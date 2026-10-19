import { BOUNDARY, PLAYERS, TEST_TIMES } from './config.js';
import { watchPosition } from './gps.js';
import { keepScreenOn } from './wakelock.js';
import { isInside } from './geo.js';
import { createMap } from './mapview.js';
import { phaseAt, formatDuration } from './timing.js';

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
  lastRevealSeen: null, // pro upozornění na nové odhalení
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

  const t = meta.times;
  const testMode = t.chaseMin === TEST_TIMES.chaseMin && t.headStartMin === TEST_TIMES.headStartMin;
  $('test-wrap').hidden = !isHost;
  $('test-mode').checked = testMode;
  let note = `${testMode ? 'ZKUŠEBNÍ HRA · ' : ''}Náskok ${t.headStartMin} min · odhalení každé ${t.revealEveryMin} min · honička ${t.chaseMin} min.`;
  if (phantomChosen && detectives < PLAYERS.minDetectives) {
    note += ` Doporučeno je ${PLAYERS.minDetectives}–${PLAYERS.maxDetectives} detektivů (teď ${detectives}).`;
  }
  $('lobby-times').textContent = note;

  $('start').hidden = !isHost;
  $('start').disabled = !(phantomChosen && detectives >= 1 && detectives <= PLAYERS.maxDetectives);
  $('lobby-wait').hidden = isHost;
}

$('test-mode').addEventListener('change', (e) => state.api.setTestMode(state.code, e.target.checked));

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

function tick() {
  if (!isRunning()) return;
  const tl = timeline();
  if (!tl) return;
  const now = state.serverNow();
  const phantom = isPhantom();

  // Herní panel
  $('role').className = `chip ${phantom ? 'phantom' : 'detective'}`;
  $('role').textContent = phantom ? 'FANTOM' : 'DETEKTIV';
  $('phase').textContent = tl.phase === 'headstart'
    ? (phantom ? 'Náskok – utíkej a schovej se!' : 'Fantom má náskok – čekejte')
    : 'Honička';
  $('next-reveal').textContent = tl.nextRevealAt ? formatDuration(tl.nextRevealAt - now) : '—';
  $('time-left').textContent = formatDuration(tl.endAt - now);
  $('hud-note').textContent = hudNote(tl, now, phantom);

  // Nové odhalení: upozornit a zapsat vlastní polohu
  if (tl.revealIndex >= 0) {
    if (state.lastRevealSeen !== null && tl.revealIndex > state.lastRevealSeen) {
      toast(phantom ? '🔍 Odhalení! Detektivové teď vidí, kde jsi.' : '🔍 Odhalení! Podívej se, kde je Fantom.');
    }
    writeMyReveal(tl, now);
  }
  state.lastRevealSeen = tl.revealIndex;
  renderMarkers();

  // Vypršel čas → Fantom unikl
  if (tl.phase === 'over' && !state.escapeSent) {
    state.escapeSent = true;
    state.api.reportEscaped(state.code).catch(() => { state.escapeSent = false; });
  }
}

function writeMyReveal(tl, now) {
  const index = tl.revealIndex;
  const done = state.game.reveals?.[index]?.[state.uid];
  if (done || state.writing.has(index) || !state.fix) return;
  const revealAt = tl.chaseStart + index * state.game.meta.times.revealEveryMin * 60000;
  const late = now - revealAt > 30000; // telefon byl zamčený, poloha je pozdější
  state.writing.add(index);
  state.api.writeReveal(state.code, index, state.uid, state.fix, late).catch(() => state.writing.delete(index));
}

function latestReveal(uid, upTo) {
  const reveals = state.game.reveals || {};
  for (let k = upTo; k >= 0; k--) {
    if (reveals[k]?.[uid]) return { ...reveals[k][uid], index: k };
  }
  return null;
}

function hudNote(tl, now, phantom) {
  if (tl.phase === 'headstart') {
    return phantom
      ? 'Tvoje poloha se poprvé ukáže, až skončí náskok.'
      : 'Až skončí náskok, uvidíte, kde Fantom je.';
  }
  if (phantom) return 'Při každém odhalení detektivové uvidí, kde právě jsi.';
  const ph = latestReveal(state.game.meta.phantomUid, tl.revealIndex);
  if (!ph) return 'Fantomův telefon se zatím neozval.';
  if (ph.index < tl.revealIndex) return 'Fantom se při posledním odhalení neozval – ukazuji starší polohu.';
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
  const maxIndex = Math.max(-1, ...Object.keys(reveals).map(Number));
  const limit = ended ? maxIndex : (tl ? tl.revealIndex : -1);
  const key = JSON.stringify([game.meta.status, limit, reveals]);
  if (key === state.markersKey) return;
  state.markersKey = key;

  const markers = [];
  const lines = [];
  const phantomUid = game.meta.phantomUid;

  // Detektivové: poloha z posledního odhalení
  for (const [uid, player] of Object.entries(game.players)) {
    if (uid === phantomUid || uid === state.uid) continue;
    const r = latestReveal(uid, limit);
    if (r) markers.push({ lat: r.lat, lng: r.lng, kind: 'detective', label: player.name + (r.index < limit ? ' (starší)' : '') });
  }

  // Fantom: během hry poslední a předchozí odhalení, po konci celá trasa
  if (ended) {
    const trail = [];
    for (let k = 0; k <= maxIndex; k++) {
      if (reveals[k]?.[phantomUid]) trail.push({ ...reveals[k][phantomUid], index: k });
    }
    if (trail.length > 1) lines.push(trail.map((r) => [r.lat, r.lng]));
    trail.forEach((r, i) => markers.push({
      lat: r.lat, lng: r.lng, kind: 'phantom', faded: i < trail.length - 1, label: `${r.index + 1}.`,
    }));
  } else if (!isPhantom()) {
    const last = latestReveal(phantomUid, limit);
    if (last) {
      const prev = latestReveal(phantomUid, last.index - 1);
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
  const chaseStart = meta.startedAt + meta.times.headStartMin * 60000;

  $('result-icon').textContent = caught ? '🕵️' : '👻';
  $('result-title').textContent = caught ? 'Fantom dopaden!' : 'Fantom unikl!';
  let text;
  if (caught) {
    text = meta.endedAt && meta.endedAt < chaseStart
      ? `${phantomName} byl dopaden ještě během náskoku.`
      : `Detektivové dopadli Fantoma (${phantomName}) po ${formatDuration((meta.endedAt || chaseStart) - chaseStart)} honičky.`;
  } else {
    text = `${phantomName} utíkal celých ${meta.times.chaseMin} minut a nikdo ho nedopadl.`;
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
