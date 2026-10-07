/* Jádro aplikace: router, guardy, události, přihlášení, historie, profil.
 * Další obrazovky: wizard.js (průvodce, kalkulace, PDF, porovnání), admin.js (správa). */
var App = (function () {
  var routes = [], handlers = {}, timers = [], confirmFn = null;
  var A = {};
  var MAX_ATTEMPTS = 5, LOCK_MS = 15 * 60 * 1000;

  /* ---------- helpery ---------- */
  A.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var esc = A.esc, fmt = Calc.formatCZK;
  A.$ = function (sel, root) { return (root || document).querySelector(sel); };
  A.fmtDate = function (t) { return new Date(t).toLocaleDateString('cs-CZ'); };
  A.fmtTime = function (t) { return new Date(t).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); };
  A.go = function (hash) { if (location.hash === '#' + hash) dispatch(); else location.hash = hash; };
  A.timer = function (id) { timers.push(id); };
  A.patternImg = function (p) { return p.photo || Textures.uri(p.texture, p.tint); };
  A.pricingOf = function (c) { return c.snapshot || Store.currentPricing(); };
  A.quoteOf = function (c) {
    return Calc.computeQuote(c.groups, c.patternId, A.pricingOf(c), c.discount, c.vatRate, c.extras);
  };
  A.icon = function (n, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  A.statusLabel = function (s) { return s[0].toUpperCase() + s.slice(1); };
  A.initials = function (u) {
    var n = (u.profile && u.profile.name) || u.email || '?';
    return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join('');
  };

  /* otázky pro zadavatele: malý chip u místa vzniku + jeden souhrnný panel */
  var QUESTIONS = [
    { k: 'firms', t: 'Více firem?', x: 'Používá aplikaci jeden podlahář, nebo více firem, každá s vlastním ceníkem? Teď je ceník společný a spravuje ho admin.' },
    { k: 'numbering', t: 'Číselná řada kalkulací', x: 'Je číslování RRRR-NNNN společné pro všechny, nebo má každý podlahář svou vlastní řadu? Teď je společná.' },
    { k: 'custContact', t: 'E-mail a telefon zákazníka', x: 'Krok 1 podle zadání neobsahuje e-mail ani telefon zákazníka, ale „Odeslat e-mailem“ e-mail potřebuje. Zatím se zadává až v okně odeslání. Přidat pole sem?' },
    { k: 'spiral', t: 'Točité / lichoběžníkové schody a podesty', x: 'Zadání počítá jen s obdélníkovými nášlapy. Jak řešit točité schody, zkosené nášlapy a podesty?' },
    { k: 'photos', t: 'Fotky vzorů', x: 'Ukázkové fotky jsou nahrazeny texturami. Správce nahraje skutečné fotky v administraci. Stačí jedna fotka na vzor?' },
    { k: 'labor', t: 'Práce za kus vs. za m²', x: 'Práce se teď počítá za nášlap (Kč/ks). Účtuje podlahář práci spíš za nášlap, nebo za m²? Případně podle vzoru?' },
    { k: 'vat', t: 'Je podlahář plátce DPH?', x: 'Kalkulace vždy ukazuje DPH. Má být cena s DPH i bez DPH pro neplátce skrytá, nebo se DPH dá vypnout?' },
    { k: 'editPrices', t: 'Upravit = staré ceny?', x: 'Má „Upravit“ u uložené kalkulace držet původní ceny (jak je to teď, dokud se ceník nezmění), nebo vždy nabídnout aktuální ceník?' },
    { k: 'firmsPricing', t: 'Více firem s vlastním ceníkem?', x: 'Je ceník jeden společný pro všechny podlaháře, nebo má mít každá firma svůj? Prototyp má jeden ceník spravovaný adminem.' }
  ];
  A.question = function (key) {
    var i = QUESTIONS.map(function (q) { return q.k; }).indexOf(key);
    if (i < 0) return '';
    return '<div class="qrow no-print"><button type="button" class="qchip" data-click="qopen" data-q="' + i + '">' + A.icon('help') + 'Otázka</button></div>';
  };
  A.on = function (type, name, fn) { (handlers[type] = handlers[type] || {})[name] = fn; };
  A.on('click', 'qopen', function (el) {
    var q = QUESTIONS[+el.dataset.q];
    A.modal('<h2>Otázka pro zadavatele</h2><div class="qitem"><b>' + esc(q.t) + '</b><p>' + esc(q.x) + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-click="qall">Všechny otázky (' + QUESTIONS.length + ')</button><button class="btn primary" data-click="closeModal">Zavřít</button></div>');
  });
  A.on('click', 'qall', function () {
    A.modal('<h2>Všechny otázky (' + QUESTIONS.length + ')</h2><p class="small muted">Body, které je potřeba odsouhlasit se zadavatelem.</p>' +
      QUESTIONS.map(function (q) { return '<div class="qitem"><b>' + esc(q.t) + '</b><p>' + esc(q.x) + '</p></div>'; }).join('') +
      '<div class="dlg-foot"><button class="btn primary" data-click="closeModal">Zavřít</button></div>');
  });
  A.setErr = function (input, msg) {
    var f = input.closest('.field'); if (!f) return;
    input.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    var e = f.querySelector('.err'); if (e) e.textContent = msg || '';
  };

  var toastTimer = null;
  A.toast = function (msg) {
    var box = document.getElementById('toast'), d = document.createElement('div');
    d.textContent = msg; box.innerHTML = ''; box.appendChild(d);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { box.innerHTML = ''; }, 3000);
  };
  A.modal = function (html) {
    var m = document.getElementById('modal');
    m.innerHTML = '<div class="grab"></div><div class="dlg">' + html + '</div>';
    if (!m.open) m.showModal();
  };
  A.sheetList = function (rows) { return '<div class="list sheet-list">' + rows + '</div>'; };
  A.closeModal = function () { var m = document.getElementById('modal'); if (m.open) m.close(); };
  A.confirmDlg = function (title, text, okLabel, fn, danger) {
    confirmFn = fn;
    A.modal('<h2>' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p><div class="dlg-foot"><button class="btn" data-click="closeModal">Zrušit</button>' +
      '<button class="btn ' + (danger ? 'danger fill' : 'primary') + '" data-click="confirmYes">' + esc(okLabel) + '</button></div>');
  };
  A.mailPreview = function (m) {
    return '<div class="mail"><div class="hd"><div><b>Komu:</b> ' + esc(m.to) + '</div><div><b>Předmět:</b> ' + esc(m.subject) + '</div></div>' +
      m.bodyHtml + (m.attach ? '<p><span class="attach">' + A.icon('pdf', 'sm') + esc(m.attach) + '</span></p>' : '') + '</div>';
  };
  A.readImage = function (file, maxW, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, maxW / img.width), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.onerror = function () { A.toast('Obrázek se nepodařilo načíst'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };

  /* ---------- události (delegace přes data-click / data-input / ...) ---------- */
  function wire(domType, attr) {
    document.addEventListener(domType, function (e) {
      var el = e.target.closest ? e.target.closest('[data-' + attr + ']') : null;
      if (!el) return;
      var fn = (handlers[attr] || {})[el.getAttribute('data-' + attr)];
      if (fn) { if (attr === 'submit') e.preventDefault(); fn(el, e); }
    }, attr === 'blur');
  }
  wire('click', 'click'); wire('input', 'input'); wire('change', 'change'); wire('submit', 'submit'); wire('focusout', 'blur');
  A.on('click', 'closeModal', A.closeModal);
  A.on('click', 'confirmYes', function () { var f = confirmFn; confirmFn = null; A.closeModal(); if (f) f(); });
  document.addEventListener('click', function (e) {
    var m = document.getElementById('modal');
    if (e.target === m) A.closeModal(); // klik na pozadí
  });

  /* ---------- router + shell ---------- */
  A.route = function (path, access, fn) {
    var keys = [], re = new RegExp('^' + path.replace(/:(\w+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ re: re, keys: keys, access: access, fn: fn });
  };
  var curPath = '';
  /* opts: wide, bare (bez horní/spodní lišty), title, back (href), saved, action (html), bar (html akční lišty místo tab baru) */
  A.render = function (html, opts) {
    opts = opts || {};
    var main = document.getElementById('app'), user = Store.currentUser();
    main.className = opts.wide ? 'wide' : '';
    main.innerHTML = html;
    renderChrome(user, opts);
    window.scrollTo(0, 0);
  };
  function renderChrome(user, opts) {
    var top = document.getElementById('topbar'), tabs = document.getElementById('tabbar'), host = document.getElementById('barHost'), b = document.body;
    var show = !!user && !opts.bare;
    top.hidden = !show;
    b.classList.toggle('has-bar', show && !!opts.bar);
    b.classList.toggle('has-tabs', show && !opts.bar);
    tabs.hidden = !(show && !opts.bar);
    host.innerHTML = show && opts.bar ? opts.bar : '';
    if (!show) { top.innerHTML = ''; tabs.innerHTML = ''; return; }
    top.innerHTML = (opts.back ? '<a class="icon-btn" href="' + opts.back + '" aria-label="Zpět">' + A.icon('back', 'lg') + '</a>' : '') +
      '<div class="tt' + (opts.back ? ' has-back' : '') + '">' + esc(opts.title || 'Kalkulačka schodů') + '</div>' +
      (opts.saved !== undefined ? '<span class="saved-ind" id="savedInd">' + esc(opts.saved) + '</span>' : '') + (opts.action || '');
    function tab(h, ic, label, cls, on) {
      return '<a href="#' + h + '" class="' + (cls || '') + (on ? ' active' : '') + '"' + (on ? ' aria-current="page"' : '') + '><span class="pl">' + A.icon(ic, 'lg') + '</span><span>' + label + '</span></a>';
    }
    var p = curPath;
    tabs.innerHTML = tab('/history', 'list', 'Kalkulace', '', /^\/(history|calc|compare)/.test(p)) + tab('/new', 'plus', 'Nová', 'fab', false) +
      tab('/profile', 'user', 'Profil', '', /^\/profile/.test(p)) +
      (user.role === 'admin' ? tab('/admin/users', 'settings', 'Správa', '', /^\/admin/.test(p)) : '');
  }
  function dispatch() {
    timers.forEach(clearInterval); timers = [];
    A.closeModal();
    var path = location.hash.replace(/^#/, '') || '/history';
    var user = Store.currentUser(), r = null, params = {};
    for (var i = 0; i < routes.length && !r; i++) {
      var m = routes[i].re.exec(path);
      if (m) { r = routes[i]; routes[i].keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); }); }
    }
    if (!r) { A.go('/history'); return; }
    if (r.access !== 'public' && r.access !== 'guest' && !user) { location.replace('#/login'); return; }
    if (r.access === 'admin' && user.role !== 'admin') { A.toast('Tato část je jen pro správce'); location.replace('#/history'); return; }
    if (r.access === 'guest' && user) { location.replace('#/history'); return; }
    curPath = path;
    r.fn(params, user);
  }
  A.dispatch = dispatch;

  /* ---------- sheet „Prototyp“ ---------- */
  A.on('click', 'protoSheet', function () {
    var user = Store.currentUser(), pres = document.body.classList.contains('present');
    A.modal('<h2>Prototyp</h2>' + A.sheetList(
      '<label class="lrow check"><span class="k">Režim prezentace<small>Skryje značky otázek a poznámky prototypu</small></span><input type="checkbox" id="presentToggle" data-change="present"' + (pres ? ' checked' : '') + '></label>' +
      '<button type="button" class="lrow" data-click="qall"><span class="lead">' + A.icon('help') + '<span class="k">Panel otázek<small>Všechny otázky pro zadavatele (' + QUESTIONS.length + ')</small></span></span>' + A.icon('chev-r', 'chev') + '</button>' +
      '<button type="button" class="lrow" data-click="resetDemo"><span class="lead">' + A.icon('refresh') + '<span class="k">Obnovit ukázková data<small>Vrátí ceník, uživatele i kalkulace</small></span></span>' + A.icon('chev-r', 'chev') + '</button>' +
      (user ? '<div class="lrow"><span class="lead"><span class="avatar">' + esc(A.initials(user)) + '</span><span class="k">' + esc(user.profile.name || user.email) + '<small>' + esc(user.email) + (user.role === 'admin' ? ' · správce' : '') + '</small></span></span></div>' +
        '<button type="button" class="lrow" data-click="logout"><span class="lead">' + A.icon('logout') + '<span class="k">Odhlásit se</span></span></button>' : '')) +
      '<div class="dlg-foot"><button class="btn primary" data-click="closeModal">Hotovo</button></div>');
  });
  A.on('change', 'present', function (el) {
    document.body.classList.toggle('present', el.checked);
    try { localStorage.setItem('kp_present', el.checked ? '1' : '0'); } catch (e) { /* ignore */ }
  });
  A.on('click', 'resetDemo', function () {
    A.confirmDlg('Obnovit ukázková data?', 'Všechny změny (kalkulace, ceník, uživatelé) se vrátí do původního stavu.', 'Obnovit', function () {
      Store.reset(); A.toast('Ukázková data obnovena'); A.go(Store.currentUser() ? '/history' : '/login'); A.dispatch();
    }, true);
  });
  A.on('click', 'logout', function () { A.closeModal(); Store.clearSession(); A.toast('Odhlášeno'); A.go('/login'); });

  /* ---------- hesla ---------- */
  function pwBlock(id, label) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input type="password" id="' + id + '" name="' + id + '" autocomplete="new-password" data-input="pwmeter" data-blur="pwcheck">' +
      '<div class="pwmeter"><i></i></div><div class="hint pwcount">Min. 8 znaků (0/8)</div><div class="err"></div></div>';
  }
  A.on('input', 'pwmeter', function (el) {
    var n = el.value.length, f = el.closest('.field'), bar = f.querySelector('.pwmeter i');
    bar.style.width = Math.min(100, n / 8 * 100) + '%'; bar.classList.toggle('ok', n >= 8);
    f.querySelector('.pwcount').textContent = n >= 8 ? 'Délka v pořádku (' + n + ' znaků)' : 'Min. 8 znaků (' + n + '/8)';
    if (n >= 8) A.setErr(el, '');
  });
  A.on('blur', 'pwcheck', function (el) { if (el.value && el.value.length < 8) A.setErr(el, 'Heslo musí mít alespoň 8 znaků'); });
  function checkPw(form) {
    var p = form.elements.pw, p2 = form.elements.pw2, ok = true;
    if (p.value.length < 8) { A.setErr(p, 'Heslo musí mít alespoň 8 znaků'); ok = false; } else A.setErr(p, '');
    if (p2.value !== p.value) { A.setErr(p2, 'Hesla se neshodují'); ok = false; } else A.setErr(p2, '');
    return ok;
  }
  function authBrand(title, sub) {
    return '<div class="auth-brand"><div class="logo-mark">' + A.icon('stairs') + '</div><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div></div>';
  }

  /* ---------- přihlášení ---------- */
  A.route('/login', 'guest', function () {
    var demo = Store.db.users.map(function (u) {
      return '<button type="button" class="chip" data-click="fillLogin" data-email="' + esc(u.email) + '" data-pw="' + esc(u.password) + '">' + esc(u.email) + ' <span class="muted">· ' + (u.role === 'admin' ? 'správce' : 'podlahář') + '</span></button>';
    }).join('');
    A.render('<div class="auth">' + authBrand('Kalkulačka schodů', 'Kalkulace obkladu schodů pro podlahářské firmy') +
      '<div class="card"><div id="loginErr"></div>' +
      '<form data-submit="login" novalidate>' +
      '<div class="field"><label for="email">E-mail</label><input type="email" id="email" name="email" autocomplete="username" inputmode="email" autocapitalize="none"></div>' +
      '<div class="field"><label for="password">Heslo</label><input type="password" id="password" name="password" autocomplete="current-password"></div>' +
      '<label class="check"><span>Zapamatovat si mě (30 dní)</span><input type="checkbox" name="remember"></label>' +
      '<button class="btn primary block mt" type="submit">Přihlásit se</button></form>' +
      '<a class="btn ghost block mt-2" href="#/forgot">Zapomenuté heslo</a></div>' +
      '<details class="card demo-accounts"><summary>Demo účty (ukázková data)' + A.icon('chev-d') + '</summary><p class="small muted mt-2">Klepnutím vyplníte přihlašovací údaje. V ostré verzi nebude veřejná registrace – jen pozvánka od správce.</p><div class="demo-chips">' + demo + '</div></details>' +
      A.question('firms') + '</div>', { bare: true });
  });
  A.on('click', 'fillLogin', function (el) {
    var f = document.querySelector('form[data-submit=login]');
    f.elements.email.value = el.dataset.email; f.elements.password.value = el.dataset.pw;
  });
  function showLoginErr(msg) { document.getElementById('loginErr').innerHTML = '<div class="alert err" role="alert">' + esc(msg) + '</div>'; }
  A.on('submit', 'login', function (form) {
    var u = Store.userByEmail(form.elements.email.value), pw = form.elements.password.value;
    if (!form.elements.email.value.trim() || !pw) return showLoginErr('Vyplňte e-mail i heslo.');
    if (!u) return showLoginErr('Nesprávný e-mail nebo heslo.');
    if (u.lockedUntil && u.lockedUntil > Date.now()) return lockMsg(u);
    if (u.status === 'blokován') return showLoginErr('Účet je zablokovaný. Kontaktujte správce.');
    if (u.status === 'pozván') return showLoginErr('Registrace ještě není dokončena – použijte odkaz z pozvánky.');
    if (u.password !== pw) {
      u.failedAttempts = (u.failedAttempts || 0) + 1;
      if (u.failedAttempts >= MAX_ATTEMPTS) { u.lockedUntil = Date.now() + LOCK_MS; u.failedAttempts = 0; Store.save(); return lockMsg(u); }
      Store.save();
      return showLoginErr('Nesprávný e-mail nebo heslo. Zbývá pokusů: ' + (MAX_ATTEMPTS - u.failedAttempts) + '.');
    }
    u.failedAttempts = 0; u.lockedUntil = null; Store.save();
    Store.setSession(u.id, form.elements.remember.checked);
    A.go('/history');
  });
  function lockMsg(u) {
    function txt() {
      var s = Math.max(0, Math.ceil((u.lockedUntil - Date.now()) / 1000));
      return 'Příliš mnoho neúspěšných pokusů. Přihlášení je zablokované ještě ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '. Správce může účet odblokovat.';
    }
    showLoginErr(txt());
    A.timer(setInterval(function () {
      var box = document.querySelector('#loginErr .alert'); if (!box) return;
      if (u.lockedUntil <= Date.now()) { box.className = 'alert ok'; box.textContent = 'Blokace vypršela, můžete se znovu přihlásit.'; return; }
      box.textContent = txt();
    }, 1000));
  }

  /* ---------- zapomenuté heslo / reset / pozvánka ---------- */
  A.route('/forgot', 'public', function () {
    A.render('<div class="auth">' + authBrand('Zapomenuté heslo', 'Pošleme vám odkaz pro nastavení nového hesla. Odkaz platí 1 hodinu.') + '<div class="card">' +
      '<form data-submit="forgot" novalidate><div class="field"><label for="fe">E-mail</label><input type="email" id="fe" name="email" inputmode="email" autocapitalize="none"><div class="err"></div></div>' +
      '<label class="check no-print"><span>Demo: simulovat vypršelý odkaz</span><input type="checkbox" name="expired"></label>' +
      '<button class="btn primary block mt" type="submit">Odeslat odkaz</button></form>' +
      '<a class="btn ghost block mt-2" href="#/login">' + A.icon('back') + 'Zpět na přihlášení</a></div><div id="forgotOut"></div></div>', { bare: true });
  });
  A.on('submit', 'forgot', function (form) {
    var inp = form.elements.email;
    if (!/^\S+@\S+\.\S+$/.test(inp.value.trim())) return A.setErr(inp, 'Zadejte platný e-mail');
    A.setErr(inp, '');
    var u = Store.userByEmail(inp.value), out = document.getElementById('forgotOut');
    var msg = '<div class="alert ok">Pokud účet s tímto e-mailem existuje, odeslali jsme odkaz pro obnovení hesla.</div>';
    if (u && u.status === 'aktivní') {
      var tok = Store.makeToken('reset', u.id, form.elements.expired.checked ? -1000 : 3600000);
      msg += '<div class="card"><h3 class="mb">Demo: náhled e-mailu</h3>' + A.mailPreview({
        to: u.email, subject: 'Obnovení hesla – Kalkulačka schodů',
        bodyHtml: '<p>Dobrý den,</p><p>pro nastavení nového hesla klepněte na odkaz. <b>Odkaz platí 1 hodinu.</b></p><p><a href="#/reset/' + tok + '">Nastavit nové heslo</a></p><p class="muted">Pokud jste o změnu nežádali, tento e-mail ignorujte.</p>'
      }) + '<a class="btn primary block" href="#/reset/' + tok + '">Otevřít odkaz (demo)</a></div>';
    } else if (u) {
      msg += '<p class="small muted">(Demo: účet je ve stavu „' + esc(u.status) + '“, e-mail by se neodeslal.)</p>';
    } else {
      msg += '<p class="small muted">(Demo: e-mail neexistuje, v ostré verzi se nic neodešle a odpověď je stejná.)</p>';
    }
    out.innerHTML = msg;
  });

  function tokenOf(t, type) {
    var k = Store.db.tokens[t];
    if (!k || k.type !== type) return { err: 'Odkaz je neplatný.' };
    if (k.expires < Date.now()) return { err: 'Platnost odkazu vypršela.' };
    return { tok: k, user: Store.userById(k.userId) };
  }
  A.route('/reset/:token', 'public', function (p) {
    var t = tokenOf(p.token, 'reset');
    if (t.err || !t.user) return A.render('<div class="auth">' + authBrand('Nový odkaz je potřeba') + '<div class="card"><div class="alert err">' + esc(t.err || 'Odkaz je neplatný.') + ' Odkazy pro obnovení hesla platí 1 hodinu.</div><a class="btn primary block" href="#/forgot">Vyžádat nový odkaz</a></div></div>', { bare: true });
    A.render('<div class="auth">' + authBrand('Nové heslo', 'Účet: ' + esc(t.user.email)) + '<div class="card"><form data-submit="reset" data-token="' + esc(p.token) + '" novalidate>' +
      pwBlock('pw', 'Nové heslo') + '<div class="field"><label for="pw2">Heslo znovu</label><input type="password" id="pw2" name="pw2" autocomplete="new-password"><div class="err"></div></div>' +
      '<button class="btn primary block" type="submit">Uložit heslo</button></form></div></div>', { bare: true });
  });
  A.on('submit', 'reset', function (form) {
    var t = tokenOf(form.dataset.token, 'reset');
    if (t.err) return A.dispatch();
    if (!checkPw(form)) return;
    t.user.password = form.elements.pw.value; t.user.failedAttempts = 0; t.user.lockedUntil = null;
    delete Store.db.tokens[form.dataset.token]; Store.save();
    A.toast('Heslo bylo změněno, můžete se přihlásit'); A.go('/login');
  });
  A.route('/invite/:token', 'public', function (p) {
    var t = tokenOf(p.token, 'invite');
    if (t.err || !t.user) return A.render('<div class="auth">' + authBrand('Pozvánka') + '<div class="card"><div class="alert err">' + esc(t.err || 'Pozvánka není platná.') + ' Požádejte správce o novou pozvánku.</div><a class="btn block" href="#/login">Na přihlášení</a></div></div>', { bare: true });
    A.render('<div class="auth">' + authBrand('Dokončení registrace', 'Nastavte si heslo pro účet <b>' + esc(t.user.email) + '</b>.') + '<div class="card"><form data-submit="invite" data-token="' + esc(p.token) + '" novalidate>' +
      '<div class="field"><label for="nm">Vaše jméno <span class="opt">(volitelné, doplníte v profilu)</span></label><input type="text" id="nm" name="name" autocomplete="name"></div>' +
      pwBlock('pw', 'Heslo') + '<div class="field"><label for="pw2">Heslo znovu</label><input type="password" id="pw2" name="pw2" autocomplete="new-password"><div class="err"></div></div>' +
      '<button class="btn primary block" type="submit">Vytvořit účet</button></form></div></div>', { bare: true });
  });
  A.on('submit', 'invite', function (form) {
    var t = tokenOf(form.dataset.token, 'invite');
    if (t.err) return A.dispatch();
    if (!checkPw(form)) return;
    t.user.password = form.elements.pw.value; t.user.status = 'aktivní';
    if (form.elements.name.value.trim()) t.user.profile.name = form.elements.name.value.trim();
    delete Store.db.tokens[form.dataset.token]; Store.save();
    A.toast('Účet je aktivní, přihlaste se'); A.go('/login');
  });

  /* ---------- historie ---------- */
  var HF = { q: '', sort: 'date-desc', status: '' };
  var SORTS = [['date-desc', 'Datum – nejnovější'], ['date-asc', 'Datum – nejstarší'], ['price-desc', 'Cena – nejvyšší'], ['price-asc', 'Cena – nejnižší'], ['name-asc', 'Zakázka A–Z'], ['name-desc', 'Zakázka Z–A']];
  A.route('/history', 'user', function (p, user) {
    var chips = [['', 'Vše'], ['koncept', 'Koncept'], ['odesláno', 'Odesláno'], ['přijato', 'Přijato'], ['zamítnuto', 'Zamítnuto']].map(function (s) {
      return '<button type="button" class="chip' + (HF.status === s[0] ? ' on' : '') + '" data-click="hstat" data-s="' + s[0] + '">' + s[1] + '</button>';
    }).join('');
    A.render('<h1 class="large-title">' + (user.role === 'admin' ? 'Všechny kalkulace' : 'Kalkulace') + '</h1>' +
      '<div class="row mb" style="flex-wrap:nowrap"><div class="search">' + A.icon('search') + '<input type="search" id="hq" placeholder="Hledat zakázku, zákazníka, číslo' + (user.role === 'admin' ? ', podlahář' : '') + '" value="' + esc(HF.q) + '" data-input="hfilter" aria-label="Hledat"></div>' +
      '<button type="button" class="btn sq" data-click="sortSheet" aria-label="Řazení">' + A.icon('sort') + '</button></div>' +
      '<div class="chips" role="group" aria-label="Stav">' + chips + '</div>' +
      '<div id="hlist"></div>' + A.question('numbering'));
    listHistory(user);
  });
  A.on('input', 'hfilter', function (el) { HF.q = el.value; listHistory(Store.currentUser()); });
  A.on('click', 'hstat', function (el) {
    HF.status = el.dataset.s;
    document.querySelectorAll('[data-click=hstat]').forEach(function (b) { b.classList.toggle('on', b === el); });
    listHistory(Store.currentUser());
  });
  A.on('click', 'sortSheet', function () {
    A.modal('<h2>Řazení</h2>' + A.sheetList(SORTS.map(function (o) {
      return '<button type="button" class="lrow" data-click="setSort" data-v="' + o[0] + '"><span>' + o[1] + '</span>' + (HF.sort === o[0] ? A.icon('check') : '') + '</button>';
    }).join('')));
  });
  A.on('click', 'setSort', function (el) { HF.sort = el.dataset.v; A.closeModal(); listHistory(Store.currentUser()); });
  function ownerName(c) { var o = Store.userById(c.ownerId); return o ? (o.profile.company || o.profile.name || o.email) : ''; }
  function listHistory(user) {
    var q = HF.q.trim().toLowerCase(), all = Store.calcsFor(user);
    var items = all.map(function (c) { return { c: c, total: c.patternId ? A.quoteOf(c).total : null }; }).filter(function (x) {
      if (HF.status && x.c.status !== HF.status) return false;
      if (!q) return true;
      return [x.c.job.name, x.c.job.customer, x.c.number || '', ownerName(x.c)].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var s = HF.sort.split('-'), dir = s[1] === 'asc' ? 1 : -1;
    items.sort(function (a, b) {
      var r = s[0] === 'date' ? a.c.updatedAt - b.c.updatedAt : s[0] === 'price' ? (a.total || 0) - (b.total || 0) : (a.c.job.name || '').localeCompare(b.c.job.name || '', 'cs');
      return r * dir;
    });
    var html = items.map(function (x) {
      var c = x.c, href = c.number || c.ownerId !== user.id ? '#/calc/' + c.id : '#/wizard/' + c.id + '/1';
      return '<a class="hist-card" href="' + href + '"><div class="top"><div><div class="name">' + esc(c.job.name || 'Bez názvu') + '</div>' +
        '<div class="small muted">' + esc(c.job.customer || 'bez zákazníka') + ' · ' + A.fmtDate(c.updatedAt) + '</div></div>' +
        '<div class="price">' + (x.total === null ? '—' : fmt(x.total)) + '</div></div>' +
        (user.role === 'admin' && c.ownerId !== user.id ? '<div class="who">' + A.icon('user', 'sm') + esc(ownerName(c)) + '</div>' : '') +
        '<div class="foot"><span class="dot st-' + c.status + '">' + A.statusLabel(c.status) + '</span><span>' + (c.number ? 'č. ' + esc(c.number) : 'rozpracováno') + '</span></div></a>';
    }).join('');
    A.$('#hlist').innerHTML = html || '<div class="empty"><svg class="ic art" aria-hidden="true"><use href="#i-inbox"/></svg>' + (all.length ? '<p>Nic nenalezeno.<br>Zkuste upravit hledání nebo filtr.</p>' : '<p>Zatím nemáte žádnou kalkulaci.</p><a class="btn primary" href="#/new">' + A.icon('plus') + 'Vytvořit první kalkulaci</a>') + '</div>';
  }

  /* ---------- profil ---------- */
  var profLogo = null;
  A.route('/profile', 'user', function (p, user) {
    profLogo = user.profile.logo;
    var pr = user.profile;
    A.render('<h1 class="large-title">Profil</h1><form data-submit="saveProfile" novalidate>' +
      '<div class="section-title">Účet a firma</div><div class="card">' +
      '<div class="field"><label for="pe">E-mail (přihlašovací)</label><input type="text" id="pe" value="' + esc(user.email) + '" disabled></div>' +
      '<div class="field"><label for="pn">Jméno</label><input type="text" id="pn" name="name" value="' + esc(pr.name) + '" autocomplete="name"><div class="err"></div></div>' +
      '<div class="field"><label for="pc">Firma</label><input type="text" id="pc" name="company" value="' + esc(pr.company) + '" autocomplete="organization"><div class="err"></div></div>' +
      '<div class="field"><label for="pi">IČO</label><input type="text" id="pi" name="ico" inputmode="numeric" maxlength="8" value="' + esc(pr.ico) + '" data-blur="icoCheck"><div class="hint">8 číslic</div><div class="err"></div></div>' +
      '<div class="field" style="margin:0"><label for="pt">Telefon</label><input type="tel" id="pt" name="phone" inputmode="tel" value="' + esc(pr.phone) + '" autocomplete="tel"><div class="err"></div></div></div>' +
      '<div class="section-title">Logo</div><div class="card"><div class="lbl muted" style="font-weight:400">Vytiskne se na kalkulaci a v PDF.</div><div id="logoBox" class="logo-box mt-2"></div>' +
      '<label class="btn sm tonal mt-2">' + A.icon('plus') + 'Nahrát logo<input type="file" class="sr" accept="image/*" data-change="logoFile" aria-label="Nahrát logo"></label></div>' +
      '<button class="btn primary block" type="submit">Uložit profil</button></form>' +
      '<button class="btn block mt" type="button" data-click="logout">' + A.icon('logout') + 'Odhlásit se</button>');
    drawLogo();
  });
  function drawLogo() {
    A.$('#logoBox').innerHTML = profLogo ? '<img class="logo-prev" src="' + profLogo + '" alt="Logo firmy"><button type="button" class="btn sm ghost" data-click="logoRemove">Odstranit</button>' : '<span class="muted small">Logo není nahráno</span>';
  }
  A.on('click', 'logoRemove', function () { profLogo = null; drawLogo(); });
  A.on('change', 'logoFile', function (el) {
    if (el.files[0]) A.readImage(el.files[0], 400, function (d) { profLogo = d; drawLogo(); });
  });
  function icoErr(v) { return v && !/^\d{8}$/.test(v.trim()) ? 'IČO musí mít přesně 8 číslic' : ''; }
  A.on('blur', 'icoCheck', function (el) { A.setErr(el, icoErr(el.value)); });
  A.on('submit', 'saveProfile', function (form) {
    var e = icoErr(form.elements.ico.value);
    A.setErr(form.elements.ico, e);
    if (e) return;
    var u = Store.currentUser();
    u.profile = { name: form.elements.name.value.trim(), company: form.elements.company.value.trim(), ico: form.elements.ico.value.trim(), phone: form.elements.phone.value.trim(), logo: profLogo };
    if (!Store.save()) return A.toast('Uložení se nepodařilo (plné úložiště?) – zkuste menší logo');
    A.toast('Profil uložen'); A.go('/history');
  });

  /* ---------- start ---------- */
  A.start = function () {
    Store.load();
    try { if (localStorage.getItem('kp_present') === '1') document.body.classList.add('present'); } catch (e) { /* ignore */ }
    window.addEventListener('hashchange', dispatch);
    dispatch();
  };
  return A;
})();
