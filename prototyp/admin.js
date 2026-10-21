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
    A.render(tabs('patterns') + '<div class="alert info">' + Store.db.patterns.length + ' vzorů v ' + kols.length + ' kolekcích, nabízí se ' + off.length + (noPrice ? ', z toho ' + noPrice + ' bez ceny' : '') + '. Cena dekoru se bere z kolekce (záložka Kolekce), tady ji lze jen přepsat. Změna cen se projeví jen v nových kalkulacích – uložené kalkulace drží své ceny (snapshot).</div>' + A.question('photos') +
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
    var r = Store.db.rates, mdf = r.mdf, eur = r.eur, gl = r.glue, rs = r.reserve, lab = r.labor, al = r.allowance, ns = r.nose, miss = missingRates(r);
    function sel(name, label, opts, cur, hint) {
      return '<div class="field"><label>' + label + '</label><select name="' + name + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
    }
    var mdfM2 = mdf.thicknessMm / 1000 * mdf.eurPerM3 * eur.rate, glueM2 = gl.czkPerKg * gl.gPerM2 / 1000;
    A.render(tabs('rates') + (miss.length ? '<div class="alert warn"><b>Cena není kompletní:</b> chybí ' + miss.join(', ') + '. Kalkulace tuto položku nezapočítá a ukáže upozornění.</div>' : '') +
      '<form data-submit="saveRates" novalidate><div class="section-title">Obecné</div><div class="card">' +
      field('transport', 'Doprava (Kč, paušál)', r.transport) +
      '<div class="field"><label for="vd">Výchozí DPH</label><select id="vd" name="vatDefault">' + r.vatOptions.map(function (v) { return '<option value="' + v + '"' + (v === r.vatDefault ? ' selected' : '') + '>' + Math.round(v * 100) + ' %</option>'; }).join('') + '</select><div class="hint">Na kalkulaci lze přepnout 21 % / 12 %.</div></div>' +
      '<div class="field" style="margin:0"><label for="rt">Zaokrouhlení</label><select id="rt" name="roundTo"><option value="1"' + (r.roundTo === 1 ? ' selected' : '') + '>na celé Kč</option><option value="10"' + (r.roundTo === 10 ? ' selected' : '') + '>na 10 Kč (ukázka)</option></select></div></div>' +
      '<div class="section-title">MDF a kurz</div><div class="card"><div class="group-grid">' + field('mdfThickness', 'Tloušťka MDF (mm)', mdf.thicknessMm) + field('mdfEur', 'MDF (EUR/m³ bez DPH)', mdf.eurPerM3) + '</div>' +
      field('eurRate', 'Kurz (Kč/EUR)', eur.rate, 'Naposledy změněno ' + A.fmtDate(eur.changedAt) + '. Datum se nastaví, když hodnotu změníte.') + A.question('eurRate') +
      '<p class="small muted" style="margin:0">MDF vychází na <b>' + nf2(mdfM2) + ' Kč/m²</b>.</p></div>' +
      '<div class="section-title">Lepidlo a rezerva</div><div class="card"><div class="group-grid">' + field('glueKg', 'Lepidlo (Kč/kg)', gl.czkPerKg) + field('glueG', 'Nános (g/m²)', gl.gPerM2) + '</div>' +
      '<p class="small muted">Lepidlo vychází na <b>' + nf2(glueM2) + ' Kč/m²</b> jednoho nánosu.</p>' +
      sel('glueLayers', 'Počet nánosů', [[1, '1× – vinyl na MDF'], [2, '2× – i MDF na podklad']], gl.layers) + A.question('glueLayers') +
      field('reservePct', 'Rezerva na vstupy (%)', rs.pct, 'Platí pro MDF a lepidlo.') + check('reserveOnVinyl', 'Rezervu počítat i na vinyl', rs.onVinyl) + '</div>' +
      '<div class="section-title">Práce</div><div class="card">' + field('hourly', 'Hodinová sazba (Kč/h)', lab.hourly, 'Prázdné = nezadáno (kalkulace ukáže upozornění).') + A.question('hourlyRate') +
      '<div class="lbl">Normohodiny na nášlap</div><div class="group-grid">' +
      Calc.TREAD_TYPES.map(function (t) { return field('h_' + t.id, t.label + ' (h)', (lab.hoursByTread || {})[t.id]); }).join('') + '</div>' +
      field('riserHours', 'Podstupnice (h na kus)', lab.riserHours) + A.question('laborHours') + '</div>' +
      '<div class="section-title">Lišty a hrany</div><div class="card"><div class="group-grid">' + field('trimPerBm', 'Lišta KPV50 (Kč/bm)', r.trimPerBm, 'Na stranu schodiště u zdi.') + field('edgePerBm', 'Vinylová hrana (Kč/bm)', r.edgePerBm, 'Na otevřenou stranu (bez zdi). Prázdné = nezadáno.') + '</div>' +
      '<p class="small muted" style="margin:0">Délka se počítá z naměřených rozměrů pro každou stranu schodiště zvlášť: (hloubka nášlapu + výška podstupnice) × počet schodů. Strana u zdi jde do lišty, otevřená strana do hrany; u šikmých schodů se bere hloubka té strany. Kterou stranu má schodiště u zdi, se volí v kalkulaci (Strany schodiště).</p>' + A.question('edgePrice') + '</div>' +
      '<div class="section-title">Přídavek na ořez</div><div class="card">' + field('alW', 'Šířka – vlevo a vpravo celkem (cm)', al.width, 'Přičte se k naměřené šířce schodu, např. 100 cm → 103 cm. Hloubka a podstupnice se počítají bez přídavku.') + '</div>' +
      '<div class="section-title">Nos schodu</div><div class="card"><p class="small muted">Přesah přes hranu a ohyb pro nos, zvlášť pro MDF a vinyl (mm).</p><div class="group-grid">' +
      field('nsMo', 'MDF přesah', ns.mdfOverhangMm) + field('nsMw', 'MDF ohyb', ns.mdfWrapMm) + field('nsVo', 'Vinyl přesah', ns.vinylOverhangMm) + field('nsVw', 'Vinyl ohyb', ns.vinylWrapMm) + '</div>' + A.question('noseAllowance') + '</div>' +
      '<div class="section-title">Prořez</div><div class="card">' + sel('wasteMode', 'Režim prořezu', [['lamellas', 'Podle lamel (skutečná spotřeba)'], ['pct', 'Paušál v % u dekoru']], r.wasteMode, 'Paušál se nastavuje u vzoru. U kolekce bez rozměru lamely se použije vždy paušál.') + A.question('lamellaJoint') + '</div>' +
      '<div class="section-title">Příplatek za typ nášlapu</div><div class="card"><div class="group-grid">' +
      Calc.TREAD_TYPES.map(function (t) { return field('t_' + t.id, t.label + ' (Kč/nášlap)', (r.treadSurcharge || {})[t.id] || 0); }).join('') + '</div><p class="small muted" style="margin:0">Případný příplatek, zatím 0.</p></div>' +
      '<button class="btn primary block" type="submit">Uložit sazby</button></form>' +
      '<div class="section-title">Demo data</div><div class="card"><p class="small muted">Vrátí ceník, uživatele i kalkulace na původní ukázková data.</p><button class="btn danger block" data-click="resetDemo">' + ic('refresh') + 'Obnovit ukázková data</button></div>', { title: 'Správa' });
  });
  function nf2(x) { return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x); }
  A.on('submit', 'saveRates', function (form) {
    var e = form.elements, r = Store.db.rates, ok = true;
    var req = ['transport', 'mdfThickness', 'mdfEur', 'eurRate', 'glueKg', 'glueG', 'reservePct', 'riserHours', 'trimPerBm', 'alW', 'nsMo', 'nsMw', 'nsVo', 'nsVw']
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
    r.allowance = { width: num(e.alW), depth: 0, riser: 0 };
    r.nose = { mdfOverhangMm: num(e.nsMo), mdfWrapMm: num(e.nsMw), vinylOverhangMm: num(e.nsVo), vinylWrapMm: num(e.nsVw) };
    r.wasteMode = e.wasteMode.value;

    Store.save(); A.toast('Sazby uloženy'); A.dispatch();
  });
})();
