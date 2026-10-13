# Kalkulačka schodů – klikatelný prototyp

HTML prototyp pro doladění flow, obrazovek a výpočtu se zákazníkem před vývojem ostré verze (Next.js + PostgreSQL).
Bez backendu a bez buildu: otevřete `index.html` v prohlížeči (funguje přes `file://`). Pro mobil v DevTools nastavte 360 px.

## Demo účty
| E-mail | Heslo | Role |
|---|---|---|
| `admin@demo.cz` | `admin1234` | admin (má i jednu vlastní kalkulaci) |
| `novak@demo.cz` | `heslo1234` | podlahář (3 kalkulace) |
| `svoboda@demo.cz` | `heslo1234` | podlahář (1 kalkulace; nevidí kalkulace Nováka) |

Na přihlašovací obrazovce stačí klepnout na účet a údaje se vyplní.

## Soubory
- `index.html` – shell, `styles.css` – design a tisk (A4)
- `patterns.js` – 337 dekorů Floor Forever (vinyl, dřevo, laminát) stažených z eshop.floorforever.cz; náhledy se načítají přímo z e-shopu
- `data.js` – seed (vzory z `patterns.js`, sazby, uživatelé, vzorové kalkulace, SVG textury jako náhrada fotky)
- `plan.js` – půdorys schodiště (pohled shora) a kreslený prostorový náhled potažený vybraným vzorem, obojí jen z rozměrů skupin, bez DOM
- `calc.js` – čisté výpočetní funkce (`computeQuote`, `comparePatterns`, `groupArea`, formátování); lze ověřit v konzoli i v Node (`require('./calc.js')`)
- `store.js` – localStorage, session, číslování `RRRR-NNNN`
- `app.js` – router + guardy, přihlášení, reset hesla, pozvánka, historie, profil
- `wizard.js` – průvodce (kroky 1–4), kalkulace, PDF náhled, e-mail, porovnání vzorů
- `admin.js` – uživatelé, vzory, sazby, reset dat

(Oproti původnímu plánu je `app.js` rozdělen na tři soubory kvůli čitelnosti.)

## Výpočet
`A = š·(h + v·p)/10 000·n`, `C = ΣA·(1+r)·c_m + Σn·(c_n + p·c_p) + c_d`.
Šikmý schod: po zaškrtnutí „Šikmý schod – různá hloubka“ se zadává hloubka vlevo a vpravo a do vzorce jde jejich průměr (plocha lichoběžníku).
Typ nášlapu (s nosem / bez nosu) se volí pro celé schodiště pod typem schodiště; zaškrtnutí „Podesta“ u skupiny z ní udělá podestový nášlap (s nosem / bez nosu podle volby pro schodiště). Podstupnice se obkládá vždy, volba se ve formuláři nenabízí. Správce v Sazbách nastavuje pro každý typ složky ceny: tloušťku podkladu MDF (cena MDF je v EUR/m³ a převádí se kurzem; 12 mm při 370 EUR/m³ a kurzu 25 = 111 Kč/m²), lepidlo a práci za m² a příplatek za nášlap. Lepidlo, práce za m² a příplatek jsou zatím 0 (vstupy nejsou), kurz je ukázkový. Složky za m² se počítají z plochy skupiny bez prořezu.
Typ schodiště (rovnoramenné / pravotočivé / levotočivé) se volí pro celou kalkulaci a řídí půdorys: skupina 1 je dole, rovnoramenné schodiště se na podestě otočí o 180° a druhé rameno se vrací vedle prvního (vpravo nebo vlevo podle přepínače na kroku 1), šikmé schody stáčejí schodiště podle svých hloubek, točité schodiště má vyjít na 180° a zbytek otočení připadne na podesty (90° nebo 180°). Když 180° nevyjde, půdorys na to upozorní. Zatáčka ze šikmých schodů, která vyjde na 90° nebo 180° (± 8°), se kreslí do pravoúhlého rohu: vnější hrany schodů jdou po stěnách a rohový schod má roh navíc. Je to jen kresba, plocha do ceny se dál počítá ze zadaných hloubek.
Kreslený náhled (krok 2, kalkulace, PDF) ukazuje totéž schodiště v prostoru s vybraným vzorem na nášlapech a obkládaných podstupnicích. Je to schéma z rozměrů, ne úprava fotky zákazníka.
Řádky rozpisu se zaokrouhlují na `roundTo` (1 Kč / 10 Kč), DPH = round(základ · sazba), celkem = základ + DPH – součty vždy sedí.
Kontrolní příklad (100×30 cm, podstupnice 18 cm, 10 ks, obkládat, vzor s materiálem 1 190 Kč/m², prořez 10 %, práce 450 Kč/nášlap, MDF 12 mm): materiál 6 283 + MDF 533 + práce 4 500 + podstupnice 2 500 + doprava 1 500 = základ 15 316 Kč, DPH 21 % 3 216 Kč, **celkem 18 532 Kč**; bez obkladu podstupnice základ 10 260 Kč. Bez MDF vychází původních 17 887 Kč.

Uložená kalkulace si drží **snapshot celého ceníku**. Změna ceníku ji nezmění; „Duplikovat“ použije aktuální ceník, „Upravit“ nabídne přepočet.

## Co je v prototypu simulované
- Přihlášení, heslo (plaintext v localStorage), blokace po 5 pokusech na 15 min, „Zapamatovat si mě“ (30 dní), pozvánky a reset hesla (náhled e-mailu + „Otevřít odkaz (demo)“).
- PDF = tisk A4 stránky (`window.print()` → Uložit jako PDF). E-mail se neodesílá, jen se změní stav na Odesláno.
- Data jsou jen v prohlížeči (`localStorage`); admin může „Obnovit ukázková data“.
- Vzory jsou skutečné dekory Floor Forever, ale ceny za m² jsou jen orientační střed cenového pásma z e-shopu (dekor bez pásma má cenu nezadanou); prořez, práce a sazby jsou vymyšlené. Uložená kalkulace si do snapshotu bere jen vzory kolekce vybraného vzoru, porovnání vzorů běží v rámci kolekce.

## Mimo prototyp (ostrá verze)
Skutečná autentizace a hashování hesel, HTTPS, serverové generování PDF, odesílání e-mailů, PostgreSQL + REST API, hosting v EU, zálohy, GDPR.

## Otevřené otázky pro zadavatele
Zobrazují se jako malé štítky „? Otázka“ u místa, kterého se týkají (klepnutím se otevře text). Souhrnný panel všech otázek a „Režim prezentace“ (skryje štítky) jsou v sheetu „Prototyp“ v proužku nahoře. Tamtéž je i přepínač „Vzhled“: Auto (podle systému) / Světlý / Tmavý, volba se pamatuje.
1. Práce za kus (nášlap) vs. za m²?
2. Je podlahář plátce DPH?
3. Točité / lichoběžníkové schody a podesty.
4. Jeden podlahář vs. více firem s vlastním ceníkem.
5. E-mail/telefon zákazníka není v kroku Zakázka, ale pro odeslání je potřeba.
6. ~~Vidí admin kalkulace všech uživatelů?~~ – rozhodnuto: ano, admin vidí a může otevřít kalkulace všech podlahářů (podlahář jen své).
7. Číselná řada: společná, nebo pro každého podlaháře?
8. Má „Upravit“ držet staré ceny?
9. Volitelné příplatky (hrany, lišty, demontáž, vyrovnání) – návrh, ve výchozím stavu vypnuto (zapíná admin v Sazbách), do vzorce ze zadání nezasahuje.
