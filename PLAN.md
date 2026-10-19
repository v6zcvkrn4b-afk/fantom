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
4. ✅ Lobby: založit hru → kód → připojit se → zvolit roli → start
5. ✅ Herní smyčka: náskok, odhalení každé 4 minuty, odpočty
6. ✅ Zobrazení na mapě: detektivové (poslední odhalení) a Fantom (poslední + předchozí)
7. ✅ Konec hry: tlačítko „Byl jsem dopaden“, vypršení času, obrazovka s výsledkem
8. ⬜ Odchod z území: zatím jen varování hráči, trest se ještě nerozhodl
9. ⬜ Zkušební hra (zkrácené časy) a test v terénu v Šumperku

## Jak hra funguje technicky
- `js/timing.js`: časová osa (náskok, odhalení, konec) ze serverového času startu.
- `js/game.js`: zakládání a připojování ke hře a zápisy do databáze.
- `database.rules.json`: pravidla databáze. **Po každé změně je potřeba je vložit ve Firebase konzoli** (Realtime Database → Rules → Publish).
- Každý telefon v okamžiku odhalení zapíše svou polohu do `reveals/{číslo}/{uid}`. Když byl telefon zamčený, zapíše ji hned po odemčení a označí ji jako zpožděnou.
- Konec: Fantom zmáčkne „Byl jsem dopaden“, nebo po vypršení času kterýkoli telefon zapíše „unikl“ (pravidla to dřív nepovolí).
