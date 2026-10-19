// Otočný váleček pro výběr čísla, jako v aplikaci Hodiny na iPhonu.
// Funguje přes nativní scrollování se „zacvaknutím“ (scroll-snap) a 3D natočením položek.
const ITEM = 40;     // výška jedné položky (px), musí odpovídat CSS .wheel-item
const VISIBLE = 5;   // počet viditelných položek

export function createWheel({ min, max, value, unit, onChange }) {
  const values = [];
  for (let v = min; v <= max; v++) values.push(v);

  const root = document.createElement('div');
  root.className = 'wheel';
  const list = document.createElement('div');
  list.className = 'wheel-list';
  const items = values.map((v) => {
    const el = document.createElement('div');
    el.className = 'wheel-item';
    el.textContent = v;
    el.addEventListener('click', () => list.scrollTo({ top: indexOf(v) * ITEM, behavior: 'smooth' }));
    list.append(el);
    return el;
  });
  root.append(list);
  if (unit) {
    const u = document.createElement('span');
    u.className = 'wheel-unit';
    u.textContent = unit;
    root.append(u);
  }

  let current = value;
  let touching = false;
  let settleTimer = null;

  function indexOf(v) {
    const i = values.indexOf(v);
    if (i >= 0) return i;
    return v < min ? 0 : values.length - 1;
  }

  // Natočení a průhlednost položek podle vzdálenosti od středu
  function paint() {
    const center = list.scrollTop / ITEM;
    items.forEach((el, i) => {
      const d = i - center;
      if (Math.abs(d) > VISIBLE) return;
      const angle = Math.max(-80, Math.min(80, d * 20));
      el.style.transform = `rotateX(${-angle}deg)`;
      el.style.opacity = String(Math.max(0.2, 1 - Math.abs(d) * 0.3));
    });
  }

  list.addEventListener('scroll', () => {
    requestAnimationFrame(paint);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const v = values[Math.max(0, Math.min(values.length - 1, Math.round(list.scrollTop / ITEM)))];
      if (!touching && v !== current) {
        current = v;
        onChange(v);
      }
    }, 150);
  }, { passive: true });
  list.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  list.addEventListener('touchend', () => { touching = false; list.dispatchEvent(new Event('scroll')); }, { passive: true });

  return {
    el: root,
    get value() { return current; },
    // Nastaví hodnotu zvenku (např. když ji změnil jiný telefon) – ne během točení prstem
    set(v) {
      if (touching) return;
      current = v;
      list.scrollTop = indexOf(v) * ITEM;
      paint();
    },
    // Po zobrazení (z hidden) je potřeba znovu nastavit pozici
    sync() {
      list.scrollTop = indexOf(current) * ITEM;
      paint();
    },
  };
}
