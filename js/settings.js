// Nastavení hry s válečky – v čekárně (pro hru) a v profilu (oblíbené nastavení hráče).
// Vytvoří se jednou; při změnách zvenku se jen aktualizují hodnoty (update),
// aby se válečky nepřekreslovaly pod prstem.
import { LIMITS } from './config.js';
import { formatMinutes, VISIBILITY } from './timing.js';
import { createWheel } from './wheel.js';

// box: prvek, do kterého se nastavení vykreslí
// readOnly: jen ukázat (připojení hráči v čekárně)
// title: nadpis; times: výchozí hodnoty (normalizeTimes)
// save(changes): uloží změnu, např. { chaseMin: 60 }
// showMap: řádek „Mapa“ (jen pro informaci, v čekárně)
export function createSettings(box, { readOnly = false, title, times: t0, save, showMap = false }) {
  box.replaceChildren();
  box.classList.toggle('readonly', readOnly);
  if (title) {
    const heading = document.createElement('div');
    heading.className = 'set-title';
    heading.textContent = title;
    box.append(heading);
  }
  // Mapa je jen pro informaci – vybírá se podle polohy zakladatele při založení hry
  let mapValue = null;
  if (showMap) {
    const mapRow = document.createElement('div');
    mapRow.className = 'set-row static';
    const mapLabel = document.createElement('span');
    mapLabel.textContent = 'Mapa';
    mapValue = document.createElement('strong');
    mapRow.append(mapLabel, mapValue);
    box.append(mapRow);
  }
  const rows = {};

  function addPicker(key, label, wheelDefs, help) {
    const item = document.createElement('div');
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'set-row';
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('strong');
    row.append(name, value);
    item.append(row);
    // Otazník s krátkým vysvětlením (otevře/zavře text pod řádkem, nerozbaluje váleček)
    if (help) {
      const q = document.createElement('span');
      q.className = 'help';
      q.setAttribute('role', 'button');
      q.setAttribute('aria-label', 'Vysvětlení');
      q.textContent = '?';
      const text = document.createElement('p');
      text.className = 'help-text';
      text.textContent = help;
      text.hidden = true;
      q.addEventListener('click', (e) => {
        e.stopPropagation();
        text.hidden = !text.hidden;
      });
      name.append(q);
      item.append(text);
    }
    const picker = document.createElement('div');
    picker.className = 'set-picker';
    picker.hidden = true;
    const wheels = wheelDefs.map((def) => {
      const w = createWheel(def);
      picker.append(w.el);
      return w;
    });
    // Ťuknutím se váleček rozbalí, ostatní se sbalí (jako v Nastavení na iPhonu)
    row.addEventListener('click', () => {
      if (readOnly) return;
      const open = picker.hidden;
      for (const r of Object.values(rows)) {
        r.picker.hidden = true;
        r.row.classList.remove('open');
      }
      if (open) {
        picker.hidden = false;
        row.classList.add('open');
        wheels.forEach((w) => w.sync());
      }
    });
    item.append(picker);
    box.append(item);
    rows[key] = { item, row, value, picker, wheels };
  }

  function saveChase() {
    const [h, m] = rows.chase.wheels;
    save({ chaseMin: Math.max(1, h.value * 60 + m.value) });
  }

  const every = LIMITS.everyMin;
  addPicker('chase', 'Délka hry', [
    { min: LIMITS.chaseHours[0], max: LIMITS.chaseHours[1], value: Math.floor(t0.chaseMin / 60), unit: 'h', onChange: saveChase },
    { min: 0, max: 59, value: t0.chaseMin % 60, unit: 'min', onChange: saveChase },
  ]);
  addPicker('headStart', 'Náskok Fantoma', [
    { min: LIMITS.headStartMin[0], max: LIMITS.headStartMin[1], value: t0.headStartMin, unit: 'min', onChange: (v) => save({ headStartMin: v }) },
  ], 'Čas na začátku hry, kdy Fantom utíká a schovává se. Detektivové zatím čekají a ničí poloha se ještě neukazuje. Délka hry se začne odpočítávat až po skončení náskoku.');
  addPicker('phantomEvery', 'Fantom se ukazuje každých', [
    { min: every[0], max: every[1], value: t0.phantomEveryMin, unit: 'min', onChange: (v) => save({ phantomEveryMin: v }) },
  ]);

  const visItem = document.createElement('div');
  const visLabel = document.createElement('div');
  visLabel.className = 'set-label';
  visLabel.textContent = 'Komu se ukazují detektivové';
  const seg = document.createElement('div');
  seg.className = 'segmented';
  const visButtons = {};
  for (const [key, text] of Object.entries(VISIBILITY)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => save({ detectiveVisibility: key }));
    seg.append(b);
    visButtons[key] = b;
  }
  visItem.append(visLabel, seg);
  box.append(visItem);

  addPicker('detEvery', 'Detektivové se ukazují každých', [
    { min: every[0], max: every[1], value: t0.detectiveEveryMin, unit: 'min', onChange: (v) => save({ detectiveEveryMin: v }) },
  ]);

  const namesItem = document.createElement('div');
  const namesLabel = document.createElement('div');
  namesLabel.className = 'set-label';
  namesLabel.textContent = 'Jména detektivů na mapě';
  const namesSeg = document.createElement('div');
  namesSeg.className = 'segmented';
  const nameButtons = {};
  for (const [key, text] of [['show', 'Zobrazit jména'], ['hide', 'Anonymně']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => save({ showDetectiveNames: key === 'show' }));
    namesSeg.append(b);
    nameButtons[key] = b;
  }
  namesItem.append(namesLabel, namesSeg);
  box.append(namesItem);

  const setWheel = (w, v) => { if (w.value !== v) w.set(v); };

  return {
    // t: normalizeTimes(...); mapName: text do řádku Mapa (jen se showMap)
    update(t, mapName) {
      if (mapValue) mapValue.textContent = mapName || '–';
      rows.headStart.value.textContent = formatMinutes(t.headStartMin);
      rows.chase.value.textContent = formatMinutes(t.chaseMin);
      rows.phantomEvery.value.textContent = `${t.phantomEveryMin} min`;
      rows.detEvery.value.textContent = `${t.detectiveEveryMin} min`;
      setWheel(rows.headStart.wheels[0], t.headStartMin);
      setWheel(rows.chase.wheels[0], Math.floor(t.chaseMin / 60));
      setWheel(rows.chase.wheels[1], t.chaseMin % 60);
      setWheel(rows.phantomEvery.wheels[0], t.phantomEveryMin);
      setWheel(rows.detEvery.wheels[0], t.detectiveEveryMin);
      rows.detEvery.item.hidden = t.detectiveVisibility === 'none';
      namesItem.hidden = t.detectiveVisibility === 'none';
      for (const [key, b] of Object.entries(visButtons)) b.classList.toggle('active', key === t.detectiveVisibility);
      nameButtons.show.classList.toggle('active', t.showDetectiveNames);
      nameButtons.hide.classList.toggle('active', !t.showDetectiveNames);
    },
  };
}
