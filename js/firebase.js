// Napojení na Firebase: anonymní přihlášení hráče a databáze pro sdílení stavu hry.
// Tyto údaje nejsou tajné, přístup k datům hlídají pravidla databáze (database.rules.json).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBNiUVHQX2Egt-sIHEZb9xvrWg8jDdzlB0',
  authDomain: 'fantom-9b24b.firebaseapp.com',
  databaseURL: 'https://fantom-9b24b-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'fantom-9b24b',
  storageBucket: 'fantom-9b24b.firebasestorage.app',
  messagingSenderId: '854758997134',
  appId: '1:854758997134:web:2189f59d8bddcd1e0b5ddf',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Rozdíl mezi hodinami telefonu a serveru, aby všichni počítali stejný čas
let serverOffset = 0;
onValue(ref(db, '.info/serverTimeOffset'), (snap) => { serverOffset = snap.val() || 0; });
export const serverNow = () => Date.now() + serverOffset;

// Přihlásí hráče (vrací jeho id) a hlásí, jestli je spojení se serverem živé.
// Kdo je přihlášený jménem a heslem, zůstane; ostatní hrají anonymně.
export async function connect(onStatus) {
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  if (onStatus) onValue(ref(db, '.info/connected'), (snap) => onStatus(snap.val() === true));
  return auth.currentUser.uid;
}
