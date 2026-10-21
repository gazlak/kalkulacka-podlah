# Vizualizace schodů na fotce (prototyp)

Stav: schváleno v konverzaci 2026-10-20. Pokus s Gemini proběhl (fotka točitého schodiště, dekory DV Home 5006
a 5008): Nano Banana 2 drží tvar schodiště i dekor, 12 s, ~1 Kč. Změny jen lokálně, push na pokyn.

## Cíl

Na konci kalkulace zákazník uvidí, jak bude vybraný vinyl vypadat na jeho vyfocených schodech. Orientační ukázka,
ne přesný náhled. Nikdo na fotce nic neklikají ani nenastavuje.

## Rozsah

- Karta „Vizualizace na fotce“ na obrazovce kalkulace (krok 4 průvodce i detail kalkulace) a obrázek v PDF náhledu.
- Lokální server `prototyp/server.py` (jen standardní knihovna Pythonu): servíruje prototyp bez cache
  a volá Gemini. Klíč nikdy nejde do prohlížeče.
- Mimo rozsah: Next.js aplikace (větev `backend`), čtení počtu schodů z fotky, výběr modelu v UI.

## Chování v aplikaci

- Tlačítko „Nahrát fotku schodů“ (`accept="image/*"`, na mobilu i fotoaparát). Prohlížeč fotku zmenší na
  nejvýš 1600 px delší strany a pošle ji jako JPEG.
- Během čekání „Připravuji vizualizaci… (asi 10–20 s)“, tlačítko zakázané.
- Výsledky (max 2) pod sebou: vizualizace, pod ní malý originál, popisek „Orientační vizualizace – skutečný vzhled
  se může lišit“, název dekoru, kterým vznikla, a odkaz Smazat.
- Limit **2 vizualizace na kalkulaci**. Smazání limit nevrací (každé volání stojí). Po vyčerpání tlačítko zakázané
  s textem „Limit vizualizací pro tuto kalkulaci je vyčerpán (2/2)“.
- Kalkulace jen ke čtení (cizí): vizualizace se zobrazí, nahrávat ani mazat nejde.
- Bez serveru (`file://`, GitHub Pages, server neodpovídá na `GET /api/vizualizace/stav`): karta ukáže
  „Vizualizace funguje jen přes lokální server (python3 prototyp/server.py)“.
- PDF náhled: sekce „Vizualizace“ s poslední vizualizací a popiskem.

## Data

- Kalkulace dostane `visuals: [{ url, original, patternId, patternName, createdAt }]` a `visualsUsed: číslo`
  (localStorage, jen cesty, ne obrázky).
- Server ukládá do `prototyp/vizualizace/` (mimo git): `<calcId>-<n>.jpg` (výsledek) a `<calcId>-<n>-foto.jpg`
  (zmenšený originál). `calcId` jen `[A-Za-z0-9_-]{1,64}`.

## API serveru

- `GET /api/vizualizace/stav?calc=<id>` → `{ ok: true, key: bool, used: n, limit: 2 }`.
- `POST /api/vizualizace` JSON `{ calcId, photo: "data:image/jpeg;base64,…", pattern: { name, photo }, stair: {
  nose: bool, stairSide: "walls"|"left"|"right"|"open"…, stairType, landing: bool } }` →
  `{ url, original, used, limit }`.
  - 400: chybí pole, špatné `calcId`, fotka není JPEG/PNG (podle prvních bajtů), větší než 10 MB.
  - 409: limit vyčerpán (počítá soubory výsledků pro `calcId`).
  - 503: chybí klíč (`GEMINI_API_KEY` nebo `~/.config/gemini/api_key`).
  - 502: Gemini vrátil chybu nebo žádný obrázek; 504: víc než 90 s.
  - Chybové odpovědi `{ error: "česká hláška" }`, klíč ani odpověď Gemini se do hlášky nevypisují celé.
- Dekor stahuje server jen z `https://eshop.floorforever.cz/` (jinak se pošle jen název dekoru).
- Model `gemini-3.1-flash-image`, `imageConfig: { aspectRatio: podle fotky (nejbližší z 1:1, 3:4, 4:3, 2:3, 3:2,
  9:16, 16:9), imageSize: "2K" }`. Výsledek se uloží jako JPEG, nejvýš 1600 px (kvalita 80, převod přes `sips`, jinak PNG).

## Pokyn pro Gemini

Skládá se na serveru z voleb kalkulace:
- obložit každý nášlap a každou podstupnici vinylem z druhého obrázku (název dekoru), lamely po šířce stupně;
- s nosem: nášlap přesahuje přes podstupnici se zaobleným nosem; bez nosu: rovná hrana bez přesahu;
- strany: u zdi tenká lišta, otevřená strana vinylová hrana (podle `stairSide`);
- podesta: rovná plocha stejným vinylem;
- **neobkládat** podlahu před schody ani nic jiného; zdi, zábradlí, okna, předměty, světlo, úhel a výřez nechat;
- fotorealisticky, bez textu.

## Testy

- `prototyp/test_server.py` (unittest, podvržené volání Gemini): stav, úspěch uloží soubory a vrátí URL, limit 409,
  špatné `calcId`, ne-obrázek a velká fotka 400, chybějící klíč 503, chyba Gemini 502, pokyn obsahuje nos / bez nosu,
  lišta / hrana, podestu a zákaz podlahy, dekor z cizí domény se nestahuje.
- Ručně: jedna skutečná fotka v prohlížeči (~1 Kč).
