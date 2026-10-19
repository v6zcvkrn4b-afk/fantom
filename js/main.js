import { PLAYERS, LIMITS, TIMES } from './config.js';
import { pickArea, getArea } from './maps.js';
import { watchPosition } from './gps.js';
import { keepScreenOn } from './wakelock.js';
import { isInside } from './geo.js';
import { createMap } from './mapview.js';
import {
  phaseAt, formatDuration, formatMinutes, normalizeTimes, VISIBILITY,
} from './timing.js';
import { createWheel } from './wheel.js';

const $ = (id) => document.getElementById(id);

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

// Mapa: před hrou podle polohy hráče (naposledy použitá, než se poloha zjistí),
// ve hře podle toho, na jaké mapě byla hra založena.
const startArea = getArea(new URLSearchParams(window.location.search).get('mapa') || store.get('map'));
const view = createMap('map', startArea);

const state = {
  area: startArea,
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
    if (!state.game) setArea(autoArea());
    view.showMe(fix, isPhantom());
    updateGpsStatus();
    tick();
  },
  (message) => {
    $('status').classList.add('error');
    $('status').textContent = message;
  },
);

// Mapu jde vynutit v adrese, např. …/fantom/?mapa=brno (na prohlédnutí jiného města)
const forcedMap = new URLSearchParams(window.location.search).get('mapa');

function autoArea() {
  if (forcedMap) return getArea(forcedMap);
  return state.fix ? pickArea(state.fix.lat, state.fix.lng) : state.area;
}

function setArea(area) {
  if (state.area === area && $('tagline').dataset.map === area.id) return;
  state.area = area;
  view.setArea(area);
  $('tagline').textContent = area.tagline;
  $('tagline').dataset.map = area.id;
  updateGpsStatus();
}

function updateGpsStatus() {
  if (!state.fix) return;
  const inside = isInside([state.fix.lat, state.fix.lng], state.area.boundary);
  $('status').classList.toggle('error', !inside);
  $('status').textContent = `${inside ? 'V herním území' : 'MIMO území!'} · přesnost ${Math.round(state.fix.accuracy)} m`;
  const outside = isRunning() && !inside;
  $('outside').hidden = !outside;
}

$('locate').addEventListener('click', () => view.centerOnMe());
keepScreenOn();

// Na výšku: kde to prohlížeč dovolí (Android, aplikace z plochy), orientaci zamkneme.
// Safari na iPhonu zámek nepodporuje – tam hru na šířku zakryje výzva k otočení (CSS #rotate).
function lockPortrait() {
  try {
    const p = screen.orientation?.lock?.('portrait');
    if (p) p.catch(() => {});
  } catch { /* nepodporováno */ }
}
lockPortrait();
document.addEventListener('pointerdown', lockPortrait, { once: true });

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

// Upozornění na odhalení: jen zvuk a vibrace (bez vyskakovací zprávy)
function notify() {
  beep();
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
}

// ---------- Obrazovky ----------
function showScreen(name) {
  for (const id of ['home', 'lobby', 'result']) $(id).hidden = id !== name;
}

// Úvod má kroky: 'start' (výběr) → 'code' (jen při připojení) → 'name'
const home = { mode: 'create', code: null };

function showStep(step, error) {
  for (const s of ['start', 'code', 'name']) $(`step-${s}`).hidden = s !== step;
  $('home-error').hidden = !error;
  $('home-error').textContent = error || '';
  if (step === 'name') {
    if (!$('name').value) $('name').value = store.get('name') || '';
    $('name-next').textContent = home.mode === 'create' ? 'Založit hru' : 'Připojit se';
    $('name').focus();
  }
  if (step === 'code') $('code').focus();
}

function showHome(error) {
  state.game = null;
  showScreen('home');
  $('hud').hidden = true;
  $('caught').hidden = true;
  $('back-result').hidden = true;
  $('outside').hidden = true;
  renderMarkers();
  setArea(autoArea());
  showStep('start', error);
}

function homeError(message) {
  $('home-error').textContent = message;
  $('home-error').hidden = false;
}

// Spustí akci se zablokovanými tlačítky a případnou chybu ukáže pod nimi
async function busy(button, fn) {
  button.disabled = true;
  $('home-error').hidden = true;
  try {
    if (!state.api) throw new Error('ještě se připojuji k serveru');
    await fn();
  } catch (err) {
    homeError(state.api && err instanceof state.api.GameError
      ? err.message
      : `Něco se nepovedlo (${err?.code || err?.message || err}). Zkus to znovu.`);
  } finally {
    button.disabled = false;
  }
}

$('go-create').addEventListener('click', () => {
  home.mode = 'create';
  showStep('name');
});

$('go-join').addEventListener('click', () => {
  home.mode = 'join';
  showStep('code');
});

$('code-next').addEventListener('click', () => busy($('code-next'), async () => {
  const code = $('code').value.trim();
  if (!/^\d{4}$/.test(code)) {
    homeError('Kód hry má 4 číslice.');
    return;
  }
  // Ověří kód hned, ať se nepíše přezdívka zbytečně
  const alreadyIn = await state.api.checkJoinable(code, state.uid);
  home.code = code;
  if (alreadyIn) openGame(code);
  else showStep('name');
}));

$('name-next').addEventListener('click', () => busy($('name-next'), async () => {
  const name = $('name').value.trim().slice(0, 20);
  if (!name) {
    homeError('Napiš svou přezdívku.');
    return;
  }
  store.set('name', name);
  if (home.mode === 'create') {
    store.set('map', state.area.id);
    openGame(await state.api.createGame(state.uid, name, state.area.id));
  } else {
    await state.api.joinGame(home.code, state.uid, name);
    openGame(home.code);
  }
}));

$('name-back').addEventListener('click', () => showStep(home.mode === 'join' ? 'code' : 'start'));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => showStep(b.dataset.back)));

// Enter na klávesnici = pokračovat
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('code-next').click(); });
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('name-next').click(); });

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
    setArea(getArea(game.meta.mapId));
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
    $('outside').hidden = true;
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
  // Nastavení vidí všichni stejně, měnit ho může jen zakladatel
  if (!settingsUi || settingsUi.code !== state.code || settingsUi.readOnly !== !isHost) {
    settingsUi = buildSettings(!isHost);
  }
  settingsUi.update(t);
  $('settings').hidden = false;
  $('lobby-times').textContent = phantomChosen && detectives < PLAYERS.minDetectives
    ? `Doporučeno je aspoň ${PLAYERS.minDetectives} detektivů (teď ${detectives}).`
    : '';

  $('start').hidden = !isHost;
  $('start').disabled = !(phantomChosen && detectives >= 1);
  $('lobby-wait').hidden = isHost;
}

// ---------- Nastavení hry (v čekárně) ----------
// Vytvoří se jednou pro hru; při změnách z databáze se jen aktualizují hodnoty,
// aby se válečky nepřekreslovaly pod prstem. Ostatní hráči ho vidí jen pro čtení.
let settingsUi = null;

function buildSettings(readOnly) {
  const box = $('settings');
  box.replaceChildren();
  box.classList.toggle('readonly', readOnly);
  const title = document.createElement('div');
  title.className = 'set-title';
  title.textContent = readOnly ? 'Nastavení hry (určuje zakladatel ★)' : 'Nastavení hry';
  box.append(title);
  // Mapa je jen pro informaci – vybírá se podle polohy zakladatele při založení hry
  const mapRow = document.createElement('div');
  mapRow.className = 'set-row static';
  const mapLabel = document.createElement('span');
  mapLabel.textContent = 'Mapa';
  const mapValue = document.createElement('strong');
  mapRow.append(mapLabel, mapValue);
  box.append(mapRow);
  const rows = {};
  const t0 = normalizeTimes(state.game.meta.times);

  // Ukládá se vždy celé nastavení, aby prošla kontrola v pravidlech databáze
  const save = (changes) => state.api.updateTimes(state.code, { ...normalizeTimes(state.game.meta.times), ...changes })
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
      if (readOnly) return;
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

  const namesItem = document.createElement('div');
  const namesLabel = document.createElement('div');
  namesLabel.className = 'set-label';
  namesLabel.textContent = 'Jména detektivů na mapě';
  const namesSeg = document.createElement('div');
  namesSeg.className = 'segmented';
  const nameButtons = {};
  for (const [key, text] of [['show', 'Zobrazit jména'], ['hide', 'Anonymně']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => save({ showDetectiveNames: key === 'show' }));
    namesSeg.append(b);
    nameButtons[key] = b;
  }
  namesItem.append(namesLabel, namesSeg);
  box.append(namesItem);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'link';
  reset.textContent = 'Obnovit výchozí nastavení';
  reset.addEventListener('click', () => save(TIMES));
  reset.hidden = readOnly;
  box.append(reset);

  const setWheel = (w, v) => { if (w.value !== v) w.set(v); };

  return {
    code: state.code,
    readOnly,
    update(t) {
      mapValue.textContent = getArea(state.game.meta.mapId).name;
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
      namesItem.hidden = t.detectiveVisibility === 'none';
      for (const [key, b] of Object.entries(visButtons)) b.classList.toggle('active', key === t.detectiveVisibility);
      nameButtons.show.classList.toggle('active', t.showDetectiveNames);
      nameButtons.hide.classList.toggle('active', !t.showDetectiveNames);
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
  if (messages.length) notify();
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
  return '';
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
  const showNames = ended || normalizeTimes(game.meta.times).showDetectiveNames;
  const key = JSON.stringify([game.meta.status, pLimit, dLimit, seeDetectives, showNames, reveals]);
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
      if (!r) continue;
      const label = (showNames ? player.name : '') + (r.index < dLimit ? ' (starší)' : '');
      markers.push({ lat: r.lat, lng: r.lng, kind: 'detective', label: label.trim() });
    }
  }

  // Vlastní poslední odhalené polohy (kde mě naposledy viděli ostatní); živou polohu ukazuje showMe
  if (!ended) {
    if (isPhantom()) {
      const last = latestPhantom(pLimit);
      if (last) {
        const prev = latestPhantom(last.index - 1);
        if (prev) {
          markers.push({ lat: prev.lat, lng: prev.lng, kind: 'phantom', faded: true, label: 'ty – předtím' });
          lines.push([[prev.lat, prev.lng], [last.lat, last.lng]]);
        }
        markers.push({ lat: last.lat, lng: last.lng, kind: 'phantom', label: 'ty – naposledy viděn' });
      }
    } else if (tl && tl.detective) {
      const mine = latestDetective(state.uid, dLimit);
      if (mine) markers.push({ lat: mine.lat, lng: mine.lng, kind: 'detective', label: 'ty – naposledy viděn' });
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
  view.fitArea();
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
