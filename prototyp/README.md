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
- `seed-db.js` – výchozí data = snapshot lokální DB (`SEED_DB`, `SEED_VERSION`); používá se při prázdném úložišti, po změně `SEED_VERSION` a při Admin → Reset dat. Přegenerování: v konzoli prototypu spustit `const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([localStorage.getItem('kp_db_v2')],{type:'application/json'}));a.download='kp_db.json';a.click()`, pak `var SEED_DB` přepsat obsahem souboru (`tokens: {}`, bez `seedVersion`) a zvýšit `SEED_VERSION`
- `data.js` – záložní seed, když `seed-db.js` chybí (vzory z `patterns.js`, kolekce a jejich párování, sazby, uživatelé, vzorové kalkulace, SVG textury jako náhrada fotky)
- `plan.js` – půdorys schodiště (pohled shora) a kreslený prostorový náhled potažený vybraným vzorem, obojí jen z rozměrů skupin, bez DOM
- `calc.js` – čisté výpočetní funkce (`computeQuote`, `comparePatterns`, `groupArea`, formátování); lze ověřit v konzoli i v Node (`require('./calc.js')`)
- `store.js` – localStorage, session, číslování `RRRR-NNNN`
- `app.js` – router + guardy, přihlášení, reset hesla, pozvánka, historie, profil
- `wizard.js` – průvodce (kroky 1–5: Fotografie, Schody, Vzor, Zakázka, Kalkulace), kalkulace, PDF náhled, e-mail, porovnání vzorů
- `admin.js` – uživatelé, vzory, kolekce (CSV export/import), sazby, reset dat

(Oproti původnímu plánu je `app.js` rozdělen na tři soubory kvůli čitelnosti.)

## Výpočet
Počítá se dvěma cestami. **Nová cesta** (ceník po kolekcích) se použije, když ceník / snapshot obsahuje `collections`. **Stará cesta** (`legacyQuote`) se použije pro uložené kalkulace bez kolekcí a počítá přesně jako dřív (`A = š·(h + v·p)/10 000·n`, `C = ΣA·(1+r)·c_m + Σn·(c_n + p·c_p) + c_d`, MDF/lepidlo/práce za m² podle typu nášlapu). Obě cesty vrací stejná pole a `lines` (řádky rozpisu), jejichž součet je mezisoučet.

Nová cesta, po krocích:
1. **Rozměr dílce** (`Calc.pieceDims`): podlahář u všech schodů stejně (bez přepínače) měří největší délku, kolmici na ni (hloubku) a výšku podstupnice; u točitého schodu je délka úhlopříčka. Dílec je obdélník z desky, ze které se tvar dořízne. Rezerva na ořez (`rates.cut`, Sazby → Rezerva na ořez) je zvlášť pro vinyl a MDF: nášlap L × (H + rezerva), podstupnice vinyl L × R (bez přídavku), MDF podstupnice 2 × (R + přídavek); délka je bez přídavku. Výchozí hodnoty: vinyl 136 mm bez nosu / 126 mm s nosem; MDF 136 / 126 / 50 mm. Starší plochý tvar `rates.cut` se při načtení převede (vinyl bez přídavku, MDF s `mdfRiserMm`). Rezerva zvětšuje plochu, a tedy i cenu, ale podlahář ji nevidí: v průvodci a ve výpisu se neukazuje, detail pro admina ukazuje schody po jednom s rozměry k nářezu (+ rezerva v mm) a v rozpisu u vinylu „vč. rezervy na ořez“. PDF ukazuje jen celkovou plochu. `rates.cutMargin` (3 cm na stranu) a `allowance` zůstaly jen pro staré uložené snapshoty, které se počítají postaru. Typ schodu (Rovný / Šikmý · rohový, volba u skupiny) je zatím jen informativní, cenu nemění. Půdorys a 3D náhled (`plan.js`) točité schodiště zatím kreslí špatně (bez `depthRight` jako rovné).
2. **Plochy**: naměřená (z rozměrů zákazníka), výrobní plocha vinylu a plocha MDF (z rozměrů dílce).
3. **Lamely** (`Calc.lamellaUse`, režim „podle lamel“): pruhů na schod = ⌈hloubka / šířka lamely⌉ + ⌈podstupnice / šířka lamely⌉; když šířka dílce ≤ délka lamely, z jedné lamely vyjde ⌊délka / šířka⌋ pruhů, jinak je potřeba spoj (odřezky se použijí na nastavení) a počet lamel = ⌈pruhy · šířka / délka⌉. Spotřeba = lamely · délka · šířka lamely; prořez = spotřeba / výrobní plocha − 1. Režim „paušál“ (nebo kolekce bez rozměru lamely) použije výrobní plochu × (1 + prořez dekoru).
4. **Řádky** (každý zaokrouhlený na `roundTo`): Vinyl (spotřeba × cena kolekce), MDF (výrobní m² × (1 + rezerva) × tloušťka/1000 × EUR/m³ × kurz), Lepidlo (nános = vinyl, u 2× i MDF, × (1 + rezerva) × Kč/kg × g/m²), Práce (normohodiny podle typu nášlapu × hodinová sazba), Podstupnice (ks × normohodiny × sazba), Lišta KPV50, Vinylová hrana, Doprava, případný příplatek za typ nášlapu a volitelné příplatky. Potom sleva → základ → DPH → celkem.
5. **Lišta a hrana** (`Calc.sideRuns`): strana u zdi dostane lištu, otevřená hranu; délka strany = hloubka strany (+ podstupnice) × počet, z naměřených rozměrů. Strany se volí u každé skupiny (krok Schody; nová skupina převezme strany předchozí, stará kalkulace s globálním `stairSide` ho převezme do skupin); délky v bm lze na kalkulaci ručně přepsat.
6. **Hodinová sazba** je výchozí 400 Kč/h (práce je v Rozpisu, který vidí jen admin). **Vinyl −50 %** (`rates.vinylInfoPct`, `quote.vinylInfo`) je jen informativní řádek v Rozpisu pro admina, do ceny ani PDF nejde. Kolekce existují jen pro vinyl (dekory dřevo a laminát mají `collectionId: null`, jsou neaktivní).
7. **Chybějící ceny**: hodinová sazba (práce > 0 h), cena hrany (bm > 0), cena vinylu (0). Kalkulace ukáže „Cena není kompletní“ a chybějící položku započítá jako 0.

Kolekce (admin → Kolekce) drží cenu za m² (MOC bez DPH) a rozměr lamely; dekory cenu dědí, případně ji přepíšou vlastní. Design Stone má formáty A/B/C – formát se vybírá v kroku 3. Nabízené varianty LEPENÁ / CLICK se nastavují v Kolekcích. Každá karta Sazeb má poznámku Výpočet (`how()` v admin.js). Při změně vzorce v calc.js ji aktualizovat. Ceník kolekcí jde exportovat a importovat jako CSV (`č.;kolekce;cena;délka;šířka`, náhled změn před uložením).

Kontrolní příklad (nová cesta): 100 × 30 cm, podstupnice 18 cm, 10 ks, s nosem (nos 0 mm), Authentic Oak 696 Kč/m² (lamela 1219,2 × 228,6), rezerva 126 mm, obě strany ke zdi, hodinová sazba pro ukázku 400 Kč/h, normohodiny 1 h:
vinylový nášlap 100 × 42,6 cm, vinylová podstupnice 100 × 18 cm, MDF podstupnice 100 × 28 cm → 3 pruhy na schod, 30 lamel = 8,36 m² (prořez ≈ 38 % z výrobních 6,06 m²) → vinyl 5 819 + MDF (7,06 m² × 1,05 × 112,50) 834 + lepidlo (1×) 618 + práce 10 h 4 000 + podstupnice 10 h 4 000 + lišta 9,6 bm × 99 = 950 + doprava 1 500 = základ **17 721 Kč**, DPH 21 % 3 721 Kč, **celkem 21 442 Kč**. Bez nosu je nášlap 100 × 43,6 cm. (Bez zadané hodinové sazby je základ 9 721 Kč a kalkulace upozorní na chybějící sazbu.)
Při 100 × 30 cm vychází prořez vysoký, protože z lamely 1 219 mm se při šířce dílce 1 000 mm vyřeže jen jeden pruh – to je přesně ten případ, který má zadavatel potvrdit (otázka „Spoj lamel“).

**Stará cesta – kontrolní příklad** (100×30 cm, podstupnice 18 cm, 10 ks, obkládat, materiál 1 190 Kč/m², prořez 10 %, práce 450 Kč/nášlap, MDF 12 mm): materiál 6 283 + MDF 533 + práce 4 500 + podstupnice 2 500 + doprava 1 500 = základ 15 316 Kč, DPH 21 % 3 216 Kč, **celkem 18 532 Kč**; bez MDF 17 887 Kč. Uložené kalkulace s tímto snapshotem vycházejí dál stejně.

Migrace: starší `localStorage` se při načtení jednou doplní o kolekce a nové sazby (snapshoty kalkulací se nemění).

Typ schodiště (rovnoramenné / pravotočivé / levotočivé, `c.stairType`) je v průvodci skrytý spolu s náhledy (`SHOW_DRAWINGS`); při jejich zapnutí vrátit volbu. Řídí půdorys: skupina 1 je dole, rovnoramenné schodiště je jedno rovné rameno, šikmé schody stáčejí schodiště podle svých hloubek, točité schodiště má vyjít na 180°. Když 180° nevyjde, půdorys na to upozorní. Zatáčka ze šikmých schodů, která vyjde na 90° nebo 180° (± 8°), se kreslí do pravoúhlého rohu: vnější hrany schodů jdou po stěnách a rohový schod má roh navíc. Je to jen kresba, plocha do ceny se dál počítá ze zadaných hloubek.
Kreslený náhled (krok 3, kalkulace, PDF) ukazuje totéž schodiště v prostoru s vybraným vzorem na nášlapech a obkládaných podstupnicích. Je to schéma z rozměrů, ne úprava fotky zákazníka.
Řádky rozpisu se zaokrouhlují na `roundTo` (1 Kč / 10 Kč), DPH = round(základ · sazba), celkem = základ + DPH – součty vždy sedí.
Kontrolní příklad (100×30 cm, podstupnice 18 cm, 10 ks, obkládat, vzor s materiálem 1 190 Kč/m², prořez 10 %, práce 450 Kč/nášlap, MDF 12 mm): materiál 6 283 + MDF 533 + práce 4 500 + podstupnice 2 500 + doprava 1 500 = základ 15 316 Kč, DPH 21 % 3 216 Kč, **celkem 18 532 Kč**; bez obkladu podstupnice základ 10 260 Kč. Bez MDF vychází původních 17 887 Kč.

Uložená kalkulace si drží **snapshot celého ceníku**. Změna ceníku ji nezmění; „Duplikovat“ použije aktuální ceník, „Upravit“ nabídne přepočet.

**Historie verzí** (jen admin, „⋯ → Historie verzí“): při předání ke zpracování se uloží nesmazatelná verze „Původní od podlaháře“; při každém otevření kalkulace adminem se těsně před první změnou uloží „Před úpravami“ (max. 10). „Obnovit“ vrátí obsah kalkulace včetně snapshotu ceníku, ale ne fotky, číslo ani stav; aktuální stav se před tím uloží jako „Před obnovením“. Duplikát začíná bez historie.

## Role a práva
- **Podlahář**: zadá schody, vybere vzor, vyplní zakázku a vidí jen **Celkem s DPH** (bez rozpisu, ceny za m², slevy, DPH, lišt, PDF). Na detailu vidí fotky, půdorys, náhled, zakázku a stručný výpis schodů. Tlačítkem **Odeslat ke zpracování** předá kalkulaci správci (stav „Ke zpracování“) a pak ji už neupravuje; může ji jen duplikovat.
- **Admin**: vidí celý rozpis a schody po jednom s rozměry k nářezu, smí upravit kalkulaci kteréhokoli podlaháře (schody, vzor, slevu, DPH, lišty, přepočet ceníku), vygenerovat PDF a odeslat ji zákazníkovi e-mailem (stav „Odesláno“), pak označit přijato / zamítnuto. Ceník se dál spravuje globálně v Sazbách.
- **Úprava kalkulace**: admin otevře kalkulaci (i novou a rozpracovanou) na jedné stránce `#/calc/id` – schody, vzor, zakázka, fotky, lišty, sleva a DPH se upravují hned a cena s rozpisem se přepočítává živě (na počítači v pravém, přilepeném sloupci). Podlahář jde dál průvodcem v 5 krocích.
- Tok stavů: koncept → (podlahář) ke zpracování → (admin, e-mail) odesláno → přijato / zamítnuto.
- Práva jsou v prototypu jen v UI (data jsou v `localStorage`). **V ostré verzi musí server rozpis ceny podlaháři vůbec neposílat z API** a PDF, e-mail a změny cizích kalkulací povolit jen adminovi.

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
3. Točité / lichoběžníkové schody.
4. Jeden podlahář vs. více firem s vlastním ceníkem.
5. E-mail/telefon zákazníka není v kroku Zakázka, ale pro odeslání je potřeba.
6. ~~Vidí admin kalkulace všech uživatelů?~~ – rozhodnuto: ano, admin vidí kalkulace všech podlahářů a smí je upravovat jako vlastník (podlahář vidí jen své).
7. Číselná řada: společná, nebo pro každého podlaháře?
8. Má „Upravit“ držet staré ceny?
9. Volitelné příplatky (demontáž, vyrovnání) – návrh, ve výchozím stavu vypnuto (zapíná admin v Sazbách). Lišty a hrany jsou teď pevnou součástí ceny.
10. Práce: normohodiny podle typu nášlapu a podstupnice, hodinová sazba (chybí).
11. Vliv typu schodu (Rovný / Šikmý / Rohový) na cenu.
12. Lepidlo 1× nebo 2× nános.
13. Nabízené varianty LEPENÁ / CLICK.
14. MOC vs. cena pro podlaháře; kurz EUR/CZK (zdroj, četnost).
15. Spoj lamel u širokých schodů.
16. Cena vinylové hrany a vedení lišty (strana u zdi / otevřená).
17. Sleva i na lišty a dopravu?
18. Grandissimo Plus: šířka lamely 228 nebo 228,6 mm.
