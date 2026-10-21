/* Čisté výpočetní funkce (bez DOM). Dvě cesty: starý snapshot bez `collections` počítá `legacyQuote` (vzorce níže),
 * nový ceník (kolekce, lamely, normohodiny) jde přes `newQuote`. Vzorce staré cesty podle zadání:
 *   A = š · (h + v · p) / 10 000 · n
 *   U šikmého schodu (jiná hloubka vlevo a vpravo) je h průměr obou hloubek – plocha lichoběžníku (jen staré uložené kalkulace).
 * Model nářezu (ceník s `rates.cut`): dílec je obdélník z desky; L = největší délka, H = hloubka kolmo na ni, R = výška podstupnice.
 *   nášlap L × (H + rezerva), rezerva zvlášť pro vinyl a MDF (výchozí 136 mm bez nosu, 126 mm s nosem); podstupnice vinyl L × R (bez přídavku), MDF 2 × L × (R + přídavek) (dva kusy),
 *   přídavek podstupnice jen u MDF (výchozí 50 mm). Rezerva je v ceně, podlahář ji nevidí. `vinylInfo` (vinyl −50 %) je jen informace pro admina, mimo cenu.
 *   Starší model s `rates.cutMargin` (m = přídavek v cm na každou stranu): nášlap (L + 2m) × (H + 2m [+ nos]), podstupnice (L + 2m) × (R + 2m).
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
    { id: 'straight', label: 'Přímé / rovnoramenné', turn: 0 },
    { id: 'right90', label: 'Pravotočivé 90° (do L)', turn: -90 }, { id: 'left90', label: 'Levotočivé 90° (do L)', turn: 90 },
    { id: 'right', label: 'Pravotočivé 180° (do U)', turn: -180 }, { id: 'left', label: 'Levotočivé 180° (do U)', turn: 180 }
  ];
  var TREAD_TYPES = [{ id: 'nose', label: 'S nosem', nose: true }, { id: 'flat', label: 'Bez nosu' }];
  // typ schodu (skupina): zatím jen informativní, cenu nemění
  var STEP_KINDS = [{ id: 'straight', label: 'Rovný' }, { id: 'skew', label: 'Šikmý / rohový' }];
  // podestové typy zrušeny; staré uložené id se převede na běžné
  var OLD_TREAD = { landingNose: 'nose', landingFlat: 'flat' };
  function pick(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }
  function stairType(c) { return pick(STAIR_TYPES, c.stairType); }
  function treadType(g) { return pick(TREAD_TYPES, OLD_TREAD[g.treadType] || g.treadType); }
  function stepKind(g) { return pick(STEP_KINDS, g.stepKind === 'corner' ? 'skew' : g.stepKind); }
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

  /* ---- STARÁ cesta výpočtu (snapshot bez kolekcí): beze změny, aby uložené kalkulace dál vycházely stejně ---- */
  function legacyQuote(groups, patternId, pricing, discount, vatRate, extras) {
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
    var risers = 0; // příplatek za obklad podstupnice zrušen (podstupnice se obkládá vždy)
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
    var lines = [];
    function ln(key, label, qty, unit, unitPrice, amount, sub) { lines.push({ key: key, label: label, qty: qty, unit: unit, unitPrice: unitPrice, amount: amount, sub: sub || '' }); }
    ln('material', 'Materiál vč. prořezu', totalArea * (1 + waste), 'm²', pat ? n0(pat.materialPerM2) : 0, material, 'prořez ' + (pat ? pat.wastePct : 0) + ' %');
    if (mdf) ln('mdf', 'Podklad MDF', totalArea, 'm²', 0, mdf);
    if (glue) ln('glue', 'Lepidlo', totalArea, 'm²', 0, glue);
    ln('labor', 'Práce', treads, 'nášlap', pat ? n0(pat.laborPerTread) : 0, labor);
    if (laborM2) ln('laborM2', 'Práce za m²', totalArea, 'm²', 0, laborM2);
    if (treadTypes) ln('treadTypes', 'Příplatek za typ nášlapu', 1, 'ks', treadTypes, treadTypes);
    ln('transport', 'Doprava', 1, 'paušál', transport, transport);
    if (rates.extrasEnabled && extrasTotal) ln('extras', 'Volitelné příplatky', 1, 'ks', extrasTotal, extrasTotal);
    return {
      legacy: true, lines: lines, missing: [], prodArea: totalArea, mdfArea: mdf ? totalArea : 0, groupsInfo: [], needsJoint: false,
      areas: areas, totalArea: totalArea, treads: treads, riserTreads: riserTreads,
      wastePct: pat ? pat.wastePct : 0,
      material: material, labor: labor, mdf: mdf, glue: glue, laborM2: laborM2, risers: risers, treadTypes: treadTypes, transport: transport, extras: extrasTotal,
      subtotal: subtotal, discountAmount: discountAmount, base: base, vat: vat, total: base + vat
    };
  }

  /* ================= NOVÁ cesta výpočtu (ceník po kolekcích) ================= */
  function isLegacy(pricing) { return !pricing.collections; }
  function ceil(x) { return Math.ceil(Math.round(x * 1e6) / 1e6); }

  // kolekce dekoru; u rodiny (Design Stone A/B/C) se podle formátu vybere sourozenec
  function collectionOf(pricing, pat, formatId) {
    if (!pat || pat.collectionId === null || pat.collectionId === undefined) return null;
    var cs = pricing.collections || [], c = null, i;
    for (i = 0; i < cs.length; i++) if (cs[i].id === pat.collectionId) c = cs[i];
    if (c && c.family && formatId) {
      for (i = 0; i < cs.length; i++) if (cs[i].family === c.family && cs[i].format === formatId) return cs[i];
    }
    return c;
  }
  // cena Kč/m²: vlastní cena dekoru, jinak kolekce; legacy dekor (bez kolekce) má vlastní materialPerM2
  function patternPrice(pricing, pat, formatId) {
    if (!pat) return 0;
    if (pat.priceOverride !== null && pat.priceOverride !== undefined && pat.priceOverride !== '' && isFinite(num(pat.priceOverride))) return num(pat.priceOverride);
    if (pat.collectionId === null || pat.collectionId === undefined) return n0(pat.materialPerM2);
    var c = collectionOf(pricing, pat, formatId);
    return c ? n0(c.materialPerM2) : 0;
  }
  function patternOffered(pricing, p) {
    if (p.active === false) return false;
    var c = collectionOf(pricing, p, null);
    if (c && c.active === false) return false;
    var v = (pricing.rates || {}).variants;
    if (v && p.variant && v[p.variant] === false) return false;
    return true;
  }

  function defaults(rates) {
    var a = rates.allowance || {}, nz = rates.nose || {}, l = rates.labor || {}, h = l.hoursByTread || {}, g = rates.glue || {}, m = rates.mdf || {}, e = rates.eur || {}, rs = rates.reserve || {};
    var ct = rates.cut;
    // starší plochý tvar {flatMm, noseMm, mdfRiserMm} platí pro vinyl i MDF, přídavek podstupnice jen u MDF
    function cutPart(x, riser) { x = x || {}; return { flat: n0(x.flatMm), nose: n0(x.noseMm), riser: n0(riser !== undefined ? riser : x.riserMm) }; }
    return {
      cut: ct ? (ct.vinyl || ct.mdf ? { vinyl: cutPart(ct.vinyl, 0), mdf: cutPart(ct.mdf) } : { vinyl: cutPart(ct, 0), mdf: cutPart(ct, ct.mdfRiserMm) }) : null,
      vinylInfoPct: isNaN(num(rates.vinylInfoPct)) ? 50 : num(rates.vinylInfoPct),
      cutMargin: isNaN(num(rates.cutMargin)) ? null : num(rates.cutMargin),
      allowance: { width: n0(a.width), depth: n0(a.depth), riser: n0(a.riser) },
      nose: { mdf: n0(nz.mdfOverhangMm) + n0(nz.mdfWrapMm), vinyl: n0(nz.vinylOverhangMm) + n0(nz.vinylWrapMm) },
      hourly: isNaN(num(l.hourly)) ? null : num(l.hourly),
      hours: h, riserHours: n0(l.riserHours),
      mdfPerM2: n0(m.thicknessMm) / 1000 * n0(m.eurPerM3) * n0(e.rate),
      gluePerM2: n0(g.czkPerKg) * n0(g.gPerM2) / 1000, glueLayers: n0(g.layers) >= 2 ? 2 : 1,
      reserve: n0(rs.pct) / 100, reserveOnVinyl: !!rs.onVinyl,
      trimPerBm: n0(rates.trimPerBm), edgePerBm: isNaN(num(rates.edgePerBm)) ? null : num(rates.edgePerBm),
      wasteMode: rates.wasteMode === 'pct' ? 'pct' : 'lamellas'
    };
  }
  // rozměry jednoho dílce v cm: šířka, hloubka pro MDF a pro vinyl, podstupnice, největší hloubka (šikmý schod)
  function pieceDims(g, rates) {
    var d = defaults(rates), nose = hasNose(g);
    if (d.cut) {
      var hc = isSkewed(g) ? Math.max(n0(g.depth), n0(g.depthRight)) : n0(g.depth), cv = d.cut.vinyl, cm = d.cut.mdf, rv = n0(g.riserHeight);
      var addV = nose ? cv.nose : cv.flat, addM = nose ? cm.nose : cm.flat, dv = hc + addV / 10;
      return { w: n0(g.width), dMdf: hc + addM / 10, dVinyl: dv, r: g.coverRiser ? rv : 0, rMdf: g.coverRiser ? 2 * (rv + cm.riser / 10) : 0, rMdfOne: rv + cm.riser / 10, dMax: dv, add: addV, addMdf: addM, addRiserMdf: cm.riser };
    }
    if (d.cutMargin !== null) {
      var m2x = 2 * d.cutMargin, hh = isSkewed(g) ? Math.max(n0(g.depth), n0(g.depthRight)) : n0(g.depth), dv = hh + m2x + (nose ? d.nose.vinyl / 10 : 0);
      return { w: n0(g.width) + m2x, dMdf: hh + m2x + (nose ? d.nose.mdf / 10 : 0), dVinyl: dv, r: g.coverRiser ? n0(g.riserHeight) + m2x : 0, rMdf: g.coverRiser ? n0(g.riserHeight) + m2x : 0, dMax: dv };
    }
    var base = depthOf(g) + d.allowance.depth;
    var maxD = isSkewed(g) ? Math.max(n0(g.depth), n0(g.depthRight)) + d.allowance.depth : base;
    var vNose = nose ? d.nose.vinyl / 10 : 0;
    return {
      w: n0(g.width) + d.allowance.width,
      dMdf: base + (nose ? d.nose.mdf / 10 : 0),
      dVinyl: base + vNose,
      r: g.coverRiser ? n0(g.riserHeight) + d.allowance.riser : 0,
      rMdf: g.coverRiser ? n0(g.riserHeight) + d.allowance.riser : 0,
      dMax: maxD + vNose
    };
  }
  // spotřeba lamel skupiny; null = kolekce bez rozměru lamely
  function lamellaUse(g, dims, coll) {
    var L = coll ? n0(coll.lamellaLengthMm) : 0, Wl = coll ? n0(coll.lamellaWidthMm) : 0;
    if (!(L > 0 && Wl > 0)) return null;
    var n = n0(g.count), W = dims.w * 10;
    var strips = (ceil(dims.dMax * 10 / Wl) + (dims.r ? ceil(dims.r * 10 / Wl) : 0)) * n, needsJoint = W > L, lamel;
    if (!needsJoint) lamel = ceil(strips / Math.floor(L / W));
    else lamel = ceil(strips * W / L); // odřezky se použijí na nastavení
    return { strips: strips, lamellas: lamel, area: lamel * L * Wl / 1e6, needsJoint: needsJoint };
  }

  /* Lišta a hrana. Strana u zdi jde do lišty, otevřená strana do hrany. Délka strany = hloubka té strany
   * (+ výška podstupnice, když se obkládá), z NAMĚŘENÝCH rozměrů. Tady se mění způsob vedení lišty. */
  function sideRuns(groups, stairSide) {
    var trim = 0, edge = 0, per = [];
    groups.forEach(function (g) {
      var s = g.side || stairSide || 'walls', riser = g.coverRiser ? n0(g.riserHeight) : 0, n = n0(g.count);
      var left = (n0(g.depth) + riser) * n / 100, right = ((isSkewed(g) ? n0(g.depthRight) : n0(g.depth)) + riser) * n / 100;
      var lOpen = s === 'openLeft' || s === 'openBoth', rOpen = s === 'openRight' || s === 'openBoth';
      var t = (lOpen ? 0 : left) + (rOpen ? 0 : right), e = (lOpen ? left : 0) + (rOpen ? right : 0);
      trim += t; edge += e; per.push({ trim: t, edge: e });
    });
    return { trimBm: trim, edgeBm: edge, perGroup: per };
  }

  function newQuote(groups, pat, pricing, discount, vatRate, extras, opt) {
    opt = opt || {};
    var rates = pricing.rates, step = rates.roundTo || 1, d = defaults(rates);
    var coll = collectionOf(pricing, pat, opt.formatId), price = patternPrice(pricing, pat, opt.formatId);
    var wastePctPat = pat ? n0(pat.wastePct) : 0, usePct = d.wasteMode === 'pct';
    var areas = [], info = [], totalArea = 0, prodArea = 0, mdfArea = 0, consumption = 0, lamellas = 0, anyLamella = false;
    var treads = 0, riserTreads = 0, hours = 0, riserCount = 0, surchargeRaw = 0, needsJoint = false, sur = rates.treadSurcharge || {};
    groups.forEach(function (g) {
      var n = n0(g.count), dm = pieceDims(g, rates), a = groupArea(g);
      var cutNew = !!d.cut || d.cutMargin !== null;
      var prod = dm.w * (dm.dVinyl + dm.r) / 1e4 * n, mdf = dm.w * (dm.dMdf + dm.rMdf) / 1e4 * n, lam = lamellaUse(g, dm, coll), use;
      if (lam && !usePct) { use = lam.area; anyLamella = true; } else use = prod * (1 + wastePctPat / 100);
      areas.push(a); totalArea += a; prodArea += prod; mdfArea += mdf; consumption += use;
      if (lam) lamellas += lam.lamellas;
      if (lam && lam.needsJoint) needsJoint = true;
      info.push({ measured: a, prod: prod, mdf: mdf, consumption: use, lamellas: lam ? lam.lamellas : null, strips: lam ? lam.strips : null,
        needsJoint: !!(lam && lam.needsJoint), dims: dm, cut: cutNew ? { w: dm.w, d: dm.dVinyl, dMdf: dm.dMdf, r: dm.r, rMdf: dm.rMdf, rMdfOne: dm.rMdfOne, add: dm.add || 0, addMdf: dm.addMdf || 0, addRiser: dm.addRiser || 0, addRiserMdf: dm.addRiserMdf || 0, n: n } : null, wastePct: prod > 0 ? (use / prod - 1) * 100 : 0 });
      treads += n; if (g.coverRiser) { riserTreads += n; riserCount += n; }
      var tt = treadType(g).id; hours += n * n0((d.hours || {})[tt]); surchargeRaw += n * n0(sur[tt]);
    });
    var wastePct = prodArea > 0 ? (consumption / prodArea - 1) * 100 : wastePctPat;
    var lines = [];
    function ln(key, label, qty, unit, unitPrice, sub) {
      var amount = roundTo(qty * unitPrice, step);
      lines.push({ key: key, label: label, qty: qty, unit: unit, unitPrice: unitPrice, amount: amount, sub: sub || '' });
      return amount;
    }
    var res = 1 + d.reserve, missing = [];
    var vinylQty = consumption * (d.reserveOnVinyl ? res : 1);
    var material = ln('material', 'Vinyl', vinylQty, 'm²', price,
      (anyLamella && !usePct ? lamellas + ' lamel, ' : '') + 'prořez ' + String(Math.round(wastePct * 10) / 10).replace('.', ',') + ' %' + (d.reserveOnVinyl && d.reserve ? ', vč. rezervy' : ''));
    var mdf = ln('mdf', 'Podklad MDF', mdfArea * res, 'm²', d.mdfPerM2, 'rezerva ' + Math.round(d.reserve * 1000) / 10 + ' %');
    var glueQty = (prodArea + (d.glueLayers === 2 ? mdfArea : 0)) * res;
    var glue = ln('glue', 'Lepidlo', glueQty, 'm²', d.gluePerM2, d.glueLayers + '× nános');
    var hourly = d.hourly === null ? 0 : d.hourly;
    var labor = ln('labor', 'Práce', hours, 'h', hourly);
    var risers = ln('risers', 'Obklad podstupnic', riserCount * d.riserHours, 'h', hourly, riserCount + ' ks');
    var runs = sideRuns(groups, opt.stairSide);
    var trimBm = isNaN(num(opt.trimBm)) ? runs.trimBm : num(opt.trimBm), edgeBm = isNaN(num(opt.edgeBm)) ? runs.edgeBm : num(opt.edgeBm);
    var trim = trimBm > 0 ? ln('trim', 'Lišta KPV50', trimBm, 'bm', d.trimPerBm) : 0;
    var edge = edgeBm > 0 ? ln('edge', 'Vinylová hrana', edgeBm, 'bm', d.edgePerBm === null ? 0 : d.edgePerBm) : 0;
    var transport = ln('transport', 'Doprava', 1, 'paušál', n0(rates.transport));
    var treadTypes = roundTo(surchargeRaw, step);
    if (treadTypes) lines.push({ key: 'treadTypes', label: 'Příplatek za typ nášlapu', qty: 1, unit: 'ks', unitPrice: treadTypes, amount: treadTypes, sub: '' });
    var extrasTotal = roundTo(computeExtras(extras, rates), step);
    if (extrasTotal) lines.push({ key: 'extras', label: 'Volitelné příplatky', qty: 1, unit: 'ks', unitPrice: extrasTotal, amount: extrasTotal, sub: '' });
    if (hours + riserCount * d.riserHours > 0 && d.hourly === null) missing.push('hodinová sazba práce');
    if (edgeBm > 0 && d.edgePerBm === null) missing.push('cena vinylové hrany');
    if (pat && !(price > 0)) missing.push('cena vinylu');
    var subtotal = lines.reduce(function (s, l) { return s + l.amount; }, 0);
    var dsc = discount || { type: 'pct', value: 0 }, dv = n0(dsc.value);
    var discountAmount = dsc.type === 'czk' ? dv : subtotal * dv / 100;
    discountAmount = Math.min(subtotal, Math.max(0, roundTo(discountAmount, step)));
    var base = subtotal - discountAmount, vat = roundTo(base * vatRate, step);
    return {
      legacy: false, lines: lines, missing: missing, areas: areas, totalArea: totalArea, prodArea: prodArea, mdfArea: mdfArea,
      groupsInfo: info, needsJoint: needsJoint, lamellas: anyLamella ? lamellas : null,
      trim: { bm: trimBm, perBm: d.trimPerBm, amount: trim }, edge: { bm: edgeBm, perBm: d.edgePerBm, amount: edge },
      autoTrimBm: runs.trimBm, autoEdgeBm: runs.edgeBm,
      treads: treads, riserTreads: riserTreads, wastePct: wastePct,
      material: material, labor: labor, mdf: mdf, glue: glue, laborM2: 0, risers: risers, treadTypes: treadTypes, transport: transport, extras: extrasTotal,
      vinylInfo: { pct: d.vinylInfoPct, amount: roundTo(material * (1 - d.vinylInfoPct / 100), step) },
      subtotal: subtotal, discountAmount: discountAmount, base: base, vat: vat, total: base + vat
    };
  }

  /* pricing = {patterns[], rates, collections?}; discount = {type:'pct'|'czk', value}; extras = {key: množství};
   * opt = {stairSide, trimBm, edgeBm, formatId} (volitelné, jen nová cesta) */
  function computeQuote(groups, patternId, pricing, discount, vatRate, extras, opt) {
    if (isLegacy(pricing)) return legacyQuote(groups, patternId, pricing, discount, vatRate, extras);
    return newQuote(groups, findPattern(pricing, patternId), pricing, discount, vatRate, extras, opt);
  }

  function comparePatterns(groups, pricing, discount, vatRate, extras, opt) {
    return pricing.patterns.map(function (p) {
      return { pattern: p, quote: computeQuote(groups, p.id, pricing, discount, vatRate, extras, opt) };
    });
  }
  var czk = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });
  var m2 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function formatCZK(x) { return czk.format(x).replace(/ /g, ' '); }
  function formatM2(x) { return m2.format(x) + ' m²'; }

  // validace polí skupiny; vrací {field: 'chyba'} (prázdný objekt = OK)
  function validateGroup(g) {
    var e = {};
    var fields = [['width', 'Největší délka'], ['depth', 'Hloubka'], ['riserHeight', 'Výška podstupnice']];
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
    isLegacy: isLegacy, collectionOf: collectionOf, patternPrice: patternPrice, patternOffered: patternOffered, pieceDims: pieceDims, lamellaUse: lamellaUse, sideRuns: sideRuns, defaults: defaults,
    STAIR_TYPES: STAIR_TYPES, TREAD_TYPES: TREAD_TYPES, stairType: stairType, treadType: treadType, STEP_KINDS: STEP_KINDS, stepKind: stepKind, hasNose: hasNose, m2Rates: m2Rates
  };
})();
if (typeof module !== 'undefined') module.exports = Calc;
