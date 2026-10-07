/* Seed data (DEFAULTS). Vše je VYMYŠLENÉ – ukázková data pro prototyp.
 * Za běhu se čte výhradně ze Store (localStorage); DEFAULTS slouží jen jako seed. */
var DEFAULTS = {
  patterns: [
    { id: 1, name: 'Dub přírodní',   texture: 'planks',      tint: '#c9a266', photo: null, materialPerM2: 1190, wastePct: 10, laborPerTread: 450 },
    { id: 2, name: 'Dub bělený',     texture: 'planks',      tint: '#e3d3b6', photo: null, materialPerM2: 1290, wastePct: 10, laborPerTread: 450 },
    { id: 3, name: 'Ořech americký', texture: 'parquet',     tint: '#6b4631', photo: null, materialPerM2: 1690, wastePct: 12, laborPerTread: 520 },
    { id: 4, name: 'Rybí kost dub',  texture: 'herringbone', tint: '#b98a4e', photo: null, materialPerM2: 1890, wastePct: 15, laborPerTread: 650 },
    { id: 5, name: 'Vinyl kámen',    texture: 'stone',       tint: '#9a9890', photo: null, materialPerM2: 790,  wastePct: 8,  laborPerTread: 380 },
    { id: 6, name: 'Laminát šedý',   texture: 'laminate',    tint: '#8d9094', photo: null, materialPerM2: 590,  wastePct: 8,  laborPerTread: 350 }
  ],
  rates: {
    riserSurcharge: 250, transport: 1500, vatDefault: 0.21, vatOptions: [0.21, 0.12], roundTo: 1,
    extrasEnabled: false,
    extras: [
      { key: 'edges',   label: 'Schodové hrany',   unit: 'bm', price: 180 },
      { key: 'trims',   label: 'Lišty',            unit: 'bm', price: 120 },
      { key: 'removal', label: 'Demontáž starého krytu', unit: 'nášlap', price: 90 },
      { key: 'leveling', label: 'Vyrovnání podkladu',    unit: 'nášlap', price: 110 }
    ]
  },
  // role: user | admin; status: aktivní | pozván | blokován
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
      groups: [{ width: 100, depth: 30, riserHeight: 18, count: 10, coverRiser: true }, { width: 120, depth: 30, riserHeight: 18, count: 2, coverRiser: false }],
      patternId: 3, discount: { type: 'czk', value: 500 }, vatRate: 0.21 },
    { id: 'c3', ownerId: 'u2', number: null, daysAgo: 0, status: 'koncept', sentTo: null,
      job: { name: 'Rozpracovaná zakázka – Černý', customer: 'Tomáš Černý', address: '', note: '' },
      groups: [{ width: 85, depth: 27, riserHeight: 16, count: 14, coverRiser: true }], patternId: null, discount: { type: 'pct', value: 0 }, vatRate: 0.21 },
    { id: 'c4', ownerId: 'u3', number: '2026-0040', daysAgo: 5, status: 'zamítnuto', sentTo: 'prochazka@example.cz',
      job: { name: 'Chata Procházkovi', customer: 'Ivan Procházka', address: 'Horní Lhota 44', note: '' },
      groups: [{ width: 80, depth: 26, riserHeight: 19, count: 8, coverRiser: true }], patternId: 5, discount: { type: 'pct', value: 0 }, vatRate: 0.12 },
    { id: 'c5', ownerId: 'u1', number: '2026-0038', daysAgo: 20, status: 'odesláno', sentTo: 'admin-zakaznik@example.cz',
      job: { name: 'Showroom – ukázkové schodiště', customer: 'Interiéry Plus', address: 'Průmyslová 1, Ostrava', note: '' },
      groups: [{ width: 110, depth: 32, riserHeight: 17, count: 6, coverRiser: true }], patternId: 4, discount: { type: 'pct', value: 10 }, vatRate: 0.21 }
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
