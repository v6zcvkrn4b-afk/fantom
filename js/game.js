// Operace se hrou v databázi. Struktura jedné hry:
// games/{kód}/
//   meta:    { hostUid, status: lobby|running|caught|escaped, mapId, times, phantomUid, startedAt, endedAt }
//   players: { uid: { name, joinedAt } }
//   reveals: { phantom:    { číslo odhalení: { lat, lng, acc, t, late } },
//              detectives: { číslo odhalení: { uid: { lat, lng, acc, t, late } } } }
// Polohy se zapisují JEN v okamžiku odhalení, takže živé polohy nikdo jiný nevidí.
import {
  ref, get, set, update, remove, onValue, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { db } from './firebase.js';
import { TIMES } from './config.js';

const gameRef = (code, path = '') => ref(db, `games/${code}${path ? '/' + path : ''}`);

export class GameError extends Error {}

function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// mapId = null: zakladatel zatím nemá polohu, mapa se doplní později (setMap)
export async function createGame(uid, name, mapId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await get(gameRef(code, 'meta'));
    if (existing.exists()) continue;
    await set(gameRef(code, 'meta'), {
      hostUid: uid,
      status: 'lobby',
      ...(mapId ? { mapId } : {}),
      times: TIMES,
      createdAt: serverTimestamp(),
    });
    await set(gameRef(code, `players/${uid}`), { name, joinedAt: serverTimestamp() });
    return code;
  }
  throw new GameError('Nepodařilo se vytvořit hru, zkus to znovu.');
}

// Ověří, že se ke hře dá připojit. Vrací true, když v ní hráč už je (návrat do hry).
export async function checkJoinable(code, uid) {
  const snap = await get(gameRef(code));
  if (!snap.exists() || !snap.val().meta) throw new GameError('Hra s tímto kódem neexistuje.');
  const game = snap.val();
  const players = game.players || {};
  if (players[uid]) return true;
  if (game.meta.status !== 'lobby') throw new GameError('Tahle hra už běží nebo skončila – připojit se dá jen před startem.');
  return false;
}

export async function joinGame(code, uid, name) {
  if (await checkJoinable(code, uid)) return;
  await set(gameRef(code, `players/${uid}`), { name, joinedAt: serverTimestamp() });
}

// Odchod z čekárny. Odchází-li zakladatel, předá roli tomu, kdo se připojil nejdřív
// (musí to udělat dřív, než ze hry zmizí – jen zakladatel smí měnit údaje hry).
export async function leaveGame(code, uid) {
  const snap = await get(gameRef(code));
  const game = snap.val();
  if (game?.meta?.hostUid === uid && game.meta.status === 'lobby') {
    const next = Object.entries(game.players || {})
      .filter(([id]) => id !== uid)
      .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0))[0];
    if (next) {
      const changes = { hostUid: next[0] };
      if (game.meta.phantomUid === uid) changes.phantomUid = null;
      await update(gameRef(code, 'meta'), changes);
    }
  }
  await remove(gameRef(code, `players/${uid}`));
}

// Sleduje celou hru, callback dostane aktuální data (nebo null, když hra neexistuje)
export function watchGame(code, callback) {
  return onValue(gameRef(code), (snap) => callback(snap.val()));
}

// V čekárně: má hráč povolenou a funkční polohu?
export function setGpsReady(code, uid, ok) {
  return update(gameRef(code, `players/${uid}`), { gps: ok });
}

export function setMap(code, mapId) {
  return update(gameRef(code, 'meta'), { mapId });
}

// uid = null zruší výběr Fantoma
export function setPhantom(code, uid) {
  return update(gameRef(code, 'meta'), { phantomUid: uid });
}

// Změna nastavení hry v čekárně (jen zakladatel), např. { chaseMin: 60 }
export function updateTimes(code, changes) {
  return update(gameRef(code, 'meta/times'), changes);
}

export function startGame(code) {
  return update(gameRef(code, 'meta'), { status: 'running', startedAt: serverTimestamp() });
}

// kind: 'phantom' | 'detective'
export function writeReveal(code, kind, index, uid, fix, late) {
  const path = kind === 'phantom' ? `reveals/phantom/${index}` : `reveals/detectives/${index}/${uid}`;
  return set(gameRef(code, path), {
    lat: fix.lat,
    lng: fix.lng,
    acc: Math.round(fix.accuracy),
    t: serverTimestamp(),
    late: Boolean(late),
  });
}

export function reportCaught(code) {
  return update(gameRef(code, 'meta'), { status: 'caught', endedAt: serverTimestamp() });
}

export function reportEscaped(code) {
  return update(gameRef(code, 'meta'), { status: 'escaped', endedAt: serverTimestamp() });
}
