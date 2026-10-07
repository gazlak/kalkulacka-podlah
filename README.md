# Kalkulačka podlah – klikatelný prototyp

Klikatelný HTML prototyp kalkulačky schodů pro podlaháře. Čisté HTML/CSS/JS, bez backendu a bez buildu.

## Jak si ho prohlédnout
1. `git clone https://github.com/gazlak/kalkulacka-podlah.git`
2. Otevřete `prototyp/index.html` v prohlížeči (funguje přes `file://`, nic se neinstaluje).
3. Pro mobilní pohled nastavte v DevTools šířku 360 px.

## Demo účty
| E-mail | Heslo | Role |
|---|---|---|
| `admin@demo.cz` | `admin1234` | admin |
| `novak@demo.cz` | `heslo1234` | podlahář |
| `svoboda@demo.cz` | `heslo1234` | podlahář |

## Poznámka k datům
Ukázková data jsou v `prototyp/data.js` a při prvním spuštění se uloží do `localStorage` prohlížeče. Každý návštěvník má tedy vlastní stav a změny se nesdílejí. Reset: sheet „Prototyp ⚙“ → „Obnovit ukázková data“.

Podrobnosti (soubory, vzorec výpočtu): [prototyp/README.md](prototyp/README.md).
