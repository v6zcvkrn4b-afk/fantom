// Časová osa hry. Vše se počítá ze serverového času startu, takže
// všechny telefony odhalují polohu ve stejný okamžik.
// Fantom a detektivové mají každý vlastní rozvrh odhalení.
const MIN = 60000;

// Komu se ukazují detektivové
export const VISIBILITY = {
  all: 'Všem',
  detectives: 'Jen sobě navzájem',
  phantom: 'Jen Fantomovi',
  none: 'Nikomu',
};

// Doplní chybějící hodnoty (i pro hry založené starší verzí aplikace)
export function normalizeTimes(t = {}) {
  return {
    headStartMin: t.headStartMin ?? 5,
    chaseMin: t.chaseMin ?? 45,
    phantomEveryMin: t.phantomEveryMin ?? t.revealEveryMin ?? 5,
    detectiveEveryMin: t.detectiveEveryMin ?? t.revealEveryMin ?? 5,
    detectiveVisibility: t.detectiveVisibility ?? 'all',
    showDetectiveNames: t.showDetectiveNames ?? true,
  };
}

// Časy odhalení (ms) od začátku honičky po konec hry
function schedule(chaseStart, endAt, everyMin) {
  const out = [];
  for (let t = chaseStart; t < endAt; t += everyMin * MIN) out.push(t);
  return out;
}

// Kde jsme v rozvrhu: index posledního proběhlého odhalení (-1 = zatím žádné),
// jeho čas a čas dalšího (null, když už žádné nebude)
function track(times, now) {
  let index = -1;
  while (index + 1 < times.length && times[index + 1] <= now) index++;
  return { index, at: times[index] ?? null, nextAt: times[index + 1] ?? null };
}

// Stav hry v čase now:
//   phase: 'headstart' (náskok) | 'chase' (honička) | 'over' (vypršel čas)
//   phantom / detective: { index, at, nextAt } – detective je null, když se detektivové neukazují
export function phaseAt(now, rawTimes, startedAt) {
  const t = normalizeTimes(rawTimes);
  const chaseStart = startedAt + t.headStartMin * MIN;
  const endAt = chaseStart + t.chaseMin * MIN;
  const phase = now >= endAt ? 'over' : now >= chaseStart ? 'chase' : 'headstart';
  return {
    phase,
    chaseStart,
    endAt,
    times: t,
    phantom: track(schedule(chaseStart, endAt, t.phantomEveryMin), now),
    detective: t.detectiveVisibility === 'none' ? null : track(schedule(chaseStart, endAt, t.detectiveEveryMin), now),
  };
}

// 125000 → "2:05", 3725000 → "1:02:05"
export function formatDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// 90 → "1 h 30 min", 45 → "45 min"
export function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
