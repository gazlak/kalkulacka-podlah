/* Administrace: uživatelé, vzory, globální sazby, reset demo dat. Jen pro roli admin. */
(function () {
  var A = App, esc = A.esc, ic = A.icon;
  var photos = {};

  function tabs(active) {
    return '<h1 class="large-title">Správa</h1><div class="seg full mb no-print" role="tablist">' + [['users', 'Uživatelé'], ['patterns', 'Vzory'], ['rates', 'Sazby']].map(function (t) {
      return '<a href="#/admin/' + t[0] + '" role="tab"' + (active === t[0] ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' + t[1] + '</a>';
    }).join('') + '</div>';
  }
  function num(el) { return Calc.num(el.value); }

  /* ---------- uživatelé ---------- */
  A.route('/admin/users', 'admin', function (p, me) {
    var rows = Store.db.users.map(function (u) {
      var locked = u.lockedUntil && u.lockedUntil > Date.now(), self = u.id === me.id;
      return '<div class="lrow user-row"><span class="lead"><span class="avatar">' + esc(A.initials(u)) + '</span><div><b>' + esc(u.email) + '</b>' +
        '<span class="sub">' + esc(u.profile.name || '—') + ' · ' + esc(u.profile.company || '—') + '</span>' +
        '<div class="row" style="margin-top:4px;gap:6px"><span class="badge st-' + u.status + '">' + A.statusLabel(u.status) + '</span>' + (u.role === 'admin' ? '<span class="badge st-koncept">Admin</span>' : '') +
        (locked ? '<span class="badge st-blokován">zamčen po neúspěšných pokusech</span>' : '') + (self ? '<span class="small muted">(vy)</span>' : '') + '</div></div></span>' +
        '<button class="icon-btn" data-click="userMenu" data-u="' + u.id + '" aria-label="Akce pro ' + esc(u.email) + '">' + ic('more', 'lg') + '</button></div>';
    }).join('');
    A.render(tabs('users') + '<div class="section-title">Uživatelé <button class="btn sm primary" data-click="invite">' + ic('plus') + 'Pozvat</button></div><div class="list">' + rows + '</div>' + A.question('firmsPricing'),
      { wide: true, title: 'Správa' });
  });
  A.on('click', 'userMenu', function (el) {
    var u = Store.userById(el.dataset.u), me = Store.currentUser(), self = u.id === me.id, locked = u.lockedUntil && u.lockedUntil > Date.now();
    function row(icon, label, attrs, danger) {
      return '<button type="button" class="lrow" ' + attrs + ' data-u="' + u.id + '"><span class="lead"' + (danger ? ' style="color:var(--bad)"' : '') + '>' + ic(icon) + '<span class="k">' + label + '</span></span></button>';
    }
    A.modal('<h2>' + esc(u.email) + '</h2><div class="lbl">Role</div><div class="seg full" role="group" aria-label="Role">' +
      ['user', 'admin'].map(function (r) { return '<button type="button" data-click="setRole" data-u="' + u.id + '" data-role="' + r + '" class="' + (u.role === r ? 'on' : '') + '"' + (self ? ' disabled' : '') + '>' + (r === 'admin' ? 'Admin' : 'Uživatel') + '</button>'; }).join('') + '</div>' +
      (self ? '<p class="small muted mt-2">Vlastní roli změnit nelze.</p>' : '') +
      A.sheetList((u.status === 'pozván' ? row('mail', 'Znovu poslat pozvánku', 'data-click="resend"') : '') +
        (u.status === 'blokován' || locked ? row('key', 'Odblokovat', 'data-click="unblock"') : '') +
        (u.status === 'aktivní' && !self ? row('x', 'Blokovat', 'data-click="block"', true) : '')).replace('<div class="list sheet-list"></div>', '') +
      '<div class="dlg-foot"><button class="btn" data-click="closeModal">Zavřít</button></div>');
  });
  A.on('click', 'setRole', function (el) {
    var u = Store.userById(el.dataset.u); u.role = el.dataset.role; Store.save(); A.closeModal(); A.toast('Role změněna: ' + (u.role === 'admin' ? 'admin' : 'uživatel')); A.dispatch();
  });
  A.on('click', 'block', function (el) { Store.userById(el.dataset.u).status = 'blokován'; Store.save(); A.toast('Uživatel zablokován'); A.dispatch(); });
  A.on('click', 'unblock', function (el) {
    var u = Store.userById(el.dataset.u); if (u.status === 'blokován') u.status = 'aktivní'; u.lockedUntil = null; u.failedAttempts = 0; Store.save(); A.toast('Uživatel odblokován'); A.dispatch();
  });
  A.on('click', 'invite', function () {
    A.modal('<h2>Pozvat uživatele</h2><p class="small muted">Registrace je možná jen na pozvání.</p><form data-submit="doInvite" novalidate>' +
      '<div class="field"><label for="ie">E-mail</label><input type="email" id="ie" name="email" inputmode="email" autocapitalize="none"><div class="err"></div></div>' +
      '<div class="field"><label for="ir">Role</label><select id="ir" name="role"><option value="user">Uživatel (podlahář)</option><option value="admin">Admin</option></select></div>' +
      '<div class="dlg-foot"><button type="button" class="btn" data-click="closeModal">Zrušit</button><button class="btn primary" type="submit">Vytvořit pozvánku</button></div></form>');
  });
  function inviteMail(u) {
    var tok = Store.makeToken('invite', u.id, 7 * 86400000);
    A.modal('<h2>Pozvánka vytvořena</h2><p class="small muted">Demo: e-mail se neodesílá, zobrazujeme jeho náhled.</p>' + A.mailPreview({
      to: u.email, subject: 'Pozvánka do Kalkulačky schodů',
      bodyHtml: '<p>Dobrý den,</p><p>byli jste pozváni do aplikace Kalkulačka schodů. Pro dokončení registrace nastavte heslo (min. 8 znaků):</p><p><a href="#/invite/' + tok + '">Dokončit registraci</a></p><p class="muted">Odkaz platí 7 dní.</p>'
    }) + '<div class="dlg-foot"><button class="btn" data-click="closeAndRefresh">Zavřít</button><a class="btn primary" href="#/invite/' + tok + '">Otevřít odkaz (demo)</a></div>');
  }
  A.on('click', 'closeAndRefresh', function () { A.closeModal(); A.dispatch(); });
  A.on('submit', 'doInvite', function (form) {
    var inp = form.elements.email, mail = inp.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return A.setErr(inp, 'Zadejte platný e-mail');
    if (Store.userByEmail(mail)) return A.setErr(inp, 'Uživatel s tímto e-mailem už existuje');
    var u = { id: Store.uid('u'), email: mail, password: '', role: form.elements.role.value, status: 'pozván', failedAttempts: 0, lockedUntil: null, profile: { name: '', company: '', ico: '', phone: '', logo: null } };
    Store.db.users.push(u); Store.save(); inviteMail(u);
  });
  A.on('click', 'resend', function (el) { inviteMail(Store.userById(el.dataset.u)); });

  /* ---------- vzory ---------- */
  var adminKol = null;
  function kolekce() { var k = []; Store.db.patterns.forEach(function (p) { if (k.indexOf(p.kolekce) < 0) k.push(p.kolekce); }); return k; }
  A.route('/admin/patterns', 'admin', function () {
    photos = {};
    var kols = kolekce(); if (kols.indexOf(adminKol) < 0) adminKol = kols[0];
    var list = Store.db.patterns.filter(function (p) { return p.kolekce === adminKol; });
    var noPrice = Store.db.patterns.filter(function (p) { return !p.materialPerM2; }).length, est = Store.db.patterns.filter(function (p) { return p.materialPerM2 && p.priceEst; }).length;
    A.render(tabs('patterns') + '<div class="alert info">' + Store.db.patterns.length + ' vzorů v ' + kols.length + ' kolekcích. Cenu má orientační ' + est + ' vzorů, bez ceny je ' + noPrice + '. Změna cen se projeví jen v nových kalkulacích – uložené kalkulace drží své ceny (snapshot).</div>' + A.question('photos') +
      '<div class="field"><label for="akol">Kolekce</label><select id="akol" data-change="adminKol">' + kols.map(function (k) {
        var n = Store.db.patterns.filter(function (p) { return p.kolekce === k; }).length;
        return '<option value="' + esc(k) + '"' + (k === adminKol ? ' selected' : '') + '>' + esc(k) + ' (' + n + ')</option>';
      }).join('') + '</select></div>' +
      '<form class="card" data-submit="saveKolekce" novalidate><h2 class="card-title">Ceny pro celou kolekci</h2><p class="small muted">Vyplněná pole se zapíšou všem ' + list.length + ' vzorům kolekce, prázdná zůstanou beze změny.</p>' +
      '<div class="group-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' + field('materialPerM2', 'Materiál (Kč/m²)', '') + field('wastePct', 'Prořez (%)', '') + field('laborPerTread', 'Práce (Kč/nášlap)', '') + '</div>' +
      '<button class="btn primary block" type="submit">Nastavit celé kolekci</button></form>' +
      list.map(function (p) {
        return '<form class="card pat-admin" data-submit="savePattern" data-id="' + p.id + '" novalidate><img class="cover" loading="lazy" id="pimg' + p.id + '" src="' + A.patternImg(p) + '" alt="">' +
          '<div class="pbody"><div class="photo-actions"><label class="btn sm tonal">' + ic('plus') + 'Nahrát fotku<input type="file" class="sr" accept="image/*" data-change="patFile" data-id="' + p.id + '" aria-label="Fotka vzoru ' + p.id + '"></label>' +
          '<button type="button" class="btn sm ghost" data-click="patTex" data-id="' + p.id + '">Výchozí textura</button></div>' +
          '<div class="field"><label for="pn' + p.id + '">Název vzoru</label><input type="text" id="pn' + p.id + '" name="name" value="' + esc(p.name) + '"><div class="err"></div></div>' +
          '<div class="group-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' +
          field('materialPerM2', 'Materiál (Kč/m²)' + (p.materialPerM2 && p.priceEst ? ' – orientačně' : ''), p.materialPerM2) + field('wastePct', 'Prořez (%)', p.wastePct) + field('laborPerTread', 'Práce (Kč/nášlap)', p.laborPerTread) + '</div>' +
          '<button class="btn primary block" type="submit">Uložit vzor</button></div></form>';
      }).join(''), { wide: true, title: 'Správa' });
  });
  A.on('change', 'adminKol', function (el) { adminKol = el.value; A.dispatch(); });
  A.on('submit', 'saveKolekce', function (form) {
    var e = form.elements, ok = true, set = {};
    [['materialPerM2', 1e6], ['wastePct', 100], ['laborPerTread', 1e6]].forEach(function (k) {
      var raw = e[k[0]].value.trim(), v = num(e[k[0]]), bad = raw !== '' && !(v >= 0 && v <= k[1]);
      A.setErr(e[k[0]], bad ? 'Zadejte číslo 0–' + k[1] : ''); if (bad) ok = false; else if (raw !== '') set[k[0]] = v;
    });
    if (!ok) return;
    if (!Object.keys(set).length) return A.toast('Vyplňte aspoň jedno pole');
    var n = 0;
    Store.db.patterns.forEach(function (p) {
      if (p.kolekce !== adminKol) return;
      Object.keys(set).forEach(function (k) { p[k] = set[k]; }); if ('materialPerM2' in set) p.priceEst = false; n++;
    });
    Store.save(); A.toast('Nastaveno ' + n + ' vzorům kolekce'); A.dispatch();
  });
  function field(n, l, v) { return '<div class="field"><label>' + l + '</label><input type="text" name="' + n + '" inputmode="decimal" value="' + esc(v) + '"><div class="err"></div></div>'; }
  A.on('change', 'patFile', function (el) {
    if (!el.files[0]) return;
    A.readImage(el.files[0], 600, function (d) { photos[el.dataset.id] = d; A.$('#pimg' + el.dataset.id).src = d; });
  });
  A.on('click', 'patTex', function (el) {
    var p = Store.db.patterns.filter(function (x) { return x.id === +el.dataset.id; })[0];
    photos[p.id] = null; A.$('#pimg' + p.id).src = Textures.uri(p.texture, p.tint);
  });
  A.on('submit', 'savePattern', function (form) {
    var p = Store.db.patterns.filter(function (x) { return x.id === +form.dataset.id; })[0], ok = true, e = form.elements;
    function chk(el, bad, msg) { A.setErr(el, bad ? msg : ''); if (bad) ok = false; }
    chk(e.name, !e.name.value.trim(), 'Zadejte název');
    chk(e.materialPerM2, !(num(e.materialPerM2) >= 0), 'Zadejte cenu ≥ 0');
    chk(e.wastePct, !(num(e.wastePct) >= 0 && num(e.wastePct) <= 100), 'Prořez musí být 0–100 %');
    chk(e.laborPerTread, !(num(e.laborPerTread) >= 0), 'Zadejte cenu ≥ 0');
    if (!ok) return;
    if (num(e.materialPerM2) !== p.materialPerM2) p.priceEst = false;
    p.name = e.name.value.trim(); p.materialPerM2 = num(e.materialPerM2); p.wastePct = num(e.wastePct); p.laborPerTread = num(e.laborPerTread);
    if (p.id in photos || String(p.id) in photos) p.photo = photos[p.id];
    if (!Store.save()) return A.toast('Uložení se nepodařilo (plné úložiště?) – zkuste menší fotku');
    A.toast('Vzor uložen');
  });

  /* ---------- sazby ---------- */
  A.route('/admin/rates', 'admin', function () {
    var r = Store.db.rates, m = r.m2 || {};
    A.render(tabs('rates') + '<form data-submit="saveRates" novalidate><div class="section-title">Globální sazby</div><div class="card">' +
      field('riserSurcharge', 'Příplatek za obklad podstupnice (Kč/nášlap)', r.riserSurcharge) + field('transport', 'Doprava (Kč, paušál)', r.transport) +
      '<div class="field"><label for="vd">Výchozí DPH</label><select id="vd" name="vatDefault">' + r.vatOptions.map(function (v) { return '<option value="' + v + '"' + (v === r.vatDefault ? ' selected' : '') + '>' + Math.round(v * 100) + ' %</option>'; }).join('') + '</select><div class="hint">Na kalkulaci lze přepnout 21 % / 12 %.</div></div>' +
      '<div class="field" style="margin:0"><label for="rt">Zaokrouhlení</label><select id="rt" name="roundTo"><option value="1"' + (r.roundTo === 1 ? ' selected' : '') + '>na celé Kč</option><option value="10"' + (r.roundTo === 10 ? ' selected' : '') + '>na 10 Kč (ukázka)</option></select></div></div>' +
      '<div class="section-title">Výpočet ceny za m²</div><div class="card"><p class="small muted">Z čeho se skládá cena za m² plochy schodů. Vinyl se nastavuje u každého vzoru na kartě Vzory, ostatní složky tady.</p>' +
      '<div class="group-grid">' + field('mdfEurM3', 'MDF (EUR/m³ bez DPH)', m.mdfEurM3) + field('eurRate', 'Kurz (Kč/EUR)', m.eurRate) + '</div>' +
      '<p class="small muted" style="margin:0">MDF 12 mm teď vychází na ' + Calc.formatCZK(12 / 1000 * Calc.n0(m.mdfEurM3) * Calc.n0(m.eurRate)) + ' / m².</p></div>' +
      Calc.TREAD_TYPES.map(function (t) {
        var b = (m.byTread || {})[t.id] || {};
        return '<div class="card"><h2 class="card-title">' + t.label + '</h2><div class="group-grid">' + field('mm_' + t.id, 'MDF tloušťka (mm)', b.mdfMm || 0) + field('gl_' + t.id, 'Lepidlo (Kč/m²)', b.glue || 0) +
          field('lb_' + t.id, 'Práce (Kč/m²)', b.labor || 0) + field('t_' + t.id, 'Příplatek (Kč/nášlap)', (r.treadSurcharge || {})[t.id] || 0) + '</div></div>';
      }).join('') +
      '<div class="section-title">Volitelné příplatky (návrh)</div><div class="card"><label class="check"><span>Zapnout příplatky v kalkulaci<small class="muted" style="display:block">Mimo původní zadání</small></span><input type="checkbox" name="extrasEnabled"' + (r.extrasEnabled ? ' checked' : '') + '></label><div class="mt">' +
      r.extras.map(function (x) { return field('x_' + x.key, x.label + ' (Kč/' + x.unit + ')', x.price); }).join('') + '</div></div>' +
      '<button class="btn primary block" type="submit">Uložit sazby</button></form>' +
      '<div class="section-title">Demo data</div><div class="card"><p class="small muted">Vrátí ceník, uživatele i kalkulace na původní ukázková data.</p><button class="btn danger block" data-click="resetDemo">' + ic('refresh') + 'Obnovit ukázková data</button></div>', { title: 'Správa' });
  });
  A.on('submit', 'saveRates', function (form) {
    var e = form.elements, r = Store.db.rates, ok = true;
    var keys = ['riserSurcharge', 'transport'].concat(r.extras.map(function (x) { return 'x_' + x.key; }), ['mdfEurM3', 'eurRate']);
    Calc.TREAD_TYPES.forEach(function (t) { keys.push('t_' + t.id, 'mm_' + t.id, 'gl_' + t.id, 'lb_' + t.id); });
    keys.forEach(function (k) { var bad = !(num(e[k]) >= 0); A.setErr(e[k], bad ? 'Zadejte číslo ≥ 0' : ''); if (bad) ok = false; });
    if (!ok) return;
    r.riserSurcharge = num(e.riserSurcharge); r.transport = num(e.transport); r.vatDefault = parseFloat(e.vatDefault.value); r.roundTo = parseInt(e.roundTo.value, 10);
    r.treadSurcharge = {}; r.m2 = { mdfEurM3: num(e.mdfEurM3), eurRate: num(e.eurRate), byTread: {} };
    Calc.TREAD_TYPES.forEach(function (t) {
      r.treadSurcharge[t.id] = num(e['t_' + t.id]);
      r.m2.byTread[t.id] = { mdfMm: num(e['mm_' + t.id]), glue: num(e['gl_' + t.id]), labor: num(e['lb_' + t.id]) };
    });
    r.extrasEnabled = e.extrasEnabled.checked; r.extras.forEach(function (x) { x.price = num(e['x_' + x.key]); });
    Store.save(); A.toast('Sazby uloženy'); A.dispatch();
  });
})();
