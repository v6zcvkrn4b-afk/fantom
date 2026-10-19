// Časová osa hry. Vše se počítá ze serverového času startu, takže
// všechny telefony odhalují polohu ve stejný okamžik.
const MIN = 60000;

// Časy všech odhalení (ms) pro hru začatou v čase startedAt
export function revealTimes(times, startedAt) {
  const first = startedAt + times.headStartMin * MIN;
  const end = first + times.chaseMin * MIN;
  const out = [];
  for (let t = first; t < end; t += times.revealEveryMin * MIN) out.push(t);
  return out;
}

// Stav hry v čase now:
//   phase: 'headstart' (náskok) | 'chase' (honička) | 'over' (vypršel čas)
//   revealIndex: číslo posledního proběhlého odhalení (-1 = zatím žádné)
//   nextRevealAt, endAt: časy v ms (nextRevealAt je null, když už žádné nebude)
export function phaseAt(now, times, startedAt) {
  const reveals = revealTimes(times, startedAt);
  const chaseStart = startedAt + times.headStartMin * MIN;
  const endAt = chaseStart + times.chaseMin * MIN;
  let revealIndex = -1;
  while (revealIndex + 1 < reveals.length && reveals[revealIndex + 1] <= now) revealIndex++;
  const nextRevealAt = revealIndex + 1 < reveals.length ? reveals[revealIndex + 1] : null;
  const phase = now >= endAt ? 'over' : now >= chaseStart ? 'chase' : 'headstart';
  return { phase, revealIndex, nextRevealAt, endAt, chaseStart, revealCount: reveals.length };
}

// 125000 → "2:05", 3725000 → "1:02:05"
export function formatDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
