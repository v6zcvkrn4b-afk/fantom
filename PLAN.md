# Fantom – plán vývoje

## Technické řešení
- **Webová aplikace** v prohlížeči telefonu, bez instalace, hostovaná zdarma na GitHub Pages.
- **Mapa:** Leaflet + OpenStreetMap.
- **Sdílení stavu hry mezi telefony:** Firebase Realtime Database + anonymní přihlášení (zdarma).
- **Čas hry** se řídí serverovým časem začátku hry, takže všechny telefony odhalují ve stejný okamžik.
- **Polohy se do databáze zapisují jen v okamžiku odhalení.** Nikdo tedy nemůže „podvádět“ čtením živých poloh z databáze.

## Etapy
1. ✅ Kostra projektu, GitHub repozitář a zveřejnění na GitHub Pages
2. ✅ Mapa Šumperka, hranice území, živá GPS poloha, displej se nevypíná
3. ✅ Založení Firebase (projekt fantom-9b24b), napojení do aplikace, anonymní přihlášení
4. ⬜ Lobby: založit hru → kód → připojit se → zvolit roli → start
5. ⬜ Herní smyčka: náskok, odhalení každé 4 minuty, odpočty
6. ⬜ Zobrazení na mapě: detektivové (poslední odhalení) a Fantom (poslední + předchozí)
7. ⬜ Konec hry: tlačítko „Byl jsem dopaden“, vypršení času, obrazovka s výsledkem
8. ⬜ Odchod z území (varování a případný trest)
9. ⬜ Test v terénu v Šumperku a ladění
