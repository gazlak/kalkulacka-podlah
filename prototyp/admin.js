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
  A.route('/admin/patterns', 'admin', function () {
    photos = {};
    A.render(tabs('patterns') + '<div class="alert info">Vzory jsou přesně 6 (nepřidávají se ani nemažou). Změna cen se projeví jen v nových kalkulacích – uložené kalkulace drží své ceny (snapshot).</div>' + A.question('photos') +
      Store.db.patterns.map(function (p) {
        return '<form class="card pat-admin" data-submit="savePattern" data-id="' + p.id + '" novalidate><img class="cover" id="pimg' + p.id + '" src="' + A.patternImg(p) + '" alt="">' +
          '<div class="pbody"><div class="photo-actions"><label class="btn sm tonal">' + ic('plus') + 'Nahrát fotku<input type="file" class="sr" accept="image/*" data-change="patFile" data-id="' + p.id + '" aria-label="Fotka vzoru ' + p.id + '"></label>' +
          '<button type="button" class="btn sm ghost" data-click="patTex" data-id="' + p.id + '">Výchozí textura</button></div>' +
          '<div class="field"><label for="pn' + p.id + '">Název vzoru ' + p.id + '</label><input type="text" id="pn' + p.id + '" name="name" value="' + esc(p.name) + '"><div class="err"></div></div>' +
          '<div class="group-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' +
          field('materialPerM2', 'Materiál (Kč/m²)', p.materialPerM2) + field('wastePct', 'Prořez (%)', p.wastePct) + field('laborPerTread', 'Práce (Kč/nášlap)', p.laborPerTread) + '</div>' +
          '<button class="btn primary block" type="submit">Uložit vzor ' + p.id + '</button></div></form>';
      }).join(''), { wide: true, title: 'Správa' });
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
    p.name = e.name.value.trim(); p.materialPerM2 = num(e.materialPerM2); p.wastePct = num(e.wastePct); p.laborPerTread = num(e.laborPerTread);
    if (p.id in photos || String(p.id) in photos) p.photo = photos[p.id];
    if (!Store.save()) return A.toast('Uložení se nepodařilo (plné úložiště?) – zkuste menší fotku');
    A.toast('Vzor ' + p.id + ' uložen');
  });

  /* ---------- sazby ---------- */
  A.route('/admin/rates', 'admin', function () {
    var r = Store.db.rates;
    A.render(tabs('rates') + '<form data-submit="saveRates" novalidate><div class="section-title">Globální sazby</div><div class="card">' +
      field('riserSurcharge', 'Příplatek za obklad podstupnice (Kč/nášlap)', r.riserSurcharge) + field('transport', 'Doprava (Kč, paušál)', r.transport) +
      '<div class="field"><label for="vd">Výchozí DPH</label><select id="vd" name="vatDefault">' + r.vatOptions.map(function (v) { return '<option value="' + v + '"' + (v === r.vatDefault ? ' selected' : '') + '>' + Math.round(v * 100) + ' %</option>'; }).join('') + '</select><div class="hint">Na kalkulaci lze přepnout 21 % / 12 %.</div></div>' +
      '<div class="field" style="margin:0"><label for="rt">Zaokrouhlení</label><select id="rt" name="roundTo"><option value="1"' + (r.roundTo === 1 ? ' selected' : '') + '>na celé Kč</option><option value="10"' + (r.roundTo === 10 ? ' selected' : '') + '>na 10 Kč (ukázka)</option></select></div></div>' +
      '<div class="section-title">Volitelné příplatky (návrh)</div><div class="card"><label class="check"><span>Zapnout příplatky v kalkulaci<small class="muted" style="display:block">Mimo původní zadání</small></span><input type="checkbox" name="extrasEnabled"' + (r.extrasEnabled ? ' checked' : '') + '></label><div class="mt">' +
      r.extras.map(function (x) { return field('x_' + x.key, x.label + ' (Kč/' + x.unit + ')', x.price); }).join('') + '</div></div>' +
      '<button class="btn primary block" type="submit">Uložit sazby</button></form>' +
      '<div class="section-title">Demo data</div><div class="card"><p class="small muted">Vrátí ceník, uživatele i kalkulace na původní ukázková data.</p><button class="btn danger block" data-click="resetDemo">' + ic('refresh') + 'Obnovit ukázková data</button></div>', { title: 'Správa' });
  });
  A.on('submit', 'saveRates', function (form) {
    var e = form.elements, r = Store.db.rates, ok = true;
    var keys = ['riserSurcharge', 'transport'].concat(r.extras.map(function (x) { return 'x_' + x.key; }));
    keys.forEach(function (k) { var bad = !(num(e[k]) >= 0); A.setErr(e[k], bad ? 'Zadejte číslo ≥ 0' : ''); if (bad) ok = false; });
    if (!ok) return;
    r.riserSurcharge = num(e.riserSurcharge); r.transport = num(e.transport); r.vatDefault = parseFloat(e.vatDefault.value); r.roundTo = parseInt(e.roundTo.value, 10);
    r.extrasEnabled = e.extrasEnabled.checked; r.extras.forEach(function (x) { x.price = num(e['x_' + x.key]); });
    Store.save(); A.toast('Sazby uloženy');
  });
})();
