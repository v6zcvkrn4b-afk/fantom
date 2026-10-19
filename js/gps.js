// Sledování polohy telefonu. Funguje jen přes https (nebo localhost)
// a jen dokud je stránka otevřená a obrazovka rozsvícená.
export function watchPosition(onPosition, onError) {
  if (!('geolocation' in navigator)) {
    onError('Telefon nepodporuje zjištění polohy');
    return null;
  }

  return navigator.geolocation.watchPosition(
    (p) => onPosition({
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      accuracy: p.coords.accuracy,
      time: p.timestamp,
    }),
    (err) => {
      const messages = {
        1: 'Povol přístup k poloze v nastavení prohlížeče',
        2: 'Polohu se nepodařilo zjistit',
        3: 'Zjištění polohy trvá příliš dlouho',
      };
      onError(messages[err.code] || 'Chyba GPS');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}
