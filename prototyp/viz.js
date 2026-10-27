/* Vizualizace schodů na fotce zákazníka (Gemini přes lokální server.py). Karta na obrazovce kalkulace a v PDF.
   Kalkulace drží jen cesty k obrázkům (visuals) a počet použitých vizualizací (visualsUsed); limit hlídá i server. */
var Viz = (function () {
  'use strict';
  var A = App, LIMIT = 2, MAX_SIDE = 1600, NOTE = 'Orientační vizualizace – skutečný vzhled se může lišit.';
  var S = { server: null, used: {}, busy: null, error: null, mode: {}, cut: {} };
  var MODES = [['po', 'Vizualizace'], ['pred', 'Původní fotka'], ['cmp', 'Porovnat']];

  function esc(s) { return A.esc(s); }
  function used(c) { return Math.max(c.visualsUsed || 0, S.used[c.id] || 0); }
  function el() { return document.getElementById('vizCard'); }

  function check(c) {
    if (location.protocol === 'file:') { S.server = false; return draw(); }
    fetch('api/vizualizace/stav?calc=' + encodeURIComponent(c.id), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { S.server = !!(d && d.ok); S.key = !!(d && d.key); if (d) S.used[c.id] = d.used; draw(); })
      .catch(function () { S.server = false; draw(); });
  }

  function stairInfo(c) {
    return { nose: Calc.hasNose(c.groups[0] || {}), stairSide: c.stairSide || 'walls', stairType: Calc.stairType(c).id,
      landing: c.groups.some(function (g) { return Calc.isLanding(g); }) };
  }

  function shrink(file, cb, fail) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cb(cv.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = function () { URL.revokeObjectURL(url); fail('Fotku se nepodařilo načíst. Použijte JPG nebo PNG (HEIC z iPhonu otevře jen Safari).'); };
    img.src = url;
  }

  function card(c, readOnly) {
    var n = used(c), list = c.visuals || [], h = '<div class="section-title">Vizualizace na fotce</div><div class="card viz">';
    h += list.map(function (v, i) {
      var mode = S.mode[i] || 'po', cut = S.cut[i] == null ? 50 : S.cut[i], stage;
      if (mode === 'cmp') stage = '<img src="' + esc(v.original) + '" alt="Původní fotka">' +
        '<div class="viz-after" style="clip-path:inset(0 0 0 ' + cut + '%)"><img src="' + esc(v.url) + '" alt="Vizualizace schodů ' + (i + 1) + '"></div>' +
        '<span class="viz-line" style="left:' + cut + '%"></span><span class="viz-tag l">Před</span><span class="viz-tag r">Po</span>' +
        '<input type="range" class="viz-range" min="0" max="100" value="' + cut + '" aria-label="Porovnání před a po" data-input="vizSlide" data-i="' + i + '">' +
        '<button type="button" class="viz-full" data-click="vizZoom" data-i="' + i + '" data-k="cmp" aria-label="Přes celou obrazovku">⤢</button>';
      else stage = '<button type="button" class="viz-zoom" data-click="vizZoom" data-i="' + i + '" aria-label="Přes celou obrazovku"><img src="' + esc(mode === 'pred' ? v.original : v.url) + '" alt="' +
        (mode === 'pred' ? 'Původní fotka' : 'Vizualizace schodů ' + (i + 1)) + '"></button>';
      return '<figure class="viz-item"><div class="seg full viz-seg" role="group" aria-label="Zobrazení">' + MODES.map(function (m) {
          return '<button type="button" data-click="vizMode" data-i="' + i + '" data-m="' + m[0] + '" class="' + (m[0] === mode ? 'on' : '') + '" aria-pressed="' + (m[0] === mode) + '">' + m[1] + '</button>';
        }).join('') + '</div><div class="viz-stage' + (mode === 'cmp' ? ' cmp' : '') + '">' + stage + '</div>' +
        '<figcaption><span class="small"><b>' + esc(v.patternName) + '</b><br>' +
        '<span class="muted">' + NOTE + '</span></span>' +
        (readOnly ? '' : '<button class="btn sm ghost" data-click="vizDel" data-i="' + i + '">Smazat</button>') + '</figcaption></figure>';
    }).join('');
    if (S.busy === c.id) h += '<div class="viz-busy"><span class="spin"></span>Připravuji vizualizaci… (asi 10–20 s)</div>';
    if (S.error) h += '<div class="alert warn">' + esc(S.error) + '</div>';
    if (!readOnly) {
      if (S.server === false) h += '<p class="small muted">Vizualizace funguje jen přes lokální server (python3 prototyp/server.py).</p>';
      else if (S.server && !S.key) h += '<p class="small muted">Server nemá klíč ke Gemini (GEMINI_API_KEY nebo ~/.config/gemini/api_key).</p>';
      else if (n >= LIMIT) h += '<p class="small muted">Limit vizualizací pro tuto kalkulaci je vyčerpán (' + LIMIT + '/' + LIMIT + ').</p>';
      else {
        if (!list.length) h += '<p class="small muted">Nahrajte fotku schodů a ukážeme, jak na nich bude vybraný vinyl vypadat. Nejvýš ' + LIMIT + ' vizualizace na kalkulaci.</p>';
        h += '<label class="btn block' + (S.busy || S.server === null ? ' disabled' : '') + '">' + A.icon('plus') + 'Nahrát fotku schodů' +
          '<input type="file" class="sr" accept="image/*" aria-label="Nahrát fotku schodů" data-change="vizFile"' + (S.busy || S.server === null ? ' disabled' : '') + '></label>' +
          '<p class="small muted mt-2">Zbývá ' + (LIMIT - n) + ' z ' + LIMIT + '.</p>';
      }
    } else if (!list.length) h += '<p class="small muted">Bez vizualizace.</p>';
    return h + '</div>';
  }

  var cur = null, curRo = false;
  function draw() { var e = el(); if (e && cur) e.innerHTML = card(cur, curRo); }

  /* volá wizard po vykreslení obrazovky kalkulace */
  function mount(c, readOnly) {
    if (cur !== c) S.error = null;
    cur = c; curRo = readOnly;
    draw();
    if (S.server === null || !(c.id in S.used)) check(c);
  }

  A.on('change', 'vizFile', function (input) {
    var c = cur, file = input.files && input.files[0];
    input.value = '';
    if (!c || !file || S.busy) return;
    if (file.size > 30 * 1024 * 1024) { S.error = 'Fotka je příliš velká.'; return draw(); }
    var pat = Calc.findPattern(A.pricingOf(c), c.patternId);
    S.error = null; S.busy = c.id; draw();
    function done(msg) { S.busy = null; S.error = msg || null; draw(); }
    shrink(file, function (photo) {
      fetch('api/vizualizace', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calcId: c.id, photo: photo, pattern: { name: pat.name, photo: pat.photo || '' }, stair: stairInfo(c) }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.d.used != null) S.used[c.id] = res.d.used;
          if (!res.ok) return done(res.d.error || 'Vizualizace se nepodařila.');
          c.visuals = (c.visuals || []).concat([{ url: res.d.url, original: res.d.original, patternId: c.patternId, patternName: pat.name, createdAt: Date.now() }]);
          c.visualsUsed = res.d.used;
          c.updatedAt = Date.now(); Store.upsertCalc(c);
          done();
        })
        .catch(function () { done('Server neodpovídá. Běží python3 prototyp/server.py?'); });
    }, done);
  });

  A.on('click', 'vizMode', function (b) { S.mode[+b.dataset.i] = b.dataset.m; draw(); });
  A.on('input', 'vizSlide', function (el) { // bez překreslení, jen posun hranice
    var i = +el.dataset.i, v = +el.value, st = el.closest('.viz-stage');
    S.cut[i] = v; st.querySelector('.viz-after').style.clipPath = 'inset(0 0 0 ' + v + '%)'; st.querySelector('.viz-line').style.left = v + '%';
  });
  /* přes celou obrazovku: u každé vizualizace výsledek, původní fotka a porovnání; šipkami mezi nimi */
  function lbItems(c) {
    var out = [];
    (c.visuals || []).forEach(function (v) {
      out.push({ src: v.url, caption: 'Vizualizace – ' + v.patternName, k: 'po' }, { src: v.original, caption: 'Původní fotka', k: 'pred' },
        { before: v.original, after: v.url, caption: 'Porovnání – ' + v.patternName, k: 'cmp' });
    });
    return out;
  }
  A.on('click', 'vizZoom', function (b) {
    var c = cur, i = +b.dataset.i; if (!c || !(c.visuals || [])[i]) return;
    var k = b.dataset.k || S.mode[i] || 'po', items = lbItems(c);
    A.lightbox(items, i * 3 + ({ po: 0, pred: 1, cmp: 2 }[k] || 0));
  });
  A.on('click', 'vizDel', function (b) {
    var c = cur, i = +b.dataset.i;
    if (!c || !c.visuals || !c.visuals[i]) return;
    A.confirmDlg('Smazat vizualizaci?', 'Smazáním se limit nevrací (' + used(c) + '/' + LIMIT + ' použito).', 'Smazat', function () {
      c.visuals.splice(i, 1); S.mode = {}; S.cut = {}; c.updatedAt = Date.now(); Store.upsertCalc(c); draw();
    }, true);
  });

  /* sekce do PDF náhledu: poslední vizualizace */
  function pdf(c) {
    var v = (c.visuals || [])[(c.visuals || []).length - 1];
    if (!v) return '';
    return '<div class="pdf-viz"><h3>Vizualizace</h3><img src="' + esc(v.url) + '" alt="Vizualizace schodů"><p class="small muted">' +
      esc(v.patternName) + ' · ' + NOTE + '</p></div>';
  }

  return { mount: mount, pdf: pdf, card: card, LIMIT: LIMIT };
})();
