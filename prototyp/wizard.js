/* Průvodce (kroky 1–4), obrazovka kalkulace, PDF náhled, odeslání e-mailem, porovnání vzorů. */
(function () {
  var A = App, esc = A.esc, fmt = Calc.formatCZK, m2 = Calc.formatM2, ic = A.icon;
  var W = { pending: null, c: null, step: 1, showErrors: false, inWizard: false, folded: {}, foldFor: null };

  /* ---------- společné ---------- */
  function loadCalc(id, user) {
    var c = Store.calcById(id) || (W.pending && W.pending.id === id ? W.pending : null);
    if (!c || !Store.canSee(user, c)) { A.toast('Kalkulace nenalezena'); A.go('/history'); return null; }
    return c;
  }
  // podlahář smí upravovat jen své kalkulace, admin všechny
  function ro(c) { c = c || W.c; var u = Store.currentUser(); return !!c && !!u && u.role !== 'admin' && c.ownerId !== u.id; }
  function touch(c) {
    c.updatedAt = Date.now(); Store.upsertCalc(c);
    var el = A.$('#savedInd'); if (el) el.textContent = (c.number ? 'Změny uloženy ' : 'Koncept uložen ') + A.fmtTime(c.updatedAt);
  }
  function stepErrors(c, s) {
    if (s === 1) { var e = {}; c.groups.forEach(function (g, i) { var ge = Calc.validateGroup(g); if (Object.keys(ge).length) e[i] = ge; }); return e; }
    if (s === 2) return c.patternId ? {} : { pattern: 'Vyberte jeden vzor' };
    if (s === 3) return c.job.name.trim() ? {} : { name: 'Zadejte název zakázky' };
    return {};
  }
  function allValid(c) { return [1, 2, 3].every(function (s) { return !Object.keys(stepErrors(c, s)).length; }); }
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
    if (!priceChanged(c)) return '';
    return '<div class="alert warn"><b>Ceník se od uložení kalkulace změnil.</b> Kalkulace stále počítá s cenami z ' + A.fmtDate(c.createdAt) + ' (číslo ' + esc(c.number) + ').' +
      (ro(c) ? '' : '<div><button class="btn sm" data-click="recalc">Přepočítat podle aktuálního ceníku</button></div>') + '</div>' +
      A.question('editPrices');
  }
  A.on('click', 'recalc', function () {
    var c = W.c; if (!c || ro(c)) return;
    A.confirmDlg('Přepočítat kalkulaci?', 'Kalkulace se přepočítá podle aktuálního ceníku. Původní ceny se přepíšou.', 'Přepočítat', function () {
      c.snapshot = Store.snapshotFor(c.patternId); touch(c); A.toast('Přepočítáno podle aktuálního ceníku'); A.dispatch();
    });
  });
  function statusBadge(s) { return '<span class="badge st-' + s + '">' + A.statusLabel(s) + '</span>'; }

  /* ---------- nová kalkulace ---------- */
  A.route('/new', 'user', function (p, user) {
    W.pending = Store.newCalc(user);
    W.pending.job.name = 'Kalkulace ' + A.fmtDate(Date.now());
    location.replace('#/wizard/' + W.pending.id + '/1');
  });

  /* ---------- průvodce ---------- */
  var LABELS = ['Schody', 'Vzor', 'Zakázka', 'Kalkulace'];
  A.route('/wizard/:id/:step', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (ro(c)) return A.go('/calc/' + c.id);
    var s = parseInt(p.step, 10); if (!(s >= 1 && s <= 4)) s = 1;
    // nelze přeskočit nevalidní kroky (např. ruční změna URL)
    for (var i = 1; i < s; i++) if (Object.keys(stepErrors(c, i)).length) { W.showErrors = true; return A.go('/wizard/' + c.id + '/' + i); }
    W.c = c; W.step = s; W.inWizard = true;
    if (W.foldFor !== c.id) { W.folded = {}; W.foldFor = c.id; }
    var saved = Store.calcById(c.id) ? (c.number ? 'Změny uloženy ' : 'Koncept uložen ') + A.fmtTime(c.updatedAt) : 'Zatím neuloženo';
    var head = '<div class="wiz-head"><div class="t"><span>Krok ' + s + ' ze 4 · <b>' + LABELS[s - 1] + '</b></span></div>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="' + s + '" aria-label="Postup"><i style="width:' + (s * 25) + '%"></i></div></div>';
    var body = s === 1 ? stepStairs(c) : s === 2 ? stepPattern(c) : s === 3 ? stepJob(c) : calcBody(c, true);
    A.render(head + (s > 1 ? stairsSummary(c) : '') + (s < 4 ? priceNotice(c) : '') + body, { title: c.number ? 'Úprava kalkulace' : 'Nová kalkulace', back: '#/history', saved: saved, bar: actionBar(c, s) });
    barUpdate();
    if (s === 4) Viz.mount(c, ro(c));
    if (W.showErrors) { W.showErrors = false; showStepErrors(c, s); }
  });
  /* kroky 2–4: stručný souhrn zadaných schodů, klepnutím zpět na krok 1 */
  function stairsWord(n) { return n === 1 ? 'schod' : n >= 2 && n <= 4 ? 'schody' : 'schodů'; }
  function stairsSummary(c) {
    var q = A.quoteOf(c);
    var parts = c.groups.map(function (g) { return esc(g.count) + '× ' + esc(g.width) + ' × ' + esc(Calc.depthLabel(g)) + ' cm'; });
    return '<a class="stairs-sum" href="#/wizard/' + c.id + '/1" aria-label="Upravit schody"><span class="grow"><b>' + q.treads + ' ' + stairsWord(q.treads) + ' · ' + m2(q.totalArea) + ' · ' + esc(Calc.stairType(c).label) + '</b>' +
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
      (s === 4 ? '<button class="btn sq" data-click="moreSheet" aria-label="Další akce">' + ic('more', 'lg') + '</button><button class="btn primary" data-click="saveCalc">Uložit</button>'
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
    if (s === 3) A.setErr(A.$('[name=name]'), e.name || '');
    if (s === 1) {
      c.groups.forEach(function (g, i) {
        ['width', 'depth', 'depthRight', 'riserHeight', 'count'].forEach(function (f) {
          var el = A.$('[data-g="' + i + '"][data-f="' + f + '"]'); if (el) A.setErr(el, (e[i] || {})[f] || '');
        });
        if (e[i]) { var card = A.$('[data-gcard="' + i + '"]'); if (card) { card.classList.remove('collapsed'); delete W.folded[i]; } }
      });
    }
    if (s === 2) { var pe =A.$('#patErr'); if (pe) pe.textContent = e.pattern || ''; }
  }

  /* krok 3: zakázka */
  function stepJob(c) {
    var j = c.job;
    return '<h1 class="wiz-title">Zakázka</h1><p class="lead-text">Údaje pro kalkulaci a PDF. Název je předvyplněný, stačí přepsat.</p><div class="card">' +
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
  function gSummary(g) { return esc(g.width) + ' × ' + esc(Calc.depthLabel(g)) + ' cm · ' + esc(g.count) + ' ks'; }
  function depthName(g) { return Calc.isSkewed(g) ? 'Hloubka vlevo' : 'Hloubka nášlapu'; }
  var NOSE_TYPES = Calc.TREAD_TYPES.filter(function (t) { return !t.landing; });
  function opts(list, cur) { return list.map(function (t) { return '<option value="' + t.id + '"' + (t.id === cur ? ' selected' : '') + '>' + t.label + '</option>'; }).join(''); }
  function planHtml(c) { return Plan.html(c.groups, Calc.stairType(c).id, c.turnSide); }
  function planCard(c) { return '<div class="card plan" id="planBox">' + planHtml(c) + '</div>'; }
  function updatePlan() { var b = A.$('#planBox'); if (b) b.innerHTML = planHtml(W.c); }
  // kreslený náhled schodiště potažený vybraným vzorem
  function viewHtml(c) {
    var pat = c.patternId ? Calc.findPattern(A.pricingOf(c), c.patternId) : null, v = Plan.view3d(c.groups, Calc.stairType(c).id, c.turnSide, pat ? A.patternImg(pat) : null);
    return v ? v + '<p class="small muted plan-note">' + (pat ? 'Kreslený náhled · ' + esc(pat.name) : 'Kreslený náhled · vyberte vzor a schody se jím potáhnou') + '</p>' : '';
  }
  function viewCard(c) { var v = viewHtml(c); return v ? '<div class="card plan view3d" id="viewBox">' + v + '</div>' : ''; }
  function updateView() { var b = A.$('#viewBox'); if (b) b.innerHTML = viewHtml(W.c); }
  function sideField(c) {
    return '<div class="field' + (Calc.stairType(c).id === 'straight' ? '' : ' hidden') + '" id="sideField"><span class="lbl">Druhé rameno se vrací</span><div class="seg full" role="group" aria-label="Strana druhého ramene">' +
      [['right', 'Vpravo'], ['left', 'Vlevo']].map(function (s) { return '<button type="button" data-click="turnSide" data-s="' + s[0] + '" class="' + ((c.turnSide || 'right') === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') +
      '</div><div class="hint">Platí, když je ve schodišti podesta – na ní se otočí o 180°.</div></div>';
  }
  function groupCard(g, i, n) {
    function fld(f, label, unit, mode, cls) {
      return '<div class="field' + (cls || '') + '"><label for="g' + i + f + '">' + label + '</label><div class="inline-unit"><input type="text" id="g' + i + f + '" inputmode="' + mode + '" autocomplete="off" value="' + esc(g[f]) + '" data-g="' + i + '" data-f="' + f + '" data-input="gfield" data-blur="gblur"><span>' + unit + '</span></div><div class="err"></div></div>';
    }
    // počet schodů je v hlavičce skupiny vedle názvu, ať formulář není roztahaný
    var cnt = '<div class="field gcount"><div class="stepper-num" title="Počet schodů"><button type="button" data-click="cntStep" data-g="' + i + '" data-d="-1" aria-label="Ubrat schod">' + ic('minus') + '</button>' +
      '<input type="text" id="g' + i + 'count" aria-label="Počet schodů" inputmode="numeric" autocomplete="off" value="' + esc(g.count) + '" data-g="' + i + '" data-f="count" data-input="gfield" data-blur="gblur"><button type="button" data-click="cntStep" data-g="' + i + '" data-d="1" aria-label="Přidat schod">' + ic('plus') + '</button></div><div class="err"></div></div>';
    var collapsed = !!W.folded[i], skew = Calc.isSkewed(g);
    return '<div class="card group-card' + (collapsed ? ' collapsed' : '') + '" data-gcard="' + i + '"><div class="gh">' +
      '<button type="button" class="fold" data-click="gFold" data-g="' + i + '" aria-expanded="' + (!collapsed) + '">' + ic('chev-d', 'sm') + '<span><h2>Skupina ' + (i + 1) + '</h2><span class="sum" id="gsum' + i + '">' + gSummary(g) + '</span></span></button>' + cnt +
      (n > 1 ? '<button class="btn sm sq danger" data-click="gDel" data-g="' + i + '" aria-label="Odstranit skupinu ' + (i + 1) + '">' + ic('trash') + '</button>' : '') + '</div>' +
      '<div class="gbody"><div class="group-grid">' + fld('width', 'Šířka', 'cm', 'decimal') + fld('riserHeight', 'Výška podstupnice', 'cm', 'decimal') +
      '</div>' +
      // hloubka má vlastní řádek; pravé pole je v něm vždy a jen se skrývá, ať formulář při přepnutí neposkakuje
      '<label class="check"><span>Šikmý schod – různá hloubka</span><input type="checkbox" data-g="' + i + '" data-change="gskew"' + (skew ? ' checked' : '') + '></label>' +
      '<div class="depth-row">' + fld('depth', depthName(g), 'cm', 'decimal') + fld('depthRight', 'Hloubka vpravo', 'cm', 'decimal', skew ? '' : ' keep-hidden') + '</div>' +
      // podstupnice se obkládá vždy, volba se proto nenabízí; podesta dělá ze skupiny podestový nášlap
      '<label class="check"><span>Podesta</span><input type="checkbox" data-g="' + i + '" data-change="glanding"' + (Calc.isLanding(g) ? ' checked' : '') + '></label>' +
      '<div class="field"><label for="g' + i + 'side">Strana</label><select id="g' + i + 'side" data-g="' + i + '" data-change="gside"><option value="">Jako schodiště</option>' +
      SIDES.map(function (s) { return '<option value="' + s[0] + '"' + (g.side === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="group-area"><span class="muted small">Plocha skupiny</span><span class="chip soft" id="areaWrap' + i + '"><span id="area' + i + '">' + m2(Calc.groupArea(g)) + '</span></span></div><div class="small muted calc-note" id="gnote' + i + '">' + groupNote(W.c, i) + '</div></div></div>';
  }
  // rozměry, ze kterých se opravdu počítá (naměřené + přídavky), a varování ze spoje lamel; legacy snapshot nic neukazuje
  function groupNote(c, i) {
    var pr = A.pricingOf(c); if (Calc.isLegacy(pr) || !c.groups[i]) return '';
    var d = Calc.pieceDims(c.groups[i], pr.rates), q = c.patternId ? A.quoteOf(c) : null, inf = q && q.groupsInfo[i];
    return 'počítá se ' + nf1.format(d.w) + ' × ' + nf1.format(d.dVinyl) + ' cm' + (d.r ? ', podstupnice ' + nf1.format(d.r) + ' cm' : '') + (inf && inf.needsJoint ? ' ' + JOINT : '');
  }
  function updateNotes() { W.c.groups.forEach(function (g, i) { var el = A.$('#gnote' + i); if (el) el.innerHTML = groupNote(W.c, i); }); }
  A.on('click', 'stairSide', function (el) {
    W.c.stairSide = el.dataset.s; touch(W.c);
    document.querySelectorAll('[data-click=stairSide]').forEach(function (b) { b.classList.toggle('on', b === el); });
    barUpdate();
  });
  A.on('change', 'gside', function (el) {
    var g = W.c.groups[+el.dataset.g]; if (el.value) g.side = el.value; else delete g.side;
    touch(W.c); barUpdate();
  });
  function stepStairs(c) {
    return '<h1 class="wiz-title">Schody</h1><p class="lead-text">Začněte rozměry schodů – cenu uvidíte hned dole. Schody stejných rozměrů zadejte jako jednu skupinu, odspodu nahoru.</p>' +
      '<div class="field"><label for="stType">Typ schodiště</label><select id="stType" data-change="stairType">' + opts(Calc.STAIR_TYPES, Calc.stairType(c).id) + '</select></div>' + sideField(c) +
      '<div class="field"><label for="trType">Typ nášlapu</label><select id="trType" data-change="treadNose">' + opts(NOSE_TYPES, Calc.hasNose(c.groups[0] || {}) ? 'nose' : 'flat') + '</select><div class="hint">Platí pro celé schodiště. Podestu označíte u její skupiny.</div></div>' +
      '<div class="field"><span class="lbl">Strany schodiště</span><div class="seg full" role="group" aria-label="Strany schodiště">' + SIDES.map(function (s) {
        return '<button type="button" data-click="stairSide" data-s="' + s[0] + '" class="' + ((c.stairSide || 'walls') === s[0] ? 'on' : '') + '">' + s[1] + '</button>';
      }).join('') + '</div><div class="hint">Strana u zdi dostane lištu, otevřená strana vinylovou hranu.</div>' + A.question('trimRoute') + '</div>' +
      c.groups.map(function (g, i) { return groupCard(g, i, c.groups.length); }).join('') +
      '<button class="btn block" data-click="gAdd">' + ic('plus') + 'Přidat skupinu</button>' +
      '<div class="section-title">Půdorys schodiště</div>' + planCard(c) + A.question('spiral');
  }
  function onGroupInput(el) {
    var c = W.c, i = +el.dataset.g, g = c.groups[i];
    g[el.dataset.f] = el.value; touch(c);
    A.$('#area' + i).textContent = m2(Calc.groupArea(g));
    A.$('#gsum' + i).innerHTML = gSummary(g);
    if (!Calc.validateGroup(g)[el.dataset.f]) A.setErr(el, '');
    barUpdate(); updatePlan(); updateNotes();
  }
  A.on('change', 'stairType', function (el) { W.c.stairType = el.value; touch(W.c); A.$('#sideField').classList.toggle('hidden', el.value !== 'straight'); updatePlan(); });
  A.on('click', 'turnSide', function (el) {
    W.c.turnSide = el.dataset.s; touch(W.c);
    document.querySelectorAll('[data-click=turnSide]').forEach(function (b) { b.classList.toggle('on', b === el); });
    updatePlan();
  });
  // typ nášlapu skupiny se skládá z volby pro celé schodiště (s nosem / bez nosu) a ze zaškrtnutí Podesta
  function setTread(g, nose, landing) { g.treadType = landing ? (nose ? 'landingNose' : 'landingFlat') : (nose ? 'nose' : 'flat'); }
  A.on('change', 'treadNose', function (el) {
    W.c.groups.forEach(function (g) { setTread(g, el.value === 'nose', Calc.isLanding(g)); });
    touch(W.c); barUpdate(); updatePlan(); updateNotes();
  });
  A.on('change', 'glanding', function (el) {
    setTread(W.c.groups[+el.dataset.g], A.$('#trType').value === 'nose', el.checked);
    touch(W.c); barUpdate(); updatePlan(); updateNotes();
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
  // šikmý schod: po zaškrtnutí se ukáže i hloubka vpravo (začíná na stejné hodnotě jako vlevo)
  A.on('change', 'gskew', function (el) {
    var i = +el.dataset.g, g = W.c.groups[i], right = A.$('[data-g="' + i + '"][data-f="depthRight"]');
    g.depthSame = !el.checked;
    if (el.checked && (g.depthRight === undefined || g.depthRight === '')) g.depthRight = g.depth;
    right.value = g.depthRight === undefined ? '' : g.depthRight;
    right.closest('.field').classList.toggle('keep-hidden', !el.checked);
    A.setErr(right, '');
    A.$('label[for="g' + i + 'depth"]').textContent = depthName(g);
    touch(W.c);
    A.$('#area' + i).textContent = m2(Calc.groupArea(g));
    A.$('#gsum' + i).innerHTML = gSummary(g);
    barUpdate(); updatePlan(); updateNotes();
  });
  A.on('click', 'gAdd', function () {
    W.c.groups.forEach(function (g, i) { W.folded[i] = true; }); // dřívější skupiny se sbalí, nová je otevřená
    var g = Store.newGroup(); setTread(g, Calc.hasNose(W.c.groups[0] || g), false);
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
    var valid = !Object.keys(stepErrors(c, 1)).length;
    var cmp = valid ? Calc.comparePatterns(c.groups, { patterns: list, rates: pr.rates, collections: pr.collections }, c.discount, c.vatRate, c.extras, A.quoteOpt(c)) : null;
    var priced = cmp ? cmp.filter(function (x) { return priceOf(c, x.pattern) > 0; }).map(function (x) { return x.quote.total; }) : [];
    var min = priced.length > 1 && Math.max.apply(null, priced) > Math.min.apply(null, priced) ? Math.min.apply(null, priced) : null; // při stejných cenách bez štítku
    if (!list.length) return '<p class="muted small">Žádný vzor neodpovídá filtru.</p>';
    return '<p class="small muted pat-count">' + list.length + ' z ' + pr.patterns.filter(function (p) { return Calc.patternOffered(pr, p); }).length + ' vzorů</p><div class="tiles" role="radiogroup" aria-label="Vzor">' +
      list.map(function (p, i) {
        var sel = c.patternId === p.id, q = cmp && priceOf(c, p) > 0 ? cmp[i].quote : null;
        return '<label class="tile' + (sel ? ' selected' : '') + '"><input type="radio" name="pattern" value="' + p.id + '" data-change="pickPattern"' + (sel ? ' checked' : '') + '>' +
          '<div style="position:relative"><img loading="lazy" src="' + A.patternImg(p) + '" alt="' + esc(p.name) + '">' + (q && q.total === min ? '<span class="ov">Nejlevnější</span>' : '') + '<span class="tick">' + ic('check') + '</span></div>' +
          '<div class="t"><b>' + esc(p.name) + '</b><span class="small muted">' + patPrice(p, c) + '</span>' +
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
      '<div class="group-grid"><select aria-label="Cena za m²" data-change="patSel" data-k="cena">' + CENY.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === f.cena ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
      '<input type="search" aria-label="Hledat vzor" placeholder="Hledat název nebo kód" value="' + esc(f.q) + '" data-input="patQ" autocomplete="off"></div></div>';
  }
  function stepPattern(c) {
    return '<h1 class="wiz-title">Vzor obkladu</h1><p class="lead-text">Cena u vzoru je orientační celek s DPH pro vaše schody.' + (c.snapshot ? ' Uložená kalkulace nabízí vzory své kolekce; jiné se nabídnou po přepočtu podle aktuálního ceníku.' : '') + '</p>' +
      viewCard(c) + '<div id="patFilters">' + patFilters(c) + '</div><div id="fmtBox">' + formatSwitch(c) + '</div><div id="patTiles">' + patTiles(c) + '</div><div class="err" id="patErr" role="alert"></div>' + A.question('photos');
  }
  // dlaždice Design Stone mají víc formátů téže kolekce; volba platí pro celou kalkulaci
  function formatSwitch(c) {
    var pr = A.pricingOf(c), pat = c.patternId ? Calc.findPattern(pr, c.patternId) : null, coll = pat && Calc.collectionOf(pr, pat, null);
    if (!coll || !coll.family) return '';
    var cur = c.formatId || coll.format, sibs = (pr.collections || []).filter(function (x) { return x.family === coll.family; });
    return '<div class="field fmt-switch"><span class="lbl">Formát dlaždice</span><div class="seg full" role="group" aria-label="Formát dlaždice">' + sibs.map(function (x) {
      return '<button type="button" data-click="fmt" data-f="' + x.format + '" class="' + (x.format === cur ? 'on' : '') + '">' + x.format + ' ' + nf.format(x.lamellaLengthMm) + '×' + nf.format(x.lamellaWidthMm) + '</button>';
    }).join('') + '</div></div>';
  }
  A.on('click', 'fmt', function (el) { W.c.formatId = el.dataset.f; touch(W.c); A.$('#fmtBox').innerHTML = formatSwitch(W.c); patRefresh(false); barUpdate(); updateView(); });
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
    A.$('#patErr').textContent = ''; barUpdate(); updateView();
  });

  /* ---------- obrazovka kalkulace (krok 4 i detail) ---------- */
  function pct(v) { return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(v * 100) + ' %'; }
  var nf = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }), nf1 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 });
  function fmtUnit(x) { return Math.abs(x - Math.round(x)) < 0.005 ? fmt(x) : nf.format(x) + ' Kč'; }
  var JOINT = '<span class="joint">Schod vyžaduje spoj lamel</span>';
  var SIDES = [['walls', 'Obě strany u zdi'], ['openLeft', 'Vlevo otevřená'], ['openRight', 'Vpravo otevřená'], ['openBoth', 'Obě otevřené']];
  function lr(k, sub, v, cls) { return '<div class="lrow ' + (cls || '') + '"><span class="k">' + k + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="v">' + v + '</span></div>'; }
  function calcBody(c, inWizard) {
    W.inWizard = !!inWizard;
    var pr = A.pricingOf(c), pat = Calc.findPattern(pr, c.patternId), owner = Store.userById(c.ownerId).profile, q = A.quoteOf(c), dis = ro(c) ? ' disabled' : '';
    var html = '';
    if (!inWizard) html += priceNotice(c);
    if (!c.number) html += '<div class="alert info">Kalkulace zatím není uložena. Číslo bude přiděleno při uložení a ceník se „zamkne“.</div>';
    // hero
    html += '<div class="card hero calc-head"><div class="row between"><span class="eyebrow">Celkem s DPH</span>' + statusBadge(c.status) + '</div>' +
      '<div id="heroPrice">' + heroPrice(c) + '</div>' +
      '<a class="pat" href="#/compare/' + c.id + '" aria-label="Porovnat vzory"><img src="' + A.patternImg(pat) + '" alt=""><span class="grow"><b>' + esc(pat.name) + '</b><span class="small">' + m2(q.totalArea) + ' · ' + patPrice(pat, c) + '</span></span><span class="small cmp-link">' + '<span class="lbl-t">Porovnat</span>' + ic('chev-r', 'sm') + '</span></a>' +
      '<div class="meta"><span>' + (c.number ? 'č. <b style="color:var(--text)">' + esc(c.number) + '</b>' : 'číslo bude přiděleno při uložení') + '</span><span>' + A.fmtDate(c.createdAt) + '</span></div></div>';
    html += actionGrid(c, inWizard);
    // stav
    if (c.number && !ro(c)) {
      html += '<div class="section-title">Stav kalkulace</div><div class="card"><div class="seg full" role="group" aria-label="Stav">' +
        ['přijato', 'zamítnuto'].map(function (s) { return '<button type="button" data-click="setStatus" data-s="' + s + '" class="' + (c.status === s ? 'on' : '') + '">' + A.statusLabel(s) + '</button>'; }).join('') + '</div>' +
        (c.status === 'přijato' || c.status === 'zamítnuto' ? '<button class="btn sm ghost mt-2" data-click="setStatus" data-s="' + (c.sentTo ? 'odesláno' : 'koncept') + '">Zrušit označení</button>' : '') + '</div>';
    }
    // rozpis ceny
    html += '<div class="section-title">Rozpis ceny</div><div id="sums">' + sums(c) + '</div>';
    // schody
    html += '<div class="section-title">Schody</div><div class="list">' + c.groups.map(function (g, i) {
      var inf = q.groupsInfo[i];
      return '<div class="lrow"><span class="k">' + esc(g.width) + ' × ' + esc(Calc.depthLabel(g)) + ' cm<small>' + esc(g.count) + ' ks · ' + Calc.treadType(g).label.toLowerCase() + ' · ' + (g.coverRiser ? 'podstupnice ' + esc(g.riserHeight) + ' cm' : 'bez podstupnice') +
        (inf ? ' · výrobní plocha ' + m2(inf.prod) : '') + '</small>' + (inf && inf.needsJoint ? JOINT : '') + '</span><span class="v">' + m2(q.areas[i]) + '</span></div>';
    }).join('') + lr('Celková plocha (naměřená)', '', m2(q.totalArea), 'tot') + (q.legacy ? '' : lr('Výrobní plocha vinylu', 'vč. přídavků na ořez', m2(q.prodArea)) + lr('Plocha MDF', '', m2(q.mdfArea))) +
      lr('Typ schodiště', '', Calc.stairType(c).label) + '</div>' + viewCard(c) + planCard(c);
    html += '<div id="vizCard"></div>';
    html += trimCard(c, q);
    // sleva a DPH
    html += '<div class="section-title">Sleva a DPH</div><div class="card"><div class="lbl">Sleva</div><div class="disc-grid"><div class="seg" role="group" aria-label="Typ slevy"><button type="button"' + dis + ' data-click="discType" data-type="pct" class="' + (c.discount.type === 'pct' ? 'on' : '') + '">%</button><button type="button"' + dis + ' data-click="discType" data-type="czk" class="' + (c.discount.type === 'czk' ? 'on' : '') + '">Kč</button></div>' +
      '<input type="text" inputmode="decimal" id="discVal"' + dis + ' aria-label="Výše slevy" value="' + esc(c.discount.value || '') + '" placeholder="0" data-input="discount"></div><div class="err" id="discErr"></div>' +
      '<div class="lbl mt">Sazba DPH</div><div class="seg full" role="group" aria-label="Sazba DPH">' + (pr.rates.vatOptions || [0.21, 0.12]).map(function (v) {
        return '<button type="button"' + dis + ' data-click="vat" data-v="' + v + '" class="' + (c.vatRate === v ? 'on' : '') + '">' + pct(v) + '</button>';
      }).join('') + '</div>' + A.question('vat') + '</div>';
    // zakázka
    html += '<div class="section-title">Zakázka</div><div class="list">' + lr('Zakázka', '', '<span style="font-weight:600;white-space:normal">' + esc(c.job.name) + '</span>') +
      lr('Zákazník', '', esc(c.job.customer || '—')) + (c.job.address ? lr('Adresa', '', '<span style="white-space:normal">' + esc(c.job.address) + '</span>') : '') +
      (c.job.note ? lr('Poznámka', '', '<span style="white-space:normal;font-weight:400">' + esc(c.job.note) + '</span>') : '') +
      '<div class="firm">' + (owner.logo ? '<img src="' + owner.logo + '" alt="Logo">' : '') + '<div><b>' + esc(owner.company || owner.name || 'Vaše firma') + '</b><div class="small muted">' + [owner.name, owner.ico ? 'IČO ' + owner.ico : '', owner.phone].filter(Boolean).map(esc).join(' · ') + '</div></div></div></div>';
    html += A.question('labor') + A.question('laborHours');
    if (c.number && !inWizard) html += A.question('editPrices');
    return html;
  }
  function heroPrice(c) {
    var q = A.quoteOf(c), r = A.pricingOf(c).rates;
    return '<div class="big">' + fmt(q.total) + '</div><div class="sub">bez DPH ' + fmt(q.base) + ' · DPH ' + pct(c.vatRate) + ' ' + fmt(q.vat) + (r.roundTo > 1 ? ' · zaokrouhleno na ' + r.roundTo + ' Kč' : '') + '</div>';
  }
  function refreshCalc() {
    var c = W.c; A.$('#sums').innerHTML = sums(c); A.$('#heroPrice').innerHTML = heroPrice(c); barUpdate();
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
  A.on('input', 'extra', function (el) { if (ro()) return;
    var c = W.c; c.extras = c.extras || {}; c.extras[el.dataset.k] = el.value; touch(c); refreshCalc();
  });
  function qtyText(l) {
    var t = nf.format(l.qty) + ' ' + l.unit;
    if (l.unit === 'paušál') return 'paušál';
    return l.unitPrice && l.unit !== 'ks' ? t + ' × ' + fmtUnit(l.unitPrice) : t;
  }
  function missingAlert(q) {
    return q.missing && q.missing.length ? '<div class="alert warn"><b>Cena není kompletní:</b> chybí ' + q.missing.map(esc).join(', ') + '. Doplní správce v Sazbách.' + A.question('hourlyRate') + '</div>' : '';
  }
  function sums(c) {
    var pr = A.pricingOf(c), q = A.quoteOf(c), r = pr.rates;
    var h = missingAlert(q) + '<div class="list">' + q.lines.map(function (l) {
      return lr(esc(l.label), qtyText(l) + (l.sub ? ' · ' + esc(l.sub) : ''), fmt(l.amount));
    }).join('');
    if (q.discountAmount > 0) h += lr('Mezisoučet', '', fmt(q.subtotal)) + lr('Sleva', c.discount.type === 'pct' ? Calc.n0(c.discount.value) + ' %' : '', '− ' + fmt(q.discountAmount), 'minus');
    h += lr('Cena bez DPH', '', fmt(q.base), 'tot') + lr('DPH ' + pct(c.vatRate), '', fmt(q.vat)) + lr('Celkem s DPH', r.roundTo > 1 ? 'zaokrouhleno na ' + r.roundTo + ' Kč' : '', fmt(q.total), 'tot') + '</div>';
    return h;
  }
  // ruční přepis délky lišty a hrany (prázdné = automaticky podle stran schodiště)
  function trimCard(c, q) {
    if (q.legacy) return '';
    var d = ro(c) ? ' disabled' : '';
    function f(k, label, auto, val) {
      return '<div class="field"><label for="bm_' + k + '">' + label + '</label><div class="inline-unit"><input type="text" id="bm_' + k + '" inputmode="decimal"' + d + ' value="' + esc(val === undefined || val === null ? '' : val) + '" placeholder="' + nf.format(auto) + '" data-input="bm" data-k="' + k + '"><span>bm</span></div></div>';
    }
    return '<div class="section-title">Lišty a hrany</div><div class="card"><p class="small muted">Lišta jde na stranu u zdi, vinylová hrana na otevřenou stranu. Délka každé strany = (hloubka nášlapu + výška podstupnice) × počet schodů, z naměřených rozměrů. Prázdné pole = automaticky, vyplněním hodnotu přepíšete.</p>' +
      '<div class="group-grid">' + f('trimBm', 'Lišta KPV50', q.autoTrimBm, c.trimBm) + f('edgeBm', 'Vinylová hrana', q.autoEdgeBm, c.edgeBm) + '</div>' + A.question('discountTrims') + '</div>';
  }
  A.on('input', 'bm', function (el) { if (ro()) return;
    var c = W.c; if (el.value.trim() === '') delete c[el.dataset.k]; else c[el.dataset.k] = el.value;
    touch(c); refreshCalc();
  });
  A.on('click', 'vat', function (el) {
    if (ro()) return; W.c.vatRate = parseFloat(el.dataset.v); touch(W.c);
    document.querySelectorAll('[data-click=vat]').forEach(function (b) { b.classList.toggle('on', b === el); });
    refreshCalc();
  });
  A.on('click', 'discType', function (el) { if (ro()) return;
    W.c.discount.type = el.dataset.type; touch(W.c);
    document.querySelectorAll('[data-click=discType]').forEach(function (b) { b.classList.toggle('on', b === el); });
    applyDiscount();
  });
  A.on('input', 'discount', function (el) { if (ro()) return; W.c.discount.value = el.value; touch(W.c); applyDiscount(); });
  function applyDiscount() {
    var c = W.c, d = c.discount, raw = A.$('#discVal').value, v = Calc.num(raw), msg = '';
    if (raw.trim() !== '') {
      var sub = Calc.computeQuote(c.groups, c.patternId, A.pricingOf(c), { type: 'czk', value: 0 }, c.vatRate, c.extras, A.quoteOpt(c)).subtotal;
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
  function actionGrid(c, inWizard) {
    if (ro(c)) {
      return '<div class="alert info no-print">Kalkulace podlaháře – jen ke čtení.</div><div class="btn-grid mb no-print"><button class="btn" data-click="pdf">' + ic('pdf') + 'PDF</button><button class="btn" data-click="dup">' + ic('copy') + 'Duplikovat</button></div>';
    }
    var h = '<div class="btn-grid mb no-print"><button class="btn" data-click="pdf">' + ic('pdf') + 'PDF</button><button class="btn" data-click="mail">' + ic('mail') + 'Odeslat</button>';
    if (!inWizard) h += '<a class="btn" href="#/wizard/' + c.id + '/1">' + ic('edit') + 'Upravit</a><button class="btn" data-click="dup">' + ic('copy') + 'Duplikovat</button>';
    return h + '</div>';
  }
  A.on('click', 'moreSheet', function () {
    var c = W.c;
    function row(icon, label, attrs, link) {
      var inner = '<span class="lead">' + ic(icon) + '<span class="k">' + label + '</span></span>';
      return link ? '<a class="lrow" href="' + link + '">' + inner + '</a>' : '<button type="button" class="lrow" ' + attrs + '>' + inner + '</button>';
    }
    var rows = row('pdf', ro(c) ? 'Zobrazit PDF' : 'Stáhnout PDF', 'data-click="pdf"');
    if (!ro(c)) rows += row('mail', 'Odeslat e-mailem', 'data-click="mail"');
    if (!ro(c) && !W.inWizard) rows += row('edit', 'Upravit kalkulaci', '', '#/wizard/' + c.id + '/1');
    rows += row('copy', ro(c) ? 'Duplikovat do mých' : 'Duplikovat', 'data-click="dup"') + row('compare', 'Porovnat vzory', '', '#/compare/' + c.id);
    if (!ro(c) && priceChanged(c)) rows += row('refresh', 'Přepočítat podle aktuálního ceníku', 'data-click="recalc"');
    if (!ro(c) && c.number) rows += row('status', 'Označit jako přijato', 'data-click="setStatus" data-s="přijato"') + row('x', 'Označit jako zamítnuto', 'data-click="setStatus" data-s="zamítnuto"');
    A.modal('<h2>Akce</h2>' + A.sheetList(rows));
  });
  A.on('click', 'saveCalc', function () { if (ro()) return;
    var c = W.c;
    for (var s = 1; s <= 3; s++) if (Object.keys(stepErrors(c, s)).length) { W.showErrors = true; return A.go('/wizard/' + c.id + '/' + s); }
    var wasNew = !c.number; ensureSaved(c);
    A.toast(wasNew ? 'Uloženo jako kalkulace č. ' + c.number : 'Změny uloženy');
    A.go('/calc/' + c.id);
  });
  A.on('click', 'setStatus', function (el) { if (ro()) return; W.c.status = el.dataset.s; touch(W.c); A.toast('Stav: ' + W.c.status); A.dispatch(); });
  A.on('click', 'pdf', function () { var c = W.c; if (!allValid(c)) return A.toast('Nejprve dokončete kalkulaci'); if (!ro(c)) ensureSaved(c); A.go('/calc/' + c.id + '/pdf'); });
  A.on('click', 'dup', function () {
    var c = W.c, n = Store.clone(c), now = Date.now();
    n.id = Store.uid('c'); n.ownerId = Store.currentUser().id; n.number = null; n.snapshot = null; n.status = 'koncept'; n.sentTo = null; n.createdAt = now; n.updatedAt = now;
    n.job.name = n.job.name + ' (kopie)'; n.vatRate = Store.db.rates.vatDefault;
    Store.upsertCalc(n); A.toast('Vytvořena kopie jako koncept – s aktuálním ceníkem'); A.go('/wizard/' + n.id + '/1');
  });

  A.route('/calc/:id', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (ro(c) && !allValid(c)) { A.toast('Rozpracovaná kalkulace podlaháře ještě není dokončená'); return A.go('/history'); }
    if (!c.number && !ro(c)) return A.go('/wizard/' + c.id + '/1');
    if (!allValid(c)) return A.go('/wizard/' + c.id + '/1');
    W.c = c; W.step = 4;
    var body = calcBody(c, false), bar;
    if (ro(c)) bar = '<div class="actionbar stickybar"><div class="inner">' + priceRow() + '<div class="btns">' + backBtn('#/history') + '<button class="btn primary" data-click="pdf">' + ic('pdf') + 'Zobrazit PDF</button></div></div></div>';
    else bar = '<div class="actionbar stickybar"><div class="inner">' + priceRow() + '<div class="btns">' + backBtn('#/history') + '<button class="btn sq" data-click="moreSheet" aria-label="Další akce">' + ic('more', 'lg') + '</button><button class="btn primary" data-click="saveCalc">Uložit změny</button></div></div></div>';
    A.render(body, { title: 'Kalkulace ' + (c.number || '(koncept)'), back: '#/history', bar: bar });
    barUpdate();
    Viz.mount(c, ro(c));
  });

  /* ---------- odeslání e-mailem ---------- */
  A.on('click', 'mail', function () { if (ro()) return;
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
  A.on('submit', 'sendMail', function (form) { if (ro()) return;
    var inp = form.elements.to;
    if (!/^\S+@\S+\.\S+$/.test(inp.value.trim())) return A.setErr(inp, 'Zadejte platný e-mail zákazníka');
    var c = W.c; c.sentTo = inp.value.trim(); c.status = 'odesláno'; touch(c);
    A.closeModal(); A.toast('Kalkulace odeslána na ' + c.sentTo + ' (demo)'); A.dispatch();
  });

  /* ---------- PDF náhled ---------- */
  A.route('/calc/:id/pdf', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (!c.number) return A.go('/wizard/' + c.id + '/1');
    W.c = c;
    var pr = A.pricingOf(c), pat = Calc.findPattern(pr, c.patternId), q = A.quoteOf(c), owner = Store.userById(c.ownerId).profile, r = pr.rates;
    function row(k, v, b) { return '<tr><td>' + k + '</td><td class="num">' + (b ? '<b>' + v + '</b>' : v) + '</td></tr>'; }
    var sheet = '<div class="pdf-wrap"><div class="pdf-sheet">' +
      '<div class="pdf-top"><div>' + (owner.logo ? '<img class="logo" src="' + owner.logo + '" alt="Logo"><br>' : '') + '<b>' + esc(owner.company || owner.name) + '</b><br>' +
      '<span class="small">' + [owner.name, owner.ico ? 'IČO ' + owner.ico : '', owner.phone].filter(Boolean).map(esc).join('<br>') + '</span></div>' +
      '<div class="right"><h1>Kalkulace č. ' + esc(c.number) + '</h1><div>Datum: ' + A.fmtDate(c.createdAt) + '</div></div></div><hr>' +
      '<dl class="pdf-meta"><dt>Zakázka</dt><dd>' + esc(c.job.name) + '</dd><dt>Zákazník</dt><dd>' + esc(c.job.customer || '—') + '</dd>' + (c.job.address ? '<dt>Adresa</dt><dd>' + esc(c.job.address) + '</dd>' : '') + '<dt>Schodiště</dt><dd>' + Calc.stairType(c).label + '</dd></dl>' +
      '<div class="pat-line"><img src="' + A.patternImg(pat) + '" alt=""><div><b>' + esc(pat.name) + '</b><br><span class="small">' + fmtUnit(Calc.patternPrice(pr, pat, c.formatId)) + ' / m², prořez ' + nf1.format(q.wastePct) + ' %</span></div></div>' +
      (q.missing && q.missing.length ? '<div class="alert warn">Cena není kompletní: chybí ' + q.missing.map(esc).join(', ') + '.</div>' : '') + (q.needsJoint ? '<p class="small">' + JOINT + ' Šířka schodu je větší než délka lamely.</p>' : '') +
      '<table class="tbl"><thead><tr><th>Šířka</th><th>Hloubka</th><th>Nášlap</th><th>Podstupnice</th><th class="num">Počet</th><th class="num">Plocha</th></tr></thead><tbody>' +
      c.groups.map(function (g, i) { return '<tr><td>' + esc(g.width) + ' cm</td><td>' + esc(Calc.depthLabel(g)) + ' cm</td><td>' + Calc.treadType(g).label.toLowerCase() + '</td><td>' + (g.coverRiser ? esc(g.riserHeight) + ' cm' : 'bez obkladu') + '</td><td class="num">' + esc(g.count) + ' ks</td><td class="num">' + m2(q.areas[i]) + '</td></tr>'; }).join('') +
      '<tr><td colspan="5"><b>Celkem (naměřená plocha)</b></td><td class="num"><b>' + m2(q.totalArea) + '</b></td></tr>' +
      (q.legacy ? '' : '<tr><td colspan="5">Výrobní plocha vinylu (vč. přídavků)</td><td class="num">' + m2(q.prodArea) + '</td></tr><tr><td colspan="5">Plocha MDF</td><td class="num">' + m2(q.mdfArea) + '</td></tr>') + '</tbody></table>' +
      '<div class="plan view3d">' + viewHtml(c) + '</div><div class="plan">' + planHtml(c) + '</div>' + Viz.pdf(c) +
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

  /* ---------- porovnání vzorů ---------- */
  A.route('/compare/:id', 'user', function (p, user) {
    var c = loadCalc(p.id, user); if (!c) return;
    if (Object.keys(stepErrors(c, 1)).length) return A.go('/wizard/' + c.id + '/1');
    W.c = c;
    var pr = A.pricingOf(c);
    if (!c.patternId) return A.go('/wizard/' + c.id + '/2');
    // porovnávají se vzory ze stejné kolekce jako vybraný vzor
    pr = { patterns: Store.sameCollection(pr.patterns, c.patternId), rates: pr.rates, collections: pr.collections };
    var cmp = Calc.comparePatterns(c.groups, pr, c.discount, c.vatRate, c.extras, A.quoteOpt(c));
    var min = Math.min.apply(null, cmp.map(function (x) { return x.quote.total; }));
    var back = c.number || ro(c) ? '#/calc/' + c.id : '#/wizard/' + c.id + '/2';
    function use(x) {
      if (c.patternId === x.pattern.id) return '<span class="badge st-přijato">' + ic('check', 'sm') + 'Vybraný vzor</span>';
      return ro(c) ? '' : '<button class="btn sm tonal" data-click="usePattern" data-p="' + x.pattern.id + '">Použít</button>';
    }
    A.render('<h1 class="large-title">Porovnání vzorů</h1><p class="screen-sub">' + esc(c.job.name) + ' · ' + m2(cmp[0].quote.totalArea) + ' · DPH ' + pct(c.vatRate) + (c.discount.value ? ' · sleva ' + esc(c.discount.value) + (c.discount.type === 'pct' ? ' %' : ' Kč') : '') + (c.snapshot ? ' · ceny z ' + A.fmtDate(c.createdAt) : '') + '</p>' +
      '<div class="list only-mobile">' + cmp.map(function (x) {
        var best = x.quote.total === min, diff = x.quote.total - min;
        return '<div class="cmp-row' + (best ? ' best' : '') + '"><img src="' + A.patternImg(x.pattern) + '" alt=""><div class="nm"><b>' + esc(x.pattern.name) + '</b><span class="small muted">' + fmtUnit(Calc.patternPrice(pr, x.pattern, c.formatId)) + '/m² · prořez ' + nf1.format(x.quote.wastePct) + '&nbsp;%</span>' + (x.quote.needsJoint ? JOINT : '') + '</div>' +
          '<div class="pr"><b>' + fmt(x.quote.total) + '</b><small>' + (best ? '<span class="badge st-přijato">Nejlevnější</span>' : '+ ' + fmt(diff)) + '</small></div>' +
          '<div class="use">' + use(x) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="card only-desktop" style="overflow:auto"><table class="tbl"><thead><tr><th>Vzor</th><th class="num">Materiál</th><th class="num">Práce</th><th class="num">Podstupnice</th><th class="num">Doprava</th><th class="num">Bez DPH</th><th class="num">S DPH</th><th class="num">Rozdíl</th><th></th></tr></thead><tbody>' +
      cmp.map(function (x) {
        var q = x.quote;
        return '<tr class="' + (q.total === min ? 'best' : '') + '"><td><img class="thumb" src="' + A.patternImg(x.pattern) + '" alt=""><b>' + esc(x.pattern.name) + '</b>' + (q.total === min ? ' <span class="badge st-přijato">Nejlevnější</span>' : '') + (q.needsJoint ? JOINT : '') + '</td><td class="num">' + fmt(q.material) + '</td><td class="num">' + fmt(q.labor) + '</td><td class="num">' + fmt(q.risers) + '</td><td class="num">' + fmt(q.transport) + '</td><td class="num">' + fmt(q.base) + '</td><td class="num"><b>' + fmt(q.total) + '</b></td><td class="num">' + (q.total === min ? '—' : '+ ' + fmt(q.total - min)) + '</td><td>' + use(x) + '</td></tr>';
      }).join('') + '</tbody></table></div>', { wide: true, title: 'Porovnání vzorů', back: back, bare: false });
  });
  A.on('click', 'usePattern', function (el) { if (ro()) return;
    var c = W.c; c.patternId = +el.dataset.p; touch(c);
    A.toast('Vzor změněn'); A.go(c.number ? '/calc/' + c.id : '/wizard/' + c.id + '/4');
  });
})();
