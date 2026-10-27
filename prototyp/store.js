/* localStorage – "databáze" prototypu, session, číslování. */
var Store = (function () {
  var KEY = 'kp_db_v2', SKEY = 'kp_session_v1';
  var db = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return (p || 'id') + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

  /* ukázková vizualizace na fotce u točitého schodiště c6 (soubory v ukazky/, bez volání Gemini) */
  function demoViz(d) {
    d.demoViz = 2;
    var c = d.calculations.filter(function (x) { return x.id === 'c6'; })[0];
    if (!c) return d;
    if (!(c.photos || []).length) c.photos = ['ukazky/c6-foto.jpg']; // stejná fotka i v kroku Fotografie
    if ((c.visuals || []).length) return d;
    c.visuals = [{ url: 'ukazky/c6-vizualizace.jpg', original: 'ukazky/c6-foto.jpg', patternId: c.patternId, patternName: '6014 DUB ALVIO LEPENÁ 0,5', createdAt: Date.now(), demo: true }];
    c.visualsUsed = Math.max(c.visualsUsed || 0, 1);
    return d;
  }
  function seed() {
    if (typeof SEED_DB !== 'undefined') { var sd = clone(SEED_DB); sd.tokens = {}; sd.seedVersion = SEED_VERSION; if (sd.rates && sd.rates.markup === undefined) sd.rates.markup = clone(DEFAULTS.rates.markup); if (sd.rates && sd.rates.stairPrice === undefined) sd.rates.stairPrice = clone(DEFAULTS.rates.stairPrice); if (sd.rates && sd.rates.costPrice === undefined) sd.rates.costPrice = clone(DEFAULTS.rates.costPrice); if (sd.rates && sd.rates.landingPrice === undefined) sd.rates.landingPrice = clone(DEFAULTS.rates.landingPrice); return demoViz(sd); }
    var d = {
      patterns: clone(DEFAULTS.patterns),
      collections: clone(DEFAULTS.collections),
      rates: clone(DEFAULTS.rates),
      users: clone(DEFAULTS.users),
      tokens: {},
      calculations: [], demoWinder: 1, demoStairs: 1
    };
    DEFAULTS.calculations.forEach(function (c) { d.calculations.push(seedCalc(c)); });
    return demoViz(d);
  }
  function seedCalc(c) {
    var t = Date.now() - c.daysAgo * 86400000 - (c.daysAgo ? 3600000 * 2 : 0);
    var k = clone(c); delete k.daysAgo;
    k.createdAt = t; k.updatedAt = t;
    k.snapshot = k.number ? { patterns: clone(sameCollection(DEFAULTS.patterns, k.patternId)), rates: clone(DEFAULTS.rates), collections: clone(DEFAULTS.collections) } : null;
    return k;
  }

  // jednorázová migrace starších uložených dat na ceník po kolekcích; snapshoty kalkulací se nemění (počítají postaru)
  function migrate(d) {
    if (d.collections) return false;
    d.collections = clone(DEFAULTS.collections);
    var seed = {};
    DEFAULTS.patterns.forEach(function (p) { seed[p.id] = p; });
    d.patterns.forEach(function (p) {
      var s = seed[p.id];
      if (!s) { p.collectionId = null; p.variant = 'glued'; p.priceOverride = null; p.active = false; return; }
      p.collectionId = s.collectionId; p.variant = s.variant; p.priceOverride = null; p.active = s.active;
    });
    var r = d.rates, def = DEFAULTS.rates;
    ['mdf', 'eur', 'glue', 'reserve', 'labor', 'trimPerBm', 'edgePerBm', 'allowance', 'nose', 'wasteMode', 'variants', 'cut'].forEach(function (k) {
      if (r[k] === undefined) r[k] = clone(def[k]);
    });
    delete r.cutMargin;
    return true;
  }

  // pojistka pro admina: už předané kalkulace dostanou verzi „původní od podlaháře“ (jednou)
  function origVersions() {
    db.verOrig = 1;
    db.calculations.forEach(function (c) {
      var o = userById(c.ownerId);
      if (c.status === 'koncept' || c.versions || !o || o.role === 'admin') return;
      var d = clone(c); delete d.photos; delete d.versions;
      c.versions = [{ at: c.updatedAt || Date.now(), by: c.ownerId, kind: 'original', data: d }];
    });
  }
  /* Společná data přes server.py (/api/db): kdo kalkulaci uloží, toho ji vidí i admin na jiném zařízení.
   * Bez serveru (file://) nebo při výpadku zůstává jen localStorage. Volání jsou synchronní – prototyp, malá data. */
  var REMOTE = /^https?:$/.test(location.protocol), rev = 0, basePricing = '', replaceNext = false;
  function remote(method, body) {
    if (!REMOTE) return null;
    try {
      var x = new XMLHttpRequest(); x.open(method, 'api/db', false);
      if (body) x.setRequestHeader('Content-Type', 'application/json');
      x.send(body ? JSON.stringify(body) : null);
      if (x.status !== 200) return null;
      var r = JSON.parse(x.responseText); return r && r.db ? r : false; // false = na serveru zatím nic není
    } catch (e) { return null; }
  }
  function pricingKey(d) { return JSON.stringify([d.rates, d.patterns, d.collections]); }
  // před přechodem na jinou obrazovku si stáhne novější společná data (nová kalkulace podlaháře, změna ceníku adminem)
  function sync() {
    var r = remote('GET');
    if (r && r.db && r.rev > rev) { db = r.db; rev = r.rev; basePricing = pricingKey(db); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } return true; }
    return false;
  }
  function load() {
    var shared = remote('GET');
    if (shared && shared.db) { rev = shared.rev; try { localStorage.setItem(KEY, JSON.stringify(shared.db)); } catch (e) { /* ignore */ } }
    else if (shared === false) replaceNext = true; // na serveru zatím nic není – první uložení ho založí
    basePricing = shared && shared.db ? pricingKey(shared.db) : '';
    var out = loadLocal(), dirty = !shared;
    // nový ceník (cena schodu od nejdražšího dekoru, 27. 10.): všechny kalkulace se jednou přepočítají podle aktuálního ceníku
    if (!db.stairPrice27) { db.stairPrice27 = 1; db.calculations.forEach(function (c) { if (c.snapshot) c.snapshot = snapshotFor(c.patternId); }); dirty = true; }
    // cena schodu z materiálu (27. 10.): všechny kalkulace se jednou přepočítají podle aktuálního ceníku
    if (!db.costPrice27) { db.costPrice27 = 1; if (db.rates.costPrice === undefined) db.rates.costPrice = clone(DEFAULTS.rates.costPrice); db.calculations.forEach(function (c) { if (c.snapshot) c.snapshot = snapshotFor(c.patternId); }); dirty = true; }
    if (dirty) save();
    return db;
  }
  function loadLocal() {
    try { var raw = localStorage.getItem(KEY); if (raw) { db = JSON.parse(raw);
      // nový snapshot výchozích dat (seed-db.js) nahradí starší uložená data (jednou)
      if (db && typeof SEED_DB !== 'undefined' && db.seedVersion !== SEED_VERSION) { db = seed(); replaceNext = true; save(); return db; }
      if (db && db.users) { if (migrate(db)) save();
      // doprava se nepočítá – uložený paušál se vynuluje (jednou); uložené kalkulace drží své ceny
      if (!db.noTransport) { db.rates.transport = 0; db.noTransport = 1; save(); }
      // práce 1 h na celý schod – podstupnice už nemá vlastní hodinu (jednou)
      if (!db.stepHour) { db.rates.labor.riserHours = 0; db.stepHour = 1; save(); }
      if (!db.rates.m2) { db.rates.m2 = clone(DEFAULTS.rates.m2); db.rates.treadSurcharge = db.rates.treadSurcharge || clone(DEFAULTS.rates.treadSurcharge); save(); }
      // volitelné příplatky (demontáž, vyrovnání) a příplatek za podstupnici byly zrušeny – vyčistí se i z uložených dat
      if ((db.rates.extras || []).length || db.rates.extrasEnabled || db.rates.riserSurcharge !== undefined) { db.rates.extras = []; db.rates.extrasEnabled = false; delete db.rates.riserSurcharge; save(); }
      // nový model rezervy na ořez nahradil cutMargin (platí jen ve starých snapshotech)
      if (!db.rates.cut) { db.rates.cut = clone(DEFAULTS.rates.cut); delete db.rates.cutMargin; save(); }
      else if (!db.rates.cut.vinyl) { var oc = db.rates.cut; db.rates.cut = { vinyl: { flatMm: oc.flatMm, noseMm: oc.noseMm }, mdf: { flatMm: oc.flatMm, noseMm: oc.noseMm, riserMm: oc.mdfRiserMm } }; save(); }
      if (db.rates.vinylInfoPct === undefined) { db.rates.vinylInfoPct = DEFAULTS.rates.vinylInfoPct; save(); }
      if (db.rates.markup === undefined) { db.rates.markup = clone(DEFAULTS.rates.markup); save(); }
      // cena schodu od nejdražšího dekoru (podle ceníku AKTO) přibyla 27. 10. – doplní se jednou
      if (db.rates.stairPrice === undefined) { db.rates.stairPrice = clone(DEFAULTS.rates.stairPrice); save(); }
      if (db.rates.landingPrice === undefined) { db.rates.landingPrice = clone(DEFAULTS.rates.landingPrice); save(); }
      // cena schodu z materiálu + 10 % + práce + marže 50 % přibyla 27. 10. – doplní se jednou
      // výchozí DPH 12 % (27. 10.) – nastaví se jednou; uložené kalkulace drží svou sazbu, pozdější změna v Sazbách zůstane
      if (!db.vat12) { db.vat12 = 1; db.rates.vatDefault = 0.12; save(); }
      // DPH 12 % i u všech už uložených kalkulací (27. 10., jednou)
      if (!db.vat12calc) { db.vat12calc = 1; db.calculations.forEach(function (c) { c.vatRate = 0.12; }); save(); }
      if (db.rates.costPrice === undefined) { db.rates.costPrice = clone(DEFAULTS.rates.costPrice); save(); }
      // výchozí hodinová sazba 400 Kč/h se doplní jednou; pozdější vymazání v Sazbách zůstane platné
      if (!db.hourly400) { db.hourly400 = 1; if (db.rates.labor && db.rates.labor.hourly === null) db.rates.labor.hourly = 400; save(); }
      if (db.rates.allowance && (db.rates.allowance.depth || db.rates.allowance.riser)) { db.rates.allowance.depth = 0; db.rates.allowance.riser = 0; save(); }
      // ukázka točitého schodiště přibyla později – doplní se i do už uložených dat (jednou)
      if (!db.demoWinder) { db.demoWinder = 1; if (!calcById('c6')) db.calculations.push(seedCalc(DEFAULTS.calculations.filter(function (c) { return c.id === 'c6'; })[0])); save(); }
      // ukázky typů schodišť (d1–d7) přibyly později – doplní se jednou
      if (!db.demoStairs) { db.demoStairs = 1; DEFAULTS.calculations.forEach(function (c) { if (c.demo && !calcById(c.id)) db.calculations.push(seedCalc(c)); }); save(); }
      if (!db.verOrig) { origVersions(); save(); }
      if ((db.demoViz || 0) < 2) { demoViz(db); save(); }
      return db; } } } catch (e) { /* poškozená data */ }
    db = seed(); origVersions(); replaceNext = true; save();
    return db;
  }
  function save() {
    var ok = true;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { ok = false; }
    var r = remote('PUT', { db: db, pricingChanged: pricingKey(db) !== basePricing, replace: replaceNext });
    if (r && r.db) { db = r.db; rev = r.rev; basePricing = pricingKey(db); replaceNext = false; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } return true; }
    return ok;
  }
  function reset() { db = seed(); origVersions(); replaceNext = true; save(); }

  /* ----- session ----- */
  function setSession(userId, remember) {
    clearSession();
    var s = JSON.stringify({ userId: userId, expires: Date.now() + 30 * 86400000 });
    try { (remember ? localStorage : sessionStorage).setItem(SKEY, s); } catch (e) { /* ignore */ }
  }
  function clearSession() { try { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY); } catch (e) { /* ignore */ } }
  function currentUser() {
    var raw = null;
    try { raw = sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY); } catch (e) { /* ignore */ }
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s.expires || s.expires < Date.now()) { clearSession(); return null; }
      var u = userById(s.userId);
      if (!u || u.status !== 'aktivní') { clearSession(); return null; }
      return u;
    } catch (e) { return null; }
  }

  function userById(id) { return db.users.filter(function (u) { return u.id === id; })[0] || null; }
  function userByEmail(e) { e = String(e || '').trim().toLowerCase(); return db.users.filter(function (u) { return u.email.toLowerCase() === e; })[0] || null; }

  /* ----- kalkulace ----- */
  function calcById(id) { return db.calculations.filter(function (c) { return c.id === id; })[0] || null; }
  // admin vidí kalkulace všech podlahářů, ostatní jen své
  function canSee(user, c) { return user.role === 'admin' || c.ownerId === user.id; }
  function calcsFor(user) { return db.calculations.filter(function (c) { return canSee(user, c); }); }
  function upsertCalc(c) {
    var i = db.calculations.indexOf(calcById(c.id));
    if (i < 0) db.calculations.push(c); else db.calculations[i] = c;
    return save();
  }
  function nextNumber(ts) {
    var y = new Date(ts || Date.now()).getFullYear(), max = 0;
    db.calculations.forEach(function (c) {
      if (c.number && c.number.indexOf(y + '-') === 0) max = Math.max(max, parseInt(c.number.slice(5), 10) || 0);
    });
    return y + '-' + String(max + 1).padStart(4, '0');
  }
  function currentPricing() { return clone({ patterns: db.patterns, rates: db.rates, collections: db.collections }); }
  // vzory ze stejné kolekce jako vybraný vzor – jen ty jdou do snapshotu (stovky vzorů by zaplnily úložiště) a do porovnání
  function sameCollection(patterns, patternId) {
    var sel = patterns.filter(function (p) { return p.id === patternId; })[0];
    return sel ? patterns.filter(function (p) { return p.kolekce === sel.kolekce; }) : [];
  }
  function snapshotFor(patternId) { return clone({ patterns: sameCollection(db.patterns, patternId), rates: db.rates, collections: db.collections }); }
  function newCalc(user) {
    var now = Date.now();
    return {
      id: uid('c'), ownerId: user.id, number: null, createdAt: now, updatedAt: now, status: 'koncept', sentTo: null,
      job: { name: '', customer: '', address: '', note: '' },
      stairType: 'straight', groups: [newGroup()], patternId: null, discount: { type: 'pct', value: 0 }, vatRate: db.rates.vatDefault,
      extras: {}, stairSide: 'walls', snapshot: null, photos: []
    };
  }
  // výchozí hodnoty = typické rozměry (zrychlení cíle "do 2 minut")
  function newGroup() { return { width: 100, depth: 28, riserHeight: 17, count: 1, coverRiser: true, treadType: 'nose', stepKind: 'straight' }; }

  /* ----- tokeny (pozvánky, reset hesla) ----- */
  function makeToken(type, userId, ttlMs) {
    var t = uid('t') + uid('');
    db.tokens[t] = { type: type, userId: userId, expires: Date.now() + ttlMs };
    save();
    return t;
  }

  return {
    get db() { return db; }, load: load, save: save, sync: sync, get shared() { return REMOTE && rev > 0; }, reset: reset, clone: clone, uid: uid,
    setSession: setSession, clearSession: clearSession, currentUser: currentUser,
    userById: userById, userByEmail: userByEmail,
    calcById: calcById, calcsFor: calcsFor, canSee: canSee, upsertCalc: upsertCalc, nextNumber: nextNumber,
    currentPricing: currentPricing, migrate: migrate, sameCollection: sameCollection, snapshotFor: snapshotFor, newCalc: newCalc, newGroup: newGroup, makeToken: makeToken
  };
})();
