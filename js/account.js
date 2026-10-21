// Účet hráče: dobrovolné přihlášení uživatelským jménem a heslem.
// Uživatelské jméno je zároveň přezdívka ve hře. Firebase umí jen e-mail + heslo, proto se
// z jména udělá „e-mail“ jmeno@fantom.example.com – nikam se neposílá, slouží jen jako přihlašovací klíč
// (heslo proto nejde obnovit e-mailem).
// Profil v databázi: users/{uid}: { name, times (oblíbené nastavení hry), createdAt }
import {
  EmailAuthProvider, linkWithCredential, signInWithEmailAndPassword, signOut, signInAnonymously, updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  ref, get, set, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { auth, db, connect } from './firebase.js';
import { TIMES } from './config.js';
import { normalizeTimes } from './timing.js';

export class AccountError extends Error {}

export const NAME_MIN = 3;
export const NAME_MAX = 20;
export const PASSWORD_MIN = 6;

// Přihlašovací klíč ze jména: bez diakritiky a velkých písmen („Štěpán N.“ → „stepan-n“),
// takže se jde přihlásit i bez háčků a „Stepan“ a „Štěpán“ je tentýž účet
export function nameKey(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const emailOf = (name) => `${nameKey(name)}@fantom.example.com`;

// Vrátí očištěné jméno, nebo vyhodí chybu s vysvětlením
export function checkName(raw) {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new AccountError(`Uživatelské jméno musí mít ${NAME_MIN}–${NAME_MAX} znaků.`);
  }
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name) || nameKey(name).length < NAME_MIN) {
    throw new AccountError('Uživatelské jméno může obsahovat jen písmena, číslice, mezeru, tečku, pomlčku a podtržítko.');
  }
  return name;
}

function translate(err) {
  const messages = {
    'auth/email-already-in-use': 'Tohle uživatelské jméno už někdo používá. Vyber jiné.',
    'auth/credential-already-in-use': 'Tohle uživatelské jméno už někdo používá. Vyber jiné.',
    'auth/provider-already-linked': 'Už jsi přihlášený.',
    'auth/weak-password': `Heslo musí mít aspoň ${PASSWORD_MIN} znaků.`,
    'auth/invalid-credential': 'Špatné uživatelské jméno nebo heslo.',
    'auth/wrong-password': 'Špatné uživatelské jméno nebo heslo.',
    'auth/user-not-found': 'Špatné uživatelské jméno nebo heslo.',
    'auth/invalid-email': 'Špatné uživatelské jméno nebo heslo.',
    'auth/too-many-requests': 'Příliš mnoho pokusů. Zkus to za pár minut znovu.',
    'auth/network-request-failed': 'Nepodařilo se spojit se serverem. Zkontroluj internet.',
    'auth/operation-not-allowed': 'Přihlašování zatím není na serveru zapnuté.',
  };
  if (err instanceof AccountError) return err;
  return new AccountError(messages[err?.code] || `Něco se nepovedlo (${err?.code || err?.message || err}).`);
}

// Přihlášený hráč (ne anonymní), nebo null
export function registeredUser() {
  const user = auth.currentUser;
  return user && !user.isAnonymous ? user : null;
}

// Profil přihlášeného hráče { uid, name, times }, nebo null (hraje anonymně)
export async function loadProfile() {
  await connect();
  const user = registeredUser();
  if (!user) return null;
  const snap = await get(ref(db, `users/${user.uid}`));
  const data = snap.val() || {};
  return {
    uid: user.uid,
    name: data.name || user.displayName || '',
    times: normalizeTimes(data.times || TIMES),
  };
}

function checkPassword(password) {
  if (password.length < PASSWORD_MIN) throw new AccountError(`Heslo musí mít aspoň ${PASSWORD_MIN} znaků.`);
}

// Registrace: z anonymního hráče se stane přihlášený (zůstane mu stejné id, takže i rozehraná hra)
export async function register(rawName, password) {
  try {
    const name = checkName(rawName);
    checkPassword(password);
    await connect();
    const cred = EmailAuthProvider.credential(emailOf(name), password);
    const { user } = await linkWithCredential(auth.currentUser, cred);
    await updateProfile(user, { displayName: name });
    await set(ref(db, `users/${user.uid}`), { name, times: TIMES, createdAt: serverTimestamp() });
    return loadProfile();
  } catch (err) {
    throw translate(err);
  }
}

export async function login(rawName, password) {
  try {
    if (!rawName.trim() || !password) throw new AccountError('Vyplň uživatelské jméno i heslo.');
    await signInWithEmailAndPassword(auth, emailOf(rawName), password);
    return loadProfile();
  } catch (err) {
    throw translate(err);
  }
}

// Po odhlášení hraje dál anonymně
export async function logout() {
  await signOut(auth);
  await signInAnonymously(auth);
}

export async function saveTimes(times) {
  const user = registeredUser();
  if (!user) throw new AccountError('Nejsi přihlášený.');
  try {
    await set(ref(db, `users/${user.uid}/times`), times);
  } catch (err) {
    throw translate(err);
  }
}

// Kód hry, ve které hráč právě je (čekárna nebo běžící hra), jinak null.
// Přihlášení / odhlášení změní id hráče – z takové hry by vypadl.
export async function activeGameCode() {
  let code = null;
  try { code = localStorage.getItem('fantom.code'); } catch { /* bez uložení */ }
  if (!code) return null;
  await connect();
  try {
    const snap = await get(ref(db, `games/${code}`));
    const game = snap.val();
    const active = game?.meta && ['lobby', 'running'].includes(game.meta.status) && game.players?.[auth.currentUser.uid];
    return active ? code : null;
  } catch {
    return null;
  }
}
