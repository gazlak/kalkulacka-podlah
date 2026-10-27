/* Administrace: uživatelé, vzory, globální sazby, reset demo dat. Jen pro roli admin. */
(function () {
  var A = App, esc = A.esc, ic = A.icon;
  var photos = {};

  function tabs(active) {
    return '<h1 class="large-title">Správa</h1><div class="seg full mb no-print" role="tablist">' + [['users', 'Uživatelé'], ['patterns', 'Vzory'], ['collections', 'Kolekce'], ['rates', 'Sazby']].map(function (t) {
      return '<a href="#/admin/' + t[0] + '" role="tab"' + (active === t[0] ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' + t[1] + '</a>';
    }).join('') + '</div>';
  }
  function num(el) { return Calc.num(el.value); }
  // krátká poznámka „jak se to počítá“ pod kartou; vzorec dávat do <b>. Při změně vzorce v calc.js ji aktualizovat.
  function how(html) { return '<div class="calc-how">' + ic('help', 'sm') + '<span>' + html + '</span></div>'; }

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
        (u.status === 'neověřen' ? row('check', 'Ověřit ručně', 'data-click="verifyUser"') : '') +
        (u.status === 'blokován' || locked ? row('key', 'Odblokovat', 'data-click="unblock"') : '') +
        (u.status === 'aktivní' && !self ? row('x', 'Blokovat', 'data-click="block"', true) : '')).replace('<div class="list sheet-list"></div>', '') +
      '<div class="dlg-foot"><button class="btn" data-click="closeModal">Zavřít</button></div>');
  });
  A.on('click', 'setRole', function (el) {
    var u = Store.userById(el.dataset.u); u.role = el.dataset.role; Store.save(); A.closeModal(); A.toast('Role změněna: ' + (u.role === 'admin' ? 'admin' : 'uživatel')); A.dispatch();
  });
  A.on('click', 'block', function (el) { Store.userById(el.dataset.u).status = 'blokován'; Store.save(); A.toast('Uživatel zablokován'); A.dispatch(); });
  A.on('click', 'verifyUser', function (el) { Store.userById(el.dataset.u).status = 'aktivní'; Store.save(); A.closeModal(); A.toast('Účet ověřen'); A.dispatch(); });
  A.on('click', 'unblock', function (el) {
    var u = Store.userById(el.dataset.u); if (u.status === 'blokován') u.status = 'aktivní'; u.lockedUntil = null; u.failedAttempts = 0; Store.save(); A.toast('Uživatel odblokován'); A.dispatch();
  });
  A.on('click', 'invite', function () {
    A.modal('<h2>Pozvat uživatele</h2><p class="small muted">Podlaháři se mohou registrovat i sami. Pozvánkou založíte účet za někoho jiného nebo přidáte admina.</p><form data-submit="doInvite" novalidate>' +
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
  function priceInfo() { return { collections: Store.db.collections }; }
  function field(n, l, v, hint) { return '<div class="field"><label>' + l + '</label><input type="text" name="' + n + '" inputmode="decimal" value="' + esc(v === null || v === undefined ? '' : v) + '"><div class="err"></div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; }
  function check(n, l, on) { return '<label class="check"><span>' + l + '</span><input type="checkbox" name="' + n + '"' + (on ? ' checked' : '') + '></label>'; }
  function kcs(x) { return Calc.formatCZK(x); }
  A.route('/admin/patterns', 'admin', function () {
    photos = {};
    var kols = kolekce(); if (kols.indexOf(adminKol) < 0) adminKol = kols[0];
    var list = Store.db.patterns.filter(function (p) { return p.kolekce === adminKol; }), pi = priceInfo();
    var pctMode = Store.db.rates.wasteMode === 'pct'; // prořez % u vzoru platí jen v paušálním režimu, jinak se počítá z lamel
    var off = Store.db.patterns.filter(function (p) { return p.active !== false; }), noPrice = off.filter(function (p) { return !(Calc.patternPrice(pi, p, null) > 0); }).length;
    A.render(tabs('patterns') + '<div class="alert info">' + Store.db.patterns.length + ' vzorů v ' + kols.length + ' kolekcích, nabízí se ' + off.length + (noPrice ? ', z toho ' + noPrice + ' bez ceny' : '') + '. Cena dekoru se bere z kolekce (záložka Kolekce), tady ji lze jen přepsat. Změna cen se projeví jen v nových kalkulacích – uložené kalkulace drží své ceny (snapshot).</div>' + A.question('photos') + how('<b>Vlastní cena</b> přepíše cenu kolekce jen pro tento dekor. <b>Prořez %</b> platí jen v paušálním režimu.') +
      '<div class="field"><label for="akol">Kolekce</label><select id="akol" data-change="adminKol">' + kols.map(function (k) {
        var n = Store.db.patterns.filter(function (p) { return p.kolekce === k; }).length;
        return '<option value="' + esc(k) + '"' + (k === adminKol ? ' selected' : '') + '>' + esc(k) + ' (' + n + ')</option>';
      }).join('') + '</select></div>' +
      '<form class="card" data-submit="saveKolekce" novalidate><h2 class="card-title">Nastavení pro celou kolekci</h2><p class="small muted">Vyplněná pole se zapíšou všem ' + list.length + ' vzorům kolekce, prázdná zůstanou beze změny.</p>' +
      '<div class="group-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' + field('priceOverride', 'Vlastní cena (Kč/m²)', '') + (pctMode ? field('wastePct', 'Prořez (%)', '') : '') + '</div>' +
      '<div class="field"><label>Dostupnost</label><select name="active"><option value="">beze změny</option><option value="1">aktivní (nabízet)</option><option value="0">skrýt</option></select></div>' +
      check('clearOverride', 'Zrušit vlastní ceny (podle kolekce)', false) +
      '<button class="btn primary block mt" type="submit">Nastavit celé kolekci</button></form>' +
      '<div class="pat-admin-grid">' + list.map(function (p) {
        var c = Calc.collectionOf(pi, p, null), lbl = c ? 'Vlastní cena (prázdné = podle kolekce ' + esc(c.name) + ': ' + kcs(c.materialPerM2) + ')' : 'Vlastní cena (dekor nemá kolekci)';
        return '<form class="card pat-admin" data-submit="savePattern" data-id="' + p.id + '" novalidate><img class="cover" loading="lazy" id="pimg' + p.id + '" src="' + A.patternImg(p) + '" alt="">' +
          '<div class="pbody"><div class="photo-actions"><label class="btn sm tonal">' + ic('plus') + 'Nahrát fotku<input type="file" class="sr" accept="image/*" data-change="patFile" data-id="' + p.id + '" aria-label="Fotka vzoru ' + p.id + '"></label>' +
          '<button type="button" class="btn sm ghost" data-click="patTex" data-id="' + p.id + '">Výchozí textura</button></div>' +
          '<div class="field"><label for="pn' + p.id + '">Název vzoru</label><input type="text" id="pn' + p.id + '" name="name" value="' + esc(p.name) + '"><div class="err"></div></div>' +
          '<div class="group-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' +
          field('priceOverride', lbl, p.priceOverride) + (pctMode ? field('wastePct', 'Prořez (%)', p.wastePct) : '') + '</div>' +
          check('active', 'Nabízet v kalkulaci' + (p.variant ? ' (' + (p.variant === 'click' ? 'CLICK' : 'LEPENÁ') + ')' : ''), p.active !== false) +
          '<button class="btn primary block mt" type="submit">Uložit vzor</button></div></form>';
      }).join('') + '</div>', { wide: true, title: 'Správa' });
  });
  A.on('change', 'adminKol', function (el) { adminKol = el.value; A.dispatch(); });
  A.on('submit', 'saveKolekce', function (form) {
    var e = form.elements, ok = true, set = {};
    [['priceOverride', 1e6], ['wastePct', 100]].forEach(function (k) {
      if (!e[k[0]]) return;
      var raw = e[k[0]].value.trim(), v = num(e[k[0]]), bad = raw !== '' && !(v >= 0 && v <= k[1]);
      A.setErr(e[k[0]], bad ? 'Zadejte číslo 0–' + k[1] : ''); if (bad) ok = false; else if (raw !== '') set[k[0]] = v;
    });
    if (!ok) return;
    var clear = e.clearOverride.checked, act = e.active.value;
    if (clear) set.priceOverride = null;
    if (act !== '') set.active = act === '1';
    if (!Object.keys(set).length) return A.toast('Vyplňte aspoň jedno pole');
    var n = 0;
    Store.db.patterns.forEach(function (p) {
      if (p.kolekce !== adminKol) return;
      Object.keys(set).forEach(function (k) { p[k] = set[k]; }); if (set.priceOverride !== undefined) p.priceEst = false; n++;
    });
    Store.save(); A.toast('Nastaveno ' + n + ' vzorům kolekce'); A.dispatch();
  });
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
    var raw = e.priceOverride.value.trim();
    chk(e.name, !e.name.value.trim(), 'Zadejte název');
    chk(e.priceOverride, raw !== '' && !(num(e.priceOverride) >= 0), 'Zadejte cenu ≥ 0 nebo nechte prázdné');
    if (e.wastePct) chk(e.wastePct, !(num(e.wastePct) >= 0 && num(e.wastePct) <= 100), 'Prořez musí být 0–100 %');
    if (!ok) return;
    p.priceOverride = raw === '' ? null : num(e.priceOverride); p.priceEst = false;
    p.name = e.name.value.trim(); if (e.wastePct) p.wastePct = num(e.wastePct); p.active = e.active.checked;
    if (p.id in photos || String(p.id) in photos) p.photo = photos[p.id];
    if (!Store.save()) return A.toast('Uložení se nepodařilo (plné úložiště?) – zkuste menší fotku');
    A.toast('Vzor uložen');
  });

  /* ---------- kolekce (ceník vinylu) ---------- */
  var importPlan = null, importText = '';
  A.route('/admin/collections', 'admin', function () {
    var cs = Store.db.collections, v = Store.db.rates.variants || { glued: true, click: true };
    A.render(tabs('collections') + '<div class="alert info">Ceny jsou doporučené (MOC) <b>bez DPH</b>. Dekory dědí cenu z kolekce; uložené kalkulace drží své ceny.' + A.question('mocPrice') + '</div>' +
      how('<b>Vinyl = spotřeba (m²) × cena kolekce.</b> Délka a šířka lamely určují spotřebu v režimu Podle lamel. Bez rozměru se počítá paušál.') + +
      '<form data-submit="saveCollections" novalidate><div class="section-title">Nabízené varianty</div><div class="card">' +
      check('var_glued', 'LEPENÁ', v.glued !== false) + check('var_click', 'CLICK', v.click !== false) + A.question('variants') + '</div>' +
      '<div class="section-title">Kolekce (' + cs.length + ')</div>' + cs.map(function (c) {
        var id = c.id;
        return '<div class="card"><div class="field"><label>' + c.no + '. Název</label><input type="text" name="name_' + id + '" value="' + esc(c.name) + '"><div class="err"></div></div>' +
          '<div class="group-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">' + field('price_' + id, 'Cena (Kč/m²)', c.materialPerM2) + field('len_' + id, 'Délka (mm)', c.lamellaLengthMm) + field('wid_' + id, 'Šířka (mm)', c.lamellaWidthMm) + '</div>' +
          check('act_' + id, 'Aktivní', c.active !== false) + (c.id === 'grandissimo-plus' ? A.question('gplusWidth') : '') + '</div>';
      }).join('') + '<button class="btn primary block" type="submit">Uložit kolekce</button></form>' +
      '<div class="section-title">Hromadná úprava cen</div><form class="card" data-submit="bulkPct" novalidate><div class="field"><label>Změnit všechny ceny o ± %</label><input type="text" name="pct" inputmode="decimal" placeholder="např. 5 nebo -3"><div class="err"></div></div>' +
      '<button class="btn block" type="submit">Změnit ceny všech kolekcí</button></form>' +
      '<div class="section-title">Export a import CSV</div><div class="card"><p class="small muted">Sloupce <code>č.;kolekce;cena;délka;šířka</code>, oddělovač středník, desetinná čárka. Kolekce se při importu párují podle názvu.</p>' +
      '<button class="btn block" data-click="csvExport">Exportovat CSV</button>' +
      '<div class="field mt"><label for="csvf">Soubor CSV</label><input type="file" id="csvf" accept=".csv,text/csv,text/plain" data-change="csvFile"></div>' +
      '<div class="field"><label for="csvt">…nebo vložený text</label><textarea id="csvt" rows="5" placeholder="č.;kolekce;cena;délka;šířka">' + esc(importText) + '</textarea></div>' +
      '<button class="btn primary block" data-click="csvPreview">Zobrazit náhled změn</button></div>', { wide: true, title: 'Správa' });
  });
  A.on('submit', 'saveCollections', function (form) {
    var e = form.elements, ok = true, cs = Store.db.collections;
    cs.forEach(function (c) {
      ['price_', 'len_', 'wid_'].forEach(function (k) { var el = e[k + c.id], bad = !(num(el) >= 0); A.setErr(el, bad ? 'Zadejte číslo ≥ 0' : ''); if (bad) ok = false; });
      var nm = e['name_' + c.id]; A.setErr(nm, nm.value.trim() ? '' : 'Zadejte název'); if (!nm.value.trim()) ok = false;
    });
    if (!ok) return A.toast('Opravte označená pole');
    cs.forEach(function (c) {
      c.name = e['name_' + c.id].value.trim(); c.materialPerM2 = num(e['price_' + c.id]);
      c.lamellaLengthMm = num(e['len_' + c.id]); c.lamellaWidthMm = num(e['wid_' + c.id]); c.active = e['act_' + c.id].checked;
    });
    Store.db.rates.variants = { glued: e.var_glued.checked, click: e.var_click.checked };
    Store.save(); A.toast('Kolekce uloženy'); A.dispatch();
  });
  A.on('submit', 'bulkPct', function (form) {
    var el = form.elements.pct, v = num(el);
    if (isNaN(v) || v <= -100 || v > 1000) return A.setErr(el, 'Zadejte procento, např. 5 nebo -3');
    A.setErr(el, '');
    Store.db.collections.forEach(function (c) { c.materialPerM2 = Math.round(c.materialPerM2 * (1 + v / 100)); });
    Store.save(); A.toast('Ceny změněny o ' + v + ' %'); A.dispatch();
  });
  function csvNum(x) { return String(x).replace('.', ','); }
  A.on('click', 'csvExport', function () {
    var rows = ['č.;kolekce;cena;délka;šířka'].concat(Store.db.collections.map(function (c, i) {
      return [c.no || i + 1, c.name, csvNum(c.materialPerM2), csvNum(c.lamellaLengthMm), csvNum(c.lamellaWidthMm)].join(';');
    }));
    var blob = new Blob(['﻿' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'cenik-kolekce.csv'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  A.on('change', 'csvFile', function (el) {
    var f = el.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { importText = String(r.result).replace(/^﻿/, ''); A.$('#csvt').value = importText; };
    r.readAsText(f, 'utf-8');
  });
  // vrací {changes, added, errors, rows}; rows = nové hodnoty podle názvu
  function parseCsv(text) {
    var out = { changes: [], added: [], errors: [], rows: [] }, cs = Store.db.collections, byName = {};
    cs.forEach(function (c) { byName[c.name.trim().toLowerCase()] = c; });
    text.split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var cells = line.split(line.indexOf(';') >= 0 ? ';' : '\t').map(function (x) { return x.trim(); });
      if (i === 0 && isNaN(Calc.num(cells[2])) && /cen|kolek/i.test(line)) return; // hlavička
      if (cells.length < 5) return out.errors.push('Řádek ' + (i + 1) + ': čekám 5 sloupců (č.;kolekce;cena;délka;šířka)');
      var name = cells[1], price = Calc.num(cells[2]), len = Calc.num(cells[3]), wid = Calc.num(cells[4]);
      if (!name) return out.errors.push('Řádek ' + (i + 1) + ': chybí název kolekce');
      if (!(price >= 0) || !(len > 0) || !(wid > 0)) return out.errors.push('Řádek ' + (i + 1) + ' (' + name + '): cena, délka a šířka musí být čísla (délka, šířka > 0)');
      var c = byName[name.toLowerCase()], row = { name: name, price: price, len: len, wid: wid, c: c || null };
      out.rows.push(row);
      if (!c) return out.added.push(row);
      var ch = [];
      if (c.materialPerM2 !== price) ch.push('cena ' + csvNum(c.materialPerM2) + ' → ' + csvNum(price) + ' Kč');
      if (c.lamellaLengthMm !== len) ch.push('délka ' + csvNum(c.lamellaLengthMm) + ' → ' + csvNum(len) + ' mm');
      if (c.lamellaWidthMm !== wid) ch.push('šířka ' + csvNum(c.lamellaWidthMm) + ' → ' + csvNum(wid) + ' mm');
      if (ch.length) out.changes.push({ name: c.name, text: ch.join(', ') });
    });
    return out;
  }
  A.on('click', 'csvPreview', function () {
    importText = A.$('#csvt').value;
    if (!importText.trim()) return A.toast('Vyberte soubor nebo vložte text CSV');
    var p = importPlan = parseCsv(importText);
    function ul(items) { return '<ul class="imp-list">' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }
    A.modal('<h2>Náhled importu</h2>' +
      (p.errors.length ? '<div class="alert warn"><b>Chybné řádky (' + p.errors.length + ') se přeskočí:</b>' + ul(p.errors.map(esc)) + '</div>' : '') +
      '<div class="lbl">Změněné kolekce (' + p.changes.length + ')</div>' + (p.changes.length ? ul(p.changes.map(function (c) { return '<b>' + esc(c.name) + '</b>: ' + esc(c.text); })) : '<p class="small muted">Žádná změna.</p>') +
      '<div class="lbl">Nové kolekce (' + p.added.length + ')</div>' + (p.added.length ? ul(p.added.map(function (r) { return '<b>' + esc(r.name) + '</b>: ' + csvNum(r.price) + ' Kč, ' + csvNum(r.len) + '×' + csvNum(r.wid) + ' mm'; })) : '<p class="small muted">Žádné.</p>') +
      '<div class="dlg-foot"><button class="btn" data-click="closeModal">Zrušit</button><button class="btn primary" data-click="csvApply"' + (p.changes.length || p.added.length ? '' : ' disabled') + '>Uložit</button></div>');
  });
  A.on('click', 'csvApply', function () {
    var p = importPlan; if (!p) return;
    var cs = Store.db.collections, nextNo = cs.reduce(function (m, c) { return Math.max(m, c.no || 0); }, 0);
    p.rows.forEach(function (r) {
      if (r.c) { r.c.materialPerM2 = r.price; r.c.lamellaLengthMm = r.len; r.c.lamellaWidthMm = r.wid; }
      else cs.push({ id: Store.uid('k'), no: ++nextNo, name: r.name, materialPerM2: r.price, lamellaLengthMm: r.len, lamellaWidthMm: r.wid, active: true });
    });
    importPlan = null; importText = '';
    Store.save(); A.closeModal(); A.toast('Import uložen'); A.dispatch();
  });

  /* ---------- sazby ---------- */
  function missingRates(r) {
    var m = [];
    if (isNaN(num({ value: r.labor && r.labor.hourly }))) m.push('hodinová sazba práce');
    if (isNaN(num({ value: r.edgePerBm }))) m.push('cena vinylové hrany');
    return m;
  }
  A.route('/admin/rates', 'admin', function () {
    var r = Store.db.rates, mdf = r.mdf, eur = r.eur, gl = r.glue, rs = r.reserve, lab = r.labor, ct = r.cut || {}, cv = ct.vinyl || {}, cm = ct.mdf || {}, miss = missingRates(r);
    function sel(name, label, opts, cur, hint) {
      return '<div class="field"><label>' + label + '</label><select name="' + name + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
    }
    var mdfM2 = mdf.thicknessMm / 1000 * mdf.eurPerM3 * eur.rate, glueM2 = gl.czkPerKg * gl.gPerM2 / 1000;
    var tt = Calc.TREAD_TYPES[0], tth = (lab.hoursByTread || {})[tt.id], hr = lab.hourly;
    var workEx = tth > 0 && hr > 0 ? ' Např. schod ' + tt.label.toLowerCase() + ': <b>' + nf2(tth).replace(/,00$/, '') + ' h × ' + nf2(hr).replace(/,00$/, '') + ' = ' + kcs(tth * hr) + '</b>.' : '';
    A.render(tabs('rates') + (miss.length ? '<div class="alert warn"><b>Cena není kompletní:</b> chybí ' + miss.join(', ') + '. Kalkulace tuto položku nezapočítá a ukáže upozornění.</div>' : '') +
      ((r.costPrice || {}).on ? '<div class="card"><b>Cena schodu</b> = (vinyl za MOC + MDF + lepidlo) × (1 + prořez) + práce, celé × (1 + marže). K tomu lišta, hrana a doprava, pak sleva a DPH. Kalkulace může být i bez vinylu (jen MDF). Sekce Cena schodu a Podestový schod níže se v tomto režimu nepoužívají. Uložené kalkulace drží svůj ceník.</div>' : '') +
      ((r.costPrice || {}).on ? '' : (r.stairPrice || {}).on ? '<div class="card"><b>Cena</b> = plocha nášlapů × cena schodu za m² + plocha podstupnic × cena podstupnice za m² + lišta + hrana + doprava − sleva, pak DPH. Cena schodu se odvozuje od nejdražšího dekoru (sekce Cena schodu). Sazby MDF, lepidla a práce níže se v tomto režimu nepoužívají. Uložené kalkulace drží svůj ceník.</div>'
        : '<div class="card"><b>Cena</b> = vinyl + MDF + lepidlo + práce + podstupnice + lišta + hrana + doprava (+ příplatek) − sleva, pak DPH. Každá položka se zaokrouhlí podle nastavení. Uložené kalkulace drží svůj ceník.</div>') +
      '<form data-submit="saveRates" novalidate>' + costSection(r) + stairSection(r) + landingSection(r) + '<div class="section-title">Obecné</div><div class="card">' +
      field('transport', 'Doprava (Kč, paušál)', r.transport) +
      '<div class="field"><label for="vd">Výchozí DPH</label><select id="vd" name="vatDefault">' + r.vatOptions.map(function (v) { return '<option value="' + v + '"' + (v === r.vatDefault ? ' selected' : '') + '>' + Math.round(v * 100) + ' %</option>'; }).join('') + '</select><div class="hint">Na kalkulaci lze přepnout 21 % / 12 %.</div></div>' +
      '<div class="field" style="margin:0"><label for="rt">Zaokrouhlení</label><select id="rt" name="roundTo"><option value="1"' + (r.roundTo === 1 ? ' selected' : '') + '>na celé Kč</option><option value="10"' + (r.roundTo === 10 ? ' selected' : '') + '>na 10 Kč (ukázka)</option></select></div>' + how('Doprava se připočte jednou za kalkulaci. Sleva se odečte před DPH.') + '</div>' +
      '<div class="section-title">MDF a kurz</div><div class="card"><div class="group-grid">' + field('mdfThickness', 'Tloušťka MDF (mm)', mdf.thicknessMm) + field('mdfEur', 'Cena MDF (EUR/m³)', mdf.eurPerM3, 'Bez DPH.') + '</div>' +
      field('eurRate', 'Kurz (Kč/EUR)', eur.rate, 'Naposledy změněno ' + A.fmtDate(eur.changedAt) + '. Datum se nastaví, když hodnotu změníte.') + A.question('eurRate') +
      how('MDF Kč/m² = tloušťka (m) × EUR/m³ × kurz = <b>' + nf2(mdfM2) + ' Kč/m²</b>. Plocha MDF = (hloubka + rezerva MDF) × délka + 2 podstupnice. Bez další rezervy – ořez je už v rozměrech.') + '</div>' +
      '<div class="section-title">Lepidlo a rezerva</div><div class="card"><div class="group-grid">' + field('glueKg', 'Lepidlo (Kč/kg)', gl.czkPerKg) + field('glueG', 'Nános (g/m²)', gl.gPerM2) + '</div>' +
      how('Lepidlo Kč/m² = Kč/kg × g/m² / 1000 = <b>' + nf2(glueM2) + ' Kč/m²</b> jednoho nánosu. Plocha = plocha vinylu (2× nános: + plocha MDF) × (1 + rezerva).') +
      sel('glueLayers', 'Počet nánosů', [[1, '1× – vinyl na MDF'], [2, '2× – i MDF na podklad']], gl.layers) + A.question('glueLayers') +
      field('reservePct', 'Rezerva na lepidlo (%)', rs.pct, 'Platí jen pro lepidlo. MDF se počítá z rozměrů dílců, rezerva na ořez je už v nich.') + check('reserveOnVinyl', 'Rezervu počítat i na vinyl (jen paušální režim prořezu)', rs.onVinyl) + how('Rezerva zvedá lepidlo. Na vinyl jen v paušálním režimu – v režimu podle lamel jsou lamely celé i s odřezky.') + '</div>' +
      '<div class="section-title">Práce</div><div class="card">' + field('hourly', 'Hodinová sazba (Kč/h)', lab.hourly, 'Prázdné = nezadáno (kalkulace ukáže upozornění).') + A.question('hourlyRate') +
      '<div class="lbl">Normohodiny na schod (nášlap i podstupnice)</div><div class="group-grid">' +
      Calc.TREAD_TYPES.map(function (t) { return field('h_' + t.id, t.label + ' (h)', (lab.hoursByTread || {})[t.id]); }).join('') + '</div>' +
      field('riserHours', 'Podstupnice navíc (h na kus)', lab.riserHours, '0 = práce na podstupnici je v hodinách za schod.') + A.question('laborHours') +
      how('<b>Práce = počet schodů × normohodiny podle typu × sazba.</b> Podstupnice navíc = počet × h na kus × sazba.' + workEx) + '</div>' +
      '<div class="section-title">Lišty a hrany</div><div class="card"><div class="group-grid">' + field('trimPerBm', 'Lišta KPV50 (Kč/bm)', r.trimPerBm, 'Na stranu schodiště u zdi.') + field('edgePerBm', 'Vinylová hrana (Kč/bm)', r.edgePerBm, 'Na otevřenou stranu (bez zdi). Prázdné = nezadáno.') + '</div>' +
      A.question('edgePrice') + how('<b>bm strany = (hloubka + podstupnice) × počet schodů.</b> Strana u zdi → lišta, otevřená → hrana. Strany se volí u skupiny. Na kalkulaci lze bm přepsat.') + '</div>' +
      '<div class="section-title">Rezerva na ořez</div><div class="card"><div class="lbl">Vinyl</div><div class="group-grid">' + field('cvFlat', 'Bez nosu (mm)', cv.flatMm) + field('cvNose', 'S nosem (mm)', cv.noseMm) + '</div>' +
      '<div class="lbl">MDF</div><div class="group-grid">' + field('cmFlat', 'Bez nosu (mm)', cm.flatMm) + field('cmNose', 'S nosem (mm)', cm.noseMm) + '</div>' + field('cmRiser', 'Přídavek k výšce podstupnice (mm)', cm.riserMm) +
      how('<b>Nářez vinylu = délka × (hloubka + rezerva).</b> Podstupnice vinyl = délka × výška. MDF podstupnice = 2 × (výška + přídavek). Podlahář rezervu nevidí.') +
      field('vinylInfoPct', 'Vinyl – informativní sleva pro admina (%)', r.vinylInfoPct, 'Jen údaj v rozpisu pro správce, cenu nemění.') + '</div>' +
      '<div class="section-title">Prořez</div><div class="card">' + sel('wasteMode', 'Režim prořezu', [['lamellas', 'Podle lamel (skutečná spotřeba)'], ['pct', 'Paušál v % u dekoru']], r.wasteMode, 'Paušál se nastavuje u vzoru. U kolekce bez rozměru lamely se použije vždy paušál.') + A.question('lamellaJoint') +
      (r.wasteMode === 'pct' ? '' : check('joinRest', 'Doplňkové pruhy smí být nastavené ze dvou kusů', !!r.joinRest) +
        field('kerfMm', 'Šířka řezu pily (mm)', r.kerfMm == null ? 3 : r.kerfMm, 'Odečte se při každém řezu z lamely.')) +
      how(r.wasteMode === 'pct' ? '<b>Spotřeba = plocha k nářezu × (1 + prořez % u vzoru).</b>' : '<b>Spotřeba = celé lamely podle nářezového plánu celé kalkulace.</b> Každý nášlap a podstupnice = plné pruhy v šířce lamely + doplňkový pruh. Doplňkové pruhy se skládají vedle sebe do společných pruhů a odřezky se použijí v celé kalkulaci. S nastavováním smí být doplňkový pruh složený z kratších kusů (aspoň 15 cm).') + '</div>' +
      '<div class="section-title">Příplatek za typ nášlapu</div><div class="card"><div class="group-grid">' +
      Calc.TREAD_TYPES.map(function (t) { return field('t_' + t.id, t.label + ' (Kč/nášlap)', (r.treadSurcharge || {})[t.id] || 0); }).join('') + '</div>' + how('<b>Počet nášlapů daného typu × příplatek.</b>') + '</div>' +
      '<button class="btn primary block" type="submit">Uložit sazby</button></form>' +
      '<div class="section-title">Demo data</div><div class="card"><p class="small muted">Vrátí ceník, uživatele i kalkulace na původní ukázková data.</p><button class="btn danger block" data-click="resetDemo">' + ic('refresh') + 'Obnovit ukázková data</button></div>', { title: 'Správa' });
  });
  /* Cena schodu z materiálu: prořez, práce na schod, marže a příklad referenčního schodu s nejdražším vinylem */
  function costSection(r) {
    var cp = r.costPrice || {}, kc = function (x) { return kcs(Math.round(x)); };
    var h = '<div class="section-title">Cena schodu z materiálu</div><div class="card">' + check('cpOn', 'Počítat cenu schodu z materiálu, práce a marže (má přednost před cenou od nejdražšího dekoru)', cp.on !== false) +
      '<div class="group-grid">' + field('cpWaste', 'Prořez materiálu (%)', cp.wastePct) + field('cpMargin', 'Marže z celku (%)', cp.marginPct) + '</div>' +
      '<div class="group-grid">' + field('cpHours', 'Práce na schod (h)', cp.hoursPerStair) + field('cpHourly', 'Sazba práce (Kč/h)', cp.hourly) + '</div>';
    var pr = { patterns: Store.db.patterns, collections: Store.db.collections, rates: Object.assign({}, r, { costPrice: Object.assign({}, cp, { on: true }) }) }, top = Calc.topVinylPrice(pr);
    var g = { width: 120, depth: 33, riserHeight: 18, count: 1, treadType: 'nose', stepKind: 'straight', coverRiser: false };
    var pat = Store.db.patterns.filter(function (p) { return Calc.patternOffered(pr, p) && Calc.patternPrice(pr, p) === top; })[0];
    if (pat) {
      var q = Calc.computeQuote([g], pat.id, pr, null, 0, {}, {}), s = q.cost.split, q0 = Calc.computeQuote([g], pat.id, pr, null, 0, {}, { noVinyl: true });
      h += how('<b>Příklad:</b> schod 120 × 33 cm s nosem bez podstupnice, nejdražší vinyl ' + kc(top) + '/m². Materiál ' + kc(s.vinyl + s.mdf + s.glue) + ' (vinyl ' + kc(s.vinyl) + ', MDF ' + kc(s.mdf) + ', lepidlo ' + kc(s.glue) + ') + prořez ' + kc(s.waste) +
        ' + práce ' + kc(s.labor) + ' + marže ' + kc(s.margin) + ' = <b>' + kc(q.cost.priced) + '</b> bez DPH. Bez vinylu <b>' + kc(q0.cost.priced) + '</b>.');
    }
    return h + '</div>';
  }
  /* Cena schodu od nejdražšího dekoru: nastavení, rozpis referenčního schodu, cena za m² a tabulka kolekcí */
  function stairSection(r) {
    var sp = r.stairPrice || {}, pr = { patterns: Store.db.patterns, collections: Store.db.collections, rates: r }, sr = Calc.stairRates(pr);
    var on = sp.on !== false, kc = function (x) { return kcs(Math.round(x)); };
    var h = '<div class="section-title">Cena schodu</div><div class="card">' + check('spOn', 'Počítat cenu schodu od nejdražšího dekoru (místo výroby a přirážek)', on) +
      field('spTop', 'Cena nejdražšího schodu bez podstupnice (Kč bez DPH)', sp.topPrice, 'Referenční schod s nejdražším vinylem za MOC.') +
      '<div class="group-grid">' + field('spW', 'Referenční schod – délka (mm)', sp.refWidthMm) + field('spD', 'Referenční schod – hloubka (mm)', sp.refDepthMm) + '</div>' +
      '<div class="group-grid">' + field('spProd', 'Naše výroba (Kč/schod)', sp.productionPerStair, 'MDF, lepidlo, práce.') + field('spFloor', 'Podlahář (% z ceny)', sp.floorerPct, 'Zbytek po vinylu a výrobě patří odběrateli.') + '</div>' +
      '<div class="group-grid">' + field('spRiser', 'Podstupnice (% ceny schodu za m²)', sp.riserPct) + field('spWaste', 'Prořez vinylu ref. schodu (%)', sp.wastePct) + '</div>';
    if (sr && sr.refArea > 0) {
      h += how('<b>Referenční schod</b> ' + sp.refWidthMm + ' × ' + sp.refDepthMm + ' mm = ' + nf2(sr.refArea) + ' m² nášlapu, vinyl ' + nf2(sr.refVinylM2) + ' m² (s nosem ' + Calc.defaults(r).cut.vinyl.nose + ' mm a prořezem). ' +
          'Nejdražší vinyl ' + kc(sr.top) + '/m².<br><b>' + kc(sr.stair) + '</b> = vinyl ' + kc(sr.vinyl) + ' + výroba ' + kc(sr.production) + ' + podlahář ' + kc(sr.floorer) + ' + odběratel ' + kc(sr.buyer) + '.<br>' +
          '<b>Schod ' + kc(sr.perM2) + '/m²</b> (cena / plocha nášlapu), <b>podstupnice ' + kc(sr.riserPerM2) + '/m²</b>. Kalkulace = naměřená plocha nášlapů × cena za m² + plocha podstupnic × cena za m².<br>' +
          'Levnější dekor = ' + kc(sp.topPrice) + ' − (' + kc(sr.top) + ' − cena dekoru za m²) × ' + nf2(sr.refVinylM2) + ' m². ' +
          'Podstupnice z ceníku AKTO: schod 1 700 Kč/bm při 330 mm = 5 152 Kč/m², podstupnice 1 000 Kč za 1,2 m při 200 mm = 4 167 Kč/m², tedy cca 81 %.') +
        '<div class="list">' + Store.db.collections.filter(function (c) { return c.active !== false; }).slice().sort(function (a, b) { return b.materialPerM2 - a.materialPerM2; }).map(function (c) {
          var x = sr.forPrice(c.materialPerM2);
          return '<div class="lrow"><span class="k">' + esc(c.name) + '<small>vinyl ' + kc(c.materialPerM2) + '/m² · schod ' + kc(x.perM2) + '/m² · podstupnice ' + kc(x.riserPerM2) + '/m²</small></span><span class="v">' + kc(x.stair) + '</span></div>';
        }).join('') + '</div>';
    }
    return h + '</div>';
  }
  /* Podestový schod (plachta): cíl nejdražší podesty, naše výroba, rozpis a materiál čela z našich sazeb */
  function landingSection(r) {
    var lp = r.landingPrice || {}, pr = { patterns: Store.db.patterns, collections: Store.db.collections, rates: r }, lr = Calc.stairRates(pr, undefined, 'landingPrice');
    var kc = function (x) { return kcs(Math.round(x)); }, w = n0v(lp.refWidthMm), dep = n0v(lp.refDepthMm);
    var mN = Calc.landingMaterial({ width: w / 10, depth: dep / 10, treadType: 'nose', riserHeight: 18 }, r), mF = Calc.landingMaterial({ width: w / 10, depth: dep / 10, treadType: 'flat', riserHeight: 18 }, r);
    var h = '<div class="section-title">Podestový schod (plachta)</div><div class="card">' + check('lpOn', 'Počítat podestu vlastní cenou (typ schodu „Podestový“)', lp.on !== false) +
      field('lpTop', 'Cena nejdražší podesty (Kč bez DPH)', lp.topPrice, 'Referenční podesta s nejdražším vinylem za MOC.') +
      '<div class="group-grid">' + field('lpW', 'Referenční podesta – délka (mm)', lp.refWidthMm) + field('lpD', 'Referenční podesta – hloubka (mm)', lp.refDepthMm) + '</div>' + A.question('landingRef') +
      '<div class="group-grid">' + field('lpProd', 'Naše výroba (Kč/kus)', lp.productionPerStair) + field('lpFloor', 'Podlahář (% z ceny)', lp.floorerPct) + '</div>' + A.question('landingProduction') +
      '<div class="group-grid">' + field('lpNose', 'Čelo s nosem – výška MDF (mm)', lp.noseEdgeMm) + field('lpWaste', 'Prořez vinylu (%)', lp.wastePct) + '</div>';
    if (lr && lr.refArea > 0) h += how('<b>Konstrukce:</b> horní MDF není, vinyl se lepí přímo na podestu. Čelo = 2 × MDF 12 mm; s nosem ve výšce ' + lp.noseEdgeMm + ' mm a 1 lamela, bez nosu ve výšce podstupnice a 2 lamely (podstupnice je tím v ceně). Lepí se jen čelo.<br>' +
      '<b>Referenční podesta</b> ' + lp.refWidthMm + ' × ' + lp.refDepthMm + ' mm = ' + nf2(lr.refArea) + ' m², vinyl ' + nf2(lr.refVinylM2) + ' m².<br><b>' + kc(lr.stair) + '</b> = vinyl ' + kc(lr.vinyl) + ' + výroba ' + kc(lr.production) + ' + podlahář ' + kc(lr.floorer) + ' + odběratel ' + kc(lr.buyer) + '.<br>' +
      '<b>Podesta ' + kc(lr.perM2) + '/m²</b> plachty. Materiál čela z našich sazeb (jen informativně): s nosem MDF ' + kc(mN.mdf) + ' + lepidlo ' + kc(mN.glue) + ', bez nosu (podstupnice 18 cm) MDF ' + kc(mF.mdf) + ' + lepidlo ' + kc(mF.glue) + '.') +
      (lr && lr.buyer < lr.stair * 0.15 ? '<div class="alert warn">Odběrateli zbývá jen ' + kc(lr.buyer) + ' z ' + kc(lr.stair) + ' – zkontrolujte cílovou cenu nebo referenční rozměr.</div>' : '') + A.question('landingEdge');
    return h + '</div>';
  }
  function n0v(x) { return Calc.n0(x); }
  function nf2(x) { return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x); }
  A.on('submit', 'saveRates', function (form) {
    var e = form.elements, r = Store.db.rates, ok = true;
    var req = ['transport', 'mdfThickness', 'mdfEur', 'eurRate', 'glueKg', 'glueG', 'reservePct', 'riserHours', 'trimPerBm', 'cvFlat', 'cvNose', 'cmFlat', 'cmNose', 'cmRiser', 'vinylInfoPct']
      .concat(r.extras.map(function (x) { return 'x_' + x.key; }));
    Calc.TREAD_TYPES.forEach(function (t) { req.push('t_' + t.id, 'h_' + t.id); });
    req.forEach(function (k) { var bad = !(num(e[k]) >= 0); A.setErr(e[k], bad ? 'Zadejte číslo ≥ 0' : ''); if (bad) ok = false; });
    ['hourly', 'edgePerBm'].forEach(function (k) { var bad = e[k].value.trim() !== '' && !(num(e[k]) >= 0); A.setErr(e[k], bad ? 'Zadejte číslo ≥ 0 nebo nechte prázdné' : ''); if (bad) ok = false; });
    if (!ok) return;
    var optNum = function (el) { return el.value.trim() === '' ? null : num(el); };
    r.transport = num(e.transport); r.vatDefault = parseFloat(e.vatDefault.value); r.roundTo = parseInt(e.roundTo.value, 10);
    r.mdf = { thicknessMm: num(e.mdfThickness), eurPerM3: num(e.mdfEur) };
    var rate = num(e.eurRate); r.eur = { rate: rate, changedAt: rate !== (r.eur && r.eur.rate) ? Date.now() : (r.eur && r.eur.changedAt) || Date.now() };
    r.glue = { czkPerKg: num(e.glueKg), gPerM2: num(e.glueG), layers: parseInt(e.glueLayers.value, 10) };
    r.reserve = { pct: num(e.reservePct), onVinyl: e.reserveOnVinyl.checked };
    r.labor = { hourly: optNum(e.hourly), hoursByTread: {}, riserHours: num(e.riserHours) };
    r.treadSurcharge = {};
    Calc.TREAD_TYPES.forEach(function (t) { r.labor.hoursByTread[t.id] = num(e['h_' + t.id]); r.treadSurcharge[t.id] = num(e['t_' + t.id]); });
    r.trimPerBm = num(e.trimPerBm); r.edgePerBm = optNum(e.edgePerBm);
    r.cut = { vinyl: { flatMm: num(e.cvFlat), noseMm: num(e.cvNose) }, mdf: { flatMm: num(e.cmFlat), noseMm: num(e.cmNose), riserMm: num(e.cmRiser) } };
    r.vinylInfoPct = num(e.vinylInfoPct);
    r.wasteMode = e.wasteMode.value;
    if (e.joinRest) r.joinRest = e.joinRest.checked;
    if (e.kerfMm) { var kf = num(e.kerfMm); if (!(kf >= 0 && kf <= 10)) return A.setErr(e.kerfMm, 'Zadejte 0–10 mm'); r.kerfMm = kf; }

    var spBad = false;
    ['spTop', 'spW', 'spD', 'spProd', 'spFloor', 'spRiser', 'spWaste'].forEach(function (k) { var bad = !(num(e[k]) >= 0); A.setErr(e[k], bad ? 'Zadejte číslo ≥ 0' : ''); if (bad) spBad = true; });
    if (spBad) return;
    var lpBad = false;
    ['lpTop', 'lpW', 'lpD', 'lpProd', 'lpFloor', 'lpNose', 'lpWaste'].forEach(function (k) { var bad = !(num(e[k]) >= 0); A.setErr(e[k], bad ? 'Zadejte číslo ≥ 0' : ''); if (bad) lpBad = true; });
    if (lpBad) return;
    r.landingPrice = { on: e.lpOn.checked, topPrice: num(e.lpTop), refWidthMm: num(e.lpW), refDepthMm: num(e.lpD), productionPerStair: num(e.lpProd), floorerPct: num(e.lpFloor), wastePct: num(e.lpWaste), noseEdgeMm: num(e.lpNose), mdfLayers: 2 };
    var cpBad = false;
    ['cpWaste', 'cpMargin', 'cpHours', 'cpHourly'].forEach(function (k) { var bad = !(num(e[k]) >= 0); A.setErr(e[k], bad ? 'Zadejte číslo ≥ 0' : ''); if (bad) cpBad = true; });
    if (cpBad) return;
    r.costPrice = { on: e.cpOn.checked, wastePct: num(e.cpWaste), hoursPerStair: num(e.cpHours), hourly: num(e.cpHourly), marginPct: num(e.cpMargin) };
    r.stairPrice = { on: e.spOn.checked, topPrice: num(e.spTop), refWidthMm: num(e.spW), refDepthMm: num(e.spD), productionPerStair: num(e.spProd), floorerPct: num(e.spFloor), riserPct: num(e.spRiser), wastePct: num(e.spWaste) };
    Store.save(); A.toast('Sazby uloženy'); A.dispatch();
  });
})();
