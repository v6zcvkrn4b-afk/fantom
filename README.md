# Fantom

Městská hra v reálných ulicích Šumperka a Brna (Královo Pole): tým detektivů se snaží dopadnout Fantoma, jehož poloha se ukazuje jen jednou za pár minut (výchozí každých 5 minut).

Pravidla: [PRAVIDLA.md](PRAVIDLA.md) · Plán vývoje: [PLAN.md](PLAN.md)

**Hrát:** https://v6zcvkrn4b-afk.github.io/fantom/

## Jak hru vyzkoušet na Macu
Dvakrát klikni na soubor `spustit-lokalne.command`. Otevře se prohlížeč s hrou na adrese http://localhost:8000.

## Jak hru zveřejnit
Každá změna nahraná (push) do větve `main` se do minuty objeví na adrese výše (GitHub Pages).

## Struktura
```
index.html            vstupní stránka (hra)
mapa.html             jen prohlížení map a hranic (bez hry)
manifest.webmanifest  nastavení pro „Přidat na plochu“ v telefonu
css/style.css         vzhled
js/main.js            obrazovky a průběh hry
js/game.js            zakládání/připojení ke hře, zápisy do databáze
js/timing.js          časová osa hry (náskok, odhalení, konec)
js/mapview.js         mapa, hranice území a značky hráčů
js/wheel.js           otočný váleček pro výběr času (jako Hodiny na iPhonu)
js/config.js          výchozí nastavení hry (časy, počty hráčů)
js/maps.js            herní mapy (Šumperk, Brno – Královo Pole) a jejich hranice
database.rules.json   pravidla databáze (vkládají se ve Firebase konzoli)
js/gps.js             sledování polohy telefonu
js/firebase.js        napojení na server (Firebase): přihlášení a databáze
js/geo.js             výpočty nad mapou (je hráč v území?)
js/wakelock.js        drží displej rozsvícený
sw.js                 service worker: vždy načte nejnovější verzi
icons/                ikona aplikace
```
