# Fantom – poznámky k projektu

- Městská hra v reálném světě (GPS), podobná Scotland Yardu. Pravidla jsou v `PRAVIDLA.md`, plán a postup v `PLAN.md`; obojí aktualizuj při změnách.
- Uživatel není programátor: komunikuj česky, jednoduše, technická rozhodnutí dělej sám a vysvětli je stručně. Ptej se jen na pravidla a obsah.
- Stack: čisté HTML/CSS/JS (ES moduly), bez buildu a bez Node.js. Mapa je Leaflet 1.9.4 (cdnjs) + OSM dlaždice. Backend: Firebase projekt `fantom-9b24b` (Spark/zdarma), Realtime Database v europe-west1 (zatím v uzamčeném režimu, pravidla se nastaví v konzoli nebo přes REST) + anonymní auth. SDK 12.19.0 z gstatic, napojení v `js/firebase.js`.
- Stránky: `index.html` (úvod), `hra.html` (hra), `mapy.html` + `mapa.html` (mapy), `profil.html` (účet). Účty: Firebase Email/Password, uživatelské jméno se převádí na falešný e-mail `klíč@fantom.example.com` (`js/account.js`), registrace = `linkWithCredential` z anonymního účtu (uid zůstává). Profil v `users/{uid}`.
- Výchozí nastavení hry je v `js/config.js`, mapy a jejich hranice v `js/maps.js` (mapa se vybírá podle polohy, ukládá se do `meta.mapId`).
- Hranice se generují skriptem nad daty z Overpass API: trasování po pojmenovaných ulicích (Dijkstra s preferencí jmen, bez tunelů), lesní úseky po pěšinách, mimo cesty Bézierův oblouk, kruhové objezdy na hranici buď celé uvnitř (oblouk o poloměru objezdu + 5 m), nebo – kde to uživatel zakreslil – tětiva přes horní okraj. Úpravy od uživatele přicházejí jako screenshoty s tyrkysovou čarou; napasovat je jde na známé body hranice (screenshot je severně orientovaný, stačí 2 body na měřítko a posun). Náhledy přes SVG + `qlmanage` (SVG dělat čtvercové, jinak se náhled deformuje).
- Nasazení: GitHub Pages z větve `main` (root) do repozitáře v6zcvkrn4b-afk/fantom, adresa https://v6zcvkrn4b-afk.github.io/fantom/
- GitHub CLI je v `~/.local/bin/gh`. Na Macu jsou přihlášené dva účty, pro tento projekt se používá `v6zcvkrn4b-afk` (před pushem ověř `gh auth status`).
- Lokální test: `python3 -m http.server 8000` ve složce projektu (moduly nejdou otevřít přes file://). JS logiku bez DOM jde ověřit přes `osascript -l JavaScript`.
- Omezení webu: GPS funguje jen při otevřené stránce a rozsvíceném displeji (proto `js/wakelock.js`).
- Pravidla databáze jsou v `database.rules.json`; nasazují se ručně vložením ve Firebase konzoli (Realtime Database → Rules → Publish). Uživatele o to po každé změně požádej.
- Ověření pravidel a toku hry: REST API (`identitytoolkit … accounts:signUp?key=…` pro anonymní token, pak `…/games/X.json?auth=TOKEN`).
