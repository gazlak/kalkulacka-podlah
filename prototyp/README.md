# Kalkulačka schodů – klikatelný prototyp

HTML prototyp pro doladění flow, obrazovek a výpočtu se zákazníkem před vývojem ostré verze (Next.js + PostgreSQL).
Bez backendu a bez buildu: otevřete `index.html` v prohlížeči (funguje přes `file://`). Pro mobil v DevTools nastavte 360 px.

## Vizualizace schodů na fotce (jen s lokálním serverem)
`python3 prototyp/server.py` → http://localhost:8801. Server servíruje prototyp bez cache a na obrazovce kalkulace
umí z fotky schodů udělat vizualizaci s vybraným dekorem (Gemini, model `gemini-3.1-flash-image`, ~1 Kč, 10–20 s).
Klíč: `GEMINI_API_KEY` nebo soubor `~/.config/gemini/api_key`. Nejvýš 2 vizualizace na kalkulaci, obrázky v
`prototyp/vizualizace/` (mimo git). Testy: `python3 -m unittest prototyp/test_server.py`.
Přes `file://` karta jen oznámí, že vizualizace potřebuje server. Spec: `docs/superpowers/specs/2026-10-20-vizualizace-schodu-design.md`.

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
- `data.js` – seed (vzory z `patterns.js`, kolekce a jejich párování, sazby, uživatelé, vzorové kalkulace, SVG textury jako náhrada fotky)
- `plan.js` – půdorys schodiště (pohled shora) a kreslený prostorový náhled potažený vybraným vzorem, obojí jen z rozměrů skupin, bez DOM
- `calc.js` – čisté výpočetní funkce (`computeQuote`, `comparePatterns`, `groupArea`, formátování); lze ověřit v konzoli i v Node (`require('./calc.js')`)
- `store.js` – localStorage, session, číslování `RRRR-NNNN`
- `app.js` – router + guardy, přihlášení, reset hesla, pozvánka, historie, profil
- `wizard.js` – průvodce (kroky 1–4), kalkulace, PDF náhled, e-mail, porovnání vzorů
- `viz.js` – karta „Vizualizace na fotce“ a obrázek v PDF; `server.py` – lokální server a volání Gemini
- `admin.js` – uživatelé, vzory, kolekce (CSV export/import), sazby, reset dat

(Oproti původnímu plánu je `app.js` rozdělen na tři soubory kvůli čitelnosti.)

## Výpočet
Počítá se dvěma cestami. **Nová cesta** (ceník po kolekcích) se použije, když ceník / snapshot obsahuje `collections`. **Stará cesta** (`legacyQuote`) se použije pro uložené kalkulace bez kolekcí a počítá přesně jako dřív (`A = š·(h + v·p)/10 000·n`, `C = ΣA·(1+r)·c_m + Σn·(c_n + p·c_p) + c_d`, MDF/lepidlo/práce za m² podle typu nášlapu). Obě cesty vrací stejná pole a `lines` (řádky rozpisu), jejichž součet je mezisoučet.

Nová cesta, po krocích:
1. **Rozměr dílce** (`Calc.pieceDims`): šířka = š + přídavek na šířku, hloubka = hloubka + přídavek na hloubku (+ nos v mm, zvlášť pro MDF a vinyl), podstupnice = v + přídavek (jen když se obkládá). Šikmý schod: plocha z průměrné hloubky, počet pruhů z větší. Přídavky jsou v Sazbách (výchozí 3 cm).
2. **Plochy**: naměřená (z rozměrů zákazníka), výrobní plocha vinylu a plocha MDF (z rozměrů dílce).
3. **Lamely** (`Calc.lamellaUse`, režim „podle lamel“): pruhů na schod = ⌈hloubka / šířka lamely⌉ + ⌈podstupnice / šířka lamely⌉; když šířka dílce ≤ délka lamely, z jedné lamely vyjde ⌊délka / šířka⌋ pruhů, jinak je potřeba spoj (odřezky se použijí na nastavení) a počet lamel = ⌈pruhy · šířka / délka⌉. Spotřeba = lamely · délka · šířka lamely; prořez = spotřeba / výrobní plocha − 1. Režim „paušál“ (nebo kolekce bez rozměru lamely) použije výrobní plochu × (1 + prořez dekoru).
4. **Řádky** (každý zaokrouhlený na `roundTo`): Vinyl (spotřeba × cena kolekce), MDF (výrobní m² × (1 + rezerva) × tloušťka/1000 × EUR/m³ × kurz), Lepidlo (nános = vinyl, u 2× i MDF, × (1 + rezerva) × Kč/kg × g/m²), Práce (normohodiny podle typu nášlapu × hodinová sazba), Podstupnice (ks × normohodiny × sazba), Lišta KPV50, Vinylová hrana, Doprava, případný příplatek za typ nášlapu a volitelné příplatky. Potom sleva → základ → DPH → celkem.
5. **Lišta a hrana** (`Calc.sideRuns`): strana u zdi dostane lištu, otevřená hranu; délka strany = hloubka strany (+ podstupnice) × počet, z naměřených rozměrů. Strany se volí pro schodiště (krok 1) a lze je přepsat u skupiny; délky v bm lze na kalkulaci ručně přepsat.
6. **Chybějící ceny**: hodinová sazba (práce > 0 h), cena hrany (bm > 0), cena vinylu (0). Kalkulace ukáže „Cena není kompletní“ a chybějící položku započítá jako 0.

Kolekce (admin → Kolekce) drží cenu za m² (MOC bez DPH) a rozměr lamely; dekory cenu dědí, případně ji přepíšou vlastní. Design Stone má formáty A/B/C – formát se vybírá v kroku 2. Nabízené varianty LEPENÁ / CLICK se nastavují v Kolekcích. Ceník kolekcí jde exportovat a importovat jako CSV (`č.;kolekce;cena;délka;šířka`, náhled změn před uložením).

Kontrolní příklad (nová cesta): 100 × 30 cm, podstupnice 18 cm, 10 ks, s nosem (nos 0 mm), Authentic Oak 696 Kč/m² (lamela 1219,2 × 228,6), přídavky 3 cm, obě strany ke zdi, hodinová sazba pro ukázku 400 Kč/h, normohodiny 1 h:
dílec 103 × 33 cm, podstupnice 21 cm → 3 pruhy na schod, 30 lamel = 8,36 m² (prořez ≈ 50 % z výrobních 5,56 m²) → vinyl 5 819 + MDF (5,56 m² × 1,05 × 112,50) 657 + lepidlo (1×) 568 + práce 10 h 4 000 + podstupnice 10 h 4 000 + lišta 9,6 bm × 99 = 950 + doprava 1 500 = základ **17 494 Kč**, DPH 21 % 3 674 Kč, **celkem 21 168 Kč**. (Bez zadané hodinové sazby je základ 9 494 Kč a kalkulace upozorní na chybějící sazbu.)
Při 100 × 30 cm vychází prořez vysoký, protože z lamely 1 219 mm se při šířce dílce 1 030 mm vyřeže jen jeden pruh – to je přesně ten případ, který má zadavatel potvrdit (otázka „Spoj lamel“).

**Stará cesta – kontrolní příklad** (100×30 cm, podstupnice 18 cm, 10 ks, obkládat, materiál 1 190 Kč/m², prořez 10 %, práce 450 Kč/nášlap, MDF 12 mm): materiál 6 283 + MDF 533 + práce 4 500 + podstupnice 2 500 + doprava 1 500 = základ 15 316 Kč, DPH 21 % 3 216 Kč, **celkem 18 532 Kč**; bez MDF 17 887 Kč. Uložené kalkulace s tímto snapshotem vycházejí dál stejně.

Migrace: starší `localStorage` se při načtení jednou doplní o kolekce a nové sazby (snapshoty kalkulací se nemění).

Typ schodiště (rovnoramenné / pravotočivé / levotočivé) se volí pro celou kalkulaci a řídí půdorys: skupina 1 je dole, rovnoramenné schodiště se na podestě otočí o 180° a druhé rameno se vrací vedle prvního (vpravo nebo vlevo podle přepínače na kroku 1), šikmé schody stáčejí schodiště podle svých hloubek, točité schodiště má vyjít na 180° a zbytek otočení připadne na podesty (90° nebo 180°). Když 180° nevyjde, půdorys na to upozorní. Zatáčka ze šikmých schodů, která vyjde na 90° nebo 180° (± 8°), se kreslí do pravoúhlého rohu: vnější hrany schodů jdou po stěnách a rohový schod má roh navíc. Je to jen kresba, plocha do ceny se dál počítá ze zadaných hloubek.
Kreslený náhled (krok 2, kalkulace, PDF) ukazuje totéž schodiště v prostoru s vybraným vzorem na nášlapech a obkládaných podstupnicích. Je to schéma z rozměrů, ne úprava fotky zákazníka.
Řádky rozpisu se zaokrouhlují na `roundTo` (1 Kč / 10 Kč), DPH = round(základ · sazba), celkem = základ + DPH – součty vždy sedí.
Kontrolní příklad (100×30 cm, podstupnice 18 cm, 10 ks, obkládat, vzor s materiálem 1 190 Kč/m², prořez 10 %, práce 450 Kč/nášlap, MDF 12 mm): materiál 6 283 + MDF 533 + práce 4 500 + podstupnice 2 500 + doprava 1 500 = základ 15 316 Kč, DPH 21 % 3 216 Kč, **celkem 18 532 Kč**; bez obkladu podstupnice základ 10 260 Kč. Bez MDF vychází původních 17 887 Kč.

Uložená kalkulace si drží **snapshot celého ceníku**. Změna ceníku ji nezmění; „Duplikovat“ použije aktuální ceník, „Upravit“ nabídne přepočet.

## Co je v prototypu simulované
- Přihlášení, heslo (plaintext v localStorage), blokace po 5 pokusech na 15 min, „Zapamatovat si mě“ (30 dní), pozvánky a reset hesla (náhled e-mailu + „Otevřít odkaz (demo)“).
- PDF = tisk A4 stránky (`window.print()` → Uložit jako PDF). E-mail se neodesílá, jen se změní stav na Odesláno.
- Data jsou jen v prohlížeči (`localStorage`); admin může „Obnovit ukázková data“.
- Vzory jsou skutečné dekory Floor Forever, ceny za m² jsou ceny kolekcí vinylu Šesták (MOC bez DPH) od zadavatele; dekory bez kolekce (dřevo, laminát, Economy, Primero, Divino, XL Large) jsou skryté. Hodinová sazba a cena hrany chybí, ostatní sazby (MDF, kurz, lepidlo, lišta) jsou z podkladů a lze je upravit. Uložená kalkulace si do snapshotu bere jen vzory kolekce vybraného vzoru, porovnání vzorů běží v rámci kolekce.

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
9. Volitelné příplatky (demontáž, vyrovnání) – návrh, ve výchozím stavu vypnuto (zapíná admin v Sazbách). Lišty a hrany jsou teď pevnou součástí ceny.
10. Práce: normohodiny podle typu nášlapu a podstupnice, hodinová sazba (chybí).
11. Přídavek na nos (přesah, ohyb) pro MDF a vinyl.
12. Přídavky na ořez 3 cm pro všechny schody stejně?
13. Lepidlo 1× nebo 2× nános.
14. Nabízené varianty LEPENÁ / CLICK.
15. MOC vs. cena pro podlaháře; kurz EUR/CZK (zdroj, četnost).
16. Spoj lamel u širokých schodů.
17. Cena vinylové hrany a vedení lišty (strana u zdi / otevřená).
18. Sleva i na lišty a dopravu?
19. Grandissimo Plus: šířka lamely 228 nebo 228,6 mm.
