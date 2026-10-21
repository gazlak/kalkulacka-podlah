/* Seed data (DEFAULTS). Sazby, uživatelé a kalkulace jsou VYMYŠLENÉ – ukázková data pro prototyp.
 * Za běhu se čte výhradně ze Store (localStorage); DEFAULTS slouží jen jako seed. */
// kolekce vinylu Šesták: MOC bez DPH (Kč/m²) a rozměr lamely/dlaždice v mm. Design Stone A/B/C jsou formáty téže kolekce (family).
var DEFAULT_COLLECTIONS = [
  { id: 'authentic-oak', no: 1, name: 'Authentic Oak 0,55', materialPerM2: 696, lamellaLengthMm: 1219.2, lamellaWidthMm: 228.6 },
  { id: 'dv-home', no: 2, name: 'Design Vinyl Home 0,3', materialPerM2: 496, lamellaLengthMm: 1219.2, lamellaWidthMm: 228.6 },
  { id: 'dv-extreme', no: 3, name: 'Design Vinyl Extreme 0,55', materialPerM2: 626, lamellaLengthMm: 1219.2, lamellaWidthMm: 228.6 },
  { id: 'grandissimo', no: 4, name: 'Grandissimo 0,55', materialPerM2: 726, lamellaLengthMm: 1524, lamellaWidthMm: 228.6 },
  { id: 'grandissimo-plus', no: 5, name: 'Grandissimo Plus 0,55', materialPerM2: 726, lamellaLengthMm: 1524, lamellaWidthMm: 228 },
  { id: 'bellissimo', no: 6, name: 'Bellissimo 0,5', materialPerM2: 580, lamellaLengthMm: 1227, lamellaWidthMm: 187 },
  { id: 'xl-03', no: 7, name: 'XL 0,3', materialPerM2: 626, lamellaLengthMm: 1524, lamellaWidthMm: 228.6 },
  { id: 'xl-04', no: 8, name: 'XL 0,4', materialPerM2: 648, lamellaLengthMm: 1524, lamellaWidthMm: 228.6 },
  { id: 'xl-055', no: 9, name: 'XL 0,55', materialPerM2: 668, lamellaLengthMm: 1524, lamellaWidthMm: 228.6 },
  { id: 'style-floor', no: 10, name: 'Style Floor', materialPerM2: 546, lamellaLengthMm: 1219.2, lamellaWidthMm: 228.6 },
  { id: 'grand-floor', no: 11, name: 'Grand Floor 0,4', materialPerM2: 646, lamellaLengthMm: 1524, lamellaWidthMm: 228.6 },
  { id: 'design-stone-a', no: 12, name: 'Design Stone 0,55 A', materialPerM2: 746, lamellaLengthMm: 914.4, lamellaWidthMm: 457.2, family: 'design-stone', format: 'A' },
  { id: 'design-stone-b', no: 13, name: 'Design Stone 0,55 B', materialPerM2: 746, lamellaLengthMm: 609.6, lamellaWidthMm: 609.6, family: 'design-stone', format: 'B' },
  { id: 'design-stone-c', no: 14, name: 'Design Stone 0,55 C', materialPerM2: 746, lamellaLengthMm: 914.4, lamellaWidthMm: 914.4, family: 'design-stone', format: 'C' },
  { id: 'grand-stone', no: 15, name: 'Grand Stone 0,4', materialPerM2: 599, lamellaLengthMm: 914.4, lamellaWidthMm: 457.2 }
].map(function (c) { c.active = true; return c; });

// párování dekoru na kolekci podle názvu kolekce z e-shopu (r[1]); od nejkonkrétnějšího pravidla, null = bez kolekce (skryto)
var COLLECTION_RULES = [
  [/DESIGN STONE/, 'design-stone-a'], [/GRANDISSIMO PLUS/, 'grandissimo-plus'], [/GRANDISSIMO/, 'grandissimo'],
  [/AUTHENTIC OAK/, 'authentic-oak'], [/DESIGN VINYL EXTREME/, 'dv-extreme'], [/DESIGN VINYL HOME/, 'dv-home'], [/BELLISSIMO/, 'bellissimo'],
  [/XL LARGE/, null], [/KOLEKCE XL 0,55|XL CLICK 0,55/, 'xl-055'], [/^XL .*0,3/, 'xl-03'], [/^XL .*0,4/, 'xl-04'],
  [/STYLE FLOOR/, 'style-floor'], [/GRAND FLOOR/, 'grand-floor'], [/GRAND STONE/, 'grand-stone']
];
function collectionIdFor(kolekce) {
  for (var i = 0; i < COLLECTION_RULES.length; i++) if (COLLECTION_RULES[i][0].test(kolekce)) return COLLECTION_RULES[i][1];
  return null;
}

var DEFAULTS = {
  // vzory = dekory Floor Forever (patterns.js). Cenu za m² dědí z kolekce (collectionId), případně ji přepíše priceOverride.
  // Dekor bez kolekce (dřevo, laminát, Economy, Primero, Divino, XL Large) je neaktivní, ale nemaže se.
  collections: DEFAULT_COLLECTIONS,
  patterns: FF_PATTERNS.map(function (r, i) {
    var cid = r[0] === 'vinyl' ? collectionIdFor(r[1]) : null;
    return { id: i + 1, name: r[2], typ: r[0], kolekce: r[1], barva: r[3], texture: r[0] === 'laminat' ? 'laminate' : 'planks', tint: '#c9a266',
      photo: FF_IMG + r[5], collectionId: cid, variant: /CLICK/.test(r[2]) ? 'click' : 'glued', priceOverride: null, active: !!cid, wastePct: 10 };
  }),
  rates: {
    // STARÁ pole (m2.byTread, extras edges/trims) čte jen legacy cesta výpočtu; nová cesta je nečte
    transport: 1500,
    mdf: { thicknessMm: 12, eurPerM3: 375 }, eur: { rate: 25, changedAt: Date.now() },
    glue: { czkPerKg: 324, gPerM2: 300, layers: 1 },
    reserve: { pct: 5, onVinyl: false },
    labor: { hourly: 400, hoursByTread: { nose: 1, flat: 1 }, riserHours: 1 },
    trimPerBm: 99, edgePerBm: null,
    cut: { vinyl: { flatMm: 136, noseMm: 126 }, mdf: { flatMm: 136, noseMm: 126, riserMm: 50 } },  // rezerva na ořez zvlášť pro vinyl a MDF: hloubka nášlapu bez nosu / s nosem, přídavek k výšce podstupnice jen u MDF
    vinylInfoPct: 50,  // informativní „vinyl −50 %“ jen pro admina, mimo cenu
    allowance: { width: 3, depth: 0, riser: 0 },  // starý přídavek – jen pro uložené kalkulace bez cut a cutMargin
    nose: { mdfOverhangMm: 0, mdfWrapMm: 0, vinylOverhangMm: 0, vinylWrapMm: 0 },
    wasteMode: 'lamellas',
    variants: { glued: true, click: true },
    // příplatek podle typu nášlapu (Kč/nášlap) – zatím bez vstupů, proto 0
    treadSurcharge: { nose: 0, flat: 0 },
    // složky ceny za m² podle typu nášlapu: podklad MDF (tloušťka v mm × cena za m³ v EUR × kurz), lepidlo a práce za m²
    // kurz je ukázkový; lepidlo a práce za m² zatím bez vstupů, proto 0
    m2: {
      mdfEurM3: 370, eurRate: 25,
      byTread: {
        nose: { mdfMm: 12, glue: 0, labor: 0 }, flat: { mdfMm: 12, glue: 0, labor: 0 }
      }
    },
    vatDefault: 0.21, vatOptions: [0.21, 0.12], roundTo: 1,
    extrasEnabled: false,
    extras: []  // volitelné příplatky (demontáž, vyrovnání) zrušeny
  },
  // role: user | admin; status: aktivní | pozván | neověřen (sám se registroval, čeká na odkaz z e-mailu) | blokován
  users: [
    { id: 'u1', email: 'admin@demo.cz', password: 'admin1234', role: 'admin', status: 'aktivní', failedAttempts: 0, lockedUntil: null,
      profile: { name: 'Eva Admínová', company: 'Podlahy Admin s.r.o.', ico: '12345678', phone: '+420 601 000 001', logo: null } },
    { id: 'u2', email: 'novak@demo.cz', password: 'heslo1234', role: 'user', status: 'aktivní', failedAttempts: 0, lockedUntil: null,
      profile: { name: 'Jan Novák', company: 'Novák – podlahy a schody', ico: '87654321', phone: '+420 602 111 222', logo: null } },
    { id: 'u3', email: 'svoboda@demo.cz', password: 'heslo1234', role: 'user', status: 'aktivní', failedAttempts: 0, lockedUntil: null,
      profile: { name: 'Petr Svoboda', company: 'Svoboda Parkety', ico: '11223344', phone: '+420 603 333 444', logo: null } }
  ],
  // vzorové kalkulace; snapshot a data se doplní při seedu (store.js)
  calculations: [
    { id: 'c1', ownerId: 'u2', number: '2026-0039', daysAgo: 12, status: 'přijato', sentTo: 'dvorak@example.cz',
      job: { name: 'Rodinný dům Dvořákovi', customer: 'Karel Dvořák', address: 'Lipová 12, Brno', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 12, coverRiser: true }], patternId: 1, discount: { type: 'pct', value: 5 }, vatRate: 0.21 },
    { id: 'c2', ownerId: 'u2', number: '2026-0041', daysAgo: 3, status: 'odesláno', sentTo: 'horakova@example.cz',
      job: { name: 'Byt Horákovi – vstupní schodiště', customer: 'Marie Horáková', address: 'Nádražní 5, Praha', note: 'Zákazník chce tmavší odstín' },
      groups: [{ width: 100, depth: 30, riserHeight: 18, count: 10, coverRiser: true }, { width: 120, depth: 30, riserHeight: 18, count: 2, coverRiser: true }],
      patternId: 3, discount: { type: 'czk', value: 500 }, vatRate: 0.21 },
    { id: 'c3', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null,
      job: { name: 'Rozpracovaná zakázka – Černý', customer: 'Tomáš Černý', address: '', note: '' },
      groups: [{ width: 85, depth: 27, riserHeight: 16, count: 14, coverRiser: true }], patternId: null, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'c4', ownerId: 'u3', number: '2026-0040', daysAgo: 5, status: 'předáno', sentTo: null,
      job: { name: 'Chata Procházkovi', customer: 'Ivan Procházka', address: 'Horní Lhota 44', note: '' },
      groups: [{ width: 80, depth: 26, riserHeight: 19, count: 8, coverRiser: true }], patternId: 5, discount: { type: 'pct', value: 0 }, vatRate: 0.12 },
    { id: 'c5', ownerId: 'u1', number: '2026-0038', daysAgo: 20, status: 'odesláno', sentTo: 'admin-zakaznik@example.cz',
      job: { name: 'Showroom – ukázkové schodiště', customer: 'Interiéry Plus', address: 'Průmyslová 1, Ostrava', note: '' },
      groups: [{ width: 110, depth: 32, riserHeight: 17, count: 6, coverRiser: true }], patternId: 4, discount: { type: 'pct', value: 10 }, vatRate: 0.21 },
    // pravotočivé schodiště 180°: rovné rameno, šest točitých schodů po 30° (úhlopříčka 95 cm, kolmice 62 cm), rovné rameno
    { id: 'c6', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'right',
      job: { name: 'Ukázka – pravotočivé 180° s kosými schody', customer: 'Jana Malá', address: 'Školní 8, Olomouc', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 4, coverRiser: true, treadType: 'nose' },
        { width: 95, depth: 62, riserHeight: 17, count: 6, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 28, riserHeight: 17, count: 4, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    // ukázky typů schodišť pro demo (koncepty, jde je hned upravit)
    { id: 'd1', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'straight', demo: true,
      job: { name: 'Ukázka – přímé schodiště', customer: 'Demo', address: '', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 13, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'd2', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'straight', turnSide: 'right', demo: true,
      job: { name: 'Ukázka – rovnoramenné s podestou', customer: 'Demo', address: '', note: '' },
      groups: [{ width: 100, depth: 28, riserHeight: 17, count: 7, coverRiser: true, treadType: 'nose' },
        { width: 200, depth: 100, riserHeight: 17, count: 1, coverRiser: true, treadType: 'landingNose' },
        { width: 100, depth: 28, riserHeight: 17, count: 7, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'd3', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'right90', demo: true,
      job: { name: 'Ukázka – pravotočivé 90° s podestou', customer: 'Demo', address: '', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 6, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 90, riserHeight: 17, count: 1, coverRiser: true, treadType: 'landingNose' },
        { width: 90, depth: 28, riserHeight: 17, count: 7, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'd4', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'left90', demo: true,
      job: { name: 'Ukázka – levotočivé 90° s podestou', customer: 'Demo', address: '', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 6, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 90, riserHeight: 17, count: 1, coverRiser: true, treadType: 'landingNose' },
        { width: 90, depth: 28, riserHeight: 17, count: 7, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'd5', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'right90', demo: true,
      job: { name: 'Ukázka – pravotočivé 90° s kosými schody', customer: 'Demo', address: '', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 5, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 62, depthRight: 10, depthSame: false, riserHeight: 17, count: 3, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 28, riserHeight: 17, count: 5, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'd6', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'left', demo: true,
      job: { name: 'Ukázka – levotočivé 180° s kosými schody', customer: 'Demo', address: '', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 4, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 10, depthRight: 62, depthSame: false, riserHeight: 17, count: 6, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 28, riserHeight: 17, count: 4, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'd7', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null, stairType: 'right', demo: true,
      job: { name: 'Ukázka – pravotočivé 180° se dvěma podestami', customer: 'Demo', address: '', note: '' },
      groups: [{ width: 90, depth: 28, riserHeight: 17, count: 4, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 90, riserHeight: 17, count: 1, coverRiser: true, treadType: 'landingNose' },
        { width: 90, depth: 28, riserHeight: 17, count: 3, coverRiser: true, treadType: 'nose' },
        { width: 90, depth: 90, riserHeight: 17, count: 1, coverRiser: true, treadType: 'landingNose' },
        { width: 90, depth: 28, riserHeight: 17, count: 4, coverRiser: true, treadType: 'nose' }],
      patternId: 1, discount: { type: 'pct', value: 0 }, vatRate: 0.21 }
  ]
};

/* ---------- SVG textury místo fotek ---------- */
var Textures = (function () {
  function rnd(seed) { var s = seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return Math.max(0, Math.min(255, Math.round(v * f))); }
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }
  function planks(t, narrow) {
    var r = rnd(narrow ? 7 : 3), h = narrow ? 14 : 22, out = '';
    for (var y = 0; y < 120; y += h) {
      var x = -r() * 60;
      while (x < 160) {
        var w = 50 + r() * 50;
        out += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + h + '" fill="' + shade(t, 0.88 + r() * 0.24) + '" stroke="' + shade(t, 0.6) + '" stroke-width=".7"/>';
        out += '<path d="M' + (x + 4) + ' ' + (y + h * 0.35) + 'h' + (w * 0.5).toFixed(1) + 'M' + (x + w * 0.3) + ' ' + (y + h * 0.7) + 'h' + (w * 0.5).toFixed(1) + '" stroke="' + shade(t, 0.75) + '" stroke-width=".5" opacity=".6"/>';
        x += w;
      }
    }
    return out;
  }
  function herringbone(t) {
    var r = rnd(11), out = '', s = 16, k = 0;
    for (var y = -s; y < 130; y += s) {
      for (var x = -s * 2; x < 170; x += s * 2) {
        var o = (k % 2) * s;
        out += '<polygon points="' + (x + o) + ',' + y + ' ' + (x + o + s * 2) + ',' + (y + s) + ' ' + (x + o + s * 2 - 5) + ',' + (y + s + 5) + ' ' + (x + o - 5) + ',' + (y + 5) + '" fill="' + shade(t, 0.85 + r() * 0.3) + '" stroke="' + shade(t, 0.55) + '" stroke-width=".7"/>';
        out += '<polygon points="' + (x + o + s * 2) + ',' + (y + s) + ' ' + (x + o + s * 2) + ',' + (y + s * 2 + 4) + ' ' + (x + o + s * 2 - 5) + ',' + (y + s * 2 + 9) + ' ' + (x + o + s * 2 - 5) + ',' + (y + s + 5) + '" fill="' + shade(t, 0.8 + r() * 0.3) + '" stroke="' + shade(t, 0.55) + '" stroke-width=".7"/>';
      }
      k++;
    }
    return out;
  }
  function parquet(t) {
    var r = rnd(5), out = '', s = 30;
    for (var y = 0; y < 120; y += s) for (var x = 0; x < 160; x += s) {
      var horiz = ((x / s) + (y / s)) % 2 === 0, f = shade(t, 0.85 + r() * 0.3);
      for (var i = 0; i < 3; i++) {
        out += horiz ? '<rect x="' + x + '" y="' + (y + i * s / 3) + '" width="' + s + '" height="' + s / 3 + '"' : '<rect x="' + (x + i * s / 3) + '" y="' + y + '" width="' + s / 3 + '" height="' + s + '"';
        out += ' fill="' + (i % 2 ? f : shade(t, 1.08)) + '" stroke="' + shade(t, 0.5) + '" stroke-width=".6"/>';
      }
    }
    return out;
  }
  function stone(t) {
    var r = rnd(9), out = '<rect width="160" height="120" fill="' + shade(t, 0.5) + '"/>';
    for (var y = 2; y < 120; y += 30) for (var x = 2; x < 160; x += 40) {
      var w = 34 + r() * 4, h = 26 + r() * 2, f = shade(t, 0.8 + r() * 0.4);
      out += '<rect x="' + (x + (y % 60 ? 0 : 10)) + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + f + '"/>';
      out += '<path d="M' + (x + 6) + ' ' + (y + 8) + 'q10 6 20 0M' + (x + 10) + ' ' + (y + 18) + 'q8 -5 18 2" stroke="' + shade(t, 0.6) + '" stroke-width=".7" fill="none" opacity=".6"/>';
    }
    return out;
  }
  function svg(kind, tint) {
    var body = kind === 'herringbone' ? herringbone(tint) : kind === 'parquet' ? parquet(tint)
      : kind === 'stone' ? stone(tint) : kind === 'laminate' ? planks(tint, true) : planks(tint, false);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice"><rect width="160" height="120" fill="' + tint + '"/>' + body + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  var cache = {};
  return {
    uri: function (kind, tint) { var k = kind + tint; return cache[k] || (cache[k] = svg(kind, tint)); },
    kinds: ['planks', 'herringbone', 'parquet', 'stone', 'laminate']
  };
})();
