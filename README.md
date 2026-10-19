# Fantom

Městská hra v reálných ulicích: tým detektivů se snaží dopadnout Fantoma, jehož poloha se ukazuje jen každé 4 minuty.

Pravidla: [PRAVIDLA.md](PRAVIDLA.md) · Plán vývoje: [PLAN.md](PLAN.md)

**Hrát:** https://v6zcvkrn4b-afk.github.io/fantom/

## Jak hru vyzkoušet na Macu
Dvakrát klikni na soubor `spustit-lokalne.command`. Otevře se prohlížeč s hrou na adrese http://localhost:8000.

## Jak hru zveřejnit
Každá změna nahraná (push) do větve `main` se do minuty objeví na adrese výše (GitHub Pages).

## Struktura
```
index.html            vstupní stránka
manifest.webmanifest  nastavení pro „Přidat na plochu“ v telefonu
css/style.css         vzhled
js/main.js            spuštění aplikace (mapa, poloha)
js/config.js          pravidla hry (časy) a hranice herního území
js/gps.js             sledování polohy telefonu
js/geo.js             výpočty nad mapou (je hráč v území?)
js/wakelock.js        drží displej rozsvícený
icons/                ikona aplikace
```
