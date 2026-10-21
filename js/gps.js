// Sledování polohy telefonu. Funguje jen přes https (nebo localhost)
// a jen dokud je stránka otevřená a obrazovka rozsvícená.
const OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 };

const toFix = (p) => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  heading: p.coords.heading,   // směr pohybu (stupně od severu), jen když se hráč hýbe
  speed: p.coords.speed,       // m/s
  time: p.timestamp,
});

// err.code: 1 = zakázáno, 2 = nedostupné, 3 = vypršel čas
export const GPS_MESSAGES = {
  0: 'Telefon nepodporuje zjištění polohy',
  1: 'Poloha není povolená',
  2: 'Polohu se nepodařilo zjistit',
  3: 'Zjištění polohy trvá příliš dlouho',
};

let watchId = null;

// Spustí (nebo restartuje) sledování polohy. onError dostane kód chyby.
export function watchPosition(onPosition, onError) {
  if (!('geolocation' in navigator)) {
    onError(0);
    return;
  }
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition((p) => onPosition(toFix(p)), (err) => onError(err.code), OPTIONS);
}

// Jednorázový dotaz na polohu – volat po ťuknutí na tlačítko, aby prohlížeč
// (hlavně Safari na iPhonu) znovu ukázal žádost o povolení.
export function requestPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(0);
      return;
    }
    navigator.geolocation.getCurrentPosition((p) => resolve(toFix(p)), (err) => reject(err.code), OPTIONS);
  });
}

// Stav oprávnění: 'granted' | 'denied' | 'prompt' | 'unknown' (starší prohlížeče)
export async function permissionState() {
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unknown';
  }
}
