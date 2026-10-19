# Fantom

Mobilní hra v prohlížeči: tým detektivů se snaží dopadnout tajemného Fantoma.

**Hrát:** https://v6zcvkrn4b-afk.github.io/fantom/

## Jak hru vyzkoušet na Macu
Dvakrát klikni na soubor `spustit-lokalne.command`. Otevře se prohlížeč s hrou na adrese http://localhost:8000.

## Jak hru zveřejnit
Každá změna nahraná (push) do větve `main` se do minuty objeví na adrese výše (GitHub Pages).

## Struktura
```
index.html            vstupní stránka hry
manifest.webmanifest  nastavení pro „Přidat na plochu“ v telefonu
css/style.css         styl stránky (celá obrazovka, bez zoomu)
js/main.js            nastavení herního enginu Phaser 3
js/constants.js       rozměry herní plochy
js/scenes/            jednotlivé obrazovky hry (načítání, menu, hra)
assets/images/        obrázky a sprity
assets/audio/         hudba a zvuky
assets/fonts/         písma
icons/                ikona aplikace
```
