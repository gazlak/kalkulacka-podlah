/* Čisté výpočetní funkce (bez DOM). Vzorce přesně podle zadání:
 *   A = š · (h + v · p) / 10 000 · n
 *   C = ΣA · (1 + r) · c_m + Σn · (c_n + p · c_p) + c_d
 */
var Calc = (function () {
  function num(v) {
    if (v === null || v === undefined || v === '') return NaN;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  function n0(v) { var n = num(v); return isNaN(n) ? 0 : n; }
  function roundTo(x, step) { step = step || 1; return Math.round(x / step) * step; }

  // plocha jedné skupiny v m²; š=šířka, h=hloubka nášlapu, v=výška podstupnice, p=obkládat podstupnici, n=počet
  function groupArea(g) {
    var p = g.coverRiser ? 1 : 0;
    return n0(g.width) * (n0(g.depth) + n0(g.riserHeight) * p) / 10000 * n0(g.count);
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
    var treads = 0, riserTreads = 0;
    groups.forEach(function (g) {
      var n = n0(g.count);
      treads += n;
      if (g.coverRiser) riserTreads += n;
    });
    var waste = pat ? pat.wastePct / 100 : 0;
    var materialRaw = pat ? totalArea * (1 + waste) * pat.materialPerM2 : 0;
    var material = roundTo(materialRaw, step);
    var labor = pat ? roundTo(treads * pat.laborPerTread, step) : 0;
    var risers = roundTo(riserTreads * rates.riserSurcharge, step);
    var transport = roundTo(rates.transport, step);
    var extrasTotal = roundTo(computeExtras(extras, rates), step);
    var subtotal = material + labor + risers + transport + extrasTotal;
    var d = discount || { type: 'pct', value: 0 };
    var dv = n0(d.value);
    var discountAmount = d.type === 'czk' ? dv : subtotal * dv / 100;
    discountAmount = Math.min(subtotal, Math.max(0, roundTo(discountAmount, step)));
    var base = subtotal - discountAmount;
    var vat = roundTo(base * vatRate, step);
    return {
      areas: areas, totalArea: totalArea, treads: treads, riserTreads: riserTreads,
      wastePct: pat ? pat.wastePct : 0,
      material: material, labor: labor, risers: risers, transport: transport, extras: extrasTotal,
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
    [['width', 'Šířka'], ['depth', 'Hloubka nášlapu'], ['riserHeight', 'Výška podstupnice']].forEach(function (f) {
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
    validateGroup: validateGroup, findPattern: findPattern
  };
})();
if (typeof module !== 'undefined') module.exports = Calc;
