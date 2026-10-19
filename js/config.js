// Pravidla hry – všechny časy jsou v minutách. Podrobně viz PRAVIDLA.md.
export const RULES = {
  headStartMin: 5,       // náskok Fantoma, poloha se zatím nezobrazuje
  chaseMin: 45,          // jak dlouho musí Fantom utíkat po skončení náskoku
  revealEveryMin: 4,     // jak často se všem odhalí poloha
  minDetectives: 3,
  maxDetectives: 5,
};

// Herní město
export const CITY = {
  name: 'Šumperk',
  center: [49.9653, 16.9706], // náměstí Míru
  zoom: 15,
};

// Hranice herního území [zeměpisná šířka, délka].
// PRACOVNÍ NÁVRH: obdélník kolem centra, upřesní se podle zadání.
export const BOUNDARY = [
  [49.9750, 16.9550],
  [49.9750, 16.9850],
  [49.9570, 16.9850],
  [49.9570, 16.9550],
];
