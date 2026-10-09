# Kalkulačka schodů – Next.js (frontend + backend)

Frontend mluví s backendem přes rozhraní `Api` (`src/lib/api/client.ts`). Implementace jsou dvě:

| `NEXT_PUBLIC_API` | Implementace | Použití |
|---|---|---|
| `mock` (výchozí) | localStorage, `src/lib/api/mock/` | vývoj UI, bez DB |
| `http` | `fetch('/api/…')` → Route Handlery → PostgreSQL | skutečný provoz |

Mock slouží jako specifikace chování; e2e testy běží proti oběma režimům beze změny.

## Rychlý start (backend)

```bash
docker compose -f ../docker-compose.yml up -d     # Postgres 16 + Mailpit (http://localhost:8025)
cp .env.example .env.local
npm install
npm run db:reset                                  # migrace + demo data (účty viz kořenový README)
npm run dev                                       # NEXT_PUBLIC_API=http z .env.local
```

Skripty: `db:generate` (nová migrace ze `schema.ts`), `db:migrate`, `db:seed`, `db:reset` (smaže vše!),
`test` (Vitest, služby nad PGlite – Docker nepotřeba), `e2e` (`E2E_API=mock|http npx playwright test`).

## Architektura

```
src/app/api/**        Route Handlery (tenké): auth, calculations, pricing, patterns, rates, users, profile, files
src/server/services/  pravidla a autorizace (bez závislosti na HTTP, testované nad PGlite)
src/server/db/        Drizzle schéma (+ ./drizzle SQL migrace)
src/server/http/      obal route(): relace, role, CSRF (kontrola Origin), překlad chyb → {error}
src/server/pdf.ts     serverové PDF
src/server/mail/      Mailer (SMTP / konzole / paměť pro testy) + šablony cs
src/app/print/[id]    interní tisková stránka (PdfSheet) pro Chromium
src/lib/api/http/     HTTP klient implementující `Api`
```

- **Autorizace:** vlastník zapisuje, admin cizí kalkulace jen čte (403), podlahář cizí nevidí (404). Správa/ceník jen admin.
- **Číslování:** `RRRR-NNNN` z tabulky `counters` (jedna společná řada), přidělí se v transakci při prvním uložení kalkulace; zároveň se uloží snapshot ceníku (JSONB).
- **Přihlášení:** vlastní serverové relace – náhodný token v `HttpOnly; SameSite=Lax` cookie, v DB jen jeho SHA‑256; „zapamatovat“ = 30 dní, jinak session cookie / 12 h. Hesla argon2id. Po 5 chybách zámek na 15 min (atomicky v SQL). Reset hesla (1 h) a pozvánka (7 dní): jednorázové tokeny, v DB jen hash. „Zapomenuté heslo“ odpovídá stejně pro neexistující účet. Rate limit login/forgot v paměti procesu.
- **Obrázky:** logo a fotky vzorů se nahrávají jako data URL (PNG/JPEG/WebP ≤ 2 MB, kontrola magic bytes; SVG se nepřijímá), ukládají se do tabulky `files` pod SHA‑256 a API vrací URL `/api/files/<hash>` (neměnné → snapshot ceníku na ně smí odkazovat).
- **PDF:** `GET /api/calculations/:id/pdf` – Chromium (Playwright) vytiskne interní stránku `/print/:id`, kterou renderuje tatáž komponenta `PdfSheet` jako náhled v aplikaci. Přístup na ni má jen krátkodobý podepsaný klíč. E-mail zákazníkovi nese stejné PDF v příloze; odeslání se loguje (`mail_log`).
- **GDPR:** `DELETE /api/users/:id` (admin) smaže účet včetně kalkulací, relací a tokenů; hesla ani tokeny se neloguje.

### Odchylka od plánu
Auth.js (Credentials) nepodporuje DB relace pro Credentials provider bez obcházení, a vracení `LoginResult`
(zámek, zbývající pokusy) by se s ním tloukl. Proto jsou relace vlastní (tabulka `sessions`) – stejné vlastnosti
(DB relace, role, maxAge, CSRF přes Origin + SameSite), méně pohyblivých částí. Přechod na Auth.js by šel
udělat výměnou `src/server/services/auth.ts` + `http/handler.ts`.

## Produkce

```bash
cd .. && cp web/.env.example .env   # doplnit DB_PASSWORD, APP_URL, SMTP_*, MAIL_FROM
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Migrace se aplikují při startu (`src/instrumentation.ts`). Demo data jen na zkoušku: `DATABASE_URL=… npm run db:seed`.
Obraz stojí na `mcr.microsoft.com/playwright` (Chromium pro PDF); verze v `Dockerfile` musí odpovídat balíčku `playwright`.
Za reverzní proxy (HTTPS) posílejte `X-Forwarded-For` (rate limit) a nastavte `APP_URL` na veřejnou adresu.

### Záloha DB
```bash
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U kalkulacka -Fc kalkulacka > zaloha-$(date +%F).dump
# obnova:
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U kalkulacka -d kalkulacka --clean < zaloha.dump
```
Logo a fotky jsou v DB (tabulka `files`), takže záloha DB je kompletní. Zálohu spouštějte cronem a ukládejte mimo server.

## Otevřené otázky pro zadavatele (ovlivní schéma)
Společná vs. per‑podlahář číselná řada (dnes společná) · více firem s vlastním ceníkem (dnes jeden ceník) ·
e‑mail/telefon zákazníka v kroku Zakázka · plátce DPH · práce za kus vs. m². Výběr EU hostingu a SMTP zbývá.
