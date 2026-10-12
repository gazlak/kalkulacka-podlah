/* Čisté výpočetní funkce (bez DOM). Vzorce přesně podle zadání:
 *   A = š · (h + v · p) / 10 000 · n
 *   U šikmého schodu (jiná hloubka vlevo a vpravo) je h průměr obou hloubek – plocha lichoběžníku.
 *   C = ΣA · (1 + r) · c_m + Σn · (c_n + p · c_p) + c_d
 *   K tomu podle typu nášlapu (nastavuje správce): podklad MDF, lepidlo a práce za m² plochy skupiny a příplatek za nášlap.
 *   MDF za m² = tloušťka v mm / 1000 · cena za m³ v EUR · kurz.
 */
var Calc = (function () {
  function num(v) {
    if (v === null || v === undefined || v === '') return NaN;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  function n0(v) { var n = num(v); return isNaN(n) ? 0 : n; }
  function roundTo(x, step) { step = step || 1; return Math.round(x / step) * step; }

  // šikmý schod: depth = hloubka vlevo, depthRight = hloubka vpravo; starší data mají jen depth (stejná hloubka)
  function isSkewed(g) { return g.depthSame === false; }
  function depthOf(g) { return isSkewed(g) ? (n0(g.depth) + n0(g.depthRight)) / 2 : n0(g.depth); }
  function depthLabel(g) { return isSkewed(g) ? g.depth + ' / ' + g.depthRight : String(g.depth); }

  // typ schodiště (celá kalkulace) a typ nášlapu (skupina); starší data typ nemají a berou se jako první volba
  var STAIR_TYPES = [
    { id: 'straight', label: 'Rovnoramenné' }, { id: 'right', label: 'Pravotočivé' }, { id: 'left', label: 'Levotočivé' }
  ];
  var TREAD_TYPES = [
    { id: 'nose', label: 'S nosem', nose: true }, { id: 'flat', label: 'Bez nosu' },
    { id: 'landingNose', label: 'Podestový s nosem', nose: true, landing: true }, { id: 'landingFlat', label: 'Podestový bez nosu', landing: true }
  ];
  function pick(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }
  function stairType(c) { return pick(STAIR_TYPES, c.stairType); }
  function treadType(g) { return pick(TREAD_TYPES, g.treadType); }
  function isLanding(g) { return !!treadType(g).landing; }
  function hasNose(g) { return !!treadType(g).nose; }

  // plocha jedné skupiny v m²; š=šířka, h=hloubka nášlapu, v=výška podstupnice, p=obkládat podstupnici, n=počet
  function groupArea(g) {
    var p = g.coverRiser ? 1 : 0;
    return n0(g.width) * (depthOf(g) + n0(g.riserHeight) * p) / 10000 * n0(g.count);
  }

  // složky ceny za m² pro daný typ nášlapu; ceník bez těchto sazeb (starší uložené kalkulace) dává nuly
  function m2Rates(rates, treadId) {
    var m = rates.m2 || {}, t = (m.byTread || {})[treadId] || {};
    return { mdfMm: n0(t.mdfMm), mdfPerM2: n0(t.mdfMm) / 1000 * n0(m.mdfEurM3) * n0(m.eurRate), glue: n0(t.glue), labor: n0(t.labor) };
  }

  function findPattern(pricing, patternId) {
    var ps = pricing.patterns;
    for (var i = 0; i < ps.length; i++) if (ps[i].id === patternId) return ps[i];
    return null;
  }

  function computeExtras(extras, rates) {
    if (!rates.extrasEnabled || !extras) return 0;
    var sum = 0;
    (rates.extras || []).forEach(function (e) { sum += n0(extras[e.key]) * n0(e.price); });
    return sum;
  }

  /* pricing = {patterns[], rates}; discount = {type:'pct'|'czk', value}; extras = {key: množství} (volitelné) */
  function computeQuote(groups, patternId, pricing, discount, vatRate, extras) {
    var pat = findPattern(pricing, patternId);
    var rates = pricing.rates;
    var step = rates.roundTo || 1;
    var areas = groups.map(groupArea);
    var totalArea = areas.reduce(function (a, b) { return a + b; }, 0);
    var treads = 0, riserTreads = 0, treadTypesRaw = 0, surcharge = rates.treadSurcharge || {};
    var mdfRaw = 0, glueRaw = 0, laborM2Raw = 0;
    groups.forEach(function (g, i) {
      var n = n0(g.count), t = m2Rates(rates, treadType(g).id);
      mdfRaw += areas[i] * t.mdfPerM2; glueRaw += areas[i] * t.glue; laborM2Raw += areas[i] * t.labor;
      treads += n;
      treadTypesRaw += n * n0(surcharge[treadType(g).id]);
      if (g.coverRiser) riserTreads += n;
    });
    var waste = pat ? pat.wastePct / 100 : 0;
    var materialRaw = pat ? totalArea * (1 + waste) * pat.materialPerM2 : 0;
    var material = roundTo(materialRaw, step);
    var labor = pat ? roundTo(treads * pat.laborPerTread, step) : 0;
    var risers = roundTo(riserTreads * rates.riserSurcharge, step);
    var treadTypes = roundTo(treadTypesRaw, step);
    var mdf = roundTo(mdfRaw, step), glue = roundTo(glueRaw, step), laborM2 = roundTo(laborM2Raw, step);
    var transport = roundTo(rates.transport, step);
    var extrasTotal = roundTo(computeExtras(extras, rates), step);
    var subtotal = material + mdf + glue + labor + laborM2 + risers + treadTypes + transport + extrasTotal;
    var d = discount || { type: 'pct', value: 0 };
    var dv = n0(d.value);
    var discountAmount = d.type === 'czk' ? dv : subtotal * dv / 100;
    discountAmount = Math.min(subtotal, Math.max(0, roundTo(discountAmount, step)));
    var base = subtotal - discountAmount;
    var vat = roundTo(base * vatRate, step);
    return {
      areas: areas, totalArea: totalArea, treads: treads, riserTreads: riserTreads,
      wastePct: pat ? pat.wastePct : 0,
      material: material, labor: labor, mdf: mdf, glue: glue, laborM2: laborM2, risers: risers, treadTypes: treadTypes, transport: transport, extras: extrasTotal,
      subtotal: subtotal, discountAmount: discountAmount, base: base, vat: vat, total: base + vat
    };
  }

  function comparePatterns(groups, pricing, discount, vatRate, extras) {
    return pricing.patterns.map(function (p) {
      return { pattern: p, quote: computeQuote(groups, p.id, pricing, discount, vatRate, extras) };
    });
  }

  var czk = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });
  var m2 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function formatCZK(x) { return czk.format(x).replace(/ /g, ' '); }
  function formatM2(x) { return m2.format(x) + ' m²'; }

  // validace polí skupiny; vrací {field: 'chyba'} (prázdný objekt = OK)
  function validateGroup(g) {
    var e = {};
    var fields = [['width', 'Šířka'], ['depth', isSkewed(g) ? 'Hloubka vlevo' : 'Hloubka nášlapu'], ['riserHeight', 'Výška podstupnice']];
    if (isSkewed(g)) fields.push(['depthRight', 'Hloubka vpravo']);
    fields.forEach(function (f) {
      var v = num(g[f[0]]);
      if (g[f[0]] === '' || g[f[0]] === null || g[f[0]] === undefined || isNaN(v)) e[f[0]] = 'Vyplňte číslo 1–500 cm';
      else if (v < 1 || v > 500) e[f[0]] = f[1] + ' musí být 1–500 cm';
    });
    var c = num(g.count);
    if (g.count === '' || g.count === null || g.count === undefined || isNaN(c)) e.count = 'Vyplňte počet 1–100 ks';
    else if (c !== Math.floor(c)) e.count = 'Počet musí být celé číslo';
    else if (c < 1 || c > 100) e.count = 'Počet musí být 1–100 ks';
    return e;
  }

  return {
    num: num, n0: n0, roundTo: roundTo, groupArea: groupArea, computeQuote: computeQuote,
    comparePatterns: comparePatterns, computeExtras: computeExtras, formatCZK: formatCZK, formatM2: formatM2,
    validateGroup: validateGroup, findPattern: findPattern, isSkewed: isSkewed, depthOf: depthOf, depthLabel: depthLabel,
    STAIR_TYPES: STAIR_TYPES, TREAD_TYPES: TREAD_TYPES, stairType: stairType, treadType: treadType, isLanding: isLanding, hasNose: hasNose, m2Rates: m2Rates
  };
})();
if (typeof module !== 'undefined') module.exports = Calc;
