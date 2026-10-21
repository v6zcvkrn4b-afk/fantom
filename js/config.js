// Výchozí nastavení hry – časy v minutách. Podrobně viz PRAVIDLA.md.
// Zakladatel je může v čekárně změnit; uloží se do databáze, aby je všechny telefony měly stejné.
export const TIMES = {
  headStartMin: 5,          // náskok Fantoma, poloha se zatím nezobrazuje
  chaseMin: 45,             // jak dlouho musí Fantom utíkat po skončení náskoku
  phantomEveryMin: 5,       // jak často se ukazuje Fantom
  detectiveEveryMin: 5,     // jak často se ukazují detektivové
  detectiveVisibility: 'all', // komu: all | detectives | phantom | none (viz VISIBILITY v timing.js)
  showDetectiveNames: true,   // jména detektivů na mapě (false = anonymně)
};

// Rozsahy válečků v nastavení
export const LIMITS = {
  headStartMin: [0, 30],
  chaseHours: [0, 3],
  everyMin: [1, 30],
};

// Počet hráčů není omezený; po spuštění hry se už nikdo nepřipojí
// Doporučený počet detektivů (jen doporučení – hru jde spustit i s jiným počtem)
export const PLAYERS = {
  minDetectives: 3,      // méně: detektivové Fantoma těžko chytí
  maxDetectives: 5,      // víc: Fantom nemá šanci
};
