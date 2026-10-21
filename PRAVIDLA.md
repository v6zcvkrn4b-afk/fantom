# Fantom – pravidla hry

Městská hra v reálných ulicích pro libovolný počet hráčů (doporučeno 1 Fantom a aspoň 3 detektivové).

## Mapy
- **Šumperk:** centrum a sever města, asi 2,6 km².
- **Brno:** Královo Pole a kampusy VUT (Pod Palackého vrchem včetně Fakulty chemické, FIT na Božetěchově), asi 2,5 km². Hranice vede po cestě podél vozovny z Purkyňovy na Hudcovu, Palackého třídě, Dalimilově, Božetěchově, Mojmírově nám., Košinově, Dobrovského, Hradecké, Královopolské, Technické, U vodárny, pěšinách západně od hřiště a po Kolejní.

- **Štramberk:** celé město včetně Trúby, náměstí, jeskyně Šipka, Bílé hory a Kamenárky, asi 2,2 km². Aktivní vápencový lom Kotouč je mimo území.

Mapa se vybere automaticky podle polohy toho, kdo hru zakládá (mapa, ve které je, jinak nejbližší). Připojení hráči hrají na mapě dané hry. V nastavení hry je mapa uvedená jen pro informaci. Mapu jde vynutit v adrese, např. `…/fantom/?mapa=brno` nebo `?mapa=sumperk`.

## Role
- **Fantom** (1 hráč) utíká a skrývá se.
- **Detektivové** (kolik hráčů se připojí) ho hledají a snaží se ho dopadnout. Připojit se dá jen v čekárně; po spuštění hry už ne.

## Průběh
1. Jeden hráč dá **Založit novou hru**, napíše přezdívku a dostane 4místný kód. Ostatní dají **Připojit se ke hře**, zadají kód a pak přezdívku. Bez registrace. V čekárně všichni vidí hráče i nastavení hry; zakladatel nastavení upraví, kliknutím vybere Fantoma (dalším kliknutím na Fantoma výběr zruší) a hru spustí.
2. **Náskok 5 minut:** Fantom utíká a detektivové čekají. Ničí poloha se zatím nezobrazuje.
3. **Honička 45 minut** (podle nastavení): Fantom i detektivové se pravidelně **odhalují**, každá skupina podle svého intervalu (výchozí každých 5 minut, poprvé hned po skončení náskoku):
   - detektivové uvidí přesný bod, kde byl Fantom v okamžiku odhalení,
   - polohy detektivů uvidí podle nastavení ostatní detektivové a/nebo Fantom.
4. Celkem hra trvá 50 minut (5 minut náskok + 45 minut honičky).

## Co je vidět na mapě
- **Vlastní poloha:** každý hráč vidí svou polohu vždy živě, bez ohledu na nastavení. Navíc vidí, kde ho naposledy viděli ostatní: Fantom své poslední dvě odhalené polohy, detektiv svou poslední odhalenou polohu.
- **Ostatní detektivové:** jen jejich poloha z posledního odhalení (podle nastavení, komu se ukazují).
- **Fantom:** jeho poloha z posledního odhalení a z odhalení předtím, takže je vidět směr pohybu.
- **Hranice herního území:** vyznačená na mapě.
- **Odpočet do dalšího odhalení a do konce hry.**

## Poloha v čekárně
- Telefon se na polohu sám nezeptá. Hráč, který ji ještě nepovolil, má u svého jména v čekárně tlačítko **Povolit polohu** – teprve po kliknutí se ukáže dotaz telefonu. Kdo polohu povolil už dřív, nemusí dělat nic.
- U každého hráče v čekárně je puntík: 🟢 poloha povolená a funkční, 🔴 poloha chybí.
- Když povolení selže, hráč vidí panel „Poloha NENÍ povolena – bez ní nejde hrát“ s tlačítkem **Obnovit stránku** a tlačítkem **Jak povolit polohu**, které otevře návod podle telefonu (iPhone / Android).
- Červený puntík a stejný panel „Poloha NENÍ povolena“ dostane i hráč, který má polohu zapnutou, ale ne **přesnou** (přesnost horší než 500 m – typicky vypnutá „Přesná poloha“).
- Hru nejde spustit, dokud nemají přesnou polohu všichni.
- Kdykoli jde polohu zkusit povolit znovu ťuknutím na stav polohy v horní liště.

## Konec hry
- **Detektivové vyhrají**, když se některý z nich Fantoma **fyzicky dotkne**. Fantom pak ve hře zmáčkne „Byl jsem dopaden“.
- **Fantom vyhraje**, když ho do konce 45 minut honičky nikdo nedopadne.

## Omezení
- Herní území: centrum a sever Šumperka, asi 2,6 km². Hranice vede po ulicích Reissova, J. z Poděbrad, nám. Republiky, Havlíčkova, Husovo nám., Dr. E. Beneše, Masarykovo nám., Jeremenkova, Lidická a Jesenická, pak po lesních cestách kolem Holubího vrchu a Vyhlídky a krátce přes pole zpět na Reissovu. Přesně je vyznačená na mapě ve hře. Kruhový objezd na J. z Poděbrad (Šumperk) patří celý do herního území; přes objezd na Žerotínově (Šumperk) a Hradecká × Dobrovského (Brno) vede hranice rovně po jejich horním okraji.
- Hraje se jen uvnitř vyznačeného území.
- Pohyb jen pěšky, žádná doprava (kolo, autobus, auto…). Hra to nehlídá, je to věc férovosti.
- Telefon musí mít po celou dobu hry otevřenou hru a **rozsvícený displej**, jinak se poloha neaktualizuje. Doporučujeme powerbanku.

## Nastavení hry
Zakladatel v čekárně nastaví (časy se vybírají otočnými válečky jako v Hodinách na iPhonu):
- **náskok Fantoma** (výchozí 5 min),
- **délku hry**, tj. honičky po náskoku (výchozí 45 min),
- **jak často se ukazuje Fantom** (výchozí každých 5 min),
- **komu se ukazují detektivové**: všem / jen sobě navzájem / jen Fantomovi / nikomu (výchozí všem),
- **jak často se ukazují detektivové** (výchozí každých 5 min),
- **jména detektivů na mapě**: zobrazit, nebo anonymně (výchozí zobrazit; po konci hry se jména ukážou vždy).

Na mapě jsou detektivové červeně a Fantom černě.

Na rychlé vyzkoušení stačí nastavit krátké časy, např. 1 min náskok, 5 min hra a odhalení každou minutu.

## Otevřené otázky
- Co se stane, když Fantom opustí území. Zatím hráči obrazovka jen pomalu bliká červeně (návrh: jeho poloha se detektivům ukáže okamžitě).
