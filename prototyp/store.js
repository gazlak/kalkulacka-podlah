/* localStorage – "databáze" prototypu, session, číslování. */
var Store = (function () {
  var KEY = 'kp_db_v1', SKEY = 'kp_session_v1';
  var db = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return (p || 'id') + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

  function seed() {
    var d = {
      patterns: clone(DEFAULTS.patterns),
      rates: clone(DEFAULTS.rates),
      users: clone(DEFAULTS.users),
      tokens: {},
      calculations: []
    };
    var now = Date.now();
    DEFAULTS.calculations.forEach(function (c) {
      var t = now - c.daysAgo * 86400000 - (c.daysAgo ? 3600000 * 2 : 0);
      var k = clone(c); delete k.daysAgo;
      k.createdAt = t; k.updatedAt = t;
      k.snapshot = k.number ? { patterns: clone(DEFAULTS.patterns), rates: clone(DEFAULTS.rates) } : null;
      d.calculations.push(k);
    });
    return d;
  }

  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { db = JSON.parse(raw); if (db && db.users) return db; } } catch (e) { /* poškozená data */ }
    db = seed(); save();
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
  function reset() { db = seed(); save(); }

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
    save();
  }
  function nextNumber(ts) {
    var y = new Date(ts || Date.now()).getFullYear(), max = 0;
    db.calculations.forEach(function (c) {
      if (c.number && c.number.indexOf(y + '-') === 0) max = Math.max(max, parseInt(c.number.slice(5), 10) || 0);
    });
    return y + '-' + String(max + 1).padStart(4, '0');
  }
  function currentPricing() { return clone({ patterns: db.patterns, rates: db.rates }); }
  function newCalc(user) {
    var now = Date.now();
    return {
      id: uid('c'), ownerId: user.id, number: null, createdAt: now, updatedAt: now, status: 'koncept', sentTo: null,
      job: { name: '', customer: '', address: '', note: '' },
      groups: [newGroup()], patternId: null, discount: { type: 'pct', value: 0 }, vatRate: db.rates.vatDefault,
      extras: {}, snapshot: null
    };
  }
  // výchozí hodnoty = typické rozměry (zrychlení cíle "do 2 minut")
  function newGroup() { return { width: 100, depth: 28, riserHeight: 17, count: 1, coverRiser: true }; }

  /* ----- tokeny (pozvánky, reset hesla) ----- */
  function makeToken(type, userId, ttlMs) {
    var t = uid('t') + uid('');
    db.tokens[t] = { type: type, userId: userId, expires: Date.now() + ttlMs };
    save();
    return t;
  }

  return {
    get db() { return db; }, load: load, save: save, reset: reset, clone: clone, uid: uid,
    setSession: setSession, clearSession: clearSession, currentUser: currentUser,
    userById: userById, userByEmail: userByEmail,
    calcById: calcById, calcsFor: calcsFor, canSee: canSee, upsertCalc: upsertCalc, nextNumber: nextNumber,
    currentPricing: currentPricing, newCalc: newCalc, newGroup: newGroup, makeToken: makeToken
  };
})();
