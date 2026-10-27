const fs = require('fs'), dir = process.argv[2], out = process.argv[3];
global.window = {};
eval(['patterns.js', 'data.js', 'calc.js'].map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n') + ';global.Calc=Calc;global.D=DEFAULTS;');
const pr = { patterns: D.patterns, collections: D.collections, rates: D.rates }, sr = Calc.stairRates(pr), lr = Calc.stairRates(pr, undefined, 'landingPrice'), LP = D.rates.landingPrice;
const kc = x => Math.round(x).toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč';
const seen = {}, cols = D.collections.filter(c => c.active !== false).filter(c => { const k = c.family || c.id; if (seen[k]) return false; return seen[k] = 1; })
  .sort((a, b) => b.materialPerM2 - a.materialPerM2);
const NARROW = 100; // kosý schod = lichoběžník: široký konec do uvedené šířky, úzký konec 100 mm
const sizes = [['rovný', 'R', 1200, 330, 330], ['rovný větší', 'RV', 1500, 330, 330], ['kosý', 'K', 1550, 650, NARROW], ['kosý větší', 'KV', 1850, 800, NARROW]];
const rH = 200, rL = [1200, 1500];
const name = c => c.family ? c.name.replace(/ [ABC]$/, '') : c.name;
let rows = cols.map(c => { const x = sr.forPrice(c.materialPerM2);
  return `<tr><td class="n">${name(c)}<small>vinyl ${kc(c.materialPerM2)}/m²</small></td>${sizes.map(s => `<td>${kc(x.perM2 * s[2] * (s[3] + s[4]) / 2 / 1e6)}</td>`).join('')}<td class="m">${kc(x.perM2)}</td></tr>`; }).join('');
let rrows = cols.map(c => { const x = sr.forPrice(c.materialPerM2);
  return `<tr><td class="n">${name(c)}</td>${rL.map(l => `<td>${kc(x.riserPerM2 * l * rH / 1e6)}</td>`).join('')}<td class="m">${kc(x.riserPerM2)}</td></tr>`; }).join('');
let lrows = cols.map(c => { const x = lr.forPrice(c.materialPerM2);
  return `<tr><td class="n">${name(c)}</td><td>${kc(x.stair)}</td><td>${kc(x.perM2 * 1.0 * 0.8)}</td><td class="m">${kc(x.perM2)}</td></tr>`; }).join('');
// vzorová kalkulace: 14 schodů 1000 × 280 mm s nosem + podstupnice 180 mm, nejlevnější a nejdražší kolekce
const g = [{ width: 100, depth: 28, count: 14, treadType: 'nose', coverRiser: true, riserHeight: 18, side: 'walls' }];
const ex = [cols[0], cols[cols.length - 1]].map(c => { const p = D.patterns.find(p => p.collectionId === c.id && Calc.patternOffered(pr, p));
  const q = Calc.computeQuote(g, p.id, pr, { type: 'pct', value: 0 }, 0.21, {}, {});
  return `<tr><td class="n">${name(c)}</td>${q.lines.map(l => `<td>${kc(l.amount)}</td>`).join('')}<td class="m">${kc(q.base)}</td><td>${kc(q.total)}</td></tr>`; }).join('');
const rs = (() => { const m2 = 1.2 * 0.2 * (1 + D.rates.stairPrice.wastePct / 100), price = sr.riserPerM2 * 1.2 * 0.2, vinyl = sr.top * m2, production = price * sr.production / sr.stair, floorer = price * D.rates.stairPrice.floorerPct / 100;
  return { m2: Math.round(m2 * 1000) / 1000, price, vinyl, production, floorer, buyer: price - vinyl - production - floorer }; })();
const today = new Date().toLocaleDateString('cs-CZ');
fs.writeFileSync(out, `<!doctype html><html lang="cs"><meta charset="utf-8"><title>Ceník schodů z vinylu</title><style>
@page{size:A4;margin:14mm 14mm 12mm}*{box-sizing:border-box}body{font:10.5pt/1.4 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#16202a;margin:0}
h1{font-size:19pt;margin:0 0 2mm;letter-spacing:-.01em}h2{font-size:12.5pt;margin:7mm 0 2mm}.lead{color:#4a5866;margin:0 0 4mm}
.tag{display:inline-block;background:#fff4d6;color:#7a5a00;border-radius:4px;padding:1px 7px;font-size:9pt;font-weight:600;margin-left:6px;vertical-align:middle}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{padding:5px 7px;border-bottom:1px solid #dfe5ea;text-align:right;white-space:nowrap}
th{background:#1d4e89;color:#fff;font-weight:600;font-size:9.5pt}th small,td small{display:block;font-weight:400;font-size:8pt;opacity:.75}
td.n,th.n{text-align:left;white-space:normal}td.m{font-weight:600;background:#f3f6f9}tr:nth-child(even) td:not(.m){background:#fafbfc}
.note{font-size:9pt;color:#4a5866;margin-top:2mm}.box{border:1px solid #dfe5ea;border-radius:6px;padding:3mm 4mm;margin-top:5mm;font-size:9.5pt;background:#f8fafc}
.box b{color:#1d4e89}ul{margin:1mm 0 0;padding-left:5mm}.foot{margin-top:6mm;font-size:8.5pt;color:#7a8794}
</style><body>
<h1>Schody z vinylu s nosem – ceník <span class="tag">NÁVRH k odsouhlasení</span></h1>
<p class="lead">Obklad schodů vinylem na desku MDF 12 mm, včetně materiálu (vinyl, MDF, lepidlo) a výroby. Ceny jsou <b>bez DPH</b> a bez dopravy, za kus do uvedených rozměrů. Stav ${today}.</p>
<h2>Schody (nášlap s nosem, bez podstupnice)</h2>
<table><tr><th class="n">Kolekce vinylu</th>${sizes.map(s => `<th>${s[0]}<small>do ${s[2]} × ${s[3] === s[4] ? s[3] : s[3] + '/' + s[4]} mm</small></th>`).join('')}<th>za m²<small>nášlapu</small></th></tr>${rows}</table>
<p class="note">Kosé schody: lichoběžník, široký konec do uvedené šířky a úzký konec 100 mm (cena podle plochy). Kalkulačka počítá podle skutečně naměřené hloubky na obou stranách. Schod bez nosu se zatím počítá stejnou cenou za m².</p>
<h2>Podstupnice</h2>
<table><tr><th class="n">Kolekce vinylu</th>${rL.map(l => `<th>do ${l} mm<small>výška do ${rH} mm</small></th>`).join('')}<th>za m²<small>podstupnice</small></th></tr>${rrows}</table>
<p class="note">Podstupnice stojí ${D.rates.stairPrice.riserPct} % ceny schodu za m² (podle poměru v ceníku AKTO: schod 5 152 Kč/m², podstupnice 4 167 Kč/m² při výšce 200 mm, tedy cca 81 %).</p>
<h2>Podestový schod (plachta) <span class="tag">otevřené otázky</span></h2>
<table><tr><th class="n">Kolekce vinylu</th><th>do ${LP.refWidthMm} × ${LP.refDepthMm} mm<small>referenční podesta</small></th><th>do 1000 × 800 mm</th><th>za m²<small>plachty</small></th></tr>${lrows}</table>
<p class="note">Horní MDF se nedělá, vinyl se lepí přímo na podestu. Čelo 2 × MDF 12 mm: s nosem ve výšce ${LP.noseEdgeMm} mm a 1 lamela, bez nosu ve výšce podstupnice a 2 lamely (podstupnice je v ceně). Lepí se jen čelo.
Nejdražší podesta ${kc(lr.stair)} = vinyl ${kc(lr.vinyl)} + výroba ${kc(lr.production)} + podlahář ${kc(lr.floorer)} + odběratel ${kc(lr.buyer)}.
<b>K upřesnění:</b> pro jakou velikost podesty platí cílová cena (u 1200 × 1000 mm zbývá odběrateli málo), skutečná cena výroby (normohodiny), vedení lišty a hrany.</p>
<h2>Vzorová kalkulace: 14 schodů 1000 × 280 mm s nosem, podstupnice 180 mm</h2>
<table><tr><th class="n">Kolekce</th><th>Schody</th><th>Podstupnice</th><th>Lišta KPV50</th><th>Bez DPH</th><th>S DPH 21 %</th></tr>${ex}</table>
<div class="box"><b>Jak cena vzniká.</b> Nejdražší schod (rovný 1200 × 330 mm, nejdražší kolekce, vinyl za MOC) = <b>${kc(sr.stair)}</b> bez DPH:
<ul><li>vinyl ${kc(sr.vinyl)} (0,60 m² vč. nosu a prořezu × ${kc(sr.top)}/m²)</li><li>výroba ${kc(sr.production)} (MDF, lepidlo, práce)</li><li>podlahář ${D.rates.stairPrice.floorerPct} % z ceny = ${kc(sr.floorer)}</li><li>odběratel zbytek = ${kc(sr.buyer)}</li></ul>
<br><b>Podstupnice</b> 1200 × 200 mm u nejdražší kolekce = <b>${kc(rs.price)}</b> bez DPH (${D.rates.stairPrice.riserPct} % ceny schodu za m² × 0,24 m²):
<ul><li>vinyl ${kc(rs.vinyl)} (${rs.m2.toLocaleString('cs-CZ')} m² vč. prořezu × ${kc(sr.top)}/m²)</li><li>výroba ${kc(rs.production)} (stejný podíl z ceny jako u schodu, ${(sr.production / sr.stair * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %)</li><li>podlahář ${D.rates.stairPrice.floorerPct} % z ceny = ${kc(rs.floorer)}</li><li>odběratel zbytek = ${kc(rs.buyer)}</li></ul>
Levnější kolekce je levnější o rozdíl ceny vinylu (cena kolekce za m² × 0,60 m²); ostatní složky zůstávají. Větší schody se přepočítávají podle plochy nášlapu.
Lišta KPV50 (${kc(D.rates.trimPerBm)}/bm) a vinylová hrana se účtují zvlášť podle délky strany schodiště.</div>
<p class="foot">Ceník je návrh pro obchodní jednání, odvozený z prototypu kalkulačky. Konečnou cenu konkrétní zakázky spočítá kalkulačka z naměřených rozměrů.</p>
</body></html>`);
