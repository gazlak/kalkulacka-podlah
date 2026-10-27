# Kalkulačka schodů – co chybí k nasazení

Stav: 27. 10. 2026. Repo má dvě verze kalkulačky:

| | Prototyp (`prototyp/`) | Aplikace (`web/`, Ondra) |
|---|---|---|
| Technika | čisté HTML/JS, data v prohlížeči (localStorage), `server.py` jen pro vizualizaci | Next.js, REST API, PostgreSQL, relace, PDF přes Chromium, e-maily, Docker, CI (zelené) |
| Funkce | aktuální (viz níže) | stav prototypu z **9. 10. 2026** |
| Nasaditelné | ne – každý návštěvník má vlastní data, hesla v prohlížeči | ano technicky (`docker-compose.prod.yml`), ale bez nových funkcí |

Ověřeno 27. 10.: ve `web/` projde `npm ci`, lint, typecheck, 24 testů i `next build`; CI na GitHubu je zelené.

**Prototyp slouží jako demo a specifikace a zůstává beze změny použitelný pro prezentace.** Nasazuje se `web/`.

## Demo se společnými daty (27. 10.)

Prototyp spuštěný přes `python3 prototyp/server.py` ukládá data i na server (`prototyp/data/db.json`, mimo git):
kalkulaci uloženou podlahářem vidí admin v jiném prohlížeči nebo na jiném zařízení. Kalkulace se slučují podle id
(novější vyhrává), ceník přepíše jen ten, kdo ho změnil, nic se nemaže. Pro ostatní v síti: `HOST=0.0.0.0 python3
prototyp/server.py` a adresa `http://<IP počítače>:8801`. Je to řešení pro prezentaci, ne pro provoz (bez šifrování,
hesla v datech, poslední zápis vyhrává).

## 1. Funkce prototypu, které ve `web/` chybí (od 9. 10.)

Seřazeno podle důležitosti pro ostrý provoz:

1. **Cenový model** – ceník po kolekcích (Kč/m², lamely), rezerva na ořez, prořez podle lamel a optimalizace nářezu,
   MDF bez rezervy, lišta a hrana podle stran schodiště, normohodiny na celý schod, **cena schodu od nejdražšího dekoru**
   (3 500 Kč, podstupnice 80 % ceny za m², rozpis vinyl / výroba / podlahář / odběratel – 27. 10.).
   Doporučení: přenést `prototyp/calc.js` jako sdílený modul (čistá funkce, bez DOM) a otestovat stejnými
   vstupy jako prototyp, ať se ceny nerozejdou.
2. **Typy schodišť a nášlapů** – přímé, do L (90°), do U (180°), s nosem / bez nosu, rovný / kosý; půdorys a náhled.
3. **Vzory Floor Forever** – 337 dekorů s kolekcemi, varianty LEPENÁ / CLICK, zapínání kolekcí.
4. **Objednávka do výroby** – PDF bez cen (nářezový plán, rozměry dílců).
5. **Krok Fotografie a vizualizace schodů na fotce** (Gemini, ~1 Kč za obrázek, limit 2 na kalkulaci). Klíč Gemini
   musí být jen na serveru (dnes `~/.config/gemini/api_key` u `server.py`), v produkci proměnná prostředí.
6. **Veřejná registrace s ověřením e-mailu** (ve `web/` je zatím jen pozvánka adminem – ověřit).
7. Historie verzí kalkulace, úprava cizí kalkulace adminem, prohlížeč fotek s porovnáním před/po, Sazby a Kolekce
   ve správě na jedné stránce, výchozí data (seed).

## 2. Provoz – co je potřeba rozhodnout nebo dodat

| Co | Stav | Kdo |
|---|---|---|
| Server (VPS s Dockerem, např. Hetzner) | chybí | rozhodnout |
| Doména a HTTPS (reverzní proxy, např. Caddy) | chybí | rozhodnout |
| SMTP pro e-maily (pozvánky, reset hesla, PDF zákazníkovi) | chybí | rozhodnout poskytovatele |
| `.env` produkce: `DB_PASSWORD`, `APP_URL`, `SMTP_*`, `MAIL_FROM`, klíč Gemini | chybí | doplní správce (nikdy do repa) |
| Zálohy PostgreSQL (denní dump mimo server) a test obnovy | chybí | připravit |
| Sledování chyb a dostupnosti | chybí | připravit |
| Obchodní podmínky, GDPR (zpracování fotek a údajů zákazníků) | chybí | právník |
| Ceny k odsouhlasení (3 500 Kč, podstupnice 80 %, výroba 1 000 Kč, podlahář 30 %) | návrh, viz `podklady/cenik-schodu-navrh.pdf` | obchod |
| Otevřené otázky v prototypu (Sazby → „Otázka“: MOC vs. nákup, kurz EUR, spoj lamel, cena hrany…) | otevřené | zákazník |

## 3. Postup (návrh)

1. Odsouhlasit ceník a otevřené otázky na prezentaci (prototyp).
2. Přenést výpočet (`calc.js`) do `web/` jako sdílený modul + testy shody s prototypem.
3. Přenést chybějící obrazovky (body 2–7) podle prototypu; e2e testy v CI.
4. Připravit server, doménu, SMTP, `.env`, zálohy; nasadit na zkušební adresu (staging).
5. Pilot s jedním podlahářem, pak ostrý provoz.

Hrubý odhad práce na bodech 2–3: 2–3 týdny jednoho vývojáře (Ondra zná `web/`). Provoz (bod 4): 2–3 dny.
