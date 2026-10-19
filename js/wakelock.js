// Drží obrazovku rozsvícenou, aby telefon průběžně posílal polohu.
// Prohlížeč zámek uvolní, když se stránka schová, proto ho po návratu obnovíme.
let lock = null;

async function request() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch {
    // Např. úsporný režim baterie – hra poběží dál, jen může zhasnout displej.
  }
}

export function keepScreenOn() {
  request();
  document.addEventListener('visibilitychange', () => { if (!lock) request(); });
  // Některé prohlížeče povolí zámek až po prvním dotyku
  document.addEventListener('pointerdown', () => { if (!lock) request(); }, { once: true });
}
