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
- `data.js` – seed (6 vzorů, sazby, uživatelé, vzorové kalkulace, SVG textury místo fotek)
- `calc.js` – čisté výpočetní funkce (`computeQuote`, `comparePatterns`, `groupArea`, formátování); lze ověřit v konzoli i v Node (`require('./calc.js')`)
- `store.js` – localStorage, session, číslování `RRRR-NNNN`
- `app.js` – router + guardy, přihlášení, reset hesla, pozvánka, historie, profil
- `wizard.js` – průvodce (kroky 1–4), kalkulace, PDF náhled, e-mail, porovnání vzorů
- `admin.js` – uživatelé, vzory, sazby, reset dat

(Oproti původnímu plánu je `app.js` rozdělen na tři soubory kvůli čitelnosti.)

## Výpočet
`A = š·(h + v·p)/10 000·n`, `C = ΣA·(1+r)·c_m + Σn·(c_n + p·c_p) + c_d`.
Řádky rozpisu se zaokrouhlují na `roundTo` (1 Kč / 10 Kč), DPH = round(základ · sazba), celkem = základ + DPH – součty vždy sedí.
Kontrolní příklad (100×30 cm, podstupnice 18 cm, 10 ks, obkládat, vzor 1): základ 14 783 Kč, DPH 21 % 3 104 Kč, **celkem 17 887 Kč**; bez obkladu podstupnice 9 927 Kč.

Uložená kalkulace si drží **snapshot celého ceníku**. Změna ceníku ji nezmění; „Duplikovat“ použije aktuální ceník, „Upravit“ nabídne přepočet.

## Co je v prototypu simulované
- Přihlášení, heslo (plaintext v localStorage), blokace po 5 pokusech na 15 min, „Zapamatovat si mě“ (30 dní), pozvánky a reset hesla (náhled e-mailu + „Otevřít odkaz (demo)“).
- PDF = tisk A4 stránky (`window.print()` → Uložit jako PDF). E-mail se neodesílá, jen se změní stav na Odesláno.
- Data jsou jen v prohlížeči (`localStorage`); admin může „Obnovit ukázková data“.
- Ukázkové vzory, ceny a fotky (SVG textury) jsou vymyšlené.

## Mimo prototyp (ostrá verze)
Skutečná autentizace a hashování hesel, HTTPS, serverové generování PDF, odesílání e-mailů, PostgreSQL + REST API, hosting v EU, zálohy, GDPR.

## Otevřené otázky pro zadavatele
Zobrazují se jako malé štítky „? Otázka“ u místa, kterého se týkají (klepnutím se otevře text). Souhrnný panel všech otázek a „Režim prezentace“ (skryje štítky) jsou v sheetu „Prototyp“ v proužku nahoře.
1. Práce za kus (nášlap) vs. za m²?
2. Je podlahář plátce DPH?
3. Točité / lichoběžníkové schody a podesty.
4. Jeden podlahář vs. více firem s vlastním ceníkem.
5. E-mail/telefon zákazníka není v kroku Zakázka, ale pro odeslání je potřeba.
6. ~~Vidí admin kalkulace všech uživatelů?~~ – rozhodnuto: ano, admin vidí a může otevřít kalkulace všech podlahářů (podlahář jen své).
7. Číselná řada: společná, nebo pro každého podlaháře?
8. Má „Upravit“ držet staré ceny?
9. Volitelné příplatky (hrany, lišty, demontáž, vyrovnání) – návrh, ve výchozím stavu vypnuto (zapíná admin v Sazbách), do vzorce ze zadání nezasahuje.
