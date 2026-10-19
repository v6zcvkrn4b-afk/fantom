import { BOUNDARY, PLAYERS, LIMITS } from './config.js';
import { watchPosition } from './gps.js';
import { keepScreenOn } from './wakelock.js';
import { isInside } from './geo.js';
import { createMap } from './mapview.js';
import {
  phaseAt, formatDuration, formatMinutes, normalizeTimes, VISIBILITY,
} from './timing.js';
import { createWheel } from './wheel.js';

const $ = (id) => document.getElementById(id);
const view = createMap('map');

// Uložení v telefonu (přezdívka, kód rozehrané hry). Může být nedostupné, proto try/catch.
const store = {
  get(key) {
    try { return localStorage.getItem(`fantom.${key}`); } catch { return null; }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(`fantom.${key}`);
      else localStorage.setItem(`fantom.${key}`, value);
    } catch { /* bez uložení se jen nepamatuje přezdívka */ }
  },
};

const state = {
  api: null,            // modul game.js (načte se po připojení k serveru)
  serverNow: Date.now,
  uid: null,
  code: null,
  game: null,
  unwatch: null,
  fix: null,            // poslední poloha z GPS
  lastRevealSeen: null, // { phantom, detective } – pro upozornění na nové odhalení
  markersKey: '',
  writing: new Set(),   // odhalení, která právě zapisujeme
  escapeSent: false,
  reviewing: false,     // po konci hry prohlížení trasy na mapě
};

const isPhantom = () => Boolean(state.game?.meta?.phantomUid && state.game.meta.phantomUid === state.uid);
const isRunning = () => state.game?.meta?.status === 'running';

// ---------- GPS ----------
watchPosition(
  (fix) => {
    state.fix = fix;
    view.showMe(fix, isPhantom());
    updateGpsStatus();
    tick();
  },
  (message) => {
    $('status').classList.add('error');
    $('status').textContent = message;
  },
);

function updateGpsStatus() {
  if (!state.fix) return;
  const inside = isInside([state.fix.lat, state.fix.lng], BOUNDARY);
  $('status').classList.toggle('error', !inside);
  $('status').textContent = `${inside ? 'V herním území' : 'MIMO území!'} · přesnost ${Math.round(state.fix.accuracy)} m`;
  $('warn').hidden = !(isRunning() && !inside);
}

$('locate').addEventListener('click', () => view.centerOnMe());
keepScreenOn();

// ---------- Zvuk a vibrace při odhalení ----------
// Prohlížeč dovolí přehrát zvuk až po dotyku, proto se zvuk „odemkne“ prvním ťuknutím.
let audio = null;
document.addEventListener('pointerdown', () => {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch { /* bez zvuku */ }
});

function beep() {
  if (!audio) return;
  [0, 0.35].forEach((delay) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const t = audio.currentTime + delay;
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

let toastTimer = null;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
  beep();
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
}

// ---------- Obrazovky ----------
function showScreen(name) {
  for (const id of ['home', 'lobby', 'result']) $(id).hidden = id !== name;
}

function showHome(error) {
  state.game = null;
  showScreen('home');
  $('hud').hidden = true;
  $('caught').hidden = true;
  $('back-result').hidden = true;
  $('warn').hidden = true;
  renderMarkers();
  if (!$('name').value) $('name').value = store.get('name') || '';
  $('home-error').hidden = !error;
  $('home-error').textContent = error || '';
}

function homeError(message) {
  $('home-error').textContent = message;
  $('home-error').hidden = false;
}

function readName() {
  const name = $('name').value.trim().slice(0, 20);
  if (!name) {
    homeError('Napiš svou přezdívku.');
    return null;
  }
  store.set('name', name);
  return name;
}

async function withButtons(fn) {
  const buttons = [$('create'), $('join')];
  buttons.forEach((b) => { b.disabled = true; });
  $('home-error').hidden = true;
  try {
    if (!state.api) throw new Error('ještě se připojuji k serveru');
    await fn();
  } catch (err) {
    homeError(state.api && err instanceof state.api.GameError
      ? err.message
      : `Něco se nepovedlo (${err?.code || err?.message || err}). Zkus to znovu.`);
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
  }
}

$('create').addEventListener('click', () => withButtons(async () => {
  const name = readName();
  if (!name) return;
  openGame(await state.api.createGame(state.uid, name));
}));

$('join').addEventListener('click', () => withButtons(async () => {
  const name = readName();
  if (!name) return;
  const code = $('code').value.trim();
  if (!/^\d{4}$/.test(code)) {
    homeError('Kód hry má 4 číslice.');
    return;
  }
  await state.api.joinGame(code, state.uid, name);
  openGame(code);
}));

function openGame(code) {
  if (state.unwatch) state.unwatch();
  Object.assign(state, {
    code, game: null, lastRevealSeen: null, markersKey: '', writing: new Set(), escapeSent: false, reviewing: false,
  });
  store.set('code', code);
  state.unwatch = state.api.watchGame(code, (game) => {
    if (!game || !game.meta || !game.players?.[state.uid]) {
      closeGame();
      showHome(game ? 'Už nejsi v této hře.' : 'Tahle hra už neexistuje.');
      return;
    }
    state.game = game;
    render();
  });
}

function closeGame() {
  if (state.unwatch) state.unwatch();
  state.unwatch = null;
  state.code = null;
  state.game = null;
  store.set('code', null);
}

// ---------- Vykreslení podle stavu hry ----------
function render() {
  const { meta } = state.game;
  if (state.fix) view.showMe(state.fix, isPhantom());
  updateGpsStatus();

  if (meta.status === 'lobby') {
    showScreen('lobby');
    $('hud').hidden = true;
    $('caught').hidden = true;
    renderLobby();
  } else if (meta.status === 'running') {
    showScreen(null);
    $('hud').hidden = false;
    $('caught').hidden = !isPhantom();
    $('back-result').hidden = true;
    tick();
  } else {
    $('hud').hidden = true;
    $('caught').hidden = true;
    $('warn').hidden = true;
    showScreen(state.reviewing ? null : 'result');
    $('back-result').hidden = !state.reviewing;
    renderResult();
  }
  renderMarkers();
}

function sortedPlayers() {
  return Object.entries(state.game.players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
}

function renderLobby() {
  const { meta } = state.game;
  const isHost = meta.hostUid === state.uid;
  const players = sortedPlayers();
  const detectives = players.filter(([uid]) => uid !== meta.phantomUid).length;
  const phantomChosen = Boolean(meta.phantomUid && state.game.players[meta.phantomUid]);

  $('lobby-code').textContent = state.code;
  $('lobby-hint').textContent = isHost
    ? 'Ťukni na hráče, který bude Fantom. Ostatní budou detektivové.'
    : 'Fantoma vybírá zakladatel hry (★).';

  const list = $('lobby-players');
  list.replaceChildren();
  for (const [uid, player] of players) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = player.name + (uid === state.uid ? ' (ty)' : '') + (uid === meta.hostUid ? ' ★' : '');
    const role = document.createElement('span');
    const phantom = uid === meta.phantomUid;
    role.className = `chip ${phantom ? 'phantom' : 'detective'}`;
    role.textContent = phantom ? 'FANTOM' : 'DETEKTIV';
    li.append(name, role);
    li.classList.toggle('is-phantom', phantom);
    if (isHost) {
      li.classList.add('pickable');
      li.addEventListener('click', () => state.api.setPhantom(state.code, uid));
    }
    list.append(li);
  }

  const t = normalizeTimes(meta.times);
  if (isHost) {
    if (!settingsUi || settingsUi.code !== state.code) settingsUi = buildSettings();
    settingsUi.update(t);
  }
  $('settings').hidden = !isHost;
  let note = isHost ? '' : `${describeTimes(t)} `;
  if (phantomChosen && detectives < PLAYERS.minDetectives) {
    note += `Doporučeno je ${PLAYERS.minDetectives}–${PLAYERS.maxDetectives} detektivů (teď ${detectives}).`;
  }
  $('lobby-times').textContent = note.trim();

  $('start').hidden = !isHost;
  $('start').disabled = !(phantomChosen && detectives >= 1 && detectives <= PLAYERS.maxDetectives);
  $('lobby-wait').hidden = isHost;
}

function describeTimes(t) {
  const det = t.detectiveVisibility === 'none'
    ? 'detektivové se neukazují'
    : `detektivové se ukazují ${{ all: "všem", detectives: "jen sobě navzájem", phantom: "jen Fantomovi" }[t.detectiveVisibility]} každých ${t.detectiveEveryMin} min`;
  return `Náskok ${formatMinutes(t.headStartMin)} · hra ${formatMinutes(t.chaseMin)} · Fantom se ukazuje každé ${t.phantomEveryMin} min · ${det}.`;
}

// ---------- Nastavení hry (jen zakladatel, v čekárně) ----------
// Vytvoří se jednou pro hru; při změnách z databáze se jen aktualizují hodnoty,
// aby se válečky nepřekreslovaly pod prstem.
let settingsUi = null;

function buildSettings() {
  const box = $('settings');
  box.replaceChildren();
  const rows = {};
  const t0 = normalizeTimes(state.game.meta.times);

  const save = (changes) => state.api.updateTimes(state.code, changes)
    .catch((err) => window.alert(`Nastavení se nepodařilo uložit (${err.code || err.message}).`));

  function addPicker(key, label, wheelDefs) {
    const item = document.createElement('div');
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'set-row';
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('strong');
    row.append(name, value);
    const picker = document.createElement('div');
    picker.className = 'set-picker';
    picker.hidden = true;
    const wheels = wheelDefs.map((def) => {
      const w = createWheel(def);
      picker.append(w.el);
      return w;
    });
    // Ťuknutím se váleček rozbalí, ostatní se sbalí (jako v Nastavení na iPhonu)
    row.addEventListener('click', () => {
      const open = picker.hidden;
      for (const r of Object.values(rows)) {
        r.picker.hidden = true;
        r.row.classList.remove('open');
      }
      if (open) {
        picker.hidden = false;
        row.classList.add('open');
        wheels.forEach((w) => w.sync());
      }
    });
    item.append(row, picker);
    box.append(item);
    rows[key] = { item, row, value, picker, wheels };
  }

  function saveChase() {
    const [h, m] = rows.chase.wheels;
    save({ chaseMin: Math.max(1, h.value * 60 + m.value) });
  }

  const every = LIMITS.everyMin;
  addPicker('headStart', 'Náskok Fantoma', [
    { min: LIMITS.headStartMin[0], max: LIMITS.headStartMin[1], value: t0.headStartMin, unit: 'min', onChange: (v) => save({ headStartMin: v }) },
  ]);
  addPicker('chase', 'Délka hry', [
    { min: LIMITS.chaseHours[0], max: LIMITS.chaseHours[1], value: Math.floor(t0.chaseMin / 60), unit: 'h', onChange: saveChase },
    { min: 0, max: 59, value: t0.chaseMin % 60, unit: 'min', onChange: saveChase },
  ]);
  addPicker('phantomEvery', 'Fantom se ukazuje každých', [
    { min: every[0], max: every[1], value: t0.phantomEveryMin, unit: 'min', onChange: (v) => save({ phantomEveryMin: v }) },
  ]);

  const visItem = document.createElement('div');
  const visLabel = document.createElement('div');
  visLabel.className = 'set-label';
  visLabel.textContent = 'Komu se ukazují detektivové';
  const seg = document.createElement('div');
  seg.className = 'segmented';
  const visButtons = {};
  for (const [key, text] of Object.entries(VISIBILITY)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => save({ detectiveVisibility: key }));
    seg.append(b);
    visButtons[key] = b;
  }
  visItem.append(visLabel, seg);
  box.append(visItem);

  addPicker('detEvery', 'Detektivové se ukazují každých', [
    { min: every[0], max: every[1], value: t0.detectiveEveryMin, unit: 'min', onChange: (v) => save({ detectiveEveryMin: v }) },
  ]);

  const setWheel = (w, v) => { if (w.value !== v) w.set(v); };

  return {
    code: state.code,
    update(t) {
      rows.headStart.value.textContent = formatMinutes(t.headStartMin);
      rows.chase.value.textContent = formatMinutes(t.chaseMin);
      rows.phantomEvery.value.textContent = `${t.phantomEveryMin} min`;
      rows.detEvery.value.textContent = `${t.detectiveEveryMin} min`;
      setWheel(rows.headStart.wheels[0], t.headStartMin);
      setWheel(rows.chase.wheels[0], Math.floor(t.chaseMin / 60));
      setWheel(rows.chase.wheels[1], t.chaseMin % 60);
      setWheel(rows.phantomEvery.wheels[0], t.phantomEveryMin);
      setWheel(rows.detEvery.wheels[0], t.detectiveEveryMin);
      rows.detEvery.item.hidden = t.detectiveVisibility === 'none';
      for (const [key, b] of Object.entries(visButtons)) b.classList.toggle('active', key === t.detectiveVisibility);
    },
  };
}

$('start').addEventListener('click', async () => {
  if (!window.confirm('Spustit hru? Fantom začne utíkat a běží čas.')) return;
  $('start').disabled = true;
  try {
    await state.api.startGame(state.code);
  } catch (err) {
    window.alert(`Hru se nepodařilo spustit (${err.code || err.message}).`);
    $('start').disabled = false;
  }
});

$('leave').addEventListener('click', async () => {
  const code = state.code;
  closeGame();
  showHome();
  try { await state.api.leaveGame(code, state.uid); } catch { /* hra už mohla začít */ }
});

// ---------- Průběh hry (každou sekundu) ----------
function timeline() {
  const meta = state.game?.meta;
  if (!meta?.startedAt) return null;
  return phaseAt(state.serverNow(), meta.times, meta.startedAt);
}

// Vidím (já) detektivy? Po konci hry vidí všichni všechno.
function canSeeDetectives() {
  if (!isRunning()) return true;
  const vis = normalizeTimes(state.game.meta.times).detectiveVisibility;
  return isPhantom() ? (vis === 'all' || vis === 'phantom') : (vis === 'all' || vis === 'detectives');
}

function tick() {
  if (!isRunning()) return;
  const tl = timeline();
  if (!tl) return;
  const now = state.serverNow();
  const phantom = isPhantom();
  const vis = tl.times.detectiveVisibility;
  const until = (track) => (track && track.nextAt ? formatDuration(track.nextAt - now) : '—');

  // Herní panel
  $('role').className = `chip ${phantom ? 'phantom' : 'detective'}`;
  $('role').textContent = phantom ? 'FANTOM' : 'DETEKTIV';
  $('phase').textContent = tl.phase === 'headstart'
    ? (phantom ? 'Náskok – utíkej a schovej se!' : 'Fantom má náskok – čekejte')
    : 'Honička';
  $('next-label').textContent = phantom ? 'Ukážeš se za' : 'Fantom se ukáže za';
  $('next-reveal').textContent = until(tl.phantom);
  $('time-left').textContent = formatDuration(tl.endAt - now);
  let detLabel = '';
  if (tl.detective) {
    if (phantom) detLabel = canSeeDetectives() ? 'Detektivy uvidíš za' : '';
    else detLabel = { all: 'Ukážeš se za', detectives: 'Ukážeš se ostatním detektivům za', phantom: 'Ukážeš se Fantomovi za' }[vis];
  }
  $('det-row').hidden = !detLabel;
  $('det-label').textContent = detLabel;
  $('det-reveal').textContent = until(tl.detective);
  $('hud-note').textContent = hudNote(tl, now, phantom);

  // Nová odhalení: upozornit a zapsat vlastní polohu
  const seen = state.lastRevealSeen;
  const messages = [];
  if (seen && tl.phantom.index > seen.phantom) {
    messages.push(phantom ? '🔍 Detektivové teď vidí, kde jsi.' : '🔍 Fantom odhalen! Podívej se na mapu.');
  }
  if (seen && tl.detective && tl.detective.index > seen.detective) {
    if (phantom && canSeeDetectives()) messages.push('🕵️ Vidíš, kde jsou detektivové.');
    else if (!phantom && vis === 'phantom') messages.push('👁️ Fantom teď vidí, kde jsi.');
    else if (!phantom && !messages.length) messages.push('🕵️ Polohy detektivů aktualizovány.');
  }
  if (messages.length) toast(messages.join(' '));
  state.lastRevealSeen = { phantom: tl.phantom.index, detective: tl.detective ? tl.detective.index : -1 };
  writeMyReveal(tl, now);
  renderMarkers();

  // Vypršel čas → Fantom unikl
  if (tl.phase === 'over' && !state.escapeSent) {
    state.escapeSent = true;
    state.api.reportEscaped(state.code).catch(() => { state.escapeSent = false; });
  }
}

function writeMyReveal(tl, now) {
  const reveals = state.game.reveals || {};
  const phantom = isPhantom();
  const track = phantom ? tl.phantom : tl.detective;
  if (!track || track.index < 0 || !state.fix) return;
  const kind = phantom ? 'phantom' : 'detective';
  const index = track.index;
  const done = phantom ? reveals.phantom?.[index] : reveals.detectives?.[index]?.[state.uid];
  const key = `${kind}${index}`;
  if (done || state.writing.has(key)) return;
  const late = now - track.at > 30000; // telefon byl zamčený, poloha je pozdější
  state.writing.add(key);
  state.api.writeReveal(state.code, kind, index, state.uid, state.fix, late).catch(() => state.writing.delete(key));
}

function latestPhantom(upTo) {
  const list = state.game.reveals?.phantom || {};
  for (let k = upTo; k >= 0; k--) if (list[k]) return { ...list[k], index: k };
  return null;
}

function latestDetective(uid, upTo) {
  const list = state.game.reveals?.detectives || {};
  for (let k = upTo; k >= 0; k--) if (list[k]?.[uid]) return { ...list[k][uid], index: k };
  return null;
}

const maxKey = (obj) => Math.max(-1, ...Object.keys(obj || {}).filter((k) => obj[k]).map(Number));

function hudNote(tl, now, phantom) {
  if (tl.phase === 'headstart') {
    return phantom
      ? 'Tvoje poloha se poprvé ukáže, až skončí náskok.'
      : 'Až skončí náskok, uvidíte, kde Fantom je.';
  }
  if (phantom) return 'Při každém odhalení detektivové uvidí, kde právě jsi.';
  const ph = latestPhantom(tl.phantom.index);
  if (!ph) return 'Fantomův telefon se zatím neozval.';
  if (ph.index < tl.phantom.index) return 'Fantom se při posledním odhalení neozval – ukazuji starší polohu.';
  return `Fantom naposledy viděn před ${formatDuration(now - ph.t)}${ph.late ? ' (poloha se zpozdila)' : ''}.`;
}

// ---------- Značky na mapě ----------
function renderMarkers() {
  const game = state.game;
  if (!game || game.meta.status === 'lobby') {
    if (state.markersKey !== 'none') view.showPlayers([]);
    state.markersKey = 'none';
    return;
  }
  const ended = !isRunning();
  const tl = timeline();
  const reveals = game.reveals || {};
  const pLimit = ended ? maxKey(reveals.phantom) : (tl ? tl.phantom.index : -1);
  const dLimit = ended ? maxKey(reveals.detectives) : (tl && tl.detective ? tl.detective.index : -1);
  const seeDetectives = canSeeDetectives();
  const key = JSON.stringify([game.meta.status, pLimit, dLimit, seeDetectives, reveals]);
  if (key === state.markersKey) return;
  state.markersKey = key;

  const markers = [];
  const lines = [];
  const phantomUid = game.meta.phantomUid;

  // Detektivové: poloha z jejich posledního odhalení (jen když je smím vidět)
  if (seeDetectives) {
    for (const [uid, player] of Object.entries(game.players)) {
      if (uid === phantomUid || uid === state.uid) continue;
      const r = latestDetective(uid, dLimit);
      if (r) markers.push({ lat: r.lat, lng: r.lng, kind: 'detective', label: player.name + (r.index < dLimit ? ' (starší)' : '') });
    }
  }

  // Fantom: během hry poslední a předchozí odhalení, po konci celá trasa
  if (ended) {
    const trail = [];
    for (let k = 0; k <= pLimit; k++) {
      if (reveals.phantom?.[k]) trail.push({ ...reveals.phantom[k], index: k });
    }
    if (trail.length > 1) lines.push(trail.map((r) => [r.lat, r.lng]));
    trail.forEach((r, i) => markers.push({
      lat: r.lat, lng: r.lng, kind: 'phantom', faded: i < trail.length - 1, label: `${r.index + 1}.`,
    }));
  } else if (!isPhantom()) {
    const last = latestPhantom(pLimit);
    if (last) {
      const prev = latestPhantom(last.index - 1);
      if (prev) {
        markers.push({ lat: prev.lat, lng: prev.lng, kind: 'phantom', faded: true, label: 'předtím' });
        lines.push([[prev.lat, prev.lng], [last.lat, last.lng]]);
      }
      markers.push({ lat: last.lat, lng: last.lng, kind: 'phantom', label: 'Fantom' });
    }
  }
  view.showPlayers(markers, lines);
}

// ---------- Konec hry ----------
function renderResult() {
  const { meta, players } = state.game;
  const phantomName = players[meta.phantomUid]?.name || 'Fantom';
  const caught = meta.status === 'caught';
  const phantom = isPhantom();
  const times = normalizeTimes(meta.times);
  const chaseStart = meta.startedAt + times.headStartMin * 60000;

  $('result-icon').textContent = caught ? '🕵️' : '👻';
  $('result-title').textContent = caught ? 'Fantom dopaden!' : 'Fantom unikl!';
  let text;
  if (caught) {
    text = meta.endedAt && meta.endedAt < chaseStart
      ? `${phantomName} byl dopaden ještě během náskoku.`
      : `Detektivové dopadli Fantoma (${phantomName}) po ${formatDuration((meta.endedAt || chaseStart) - chaseStart)} honičky.`;
  } else {
    text = `${phantomName} utíkal celou hru (${formatMinutes(times.chaseMin)}) a nikdo ho nedopadl.`;
  }
  const verdict = phantom ? (caught ? 'Tentokrát to nevyšlo.' : 'Vyhrál jsi!') : (caught ? 'Vyhráli jste!' : 'Tentokrát vám utekl.');
  $('result-text').textContent = `${text} ${verdict}`;
}

$('caught').addEventListener('click', async () => {
  if (!window.confirm('Opravdu tě detektiv chytil? Hra tím pro všechny skončí.')) return;
  try {
    await state.api.reportCaught(state.code);
  } catch (err) {
    window.alert(`Nepodařilo se odeslat (${err.code || err.message}). Zkus to znovu.`);
  }
});

$('show-map').addEventListener('click', () => {
  state.reviewing = true;
  render();
  view.map.fitBounds(BOUNDARY, { padding: [20, 20] });
});

$('back-result').addEventListener('click', () => {
  state.reviewing = false;
  render();
});

$('new-game').addEventListener('click', () => {
  closeGame();
  showHome();
});

setInterval(tick, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });

// ---------- Připojení k serveru ----------
const serverEl = $('server');
function setOnline(online) {
  serverEl.classList.toggle('online', online);
  serverEl.classList.toggle('offline', !online);
  serverEl.title = online ? 'Připojeno k serveru' : 'Bez spojení se serverem';
}

showHome();
(async () => {
  try {
    // Firebase se načítá zvlášť, aby mapa fungovala, i kdyby se server nepodařilo načíst
    const fb = await import('./firebase.js');
    state.api = await import('./game.js');
    state.serverNow = fb.serverNow;
    state.uid = await fb.connect(setOnline);
  } catch (err) {
    setOnline(false);
    showHome(`Nepodařilo se připojit k serveru (${err.code || err.message}). Zkontroluj internet a obnov stránku.`);
    return;
  }
  const saved = store.get('code');
  if (saved) openGame(saved);
})();

// Zajistí, že se po každé změně hry načte nejnovější verze
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
}
