# Fantom – poznámky k projektu

- Mobilní webová hra o detektivech, kteří chytají Fantoma. Hraje se na výšku (portrait), ovládá se dotykem.
- Uživatel není programátor: komunikuj česky, jednoduše, technická rozhodnutí dělej sám a vysvětli je stručně.
- Stack: Phaser 3.90.0 z CDN (jsDelivr), čisté ES moduly, bez buildu a bez Node.js.
- Herní plocha má 720×1280 (`js/constants.js`) a škáluje se přes `Phaser.Scale.FIT`.
- Nasazení: GitHub Pages z větve `main` (root) do repozitáře v6zcvkrn4b-afk/fantom, adresa https://v6zcvkrn4b-afk.github.io/fantom/
- GitHub CLI je v `~/.local/bin/gh`. Na Macu jsou přihlášené dva účty, pro tento projekt se používá `v6zcvkrn4b-afk`.
- Lokální test: `python3 -m http.server 8000` ve složce projektu (moduly nejdou otevřít přes file://).
- `GameScene.js` je zatím jen testovací kostra; skutečný návrh hry se teprve připravuje.
