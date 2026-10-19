# Fantom – poznámky k projektu

- Městská hra v reálném světě (GPS), podobná Scotland Yardu. Pravidla jsou v `PRAVIDLA.md`, plán a postup v `PLAN.md`; obojí aktualizuj při změnách.
- Uživatel není programátor: komunikuj česky, jednoduše, technická rozhodnutí dělej sám a vysvětli je stručně. Ptej se jen na pravidla a obsah.
- Stack: čisté HTML/CSS/JS (ES moduly), bez buildu a bez Node.js. Mapa je Leaflet 1.9.4 (cdnjs) + OSM dlaždice. Plánovaný backend je Firebase Realtime Database + anonymní auth.
- Herní konstanty a hranice území jsou v `js/config.js`.
- Nasazení: GitHub Pages z větve `main` (root) do repozitáře v6zcvkrn4b-afk/fantom, adresa https://v6zcvkrn4b-afk.github.io/fantom/
- GitHub CLI je v `~/.local/bin/gh`. Na Macu jsou přihlášené dva účty, pro tento projekt se používá `v6zcvkrn4b-afk` (před pushem ověř `gh auth status`).
- Lokální test: `python3 -m http.server 8000` ve složce projektu (moduly nejdou otevřít přes file://). JS logiku bez DOM jde ověřit přes `osascript -l JavaScript`.
- Omezení webu: GPS funguje jen při otevřené stránce a rozsvíceném displeji (proto `js/wakelock.js`).
