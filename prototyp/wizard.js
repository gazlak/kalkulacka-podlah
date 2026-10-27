/* Průvodce (kroky 1–5), obrazovka kalkulace, PDF náhled, odeslání e-mailem, porovnání vzorů. */
(function () {
  var A = App, esc = A.esc, fmt = Calc.formatCZK, m2 = Calc.formatM2, ic = A.icon;
  var W = { pending: null, c: null, step: 1, showErrors: false, inWizard: false, folded: {}, foldFor: null, verFor: null, verBase: null, verPending: false };

  /* ---------- společné ---------- */
  function loadCalc(id, user) {
    var c = Store.calcById(id) || (W.pending && W.pending.id === id ? W.pending : null);
    if (!c || !Store.canSee(user, c)) { A.toast('Kalkulace nenalezena'); A.go('/history'); return null; }
    return c;
  }
  // admin smí upravit cokoli; podlahář jen vlastní koncept (po předání ke zpracování je kalkulace jen ke čtení)
  function ro(c) {
    c = c || W.c; var u = Store.currentUser();
    if (!c || !u || A.isAdmin(u)) return false;
    return c.ownerId !== u.id || c.status !== 'koncept';
  }
  // detaily (rozpis, sleva, DPH, PDF, e-mail, stavy) vidí jen admin; podlahář jen celkovou cenu
  function full() { return A.isAdmin(Store.currentUser()); }
  /* verze kalkulace: bez fotek (limit úložiště) a bez vlastní historie */
  var VER_MAX = 10;
  function verData(c) {
    var d = Store.clone(Object.assign({}, c, { photos: undefined, versions: undefined }));
    delete d.photos; delete d.versions; return d;
  }
  function pushVersion(c, kind, data) {
    var v = c.versions = c.versions || [], last = v[v.length - 1];
    if (last && JSON.stringify(last.data) === JSON.stringify(data)) return;
    var u = Store.currentUser();
    v.push({ at: Date.now(), by: u ? u.id : null, kind: kind, data: data });
    var extra = v.filter(function (x) { return x.kind !== 'original'; }).length - VER_MAX;
    for (var i = 0; i < v.length && extra > 0;) { if (v[i].kind !== 'original') { v.splice(i, 1); extra--; } else i++; }
  }
  function persist(c) {
    while (!Store.upsertCalc(c)) {
      var v = c.versions || [], i = v.findIndex(function (x) { return x.kind !== 'original'; });
      if (i < 0) { A.toast(v.length ? 'Úložiště je plné – verzi nelze uložit' : 'Úložiště je plné'); return false; }
      v.splice(i, 1);
    }
    return true;
  }
  function touch(c) {
    if (full() && W.verPending && W.verFor === c.id) { pushVersion(c, 'edit', W.verBase); W.verPending = false; }
    c.updatedAt = Date.now(); persist(c);
    var el = A.$('#savedInd'); if (el) el.textContent = (c.number ? 'Změny uloženy ' : 'Koncept uložen ') + A.fmtTime(c.updatedAt);
  }
  function stepErrors(c, s) {
    if (s === 2) { var e = {}; c.groups.forEach(function (g, i) { var ge = Calc.validateGroup(g); if (Object.keys(ge).length) e[i] = ge; }); return e; }
    if (s === 3) return c.patternId ? {} : { pattern: 'Vyberte jeden vzor' };
    if (s === 4) return c.job.name.trim() ? {} : { name: 'Zadejte název zakázky' };
    return {};
  }
  function allValid(c) { return [2, 3, 4].every(function (s) { return !Object.keys(stepErrors(c, s)).length; }); }
  function ensureSaved(c) {
    if (!c.number) {
      c.number = Store.nextNumber(Date.now());
      c.snapshot = Store.snapshotFor(c.patternId);
    }
    touch(c);
  }
  function priceKey(p) {
    return JSON.stringify([p.patterns.map(function (x) { return [x.id, x.name, x.priceOverride, x.materialPerM2, x.wastePct, x.laborPerTread, x.collectionId]; }),
      p.rates, p.collections || null]);
  }
  // snapshot drží jen vzory jedné kolekce, proto se porovnává se stejným výřezem aktuálního ceníku
  function priceChanged(c) { return !!c.snapshot && priceKey(c.snapshot) !== priceKey(Store.snapshotFor(c.patternId)); }
  function priceNotice(c) {
    if (!full() || !priceChanged(c)) return '';
    return '<div class="alert warn"><b>Ceník se od uložení kalkulace změnil.</b> Kalkulace stále počítá s cenami z ' + A.fmtDate(c.createdAt) + ' (číslo ' + esc(c.number) + ').' +
      '<div><button class="btn sm" data-click="recalc">Přepočítat podle aktuálního ceníku</button></div></div>' +
      A.question('editPrices');
  }
  A.on('click', 'recalc', function () {
    var c = W.c; if (!c || ro(c) || !full()) return;
    A.confirmDlg('Přepočítat kalkulaci?', 'Kalkulace se přepočítá podle aktuálního ceníku. Původní ceny se přepíšou.', 'Přepočítat', function () {
      c.snapshot = Store.snapshotFor(c.patternId); touch(c); A.toast('Přepočítáno podle aktuálního ceníku'); A.dispatch();
    });
  });
  function statusBadge(s) { return '<span class="badge st-' + s + '">' + A.statusLabel(s) + '</span>'; }

  /* ---------- nová kalkulace ---------- */
  A.route('/new', 'user', function (p, user) {
    W.pending = Store.newCalc(user);
    W.pending.job.name = 'Kalkulace ' + A.fmtDate(Date.now());
    location.replace(A.isAdmin(user) ? '#/calc/' + W.pending.id : '#/wizard/' + W.pending.id + '/1');
  });

  /* ---------- průvodce ---------- */
  var LABELS = ['Fotografie', 'Schody', 'Vzor', 'Zakázka', 'Kalkulace'];
  A.route('/wizard/:id/:step', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (ro(c) || full()) return A.go('/calc/' + c.id); // admin upravuje na jedné stránce
    var s = parseInt(p.step, 10); if (!(s >= 1 && s <= 5)) s = 1;
    // nelze přeskočit nevalidní kroky (např. ruční změna URL)
    for (var i = 1; i < s; i++) if (Object.keys(stepErrors(c, i)).length) { W.showErrors = true; return A.go('/wizard/' + c.id + '/' + i); }
    W.c = c; W.step = s; W.inWizard = true;
    if (W.foldFor !== c.id) { W.folded = {}; W.foldFor = c.id; }
    var saved = Store.calcById(c.id) ? (c.number ? 'Změny uloženy ' : 'Koncept uložen ') + A.fmtTime(c.updatedAt) : 'Zatím neuloženo';
    var head = '<div class="wiz-head"><div class="t"><span>Krok ' + s + ' z 5 · <b>' + LABELS[s - 1] + '</b></span></div>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="5" aria-valuenow="' + s + '" aria-label="Postup"><i style="width:' + (s * 20) + '%"></i></div></div>';
    var body = s === 1 ? stepPhotos(c) : s === 2 ? stepStairs(c) : s === 3 ? stepPattern(c) : s === 4 ? stepJob(c) : calcBody(c, true);
    A.render(head + (s > 2 ? stairsSummary(c) : '') + (s < 5 ? priceNotice(c) : '') + body, { title: c.number ? 'Úprava kalkulace' : 'Nová kalkulace', back: '#/history', saved: saved, bar: actionBar(c, s) });
    barUpdate();
    if (s === 5 || (s === 1 && c.patternId)) Viz.mount(c, ro(c));
    if (W.showErrors) { W.showErrors = false; showStepErrors(c, s); }
  });
  /* kroky 3–5: stručný souhrn zadaných schodů, klepnutím zpět na krok 2 */
  function stairsWord(n) { return n === 1 ? 'schod' : n >= 2 && n <= 4 ? 'schody' : 'schodů'; }
  function stairsSummary(c) {
    var q = A.quoteOf(c);
    var parts = c.groups.map(function (g) { return esc(g.count) + '× ' + esc(g.width) + ' × ' + esc(Calc.depthLabel(g)) + ' cm ' + Calc.stepKind(g).label.toLowerCase(); });
    return '<a class="stairs-sum" href="#/wizard/' + c.id + '/2" aria-label="Upravit schody"><span class="grow"><b>' + q.treads + ' ' + stairsWord(q.treads) + ' · ' + m2(q.totalArea) + '</b>' +
      '<small>' + parts.join(' · ') + '</small></span><span class="small edit">Upravit' + ic('chev-r', 'sm') + '</span></a>';
  }
  function goStep(n) {
    var c = W.c;
    if (n > W.step) {
      for (var s = 1; s < n; s++) {
        if (Object.keys(stepErrors(c, s)).length) {
          if (s === W.step) { showStepErrors(c, s); var f = A.$('.invalid'); if (f) f.focus(); A.toast('Opravte označená pole'); }
          else { W.showErrors = true; A.go('/wizard/' + c.id + '/' + s); }
          return;
        }
      }
    }
    A.go('/wizard/' + c.id + '/' + n);
  }
  A.on('click', 'next', function () { goStep(W.step + 1); });
  A.on('click', 'back', function () { if (W.step === 1) A.go('/history'); else A.go('/wizard/' + W.c.id + '/' + (W.step - 1)); });

  /* spodní akční lišta: cena + Zpět / Dál / Uložit */
  function priceRow() { return '<div class="price"><span class="pi" id="barInfo"></span><span class="nowrap">Celkem s DPH <strong id="barPrice">—</strong></span></div>'; }
  function backBtn(href) {
    return href ? '<a class="btn sq" href="' + href + '" aria-label="Zpět">' + ic('back', 'lg') + '</a>' : '<button class="btn sq" data-click="back" aria-label="Zpět">' + ic('back', 'lg') + '</button>';
  }
  function actionBar(c, s) {
    var inner = priceRow() + '<div class="btns">' + backBtn() +
      (s === 5 ? (full() ? '<button class="btn sq" data-click="moreSheet" aria-label="Další akce">' + ic('more', 'lg') + '</button><button class="btn primary" data-click="saveCalc">Uložit</button>'
        : '<button class="btn" data-click="saveCalc">Uložit</button><button class="btn primary" data-click="handover">Odeslat ke zpracování</button>')
        : '<button class="btn primary" data-click="next">Dál</button>') + '</div>';
    return '<div class="actionbar stickybar"><div class="inner">' + inner + '</div></div>';
  }
  function barUpdate() {
    var c = W.c, info = A.$('#barInfo'), pr = A.$('#barPrice'); if (!info) return;
    var q = A.quoteOf(c), pat = c.patternId ? Calc.findPattern(A.pricingOf(c), c.patternId) : null;
    info.textContent = m2(q.totalArea) + (pat ? ' · ' + pat.name : ' · vzor zatím nevybrán');
    pr.textContent = pat ? fmt(q.total) : '—';
  }

  function showStepErrors(c, s) {
    var e = stepErrors(c, s);
    if (s === 4) A.setErr(A.$('[name=name]'), e.name || '');
    if (s === 2) {
      c.groups.forEach(function (g, i) {
        ['width', 'depth', 'riserHeight', 'count'].forEach(function (f) {
          var el = A.$('[data-g="' + i + '"][data-f="' + f + '"]'); if (el) A.setErr(el, (e[i] || {})[f] || '');
        });
        if (e[i]) { var card = A.$('[data-gcard="' + i + '"]'); if (card) { card.classList.remove('collapsed'); delete W.folded[i]; } }
      });
    }
    if (s === 3) { var pe =A.$('#patErr'); if (pe) pe.textContent = e.pattern || ''; }
  }

  /* krok 1: fotografie */
  function photoGrid(c, edit) {
    var ph = c.photos || [];
    if (!ph.length) return '<p class="muted small">Zatím žádné fotky</p>';
    return '<p class="small muted">' + ph.length + ' ' + (ph.length === 1 ? 'fotka' : ph.length < 5 ? 'fotky' : 'fotek') + '</p><div class="photo-grid">' + ph.map(function (d, i) {
      return '<div class="ph"><button type="button" class="zoom" data-click="photoZoom" data-i="' + i + '" aria-label="Zvětšit fotku ' + (i + 1) + '"><img src="' + d + '" alt="Fotka ' + (i + 1) + '"></button>' +
        (edit ? '<button type="button" class="del" data-click="photoDel" data-i="' + i + '" aria-label="Smazat fotku ' + (i + 1) + '">' + ic('trash') + '</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function stepPhotos(c, bare) {
    return (bare ? '' : '<h1 class="wiz-title">Fotografie</h1><p class="lead-text">Vyfoťte schodiště nebo nahrajte fotky z galerie. Počet není omezený, krok lze přeskočit.</p>') +
      '<div class="btn-grid"><label class="btn primary">' + ic('camera') + 'Vyfotit<input type="file" class="sr" accept="image/*" capture="environment" data-change="photoAdd" aria-label="Vyfotit schodiště"></label>' +
      '<label class="btn">' + ic('plus') + 'Nahrát fotky<input type="file" class="sr" accept="image/*" multiple data-change="photoAdd" aria-label="Nahrát fotky"></label></div>' +
      '<div id="photoGrid">' + photoGrid(c, true) + '</div>' +
      // vizualizace potřebuje vybraný vzor – v průvodci se ukáže u fotek, jakmile vzor existuje (rozpracovaná kalkulace)
      (!bare && c.patternId ? '<div id="vizCard"></div>' : '');
  }
  function refreshPhotos() { var g = A.$('#photoGrid'); if (g) g.innerHTML = photoGrid(W.c, true); }
  A.on('change', 'photoAdd', function (el) {
    var c = W.c; if (!c || ro(c)) return;
    c.photos = c.photos || [];
    Array.prototype.forEach.call(el.files || [], function (f) {
      A.readImage(f, 1280, function (d) {
        c.photos.push(d);
        if (Store.upsertCalc(c) === false) { c.photos.pop(); A.toast('Úložiště je plné – fotku nelze uložit'); }
        else touch(c);
        refreshPhotos();
      });
    });
    el.value = '';
  });
  A.on('click', 'photoDel', function (el) {
    var c = W.c; if (!c || ro(c)) return;
    (c.photos || []).splice(+el.dataset.i, 1); touch(c); refreshPhotos();
  });
  A.on('click', 'photoZoom', function (el) {
    var ph = (W.c || {}).photos || [];
    A.lightbox(ph.map(function (d, i) { return { src: d, caption: 'Fotka ' + (i + 1) }; }), +el.dataset.i);
  });

  /* krok 4: zakázka */
  function stepJob(c, bare) {
    var j = c.job;
    return (bare ? '' : '<h1 class="wiz-title">Zakázka</h1><p class="lead-text">Údaje pro kalkulaci a PDF. Název je předvyplněný, stačí přepsat.</p>') + '<div class="card">' +
      '<div class="field"><label for="jn">Název zakázky *</label><input type="text" id="jn" name="name" value="' + esc(j.name) + '" data-input="job" data-f="name" data-blur="jobBlur" placeholder="např. Rodinný dům Novákovi" autocomplete="off"><div class="err"></div></div>' +
      '<div class="field"><label for="jc">Zákazník <span class="opt">(volitelné)</span></label><input type="text" id="jc" value="' + esc(j.customer) + '" data-input="job" data-f="customer" autocomplete="off"></div>' +
      '<div class="field"><label for="ja">Adresa <span class="opt">(volitelné)</span></label><input type="text" id="ja" value="' + esc(j.address) + '" data-input="job" data-f="address" autocomplete="off"></div>' +
      '<div class="field" style="margin:0"><label for="jt">Poznámka <span class="opt">(volitelné)</span></label><textarea id="jt" data-input="job" data-f="note">' + esc(j.note) + '</textarea></div></div>' +
      A.question('custContact');
  }
  A.on('input', 'job', function (el) {
    W.c.job[el.dataset.f] = el.value; touch(W.c);
    if (el.dataset.f === 'name' && el.value.trim()) A.setErr(el, '');
  });
  A.on('blur', 'jobBlur', function (el) { A.setErr(el, el.value.trim() ? '' : 'Zadejte název zakázky'); });

  /* krok 1: schody */
  function sideLabel(g, c) { return SHORT_SIDES[g.side || (c || W.c || {}).stairSide || 'walls']; }
  function gSummary(g) { return esc(g.width) + ' × ' + esc(Calc.depthLabel(g)) + ' cm · ' + esc(g.count) + ' ks · ' + Calc.treadType(g).label.toLowerCase() + ' · ' + Calc.stepKind(g).label.toLowerCase() + ' · ' + sideLabel(g); }
  var DIM_HINT = 'Změřte nejdelší rozměr nášlapu (délka) a kolmo k ní hloubku v nejhlubším místě. U točitého schodu je délka úhlopříčka. Výška podstupnice je od nášlapu k nášlapu.';
  // starý šikmý schod (hloubka vlevo/vpravo) se při otevření v průvodci převede na největší hloubku
  function normalizeGroup(g, c) {
    if (!g.side) g.side = c.stairSide || 'walls';
    g.treadType = Calc.treadType(g).id; if (!g.stepKind || g.stepKind === 'corner') g.stepKind = Calc.stepKind(g).id;
    if (!Calc.isSkewed(g)) return;
    g.depth = Math.max(Calc.n0(g.depth), Calc.n0(g.depthRight)); delete g.depthRight; delete g.depthSame;
  }
  var NOSE_TYPES = Calc.TREAD_TYPES;
  function opts(list, cur) { return list.map(function (t) { return '<option value="' + t.id + '"' + (t.id === cur ? ' selected' : '') + '>' + t.label + '</option>'; }).join(''); }
  function planHtml(c) { return Plan.html(c.groups, Calc.stairType(c).id, c.turnSide); }
  var SHOW_DRAWINGS = false; // kreslené náhledy dočasně skryté
  function planCard(c) { if (!SHOW_DRAWINGS) return ''; return '<div class="card plan" id="planBox">' + planHtml(c) + '</div>'; }
  function updatePlan() { var b = A.$('#planBox'); if (b) b.innerHTML = planHtml(W.c); }
  // kreslený náhled schodiště potažený vybraným vzorem
  function viewHtml(c) {
    var pat = c.patternId ? Calc.findPattern(A.pricingOf(c), c.patternId) : null, v = Plan.view3d(c.groups, Calc.stairType(c).id, c.turnSide, pat ? A.patternImg(pat) : null);
    return v ? v + '<p class="small muted plan-note">' + (pat ? 'Kreslený náhled · ' + esc(pat.name) : 'Kreslený náhled · vyberte vzor a schody se jím potáhnou') + '</p>' : '';
  }
  function viewCard(c) { if (!SHOW_DRAWINGS) return ''; var v = viewHtml(c); return v ? '<div class="card plan view3d" id="viewBox">' + v + '</div>' : ''; }
  function updateView() { var b = A.$('#viewBox'); if (b) b.innerHTML = viewHtml(W.c); }
  function groupCard(g, i, n) {
    function fld(f, label, unit, mode, cls) {
      return '<div class="field' + (cls || '') + '"><label for="g' + i + f + '">' + label + '</label><div class="inline-unit"><input type="text" id="g' + i + f + '" inputmode="' + mode + '" autocomplete="off" value="' + esc(g[f]) + '" data-g="' + i + '" data-f="' + f + '" data-input="gfield" data-blur="gblur"><span>' + unit + '</span></div><div class="err"></div></div>';
    }
    // počet schodů je v hlavičce skupiny vedle názvu, ať formulář není roztahaný
    var cnt = '<div class="field gcount"><div class="stepper-num" title="Počet schodů"><button type="button" data-click="cntStep" data-g="' + i + '" data-d="-1" aria-label="Ubrat schod">' + ic('minus') + '</button>' +
      '<input type="text" id="g' + i + 'count" aria-label="Počet schodů" inputmode="numeric" autocomplete="off" value="' + esc(g.count) + '" data-g="' + i + '" data-f="count" data-input="gfield" data-blur="gblur"><button type="button" data-click="cntStep" data-g="' + i + '" data-d="1" aria-label="Přidat schod">' + ic('plus') + '</button></div><div class="err"></div></div>';
    normalizeGroup(g, W.c);
    var collapsed = !!W.folded[i];
    return '<div class="card group-card' + (collapsed ? ' collapsed' : '') + '" data-gcard="' + i + '"><div class="gh">' +
      '<button type="button" class="fold" data-click="gFold" data-g="' + i + '" aria-expanded="' + (!collapsed) + '">' + ic('chev-d', 'sm') + '<span><h2>Skupina ' + (i + 1) + '</h2><span class="sum" id="gsum' + i + '">' + gSummary(g) + '</span></span></button>' + cnt +
      (n > 1 ? '<button class="btn sm sq danger" data-click="gDel" data-g="' + i + '" aria-label="Odstranit skupinu ' + (i + 1) + '">' + ic('trash') + '</button>' : '') + '</div>' +
      '<div class="gbody"><div class="hint dim-hint">' + DIM_HINT + '</div><div class="group-grid">' + fld('width', 'Největší délka', 'cm', 'decimal') + fld('depth', 'Hloubka', 'cm', 'decimal') + fld('riserHeight', 'Výška podstupnice', 'cm', 'decimal') +
      '</div>' +
      // podstupnice se obkládá vždy, volba se proto nenabízí
      '<div class="field"><span class="lbl">Typ schodu</span><div class="seg full" role="group" aria-label="Typ schodu ' + (i + 1) + '">' +
      Calc.STEP_KINDS.map(function (k) { return '<button type="button" data-click="stepKind" data-g="' + i + '" data-k="' + k.id + '" class="' + (Calc.stepKind(g).id === k.id ? 'on' : '') + '">' + k.label + '</button>'; }).join('') + '</div>' + (i === 0 ? A.question('stepKindPrice') : '') + '</div>' +
      '<div class="field"><span class="lbl">Strana</span><div class="seg full wrap" role="group" aria-label="Strana skupiny ' + (i + 1) + '">' + SIDES.map(function (x) {
        return '<button type="button" data-click="gside" data-g="' + i + '" data-s="' + x[0] + '" class="' + (g.side === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div>' + (i === 0 ? '<div class="hint">Strana u zdi dostane lištu, otevřená strana vinylovou hranu.</div>' + A.question('trimRoute') : '') + '</div>' +
      '<div class="group-area"><span class="muted small">Plocha skupiny</span><span class="chip soft" id="areaWrap' + i + '"><span id="area' + i + '">' + m2(Calc.groupArea(g)) + '</span></span></div><div class="small muted calc-note" id="gnote' + i + '">' + groupNote(W.c, i) + '</div></div></div>';
  }
  // varování ze spoje lamel; rozměry nářezu se v průvodci neukazují
  function groupNote(c, i) {
    var pr = A.pricingOf(c); if (Calc.isLegacy(pr) || !c.groups[i]) return '';
    var q = c.patternId ? A.quoteOf(c) : null, inf = q && q.groupsInfo[i];
    return inf && inf.needsJoint ? JOINT : '';
  }
  function updateNotes() { W.c.groups.forEach(function (g, i) { var el = A.$('#gnote' + i); if (el) el.innerHTML = groupNote(W.c, i); }); }
  A.on('click', 'gside', function (el) {
    var i = +el.dataset.g, g = W.c.groups[i]; g.side = el.dataset.s; touch(W.c);
    el.parentNode.querySelectorAll('[data-click=gside]').forEach(function (b) { b.classList.toggle('on', b === el); });
    A.$('#gsum' + i).innerHTML = gSummary(g); refreshAll();
  });
  function stepStairs(c, bare) {
    return (bare ? '' : '<h1 class="wiz-title">Schody</h1><p class="lead-text">Začněte rozměry schodů – cenu uvidíte hned dole. Schody stejných rozměrů zadejte jako jednu skupinu, odspodu nahoru.</p>') +
      '<div class="field"><label for="trType">Typ nášlapu</label><select id="trType" data-change="treadNose">' + opts(NOSE_TYPES, Calc.hasNose(c.groups[0] || {}) ? 'nose' : 'flat') + '</select><div class="hint">Platí pro celé schodiště.</div></div>' +
      c.groups.map(function (g, i) { return groupCard(g, i, c.groups.length); }).join('') +
      '<button class="btn block mb" data-click="gAdd">' + ic('plus') + 'Přidat skupinu</button>' +
      (SHOW_DRAWINGS ? '<div class="section-title">Půdorys schodiště</div>' + planCard(c) + A.question('spiral') : '');
  }
  function onGroupInput(el) {
    var c = W.c, i = +el.dataset.g, g = c.groups[i];
    g[el.dataset.f] = el.value; touch(c);
    A.$('#area' + i).textContent = m2(Calc.groupArea(g));
    A.$('#gsum' + i).innerHTML = gSummary(g);
    if (!Calc.validateGroup(g)[el.dataset.f]) A.setErr(el, '');
    refreshAll();
  }
  // typ nášlapu se volí pro celé schodiště (s nosem / bez nosu)
  function setTread(g, nose) { g.treadType = nose ? 'nose' : 'flat'; }
  A.on('change', 'treadNose', function (el) {
    W.c.groups.forEach(function (g, i) { setTread(g, el.value === 'nose'); A.$('#gsum' + i).innerHTML = gSummary(g); });
    touch(W.c); refreshAll();
  });
  A.on('click', 'stepKind', function (el) {
    var i = +el.dataset.g, g = W.c.groups[i]; g.stepKind = el.dataset.k; touch(W.c);
    el.parentNode.querySelectorAll('[data-click=stepKind]').forEach(function (b) { b.classList.toggle('on', b === el); });
    A.$('#gsum' + i).innerHTML = gSummary(g); refreshAll();
  });
  A.on('input', 'gfield', onGroupInput);
  A.on('click', 'cntStep', function (el) {
    var i = +el.dataset.g, inp = A.$('[data-g="' + i + '"][data-f="count"]'), cur = Calc.num(inp.value);
    var v = Math.min(100, Math.max(1, (isNaN(cur) ? 0 : Math.floor(cur)) + parseInt(el.dataset.d, 10)));
    inp.value = v; onGroupInput(inp); A.setErr(inp, '');
  });
  A.on('click', 'gFold', function (el) {
    var i = +el.dataset.g, card = el.closest('.group-card'), c = card.classList.toggle('collapsed');
    W.folded[i] = c; el.setAttribute('aria-expanded', c ? 'false' : 'true');
  });
  A.on('blur', 'gblur', function (el) {
    var g = W.c.groups[+el.dataset.g]; A.setErr(el, Calc.validateGroup(g)[el.dataset.f] || '');
  });
  A.on('click', 'gAdd', function () {
    W.c.groups.forEach(function (g, i) { W.folded[i] = true; }); // dřívější skupiny se sbalí, nová je otevřená
    var g = Store.newGroup(), last = W.c.groups[W.c.groups.length - 1]; setTread(g, Calc.hasNose(W.c.groups[0] || g)); if (last) g.side = last.side || W.c.stairSide || 'walls';
    W.c.groups.push(g); touch(W.c); A.dispatch();
  });
  A.on('click', 'gDel', function (el) {
    if (W.c.groups.length < 2) return;
    W.c.groups.splice(+el.dataset.g, 1); W.folded = {}; touch(W.c); A.toast('Skupina odstraněna'); A.dispatch();
  });

  /* krok 2: vzor – stovky dekorů, proto filtr podle typu, kolekce, ceny a názvu */
  var TYPY = [['', 'Vše'], ['vinyl', 'Vinyl'], ['drevo', 'Dřevo'], ['laminat', 'Laminát']];
  var CENY = [['', 'Jakákoli cena za m²', 0, Infinity], ['a', 'do 500 Kč/m²', 0.01, 500], ['b', '500–900 Kč/m²', 500, 900], ['c', '900–1 500 Kč/m²', 900, 1500], ['d', 'nad 1 500 Kč/m²', 1500, Infinity], ['x', 'cena nezadána', 0, 0]];
  function patFilter(c) {
    if (W.pfFor !== c.id) {
      var sel = c.patternId ? Calc.findPattern(A.pricingOf(c), c.patternId) : null;
      W.pf = { typ: sel ? sel.typ : 'vinyl', kol: sel ? sel.kolekce : '', cena: '', q: '' }; W.pfFor = c.id;
    }
    return W.pf;
  }
  function priceOf(c, p) { return Calc.patternPrice(A.pricingOf(c), p, c.formatId); }
  function patPrice(p, c) { var v = priceOf(c, p); return v ? fmt(v) + ' / m²' + (p.priceEst ? ' orientačně' : '') : 'cena za m² nezadána'; }
  function patMatch(p, f, c) {
    var band = CENY.filter(function (x) { return x[0] === f.cena; })[0], v = priceOf(c, p);
    if (f.typ && p.typ !== f.typ) return false;
    if (f.kol && p.kolekce !== f.kol) return false;
    if (f.cena === 'x' ? v > 0 : f.cena && !(v >= band[2] && v < band[3])) return false;
    return !f.q || (p.name + ' ' + p.kolekce).toLowerCase().indexOf(f.q.toLowerCase()) >= 0;
  }
  function patTiles(c) {
    var pr = A.pricingOf(c), f = patFilter(c);
    // nabízí se jen aktivní dekory; už vybraný dekor zůstane vidět i po vypnutí
    var list = pr.patterns.filter(function (p) { return (p.id === c.patternId || Calc.patternOffered(pr, p)) && patMatch(p, f, c); });
    var valid = !Object.keys(stepErrors(c, 2)).length;
    var cmp = valid ? Calc.comparePatterns(c.groups, { patterns: list, rates: pr.rates, collections: pr.collections }, c.discount, c.vatRate, c.extras, A.quoteOpt(c)) : null;
    var priced = cmp ? cmp.filter(function (x) { return priceOf(c, x.pattern) > 0; }).map(function (x) { return x.quote.total; }) : [];
    var min = priced.length > 1 && Math.max.apply(null, priced) > Math.min.apply(null, priced) ? Math.min.apply(null, priced) : null; // při stejných cenách bez štítku
    if (!list.length) return '<p class="muted small">Žádný vzor neodpovídá filtru.</p>';
    return '<p class="small muted pat-count">' + list.length + ' z ' + pr.patterns.filter(function (p) { return Calc.patternOffered(pr, p); }).length + ' vzorů</p><div class="tiles" role="radiogroup" aria-label="Vzor">' +
      list.map(function (p, i) {
        var sel = c.patternId === p.id, q = cmp && priceOf(c, p) > 0 ? cmp[i].quote : null;
        return '<label class="tile' + (sel ? ' selected' : '') + '"><input type="radio" name="pattern" value="' + p.id + '" data-change="pickPattern"' + (sel ? ' checked' : '') + '>' +
          '<div style="position:relative"><img loading="lazy" src="' + A.patternImg(p) + '" alt="' + esc(p.name) + '">' + (q && q.total === min ? '<span class="ov">Nejlevnější</span>' : '') + '<span class="tick">' + ic('check') + '</span></div>' +
          '<div class="t"><b>' + esc(p.name) + '</b>' + (full() ? '<span class="small muted">' + patPrice(p, c) + '</span>' : '') +
          (q ? '<div class="tot"><b>' + fmt(q.total) + '</b> <span class="muted">s DPH</span></div>' + (q.needsJoint ? JOINT : '') : '') + '</div></label>';
      }).join('') + '</div>';
  }
  function patFilters(c) {
    var pr = A.pricingOf(c), f = patFilter(c), kols = [];
    pr.patterns.forEach(function (p) { if ((!f.typ || p.typ === f.typ) && (p.id === c.patternId || Calc.patternOffered(pr, p)) && kols.indexOf(p.kolekce) < 0) kols.push(p.kolekce); });
    if (f.kol && kols.indexOf(f.kol) < 0) f.kol = '';
    return '<div class="pat-filter"><div class="seg full" role="group" aria-label="Typ podlahy">' + TYPY.map(function (t) {
      return '<button type="button" data-click="patTyp" data-t="' + t[0] + '" class="' + (f.typ === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
    }).join('') + '</div>' +
      '<select aria-label="Kolekce" data-change="patSel" data-k="kol"><option value="">Všechny kolekce (' + kols.length + ')</option>' + kols.map(function (k) { return '<option' + (k === f.kol ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
      '<div class="group-grid">' + (full() ? '<select aria-label="Cena za m²" data-change="patSel" data-k="cena">' + CENY.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === f.cena ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' : '') +
      '<input type="search" aria-label="Hledat vzor" placeholder="Hledat název nebo kód" value="' + esc(f.q) + '" data-input="patQ" autocomplete="off"></div></div>';
  }
  function stepPattern(c) {
    return '<h1 class="wiz-title">Vzor obkladu</h1><p class="lead-text">Cena u vzoru je orientační celek s DPH pro vaše schody.' + (c.snapshot ? ' Uložená kalkulace nabízí vzory své kolekce; jiné se nabídnou po přepočtu podle aktuálního ceníku.' : '') + '</p>' +
      viewCard(c) + vinylSwitch(c) + '<div id="patFilters">' + patFilters(c) + '</div><div id="fmtBox">' + formatSwitch(c) + '</div><div id="patTiles">' + patTiles(c) + '</div><div class="err" id="patErr" role="alert"></div>' + A.question('photos');
  }
  // schody s vinylem, nebo bez vinylu (jen MDF) – jen v ceně z materiálu
  function vinylSwitch(c) {
    if (!(A.pricingOf(c).rates.costPrice || {}).on) return '';
    return '<div class="seg full" role="group" aria-label="Vinyl" style="margin-bottom:12px">' + [[false, 'S vinylem'], [true, 'Bez vinylu (jen MDF)']].map(function (o) {
      return '<button type="button" data-click="noVinyl" data-v="' + (o[0] ? 1 : 0) + '" aria-pressed="' + (!!c.noVinyl === o[0]) + '" class="' + (!!c.noVinyl === o[0] ? 'on' : '') + '"' + (ro(c) ? ' disabled' : '') + '>' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  A.on('click', 'noVinyl', function (el) { if (ro()) return; W.c.noVinyl = el.dataset.v === '1'; touch(W.c); A.dispatch(); });
  // dlaždice Design Stone mají víc formátů téže kolekce; volba platí pro celou kalkulaci
  function formatSwitch(c) {
    var pr = A.pricingOf(c), pat = c.patternId ? Calc.findPattern(pr, c.patternId) : null, coll = pat && Calc.collectionOf(pr, pat, null);
    if (!coll || !coll.family) return '';
    var cur = c.formatId || coll.format, sibs = (pr.collections || []).filter(function (x) { return x.family === coll.family; });
    return '<div class="field fmt-switch"><span class="lbl">Formát dlaždice</span><div class="seg full" role="group" aria-label="Formát dlaždice">' + sibs.map(function (x) {
      return '<button type="button" data-click="fmt" data-f="' + x.format + '" class="' + (x.format === cur ? 'on' : '') + '">' + x.format + ' ' + nf.format(x.lamellaLengthMm) + '×' + nf.format(x.lamellaWidthMm) + '</button>';
    }).join('') + '</div></div>';
  }
  A.on('click', 'fmt', function (el) { W.c.formatId = el.dataset.f; touch(W.c); A.$('#fmtBox').innerHTML = formatSwitch(W.c); patRefresh(false); refreshAll(); });
  function patRefresh(all) { if (all) A.$('#patFilters').innerHTML = patFilters(W.c); A.$('#patTiles').innerHTML = patTiles(W.c); }
  A.on('click', 'patTyp', function (el) { W.pf.typ = el.dataset.t; W.pf.kol = ''; patRefresh(true); });
  A.on('change', 'patSel', function (el) { W.pf[el.dataset.k] = el.value; patRefresh(false); });
  A.on('input', 'patQ', function (el) { W.pf.q = el.value; patRefresh(false); });
  A.on('change', 'pickPattern', function (el) {
    W.c.patternId = +el.value;
    var pr = A.pricingOf(W.c), coll = Calc.collectionOf(pr, Calc.findPattern(pr, W.c.patternId), null);
    if (coll && coll.family) W.c.formatId = W.c.formatId || coll.format; else delete W.c.formatId;
    touch(W.c); A.$('#fmtBox').innerHTML = formatSwitch(W.c);
    document.querySelectorAll('.tile').forEach(function (t) { t.classList.toggle('selected', t.contains(el)); });
    A.$('#patErr').textContent = ''; refreshAll();
  });

  /* ---------- obrazovka kalkulace (krok 4 i detail) ---------- */
  function pct(v) { return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(v * 100) + ' %'; }
  var nf = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }), nf1 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 });
  function fmtUnit(x) { return Math.abs(x - Math.round(x)) < 0.005 ? fmt(x) : nf.format(x) + ' Kč'; }
  var JOINT = '<span class="joint">Schod vyžaduje spoj lamel</span>';
  var SHORT_SIDES = { walls: 'u zdi', openLeft: 'vlevo otevřená', openRight: 'vpravo otevřená', openBoth: 'obě otevřené' };
  var SIDES = [['walls', 'Obě strany u zdi'], ['openLeft', 'Vlevo otevřená'], ['openRight', 'Vpravo otevřená'], ['openBoth', 'Obě otevřené']];
  // rozměry dílců jednoho schodu včetně přídavku (jen nový model výpočtu)
  function cutPieces(g, inf) {
    var ct = inf && inf.cut; if (!ct) return [];
    var f = function (x) { return nf1.format(x); }, out = [];
    out.push('nášlap ' + f(ct.w) + ' × ' + f(ct.d) + ' cm' + (ct.add ? ' (+' + ct.add + ' mm)' : ''));
    if (Math.abs(ct.dMdf - ct.d) > 1e-9) out.push('nášlap MDF ' + f(ct.w) + ' × ' + f(ct.dMdf) + ' cm' + (ct.addMdf ? ' (+' + ct.addMdf + ' mm)' : ''));
    if (ct.r > 0) out.push('podstupnice ' + f(ct.w) + ' × ' + f(ct.r) + ' cm');
    if (ct.r > 0 && ct.rMdfOne) out.push('podstupnice MDF 2 × ' + f(ct.w) + ' × ' + f(ct.rMdfOne) + ' cm' + (ct.addRiserMdf ? ' (+' + ct.addRiserMdf + ' mm)' : ''));
    else if (ct.r > 0 && Math.abs(ct.rMdf - ct.r) > 1e-9) out.push('podstupnice MDF ' + f(ct.w) + ' × ' + f(ct.rMdf) + ' cm');
    return out;
  }
  // každý schod zvlášť (průběžné číslování přes skupiny): naměřené rozměry, rozměry k nářezu a plocha jednoho schodu
  function stairRows(c, q) {
    var k = 0, html = '';
    c.groups.forEach(function (g, i) {
      var inf = q.groupsInfo[i], n = Math.max(0, Math.floor(Calc.n0(g.count))), one = n ? q.areas[i] / n : 0;
      var cut = cutPieces(g, inf).join(' · '), joint = inf && inf.needsJoint ? JOINT : '';
      for (var j = 0; j < n; j++) {
        k++;
        html += lr(k + '. schod – ' + esc(g.width) + ' × ' + esc(Calc.depthLabel(g)) + ' cm' + (g.coverRiser ? ', podstupnice ' + esc(g.riserHeight) + ' cm' : ', bez podstupnice'),
          Calc.treadType(g).label.toLowerCase() + ' · ' + Calc.stepKind(g).label.toLowerCase() + (cut ? ' · ' + cut : '') + joint, m2(one));
      }
    });
    return html;
  }
  function lr(k, sub, v, cls) { return '<div class="lrow ' + (cls || '') + '"><span class="k">' + k + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="v">' + v + '</span></div>'; }
  // seznam po schodech s celkovými plochami (admin stránka)
  function stairsList(c) {
    var q = A.quoteOf(c), f = full();
    return '<div class="list">' + (canPrice(c) ? stairRows(c, q) : '') + lr('Celková plocha (naměřená)', '', m2(q.totalArea), 'tot') +
      (q.legacy || !canPrice(c) ? '' : lr('Plocha k nářezu', '', m2(q.prodArea)) + lr('Plocha MDF', '', m2(q.mdfArea))) + '</div>';
  }
  function calcBody(c, inWizard) {
    W.inWizard = !!inWizard;
    var pr = A.pricingOf(c), pat = Calc.findPattern(pr, c.patternId), owner = Store.userById(c.ownerId).profile, q = A.quoteOf(c), dis = ro(c) ? ' disabled' : '', f = full(), me = Store.currentUser();
    var html = '';
    if (!inWizard) html += priceNotice(c);
    if (!c.number) html += '<div class="alert info">Kalkulace zatím není uložena. Číslo bude přiděleno při uložení a ceník se „zamkne“.</div>';
    html += heroCard(c);
    if (!f) html += missingAlert(q);
    html += actionGrid(c, inWizard);
    if (f) html += statusCard(c);
    // rozpis ceny
    if (f) html += '<div class="section-title">Rozpis ceny</div><div id="sums">' + sums(c) + '</div>';
    // schody
    html += '<div class="section-title">Schody</div><div class="list">' + (inWizard || !f ? c.groups.map(function (g, i) {
      var inf = q.groupsInfo[i];
      return '<div class="lrow"><span class="k">' + esc(g.width) + ' × ' + esc(Calc.depthLabel(g)) + ' cm<small>' + esc(g.count) + ' ks · ' + Calc.treadType(g).label.toLowerCase() + ' · ' + Calc.stepKind(g).label.toLowerCase() + ' · ' + sideLabel(g, c) + ' · ' + (g.coverRiser ? 'podstupnice ' + esc(g.riserHeight) + ' cm' : 'bez podstupnice') +
        (f && inf ? ' · výrobní plocha ' + m2(inf.prod) : '') + '</small>' + (f && inf && inf.needsJoint ? JOINT : '') + '</span><span class="v">' + m2(q.areas[i]) + '</span></div>';
    }).join('') : stairRows(c, q)) + lr('Celková plocha (naměřená)', '', m2(q.totalArea), 'tot') + (q.legacy || !f ? '' : lr('Plocha k nářezu', '', m2(q.prodArea)) + lr('Plocha MDF', '', m2(q.mdfArea))) +
      '</div>' + viewCard(c) + planCard(c);
    html += '<div id="vizCard"></div>';
    if ((c.photos || []).length) html += '<div class="section-title">Fotografie</div>' + photoGrid(c, false);
    if (f) html += cutCard(c, q) + trimCard(c, q);
    if (f) html += discountCard(c, pr);
    // zakázka
    html += '<div class="section-title">Zakázka</div><div class="list">' + lr('Zakázka', '', '<span style="font-weight:600;white-space:normal">' + esc(c.job.name) + '</span>') +
      lr('Zákazník', '', esc(c.job.customer || '—')) + (c.job.address ? lr('Adresa', '', '<span style="white-space:normal">' + esc(c.job.address) + '</span>') : '') +
      (c.job.note ? lr('Poznámka', '', '<span style="white-space:normal;font-weight:400">' + esc(c.job.note) + '</span>') : '') +
      '<div class="firm">' + (owner.logo ? '<img src="' + owner.logo + '" alt="Logo">' : '') + '<div><b>' + esc(owner.company || owner.name || 'Vaše firma') + '</b><div class="small muted">' + [owner.name, owner.ico ? 'IČO ' + owner.ico : '', owner.phone].filter(Boolean).map(esc).join(' · ') + '</div></div></div></div>';
    if (f) html += A.question('labor') + A.question('laborHours');
    if (f && c.number && !inWizard) html += A.question('editPrices');
    return html;
  }
  // cenu lze spočítat jen s vybraným vzorem a platnými rozměry schodů
  function canPrice(c) { return !!c.patternId && !Object.keys(stepErrors(c, 2)).length; }
  function heroCard(c) {
    var pr = A.pricingOf(c), owner = Store.userById(c.ownerId).profile, f = full(), me = Store.currentUser(), pat = c.patternId ? Calc.findPattern(pr, c.patternId) : null, line = '';
    if (pat && canPrice(c)) {
      line = '<a class="pat" href="#/compare/' + c.id + '" aria-label="Porovnat vzory"><img src="' + A.patternImg(pat) + '" alt=""><span class="grow"><b>' + esc(pat.name) + '</b><span class="small">' + m2(A.quoteOf(c).totalArea) + (f ? ' · ' + patPrice(pat, c) : '') + '</span></span><span class="small cmp-link">' + '<span class="lbl-t">Porovnat</span>' + ic('chev-r', 'sm') + '</span></a>';
    }
    return '<div class="card hero calc-head"><div class="row between"><span class="eyebrow">Celkem s DPH</span>' + statusBadge(c.status) + '</div>' +
      '<div id="heroPrice">' + heroPrice(c) + '</div>' + line +
      '<div class="meta"><span>' + (c.number ? 'č. <b style="color:var(--text)">' + esc(c.number) + '</b>' : 'číslo bude přiděleno při uložení') + '</span><span>' + A.fmtDate(c.createdAt) + '</span>' + (f && c.ownerId !== me.id ? '<span>Podlahář: <b style="color:var(--text)">' + esc(owner.name || owner.company || Store.userById(c.ownerId).email) + '</b></span>' : '') + '</div></div>';
  }
  function statusCard(c) {
    if (!c.number) return '';
    return '<div class="section-title">Stav kalkulace</div><div class="card"><div class="seg full" role="group" aria-label="Stav">' +
      ['přijato', 'zamítnuto'].map(function (s) { return '<button type="button" data-click="setStatus" data-s="' + s + '" class="' + (c.status === s ? 'on' : '') + '">' + A.statusLabel(s) + '</button>'; }).join('') + '</div>' +
      (c.status === 'přijato' || c.status === 'zamítnuto' ? '<button class="btn sm ghost mt-2" data-click="setStatus" data-s="' + (c.sentTo ? 'odesláno' : 'koncept') + '">Zrušit označení</button>' : '') + '</div>';
  }
  function discountCard(c, pr) {
    var dis = ro(c) ? ' disabled' : '';
    return '<div class="section-title">Sleva a DPH</div><div class="card"><div class="lbl">Sleva</div><div class="disc-grid"><div class="seg" role="group" aria-label="Typ slevy"><button type="button"' + dis + ' data-click="discType" data-type="pct" class="' + (c.discount.type === 'pct' ? 'on' : '') + '">%</button><button type="button"' + dis + ' data-click="discType" data-type="czk" class="' + (c.discount.type === 'czk' ? 'on' : '') + '">Kč</button></div>' +
      '<input type="text" inputmode="decimal" id="discVal"' + dis + ' aria-label="Výše slevy" value="' + esc(c.discount.value || '') + '" placeholder="0" data-input="discount"></div><div class="err" id="discErr"></div>' +
      '<div class="lbl mt">Sazba DPH</div><div class="seg full" role="group" aria-label="Sazba DPH">' + (pr.rates.vatOptions || [0.21, 0.12]).map(function (v) {
        return '<button type="button"' + dis + ' data-click="vat" data-v="' + v + '" class="' + (c.vatRate === v ? 'on' : '') + '">' + pct(v) + '</button>';
      }).join('') + '</div>' + A.question('vat') + '</div>';
  }
  function heroPrice(c) {
    if (!canPrice(c)) return '<div class="big">—</div><div class="sub">' + (c.patternId ? 'Doplňte rozměry schodů' : 'Vyberte vzor') + '</div>';
    var q = A.quoteOf(c), r = A.pricingOf(c).rates;
    if (!full()) return '<div class="big">' + fmt(q.total) + '</div>';
    return '<div class="big">' + fmt(q.total) + '</div><div class="sub">bez DPH ' + fmt(q.base) + ' · DPH ' + pct(c.vatRate) + ' ' + fmt(q.vat) + (r.roundTo > 1 ? ' · zaokrouhleno na ' + r.roundTo + ' Kč' : '') + '</div>';
  }
  function refreshCalc() {
    var c = W.c, s = A.$('#sums'), h = A.$('#heroPrice'); if (s) s.innerHTML = sums(c); if (h) h.innerHTML = heroPrice(c); barUpdate();
    // placeholdery ručních délek lišty a hrany ukazují automatickou hodnotu
    var q = A.quoteOf(c);
    ['trimBm', 'edgeBm'].forEach(function (k) { var el = A.$('#bm_' + k); if (el && !q.legacy) el.placeholder = nf.format(q[k === 'trimBm' ? 'autoTrimBm' : 'autoEdgeBm']); });
  }
  // jednotné živé přepočty po změně rozměrů, vzoru či stran (na stránce jen to, co tam je)
  function refreshAll() {
    barUpdate(); updatePlan(); updateNotes(); updateView();
    var c = W.c, r = A.$('#stairRows'); if (r) r.innerHTML = stairsList(c);
    var pv = A.$('#patPreview'); if (pv) pv.innerHTML = patPreview(c);
    if (A.$('#sums') || A.$('#heroPrice')) refreshCalc();
  }
  function extrasCard(c, pr) {
    var r = pr.rates, on = r.extrasEnabled, anyVal = on && Object.keys(c.extras || {}).some(function (k) { return Calc.n0(c.extras[k]) > 0; });
    return '<details class="list fold-card"' + (anyVal ? ' open' : '') + '><summary><span>Volitelné příplatky <span class="badge st-pozván">návrh</span></span>' + ic('chev-d') + '</summary>' +
      (on ? '' : '<div class="pad small muted">Sekce je zatím vypnutá a do výpočtu nezasahuje. Zapnout ji může správce v Sazbách (po odsouhlasení se zákazníkem).</div>') +
      (r.extras || []).map(function (e) {
        return '<div class="extra-row"><span class="nm">' + esc(e.label) + '<small>' + fmt(e.price) + ' / ' + esc(e.unit) + '</small></span>' +
          (on ? '<span class="inline-unit"><input type="text" inputmode="decimal" aria-label="' + esc(e.label) + '"' + (ro(c) ? ' disabled' : '') + ' value="' + esc((c.extras || {})[e.key] || '') + '" data-input="extra" data-k="' + e.key + '" placeholder="0"><span>' + esc(e.unit) + '</span></span>' : '<span></span>') + '</div>';
      }).join('') + '</details>';
  }
  A.on('input', 'extra', function (el) { if (!full() || ro()) return;
    var c = W.c; c.extras = c.extras || {}; c.extras[el.dataset.k] = el.value; touch(c); refreshCalc();
  });
  function qtyText(l) {
    var t = nf.format(l.qty) + ' ' + l.unit;
    if (l.unit === 'paušál') return 'paušál';
    return l.unitPrice && l.unit !== 'ks' ? t + ' × ' + fmtUnit(l.unitPrice) : t;
  }
  function missingAlert(q) {
    if (!full()) return q.missing && q.missing.length ? '<div class="alert warn">Cena zatím není kompletní, doplní ji správce.</div>' : '';
    return q.missing && q.missing.length ? '<div class="alert warn"><b>Cena není kompletní:</b> chybí ' + q.missing.map(esc).join(', ') + '. Doplní správce v Sazbách.' + A.question('hourlyRate') + '</div>' : '';
  }
  function sums(c) {
    if (!canPrice(c)) return '';
    var pr = A.pricingOf(c), q = A.quoteOf(c), r = pr.rates;
    var hasCut = !q.legacy && q.groupsInfo.some(function (i) { return i.cut && i.cut.add; });
    var h = missingAlert(q) + '<div class="list">' + q.lines.map(function (l) {
      var sub = l.sub + (l.key === 'material' && hasCut ? ', vč. rezervy na ořez' : '');
      return lr(esc(l.label), qtyText(l) + (sub ? ' · ' + esc(sub) : ''), fmt(l.amount) + (l.key === 'material' && q.vinylInfo ? '<small class="sub">po slevě ' + Calc.n0(q.vinylInfo.pct) + ' %: ' + fmt(q.vinylInfo.amount) + '</small>' : ''));
    }).join('');
    if (q.stairMode && full()) { var sp = q.stair.split;
      h += lr('<span class="muted">Z toho vinyl (MOC)</span>', '', '<span class="muted">' + fmt(sp.vinyl) + '</span>') + lr('<span class="muted">Naše výroba</span>', q.treads + ' schodů', '<span class="muted">' + fmt(sp.production) + '</span>') +
        lr('<span class="muted">Podlahář</span>', Calc.n0(r.stairPrice.floorerPct) + ' %', '<span class="muted">' + fmt(sp.floorer) + '</span>') + lr('<span class="muted">Odběratel</span>', 'zbytek', '<span class="muted">' + fmt(sp.buyer) + '</span>'); }
    if (q.costMode && full()) { var cs = q.cost.split, cf = q.cost.cfg;
      h += (q.noVinyl ? '' : lr('<span class="muted">Z toho vinyl (MOC)</span>', '', '<span class="muted">' + fmt(cs.vinyl) + '</span>')) + lr('<span class="muted">MDF a lepidlo</span>', '', '<span class="muted">' + fmt(cs.mdf + cs.glue) + '</span>') +
        lr('<span class="muted">Prořez materiálu</span>', Calc.n0(cf.wastePct) + ' %', '<span class="muted">' + fmt(cs.waste) + '</span>') +
        lr('<span class="muted">Práce</span>', (q.cost.stairs + q.cost.landings) + ' × ' + nf.format(Calc.n0(cf.hoursPerStair)) + ' h × ' + fmt(cf.hourly), '<span class="muted">' + fmt(cs.labor) + '</span>') +
        lr('<span class="muted">Marže</span>', Calc.n0(cf.marginPct) + ' %', '<span class="muted">' + fmt(cs.margin) + '</span>'); }
    if (q.discountAmount > 0) h += lr('Mezisoučet', '', fmt(q.subtotal)) + lr('Sleva', c.discount.type === 'pct' ? Calc.n0(c.discount.value) + ' %' : '', '− ' + fmt(q.discountAmount), 'minus');
    h += lr('Cena bez DPH', '', fmt(q.base), 'tot') + lr('DPH ' + pct(c.vatRate), '', fmt(q.vat)) + lr('Celkem s DPH', r.roundTo > 1 ? 'zaokrouhleno na ' + r.roundTo + ' Kč' : '', fmt(q.total), 'tot') + '</div>';
    return h;
  }
  // ruční přepis délky lišty a hrany (prázdné = automaticky podle stran schodiště)
  /* nářezový plán z optimalizace (jen admin): stejné lamely se sloučí, pruh ukáže řezy v měřítku */
  function cutRows(cp) {
    var groups = {};
    cp.plan.forEach(function (l) {
      var key = l.cuts.map(function (x) { return Math.round(x.len) + '|' + x.desc; }).join(';');
      (groups[key] = groups[key] || { n: 0, l: l }).n++;
    });
    var rows = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.n - a.n; }).map(function (gr) {
      var bar = gr.l.cuts.map(function (x) {
        return '<span class="cut' + (/doplňky/.test(x.desc) ? ' rest' : '') + '" style="width:' + (x.len / cp.L * 100) + '%" title="' + esc(Math.round(x.len) + ' mm – ' + x.desc) + '">' + Math.round(x.len / 10) + '</span>';
      }).join('') + (gr.l.free > 1 ? '<span class="cut waste" style="width:' + (gr.l.free / cp.L * 100) + '%" title="odřezek ' + Math.round(gr.l.free) + ' mm">' + (gr.l.free >= 100 ? Math.round(gr.l.free / 10) : '') + '</span>' : '');
      return '<div class="cut-row"><b>' + gr.n + '×</b><div class="cut-bar">' + bar + '</div></div>';
    }).join('');
    return rows + '<p class="small muted mt-2"><span class="cut-key"></span> plný pruh <span class="cut-key rest"></span> doplňky vedle sebe <span class="cut-key waste"></span> odřezek</p>';
  }
  function cutSummary(cp) {
    return cp.lamellas + ' lamel ' + Math.round(cp.L) + ' × ' + Math.round(cp.Wl) + ' mm · využití ' + Math.round(cp.usePct) + ' % · ' + cp.fullStrips + ' plných pruhů, ' +
      cp.restPieces + ' doplňků ve ' + cp.restStrips + ' společných pruzích · řez ' + cp.kerf + ' mm' + (cp.join ? ' · doplňky smí být nastavené' : '');
  }
  function cutCard(c, q) {
    var cp = q && q.cutPlan; if (!cp) return '';
    var rows = cutRows(cp);
    return '<div class="section-title">Nářezový plán</div><div class="card"><p class="small muted">' + cutSummary(cp) + '</p><details class="cut-plan"><summary>Zobrazit řezy po lamelách (čísla v cm)</summary>' + rows + '</details></div>';
  }
  function trimCard(c, q) {
    if (q.legacy) return '';
    var d = ro(c) ? ' disabled' : '';
    function f(k, label, auto, val) {
      return '<div class="field"><label for="bm_' + k + '">' + label + '</label><div class="inline-unit"><input type="text" id="bm_' + k + '" inputmode="decimal"' + d + ' value="' + esc(val === undefined || val === null ? '' : val) + '" placeholder="' + nf.format(auto) + '" data-input="bm" data-k="' + k + '"><span>bm</span></div></div>';
    }
    return '<div class="section-title">Lišty a hrany</div><div class="card"><p class="small muted">Lišta jde na stranu u zdi, vinylová hrana na otevřenou stranu. Délka každé strany = (hloubka nášlapu + výška podstupnice) × počet schodů, z naměřených rozměrů. Prázdné pole = automaticky, vyplněním hodnotu přepíšete.</p>' +
      '<div class="group-grid">' + f('trimBm', 'Lišta KPV50', q.autoTrimBm, c.trimBm) + f('edgeBm', 'Vinylová hrana', q.autoEdgeBm, c.edgeBm) + '</div>' + A.question('discountTrims') + '</div>';
  }
  A.on('input', 'bm', function (el) { if (!full() || ro()) return;
    var c = W.c; if (el.value.trim() === '') delete c[el.dataset.k]; else c[el.dataset.k] = el.value;
    touch(c); refreshCalc();
  });
  A.on('click', 'vat', function (el) {
    if (!full() || ro()) return; W.c.vatRate = parseFloat(el.dataset.v); touch(W.c);
    document.querySelectorAll('[data-click=vat]').forEach(function (b) { b.classList.toggle('on', b === el); });
    refreshCalc();
  });
  A.on('click', 'discType', function (el) { if (!full() || ro()) return;
    W.c.discount.type = el.dataset.type; touch(W.c);
    document.querySelectorAll('[data-click=discType]').forEach(function (b) { b.classList.toggle('on', b === el); });
    applyDiscount();
  });
  A.on('input', 'discount', function (el) { if (!full() || ro()) return; W.c.discount.value = el.value; touch(W.c); applyDiscount(); });
  function applyDiscount() {
    var c = W.c, d = c.discount, raw = A.$('#discVal').value, v = Calc.num(raw), msg = '';
    if (raw.trim() !== '') {
      var sub = canPrice(c) ? Calc.computeQuote(c.groups, c.patternId, A.pricingOf(c), { type: 'czk', value: 0 }, c.vatRate, c.extras, A.quoteOpt(c)).subtotal : Infinity;
      if (isNaN(v) || v < 0) msg = 'Zadejte číslo 0 nebo větší';
      else if (d.type === 'pct' && v > 100) msg = 'Sleva v % musí být 0–100';
      else if (d.type === 'czk' && v > sub) msg = 'Sleva nesmí být vyšší než cena (' + fmt(sub) + ')';
    }
    A.$('#discErr').textContent = msg; A.$('#discVal').classList.toggle('invalid', !!msg);
    // při chybě se sleva neuplatní
    var real = c.discount; if (msg) c.discount = { type: d.type, value: 0 };
    refreshCalc();
    c.discount = real;
  }

  /* akce pod heroem (2×2) a v sheetu „⋯“ */
  var STATUS_INFO = { 'předáno': 'Předáno ke zpracování – úpravy a nabídku pro zákazníka připraví správce.', 'odesláno': 'Nabídka byla odeslána zákazníkovi.', 'přijato': 'Zákazník nabídku přijal.', 'zamítnuto': 'Zákazník nabídku zamítl.' };
  function actionGrid(c, inWizard) {
    var dup = '<button class="btn" data-click="dup">' + ic('copy') + 'Duplikovat</button>', edit = '<a class="btn" href="#/wizard/' + c.id + '/1">' + ic('edit') + 'Upravit</a>';
    if (!full()) {
      if (inWizard) return '';
      if (!ro(c)) return '<div class="btn-grid mb no-print"><button class="btn primary" style="grid-column:1/-1" data-click="handover">Odeslat ke zpracování</button>' + edit + dup + '</div>';
      return '<div class="alert info no-print">' + STATUS_INFO[c.status] + '</div><div class="btn-grid mb no-print">' + dup + '</div>';
    }
    var h = '<div class="btn-grid mb no-print"><button class="btn" data-click="pdf">' + ic('pdf') + 'PDF</button><button class="btn" data-click="mail">' + ic('mail') + 'Odeslat</button>' +
      '<button class="btn" data-click="vyroba">' + ic('print') + 'Do výroby</button>';
    if (!inWizard) h += dup;
    return h + '</div>';
  }
  A.on('click', 'moreSheet', function () {
    var c = W.c; if (!full()) return;
    function row(icon, label, attrs, link) {
      var inner = '<span class="lead">' + ic(icon) + '<span class="k">' + label + '</span></span>';
      return link ? '<a class="lrow" href="' + link + '">' + inner + '</a>' : '<button type="button" class="lrow" ' + attrs + '>' + inner + '</button>';
    }
    var rows = row('pdf', 'Stáhnout PDF', 'data-click="pdf"') + row('print', 'Objednávka do výroby (PDF)', 'data-click="vyroba"') + row('mail', 'Odeslat e-mailem', 'data-click="mail"');
    rows += row('copy', 'Duplikovat', 'data-click="dup"') + row('compare', 'Porovnat vzory', '', '#/compare/' + c.id);
    if (c.versions && c.versions.length) rows += row('history', 'Historie verzí', 'data-click="versions"');
    if (priceChanged(c)) rows += row('refresh', 'Přepočítat podle aktuálního ceníku', 'data-click="recalc"');
    if (c.number) rows += row('status', 'Označit jako přijato', 'data-click="setStatus" data-s="přijato"') + row('x', 'Označit jako zamítnuto', 'data-click="setStatus" data-s="zamítnuto"');
    A.modal('<h2>Akce</h2>' + A.sheetList(rows));
  });
  var VER_LABEL = { original: 'Původní od podlaháře', edit: 'Před úpravami', restore: 'Před obnovením' };
  A.on('click', 'versions', function () {
    var c = W.c; if (!full() || !c) return;
    var rows = (c.versions || []).map(function (v, i) { return { v: v, i: i }; }).reverse().map(function (x) {
      var u = Store.userById(x.v.by), who = u ? ((u.profile && u.profile.name) || u.email) : '';
      return '<div class="lrow"><span class="lead"><span><span class="k">' + VER_LABEL[x.v.kind] + '</span><br><small class="muted">' + A.fmtDate(x.v.at) + ' ' + A.fmtTime(x.v.at) + (who ? ' · ' + esc(who) : '') +
        (x.v.data.patternId ? ' · ' + fmt(A.quoteOf(x.v.data).total) : '') + '</small></span></span>' +
        '<button type="button" class="btn" data-click="verRestore" data-i="' + x.i + '">Obnovit</button></div>';
    }).join('');
    A.modal('<h2>Historie verzí</h2>' + A.sheetList(rows) + '<p class="small muted">Fotky se do verzí neukládají a při obnovení zůstanou.</p>');
  });
  A.on('click', 'verRestore', function (el) {
    var c = W.c, v = c && (c.versions || [])[+el.dataset.i]; if (!v || !full()) return;
    A.confirmDlg('Obnovit verzi?', 'Aktuální stav se uloží do historie, fotky zůstanou.', 'Obnovit', function () {
      pushVersion(c, 'restore', verData(c));
      var keep = { id: c.id, number: c.number, ownerId: c.ownerId, createdAt: c.createdAt, status: c.status, sentTo: c.sentTo, photos: c.photos, versions: c.versions };
      Object.keys(c).forEach(function (k) { delete c[k]; });
      Object.assign(c, Store.clone(v.data), keep);
      W.verPending = false; touch(c); A.toast('Verze obnovena'); A.dispatch();
    });
  });
  // podlahář předá kalkulaci správci; potom ji už neupravuje
  A.on('click', 'handover', function () {
    var c = W.c; if (!c || full() || ro(c)) return;
    if (!allValid(c)) return A.toast('Nejprve dokončete kalkulaci');
    ensureSaved(c);
    A.confirmDlg('Odeslat ke zpracování?', 'Poté už kalkulaci nebudete moci upravit.', 'Odeslat', function () {
      c.status = 'předáno'; pushVersion(c, 'original', verData(c)); touch(c); A.toast('Kalkulace předána ke zpracování'); A.go('/calc/' + c.id);
    });
  });
  A.on('click', 'saveCalc', function () { if (ro()) return;
    var c = W.c, bad = [2, 3, 4].filter(function (s) { return Object.keys(stepErrors(c, s)).length; });
    if (bad.length && full()) { // admin vidí všechna pole na jedné stránce, chyby se ukážou přímo na ní
      bad.forEach(function (s) { showStepErrors(c, s); });
      if (bad.indexOf(3) >= 0) { var pk = A.$('#patPick'); if (pk) pk.open = true; }
      var first = A.$('.invalid') || A.$('#patErr'); if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (first.focus && first.tagName !== 'DIV') first.focus({ preventScroll: true }); }
      return A.toast('Opravte označená pole');
    }
    if (bad.length) { W.showErrors = true; return A.go('/wizard/' + c.id + '/' + bad[0]); }
    var wasNew = !c.number; ensureSaved(c);
    A.toast(wasNew ? 'Uloženo jako kalkulace č. ' + c.number : 'Změny uloženy');
    if (full()) A.dispatch(); else A.go('/calc/' + c.id);
  });
  A.on('click', 'setStatus', function (el) { if (!full() || ro()) return; W.c.status = el.dataset.s; touch(W.c); A.toast('Stav: ' + W.c.status); A.dispatch(); });
  A.on('click', 'pdf', function () { var c = W.c; if (!full()) return A.toast('Jen pro správce'); if (!allValid(c)) return A.toast('Nejprve dokončete kalkulaci'); ensureSaved(c); A.go('/calc/' + c.id + '/pdf'); });
  A.on('click', 'dup', function () {
    var c = W.c, n = Store.clone(c), now = Date.now();
    n.id = Store.uid('c'); n.ownerId = Store.currentUser().id; n.number = null; n.snapshot = null; n.status = 'koncept'; n.sentTo = null; n.versions = []; n.createdAt = now; n.updatedAt = now;
    n.job.name = n.job.name + ' (kopie)'; n.vatRate = Store.db.rates.vatDefault;
    Store.upsertCalc(n); A.toast('Vytvořena kopie jako koncept – s aktuálním ceníkem'); A.go(full() ? '/calc/' + n.id : '/wizard/' + n.id + '/1');
  });


  /* ---------- admin: úprava kalkulace na jedné stránce ---------- */
  function patPreview(c) {
    var pat = c.patternId ? Calc.findPattern(A.pricingOf(c), c.patternId) : null;
    if (!pat) return '<p class="muted small">Vzor zatím není vybrán.</p>';
    return '<a class="stairs-sum" href="#/compare/' + c.id + '" aria-label="Porovnat vzory"><img src="' + A.patternImg(pat) + '" alt="" style="width:72px;height:54px;object-fit:cover;border-radius:var(--r-sm);flex:none"><span class="grow"><b>' + esc(pat.name) + '</b><small>' + patPrice(pat, c) + '</small></span><span class="small edit">Porovnat' + ic('chev-r', 'sm') + '</span></a>';
  }
  // odchod ze stránky úprav ukončí „otevření“: další vstup založí novou verzi z úprav
  window.addEventListener('hashchange', function () { if (!/^#\/calc\/[^\/]+$/.test(location.hash)) W.verFor = null; });
  function adminPage(c) {
    W.c = c; W.step = 5; W.inWizard = false;
    if (W.foldFor !== c.id) { W.folded = {}; W.foldFor = c.id; }
    if (W.verFor !== c.id) { W.verFor = c.id; W.verBase = verData(c); W.verPending = true; }
    var pr = A.pricingOf(c);
    var top = heroCard(c) + actionGrid(c, false) + priceNotice(c) + (c.number ? '' : '<div class="alert info">Kalkulace zatím není uložena. Číslo bude přiděleno při uložení a ceník se „zamkne“.</div>');
    var main = '<div class="section-title">Schody</div>' + stepStairs(c, true) + '<div id="stairRows">' + stairsList(c) + '</div>' +
      '<div class="section-title">Vzor</div>' + vinylSwitch(c) + '<div id="patPreview">' + patPreview(c) + '</div>' +
      '<details class="fold-card list" id="patPick"' + (c.patternId ? '' : ' open') + '><summary><span>Změnit vzor</span>' + ic('chev-d') + '</summary><div class="pad">' +
      '<div id="patFilters">' + patFilters(c) + '</div><div id="fmtBox">' + formatSwitch(c) + '</div><div id="patTiles">' + patTiles(c) + '</div></div></details>' +
      '<div class="err" id="patErr" role="alert"></div>' + viewCard(c) +
      '<div class="section-title">Zakázka</div>' + stepJob(c, true) +
      '<div class="section-title">Fotografie</div>' + stepPhotos(c, true) + '<div id="vizCard"></div>' +
      cutCard(c, A.quoteOf(c)) + trimCard(c, A.quoteOf(c)) + discountCard(c, pr);
    var rest = '<div class="section-title">Rozpis ceny</div><div id="sums">' + sums(c) + '</div>' + statusCard(c) + A.question('labor') + A.question('laborHours') + (c.number ? A.question('editPrices') : '');
    var bar = '<div class="actionbar stickybar"><div class="inner">' + priceRow() + '<div class="btns">' + backBtn('#/history') + '<button class="btn sq" data-click="moreSheet" aria-label="Další akce">' + ic('more', 'lg') + '</button><button class="btn primary" data-click="saveCalc">Uložit</button></div></div></div>';
    var saved = Store.calcById(c.id) ? (c.number ? 'Změny uloženy ' : 'Koncept uložen ') + A.fmtTime(c.updatedAt) : 'Zatím neuloženo';
    A.render('<div class="adm-grid" id="adm"><div class="adm-main">' + main + '</div><div class="adm-side"><div class="adm-top">' + top + '</div><div class="adm-rest">' + rest + '</div></div></div>',
      { wide: true, title: 'Kalkulace ' + (c.number || '(koncept)'), back: '#/history', saved: saved, bar: bar });
    barUpdate();
    Viz.mount(c, false);
  }

  A.route('/calc/:id', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (full()) return adminPage(c);
    if (!c.number && !ro(c)) return A.go('/wizard/' + c.id + '/1');
    if (!allValid(c)) return A.go('/wizard/' + c.id + '/1');
    W.c = c; W.step = 5;
    var body = calcBody(c, false), bar;
    if (!full()) bar = '<div class="actionbar stickybar"><div class="inner">' + priceRow() + '<div class="btns">' + backBtn('#/history') + (ro(c) ? '' : '<button class="btn primary" data-click="handover">Odeslat ke zpracování</button>') + '</div></div></div>';
    else bar = '<div class="actionbar stickybar"><div class="inner">' + priceRow() + '<div class="btns">' + backBtn('#/history') + '<button class="btn sq" data-click="moreSheet" aria-label="Další akce">' + ic('more', 'lg') + '</button><button class="btn primary" data-click="saveCalc">Uložit změny</button></div></div></div>';
    A.render(body, { title: 'Kalkulace ' + (c.number || '(koncept)'), back: '#/history', bar: bar });
    barUpdate();
    Viz.mount(c, ro(c));
  });

  /* ---------- odeslání e-mailem ---------- */
  A.on('click', 'mail', function () { if (!full() || ro()) return;
    var c = W.c; if (!allValid(c)) return A.toast('Nejprve dokončete kalkulaci');
    ensureSaved(c);
    var owner = Store.userById(c.ownerId).profile, file = 'Kalkulace-' + c.number + '.pdf';
    A.modal('<h2>Odeslat kalkulaci e-mailem</h2><form data-submit="sendMail" novalidate>' +
      '<div class="field"><label for="mt">E-mail zákazníka</label><input type="email" id="mt" name="to" inputmode="email" autocapitalize="none" value="' + esc(c.sentTo || '') + '"><div class="err"></div></div>' +
      '<div class="field"><label for="ms">Předmět</label><input type="text" id="ms" name="subject" value="Kalkulace obkladu schodiště č. ' + esc(c.number) + '"></div>' +
      '<div class="field"><label for="mb">Text zprávy</label><textarea id="mb" name="body" rows="6">Dobrý den,\n\nv příloze zasíláme kalkulaci obkladu schodiště (' + esc(c.job.name) + ').\nV případě dotazů nás neváhejte kontaktovat.\n\nS pozdravem\n' + esc(owner.name || '') + '\n' + esc(owner.company || '') + (owner.phone ? '\n' + esc(owner.phone) : '') + '</textarea></div>' +
      '<p><span class="attach">' + ic('pdf', 'sm') + esc(file) + '</span></p><p class="small muted">Prototyp e-mail neodešle – jen změní stav kalkulace na „Odesláno“.</p>' +
      '<div class="dlg-foot"><button type="button" class="btn" data-click="closeModal">Zrušit</button><button type="submit" class="btn primary">' + ic('send') + 'Odeslat</button></div></form>');
  });
  A.on('submit', 'sendMail', function (form) { if (!full() || ro()) return;
    var inp = form.elements.to;
    if (!/^\S+@\S+\.\S+$/.test(inp.value.trim())) return A.setErr(inp, 'Zadejte platný e-mail zákazníka');
    var c = W.c; c.sentTo = inp.value.trim(); c.status = 'odesláno'; touch(c);
    A.closeModal(); A.toast('Kalkulace odeslána na ' + c.sentTo + ' (demo)'); A.dispatch();
  });

  /* ---------- PDF náhled ---------- */
  A.route('/calc/:id/pdf', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (!full()) { A.toast('Jen pro správce'); return A.go('/calc/' + c.id); }
    if (!c.number) return A.go('/wizard/' + c.id + '/1');
    W.c = c;
    var pr = A.pricingOf(c), pat = Calc.findPattern(pr, c.patternId), q = A.quoteOf(c), owner = Store.userById(c.ownerId).profile, r = pr.rates;
    function row(k, v, b) { return '<tr><td>' + k + '</td><td class="num">' + (b ? '<b>' + v + '</b>' : v) + '</td></tr>'; }
    var sheet = '<div class="pdf-wrap"><div class="pdf-sheet">' +
      '<div class="pdf-top"><div>' + (owner.logo ? '<img class="logo" src="' + owner.logo + '" alt="Logo"><br>' : '') + '<b>' + esc(owner.company || owner.name) + '</b><br>' +
      '<span class="small">' + [owner.name, owner.ico ? 'IČO ' + owner.ico : '', owner.phone].filter(Boolean).map(esc).join('<br>') + '</span></div>' +
      '<div class="right"><h1>Kalkulace č. ' + esc(c.number) + '</h1><div>Datum: ' + A.fmtDate(c.createdAt) + '</div></div></div><hr>' +
      '<dl class="pdf-meta"><dt>Zakázka</dt><dd>' + esc(c.job.name) + '</dd><dt>Zákazník</dt><dd>' + esc(c.job.customer || '—') + '</dd>' + (c.job.address ? '<dt>Adresa</dt><dd>' + esc(c.job.address) + '</dd>' : '') + '<dt>Typ schodů</dt><dd>' + esc(c.groups.map(function (g) { return Calc.stepKind(g).label.toLowerCase(); }).filter(function (k, i, a) { return a.indexOf(k) === i; }).join(', ')) + '</dd></dl>' +
      '<div class="pat-line"><img src="' + A.patternImg(pat) + '" alt=""><div><b>' + esc(pat.name) + '</b><br><span class="small">' + fmtUnit(Calc.patternPrice(pr, pat, c.formatId)) + ' / m², prořez ' + nf1.format(q.wastePct) + ' %</span></div></div>' +
      (q.missing && q.missing.length ? '<div class="alert warn">Cena není kompletní: chybí ' + q.missing.map(esc).join(', ') + '.</div>' : '') + (q.needsJoint ? '<p class="small">' + JOINT + ' Šířka schodu je větší než délka lamely.</p>' : '') +
      '<table class="tbl"><tbody>' + row('Celková plocha', m2(q.totalArea), true) + '</tbody></table>' +
      (SHOW_DRAWINGS ? '<div class="plan view3d">' + viewHtml(c) + '</div><div class="plan">' + planHtml(c) + '</div>' : '') + Viz.pdf(c) +
      '<table class="tbl"><thead><tr><th>Položka</th><th class="num">Množství</th><th class="num">Jedn. cena</th><th class="num">Částka</th></tr></thead><tbody>' +
      q.lines.map(function (l) {
        return '<tr><td>' + esc(l.label) + (l.sub ? '<br><span class="small muted">' + esc(l.sub) + '</span>' : '') + '</td><td class="num">' + nf.format(l.qty) + ' ' + esc(l.unit) + '</td><td class="num">' + (l.unitPrice ? fmtUnit(l.unitPrice) : '') + '</td><td class="num">' + fmt(l.amount) + '</td></tr>';
      }).join('') +
      (q.discountAmount ? '<tr><td colspan="3">Sleva</td><td class="num">− ' + fmt(q.discountAmount) + '</td></tr>' : '') +
      '<tr><td colspan="3"><b>Cena bez DPH</b></td><td class="num"><b>' + fmt(q.base) + '</b></td></tr><tr><td colspan="3">DPH ' + pct(c.vatRate) + '</td><td class="num">' + fmt(q.vat) + '</td></tr></tbody></table>' +
      '<div class="pdf-total"><span><b>Celkem s DPH</b></span><span class="v">' + fmt(q.total) + '</span></div>' +
      '<div class="pdf-foot">Vygenerováno v prototypu. V ostré verzi PDF vytváří server. Cena platí dle ceníku k ' + A.fmtDate(c.createdAt) + '.</div></div></div>';
    A.render(sheet, { title: 'Náhled PDF', back: '#/calc/' + c.id, bar: '<div class="actionbar stickybar no-print"><div class="inner"><div class="btns">' + backBtn('#/calc/' + c.id) + '<button class="btn primary" data-click="print">' + ic('print') + 'Tisk / Uložit jako PDF</button></div></div></div>' });
  });
  A.on('click', 'print', function () { window.print(); });

  /* ---------- objednávka do výroby: rozměry dílců, materiál, nářezový plán, fotky; bez cen ---------- */
  A.on('click', 'vyroba', function () { var c = W.c; if (!full()) return A.toast('Jen pro správce'); if (!allValid(c)) return A.toast('Nejprve dokončete kalkulaci'); ensureSaved(c); A.closeModal && A.closeModal(); A.go('/calc/' + c.id + '/vyroba'); });
  A.route('/calc/:id/vyroba', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (!full()) { A.toast('Jen pro správce'); return A.go('/calc/' + c.id); }
    if (!allValid(c)) return A.go('/wizard/' + c.id + '/1');
    W.c = c;
    var pr = A.pricingOf(c), pat = Calc.findPattern(pr, c.patternId), q = A.quoteOf(c), owner = Store.userById(c.ownerId).profile, r = pr.rates;
    var n0 = function (x) { var v = parseFloat(String(x == null ? '' : x).replace(',', '.')); return isNaN(v) ? 0 : v; };
    var coll = Calc.collectionOf(pr, pat, c.formatId), cp = q.cutPlan, mm = function (cm) { return Math.round(n0(cm) * 10); };
    var steps = c.groups.reduce(function (a, g) { return a + n0(g.count); }, 0), glue = q.lines.filter(function (l) { return l.key === 'glue'; })[0];
    var parts = c.groups.map(function (g, i) {
      var inf = q.groupsInfo[i] || {}, d = inf.cut || inf.dims || {}, n = n0(g.count);
      return '<tr><td class="num"><b>' + n + '×</b></td><td>' + esc(Calc.stepKind(g).label) + (Calc.isLanding && Calc.isLanding(g) ? ', podesta' : '') + '<br><span class="small muted">' +
        esc(Calc.treadType(g).label.toLowerCase()) + ' · ' + esc(sideLabel(g, c)) + '</span></td>' +
        '<td class="num">' + mm(n0(g.width)) + ' × ' + mm(n0(g.depth)) + (g.coverRiser ? '<br><span class="small muted">podst. ' + mm(n0(g.riserHeight)) + '</span>' : '') + '</td>' +
        '<td class="num"><b>' + mm(d.w) + ' × ' + mm(d.d || d.dVinyl) + '</b>' + (d.r ? '<br>' + mm(d.w) + ' × ' + mm(d.r) : '') + '</td>' +
        '<td class="num">' + mm(d.w) + ' × ' + mm(d.dMdf) + (d.rMdfOne ? '<br>2× ' + mm(d.w) + ' × ' + mm(d.rMdfOne) : d.rMdf ? '<br>' + mm(d.w) + ' × ' + mm(d.rMdf) : '') + '</td></tr>';
    }).join('');
    function mrow(k, v, sub) { return '<tr><td>' + k + (sub ? '<br><span class="small muted">' + sub + '</span>' : '') + '</td><td class="num"><b>' + v + '</b></td></tr>'; }
    var mat = mrow('Vinyl – ' + esc(pat.name), (q.lamellas ? q.lamellas + ' lamel · ' : '') + m2(q.lines[0] && q.lines[0].key === 'material' ? q.lines[0].qty : q.prodArea),
        coll && coll.lamellaLengthMm ? 'lamela ' + Math.round(coll.lamellaLengthMm) + ' × ' + Math.round(coll.lamellaWidthMm) + ' mm · plocha k nářezu ' + m2(q.prodArea) : 'plocha k nářezu ' + m2(q.prodArea)) +
      mrow('MDF ' + (r.mdf && r.mdf.thicknessMm ? r.mdf.thicknessMm + ' mm' : ''), m2(q.mdfArea), 'z rozměrů dílců vč. rezervy na ořez') +
      (glue ? mrow('Lepidlo', m2(glue.qty), glue.sub) : '') +
      (q.trim && q.trim.bm ? mrow('Lišta KPV50', nf.format(q.trim.bm) + ' bm', 'strana u zdi') : '') +
      (q.edge && q.edge.bm ? mrow('Vinylová hrana', nf.format(q.edge.bm) + ' bm', 'otevřená strana') : '');
    var photos = (c.photos || []).slice(0, 6);
    var sheet = '<div class="pdf-wrap"><div class="pdf-sheet prod-sheet">' +
      '<div class="pdf-top"><div><div class="prod-kicker">Objednávka do výroby</div><h1>Zakázka ' + esc(c.number || '(koncept)') + '</h1><div>Vystaveno: ' + A.fmtDate(Date.now()) + '</div></div>' +
      '<div class="right">' + (owner.logo ? '<img class="logo" src="' + owner.logo + '" alt="Logo"><br>' : '') + '<b>' + esc(owner.company || owner.name) + '</b><br><span class="small">' +
      [owner.name, owner.ico ? 'IČO ' + owner.ico : '', owner.phone].filter(Boolean).map(esc).join('<br>') + '</span></div></div><hr>' +
      (c.number ? '' : '<div class="alert warn">Kalkulace je zatím koncept – před výrobou ji uložte.</div>') +
      '<dl class="pdf-meta"><dt>Zakázka</dt><dd>' + esc(c.job.name) + '</dd><dt>Zákazník</dt><dd>' + esc(c.job.customer || '—') + '</dd>' +
      (c.job.address ? '<dt>Místo montáže</dt><dd>' + esc(c.job.address) + '</dd>' : '') +
      '<dt>Schodiště</dt><dd>' + esc(Calc.stairType(c).label) + ' · ' + steps + ' ' + (steps === 1 ? 'schod' : steps < 5 ? 'schody' : 'schodů') + '</dd>' +
      '<dt>Požadovaný termín</dt><dd class="fill">&nbsp;</dd></dl>' +
      '<div class="pat-line"><img src="' + A.patternImg(pat) + '" alt=""><div><b>' + esc(pat.name) + '</b><br><span class="small">' + esc(pat.kolekce || '') +
      (coll && coll.lamellaLengthMm ? ' · lamela ' + Math.round(coll.lamellaLengthMm) + ' × ' + Math.round(coll.lamellaWidthMm) + ' mm' : '') + '</span></div></div>' +
      '<h3>Dílce</h3><p class="small muted">Rozměry v mm. Nářez = naměřený rozměr + rezerva na ořez (vinyl ' + (r.cut && r.cut.vinyl ? r.cut.vinyl.flatMm + '/' + r.cut.vinyl.noseMm : '–') +
      ' mm bez/s nosem, MDF ' + (r.cut && r.cut.mdf ? r.cut.mdf.flatMm + '/' + r.cut.mdf.noseMm : '–') + ' mm). První řádek nášlap, druhý podstupnice.</p>' +
      '<table class="tbl"><thead><tr><th class="num">Ks</th><th>Schod</th><th class="num">Naměřeno<br>délka × hloubka</th><th class="num">Nářez vinyl</th><th class="num">Nářez MDF</th></tr></thead><tbody>' + parts + '</tbody></table>' +
      (q.needsJoint ? '<p class="small">' + JOINT + ' Šířka schodu je větší než délka lamely – pruhy se nastavují.</p>' : '') +
      '<h3>Materiál</h3><table class="tbl"><tbody>' + mat + '</tbody></table>' +
      (cp ? '<h3>Nářezový plán vinylu</h3><p class="small muted">' + cutSummary(cp) + '. Čísla v cm.</p><div class="prod-cut">' + cutRows(cp) + '</div>' : '') +
      (photos.length ? '<h3>Fotografie</h3><div class="prod-photos">' + photos.map(function (ph) { return '<img src="' + ph + '" alt="">'; }).join('') + '</div>' : '') +
      Viz.pdf(c) +
      '<h3>Poznámka</h3><div class="prod-note">' + (c.job.note ? esc(c.job.note) : '&nbsp;') + '</div>' +
      '<div class="prod-sign"><div>Objednal (podlahář)<span></span></div><div>Převzal (výroba)<span></span></div><div>Datum<span></span></div></div>' +
      '<div class="pdf-foot">Vygenerováno v prototypu. Výrobní list neobsahuje ceny. V ostré verzi PDF vytváří server.</div></div></div>';
    A.render(sheet, { title: 'Objednávka do výroby', back: '#/calc/' + c.id, bar: '<div class="actionbar stickybar no-print"><div class="inner"><div class="btns">' + backBtn('#/calc/' + c.id) +
      '<button class="btn primary" data-click="print">' + ic('print') + 'Tisk / Uložit jako PDF</button></div></div></div>' });
  });

  /* ---------- porovnání vzorů ---------- */
  A.route('/compare/:id', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (Object.keys(stepErrors(c, 2)).length) return A.go('/wizard/' + c.id + '/2');
    W.c = c;
    var pr = A.pricingOf(c);
    if (!c.patternId) return A.go('/wizard/' + c.id + '/3');
    // porovnávají se vzory ze stejné kolekce jako vybraný vzor
    pr = { patterns: Store.sameCollection(pr.patterns, c.patternId), rates: pr.rates, collections: pr.collections };
    var cmp = Calc.comparePatterns(c.groups, pr, c.discount, c.vatRate, c.extras, A.quoteOpt(c));
    var min = Math.min.apply(null, cmp.map(function (x) { return x.quote.total; }));
    var back = c.number || ro(c) || full() ? '#/calc/' + c.id : '#/wizard/' + c.id + '/3';
    function use(x) {
      if (c.patternId === x.pattern.id) return '<span class="badge st-přijato">' + ic('check', 'sm') + 'Vybraný vzor</span>';
      return ro(c) ? '' : '<button class="btn sm tonal" data-click="usePattern" data-p="' + x.pattern.id + '">Použít</button>';
    }
    var f = full();
    A.render('<h1 class="large-title">Porovnání vzorů</h1><p class="screen-sub">' + esc(c.job.name) + ' · ' + m2(cmp[0].quote.totalArea) + (f ? ' · DPH ' + pct(c.vatRate) + (c.discount.value ? ' · sleva ' + esc(c.discount.value) + (c.discount.type === 'pct' ? ' %' : ' Kč') : '') + (c.snapshot ? ' · ceny z ' + A.fmtDate(c.createdAt) : '') : '') + '</p>' +
      '<div class="list' + (f ? ' only-mobile' : '') + '">' + cmp.map(function (x) {
        var best = x.quote.total === min, diff = x.quote.total - min;
        return '<div class="cmp-row' + (best ? ' best' : '') + '"><img src="' + A.patternImg(x.pattern) + '" alt=""><div class="nm"><b>' + esc(x.pattern.name) + '</b>' + (f ? '<span class="small muted">' + fmtUnit(Calc.patternPrice(pr, x.pattern, c.formatId)) + '/m² · prořez ' + nf1.format(x.quote.wastePct) + '&nbsp;%</span>' + (x.quote.needsJoint ? JOINT : '') : '') + '</div>' +
          '<div class="pr"><b>' + fmt(x.quote.total) + '</b><small>' + (best ? '<span class="badge st-přijato">Nejlevnější</span>' : '+ ' + fmt(diff)) + '</small></div>' +
          '<div class="use">' + use(x) + '</div></div>';
      }).join('') + '</div>' +
      (f ? '<div class="card only-desktop" style="overflow:auto"><table class="tbl"><thead><tr><th>Vzor</th><th class="num">Materiál</th><th class="num">Práce</th><th class="num">Bez DPH</th><th class="num">S DPH</th><th class="num">Rozdíl</th><th></th></tr></thead><tbody>' +
      cmp.map(function (x) {
        var q = x.quote;
        return '<tr class="' + (q.total === min ? 'best' : '') + '"><td><img class="thumb" src="' + A.patternImg(x.pattern) + '" alt=""><b>' + esc(x.pattern.name) + '</b>' + (q.total === min ? ' <span class="badge st-přijato">Nejlevnější</span>' : '') + (q.needsJoint ? JOINT : '') + '</td><td class="num">' + fmt(q.material) + '</td><td class="num">' + fmt(q.labor) + '</td><td class="num">' + fmt(q.base) + '</td><td class="num"><b>' + fmt(q.total) + '</b></td><td class="num">' + (q.total === min ? '—' : '+ ' + fmt(q.total - min)) + '</td><td>' + use(x) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : ''), { wide: true, title: 'Porovnání vzorů', back: back, bare: false });
  });
  A.on('click', 'usePattern', function (el) { if (ro()) return;
    var c = W.c; c.patternId = +el.dataset.p; touch(c);
    A.toast('Vzor změněn'); A.go(c.number || full() ? '/calc/' + c.id : '/wizard/' + c.id + '/5');
  });
})();
