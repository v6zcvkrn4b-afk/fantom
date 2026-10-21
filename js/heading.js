// Kam je hráč otočený (stupně od severu po směru hodinových ručiček) – pro kužel u vlastní polohy.
// Hlavně z kompasu telefonu. Kde kompas není (nebo ho iPhone zatím nepovolil),
// podle směru chůze z GPS – ten ale funguje jen za chůze.
const COMPASS_FRESH_MS = 3000;   // kompas, který se déle neozval, nebereme
const GPS_FRESH_MS = 10000;
const MIN_SPEED = 0.7;           // m/s – pomalejší pohyb GPS nedá spolehlivý směr

let compass = null;   // { deg, at }
let listening = false;
let onChange = () => {};

const screenAngle = () => screen.orientation?.angle ?? window.orientation ?? 0;

function onOrientation(e) {
  let deg = null;
  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) deg = e.webkitCompassHeading; // iPhone
  else if (e.absolute && typeof e.alpha === 'number') deg = 360 - e.alpha;   // Android
  if (deg === null) return;
  compass = { deg: (deg + screenAngle() + 360) % 360, at: Date.now() };
  onChange();
}

function listen() {
  if (listening) return;
  listening = true;
  // Android: „absolutní“ natočení je vůči severu; iPhone posílá kompas v běžné události
  const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(type, onOrientation);
}

const needsPermission = () => typeof DeviceOrientationEvent !== 'undefined'
  && typeof DeviceOrientationEvent.requestPermission === 'function';

// Spustí kompas tam, kde nepotřebuje povolení (Android). callback se volá při každé změně.
export function startCompass(callback) {
  onChange = callback;
  if (typeof DeviceOrientationEvent !== 'undefined' && !needsPermission()) listen();
}

// iPhone: kompas smí zapnout jen ťuknutí hráče (telefon se zeptá na „pohyb a orientaci“)
export function askCompass() {
  if (!needsPermission() || listening) return;
  DeviceOrientationEvent.requestPermission()
    .then((answer) => { if (answer === 'granted') listen(); })
    .catch(() => { /* zamítnuto – zůstane směr chůze z GPS */ });
}

// Aktuální směr, nebo null (šipka se nezobrazí)
export function currentHeading(fix) {
  if (compass && Date.now() - compass.at < COMPASS_FRESH_MS) return compass.deg;
  if (fix && Number.isFinite(fix.heading) && fix.speed >= MIN_SPEED && Date.now() - fix.receivedAt < GPS_FRESH_MS) {
    return fix.heading;
  }
  return null;
}
