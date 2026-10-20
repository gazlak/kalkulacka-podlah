/* Půdorys schodiště (pohled shora) – kreslí se jen z rozměrů skupin, bez DOM.
 * Skupina 1 je dole, první schod úplně dole, další navazují ve směru výstupu.
 * Rovný schod = obdélník šířka × hloubka. Šikmý schod = lichoběžník z hloubky vlevo a vpravo,
 * schodiště se na něm stáčí ke straně s menší hloubkou – o kolik, to vyjde z rozměrů.
 * Rovnoramenné schodiště = ramena vedle sebe, na podestě se otáčí o 180° (druhé rameno se vrací vpravo).
 * Točité schodiště (pravotočivé / levotočivé) se má otočit celkem o 90° (do L) nebo 180° (do U): co neotočí šikmé schody,
 * otočí se na podestách (po 90° nebo 180°).
 * Zatáčka ze šikmých schodů, která vyjde na 90° nebo 180°, se kreslí do pravoúhlého rohu: vnější hrana jde po stěnách. */
var Plan = (function () {
  var n0 = Calc.n0, DEG = 180 / Math.PI;
  function add(p, v, k) { return [p[0] + v[0] * k, p[1] + v[1] * k]; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function right(u) { return [u[1], -u[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }

  function expand(groups) {
    var steps = [];
    groups.forEach(function (g, gi) {
      var w = n0(g.width), dl = n0(g.depth), dr = Calc.isSkewed(g) ? n0(g.depthRight) : dl, n = Math.min(100, Math.floor(n0(g.count)));
      if (!(w > 0 && dl > 0 && dr > 0 && n > 0)) return;
      for (var k = 0; k < n; k++) steps.push({ g: gi, w: w, dl: dl, dr: dr, rh: n0(g.riserHeight) > 0 ? n0(g.riserHeight) : 17, cover: !!g.coverRiser, landing: Calc.isLanding(g), nose: Calc.hasNose(g), first: k === 0 });
    });
    return steps;
  }

  /* Šikmé schody v rohu: vnější hrana nejde obloukem, ale po stěnách – po přímce ramene, které do zatáčky vchází,
   * a po kolmicích na ni. Hrany schodů se od vnitřní strany protáhnou až ke stěně, rohový schod dostane roh navíc.
   * Jen když zatáčka vyjde na 90° nebo 180°, jinak zůstávají lichoběžníky přesně podle zadaných rozměrů. */
  function wallRun(run, sg) {
    var A = 0, w = 0;
    run.forEach(function (s) { A += Math.abs(Math.atan2(s.dr - s.dl, s.w)) * DEG; w = Math.max(w, s.w); });
    var k = Math.round(A / 90);
    if (k < 1 || k > 2 || Math.abs(A - k * 90) > 8) return;
    var iF = sg > 0 ? 0 : 1, iB = sg > 0 ? 3 : 2; // vnitřní strana: vlevo, když se stáčí doleva
    var I = [run[0].pts[iF]], O = [run[0].pts[1 - iF]];
    // zadní hrana lichoběžníku je delší než šířka schodu, vnější bod se proto bere ve vzdálenosti šířky od vnitřního
    run.forEach(function (s) {
      var p = s.pts[iB], o = s.pts[5 - iB], len = Math.hypot(o[0] - p[0], o[1] - p[1]);
      I.push(p); O.push(add(p, [(o[0] - p[0]) / len, (o[1] - p[1]) / len], s.w));
    });
    var u = run[0].u, r = right(u), n = [sg > 0 ? r : [-r[0], -r[1]], u];
    if (k === 2) n.push([-n[0][0], -n[0][1]]);
    // stěna = nejvzdálenější bod vnitřní strany + šířka schodu; první a poslední lícují s navazujícími rameny
    var c = n.map(function (v) { return Math.max.apply(null, I.map(function (p) { return dot(p, v); })) + w; });
    c[0] = dot(O[0], n[0]); c[k] = dot(O[O.length - 1], n[k]);
    var X = [], Q = [];
    I.forEach(function (p, t) {
      if (t === 0 || t === I.length - 1) { X.push(O[t]); Q.push(t ? k : 0); return; }
      var len = Math.hypot(O[t][0] - p[0], O[t][1] - p[1]), d = [(O[t][0] - p[0]) / len, (O[t][1] - p[1]) / len], best = Infinity, bq = 0;
      n.forEach(function (v, q) {
        var den = dot(v, d), tt = den > 1e-6 ? (c[q] - dot(p, v)) / den : Infinity;
        if (tt < best) { best = tt; bq = q; }
      });
      X.push(isFinite(best) && best > 0 ? add(p, d, best) : O[t]); Q.push(bq);
    });
    run.forEach(function (s, t) {
      var corners = [];
      for (var q = Q[t]; q < Q[t + 1]; q++) corners.push([n[q][0] * c[q] + n[q + 1][0] * c[q + 1], n[q][1] * c[q] + n[q + 1][1] * c[q + 1]]);
      s.pts[1 - iF] = X[t]; s.pts[5 - iB] = X[t + 1];
      s.poly = sg > 0 ? [s.pts[0], s.pts[1]].concat(corners, [s.pts[2], s.pts[3]]) : s.pts.concat(corners.reverse());
      s.back = sg > 0 ? 2 + corners.length : 2;
    });
  }
  function walls(steps) {
    for (var i = 0, j; i < steps.length; i = j + 1) {
      var sg = steps[i].sk; j = i;
      if (!sg) continue;
      while (j + 1 < steps.length && steps[j + 1].sk === sg) j++;
      wallRun(steps.slice(i, j + 1), sg);
    }
  }

  /* vrací {steps: [{pts, poly, back, g, landing, nose, first, noseLine, c}], turnDeg}; souřadnice v cm, y roste nahoru.
   * pts = [levý přední, pravý přední, pravý zadní, levý zadní], poly = celý obrys (u rohového schodu má bod navíc),
   * back = index hrany obrysu, která je zadní hranou schodu. */
  function layout(groups, stairType, side) {
    var steps = expand(groups);
    var turnTo = Calc.STAIR_TYPES.filter(function (t) { return t.id === stairType; }).concat([{ turn: 0 }])[0].turn;
    var dir = turnTo < 0 ? -1 : turnTo > 0 ? 1 : 0, target = Math.abs(turnTo); // kladný úhel = doleva
    // kolik stupňů připadá na jednu podestu
    var wedge = 0, landings = 0;
    steps.forEach(function (s) {
      if (s.landing && s.dl === s.dr) landings++;
      else wedge += Math.atan2(s.dr - s.dl, s.w) * DEG;
    });
    // rovnoramenné: dvě ramena vedle sebe, na každé podestě otočka o 180° (druhé rameno se vrací vpravo, nebo vlevo podle volby)
    var perLanding = !landings ? 0 : dir ? Math.max(0, Math.min(2, Math.round((target - wedge * dir) / landings / 90))) * 90 : 180;
    var ld = dir || (side === 'left' ? 1 : -1);

    var st = { mode: 'center', p: [0, 0], u: [0, 1] }, prev = null, turn = 0;
    steps.forEach(function (s) {
      var u = st.u, r = right(u), L, R, L2, R2;
      L = st.mode === 'center' ? add(st.p, r, -s.w / 2) : st.mode === 'left' ? st.p : add(st.p, r, -s.w);
      if (s.landing && s.dl === s.dr && perLanding) {
        // podesta s otočením: vnější hrana lícuje s ramenem, které na ni přichází
        if (prev && st.mode === 'center') L = ld < 0 ? prev.L : add(prev.R, r, -s.w);
        R = add(L, r, s.w); L2 = add(L, u, s.dl); R2 = add(R, u, s.dl);
        if (perLanding === 90) st = ld < 0 ? { mode: 'left', p: R2, u: r } : { mode: 'right', p: L2, u: [-r[0], -r[1]] };
        else st = ld < 0 ? { mode: 'left', p: R, u: [-u[0], -u[1]] } : { mode: 'right', p: L, u: [-u[0], -u[1]] };
        // čára výstupu jde po podestě ve stejné vzdálenosti od hrany, ne přes její střed
        if (prev) {
          var wIn = Math.hypot(prev.R[0] - prev.L[0], prev.R[1] - prev.L[1]), a = add(mid(prev.L, prev.R), u, s.dl / 2);
          s.way = perLanding === 180 ? [a, add(add(ld < 0 ? R : L, r, ld * wIn / 2), u, s.dl / 2)] : [a];
        }
        prev = null; turn += perLanding * ld; s.sk = 0;
      } else {
        R = add(L, r, s.w); L2 = add(L, u, s.dl); R2 = add(R, u, s.dr);
        var len = Math.hypot(R2[0] - L2[0], R2[1] - L2[1]), r2 = [(R2[0] - L2[0]) / len, (R2[1] - L2[1]) / len];
        // za šikmým schodem navazuje další na vnitřní (kratší) straně, ať se zatáčka nerozjíždí
        var u2 = [-r2[1], r2[0]];
        st = s.dl === s.dr ? { mode: 'center', p: mid(L2, R2), u: u2 } : s.dl < s.dr ? { mode: 'left', p: L2, u: u2 } : { mode: 'right', p: R2, u: u2 };
        prev = { L: L2, R: R2 }; turn += Math.atan2(s.dr - s.dl, s.w) * DEG;
        s.sk = s.dl === s.dr ? 0 : s.dl < s.dr ? 1 : -1;
      }
      s.pts = [L, R, R2, L2]; s.u = u;
      // střed podle zadané šířky – tudy vede čára výstupu, i když se vnější hrana protáhne ke stěně
      s.c = mid(mid(L, R), mid(L2, R2));
      if (!s.way) s.way = [s.c];
    });
    walls(steps);
    steps.forEach(function (s) {
      if (!s.poly) { s.poly = s.pts; s.back = 2; }
      // nos = přesah přední hrany; čárkovaně je pod ním hrana podstupnice
      if (s.nose) { var k = Math.min(3, Math.min(s.dl, s.dr) / 3); s.noseLine = [add(s.pts[0], s.u, k), add(s.pts[1], s.u, k)]; }
    });
    return { steps: steps, turnDeg: turn };
  }

  function svg(groups, stairType, side) {
    var lay = layout(groups, stairType, side), steps = lay.steps;
    if (!steps.length) return '';
    var xs = [], ys = [];
    steps.forEach(function (s) { s.poly.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var pad = 14, k = Math.min(300 / (maxX - minX), 340 / (maxY - minY), 1.6);
    var W = (maxX - minX) * k + pad * 2, H = (maxY - minY) * k + pad * 2;
    function pt(p) { return (pad + (p[0] - minX) * k).toFixed(1) + ',' + (pad + (maxY - p[1]) * k).toFixed(1); }
    var out = '<svg viewBox="0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0) + '" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" role="img" aria-label="Půdorys schodiště, pohled shora">';
    steps.forEach(function (s) {
      out += '<polygon class="pg pg' + (s.g % 4) + (s.landing ? ' pl' : '') + '" points="' + s.poly.map(pt).join(' ') + '"/>';
      if (s.noseLine) out += '<polyline class="nose" points="' + s.noseLine.map(pt).join(' ') + '"/>';
    });
    // směr výstupu: čára středy schodů, dole tečka, nahoře šipka
    var way = [mid(steps[0].pts[0], steps[0].pts[1])];
    steps.forEach(function (s) { way = way.concat(s.way); });
    var last = steps[steps.length - 1], top = mid(last.pts[2], last.pts[3]);
    way.push(mid(last.c, top));
    out += '<polyline class="way" points="' + way.map(pt).join(' ') + '"/>';
    var a = way[way.length - 2], b = way[way.length - 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, v = [(b[0] - a[0]) / d, (b[1] - a[1]) / d], n = right(v), h = 7 / k;
    out += '<polygon class="way-head" points="' + [add(b, v, h), add(add(b, n, h * .6), v, -h * .2), add(add(b, n, -h * .6), v, -h * .2)].map(pt).join(' ') + '"/>';
    out += '<circle class="way-head" r="3" cx="' + pt(way[0]).split(',')[0] + '" cy="' + pt(way[0]).split(',')[1] + '"/>';
    // číslo skupiny u jejího prvního schodu, mimo čáru výstupu
    steps.forEach(function (s) {
      if (!s.first) return;
      var e = mid(s.pts[0], s.pts[3]), p = pt([s.c[0] + (e[0] - s.c[0]) * .75, s.c[1] + (e[1] - s.c[1]) * .75]).split(',');
      out += '<text class="pnum" x="' + p[0] + '" y="' + (+p[1] + 4).toFixed(1) + '" text-anchor="middle">' + (s.g + 1) + '</text>';
    });
    return { svg: out + '</svg>', turnDeg: lay.turnDeg };
  }

  /* hotový blok s popiskem; prázdný řetězec, když rozměry nejsou vyplněné */
  function html(groups, stairType, side) {
    var r = svg(groups, stairType, side);
    if (!r) return '<p class="small muted" style="margin:0">Půdorys se nakreslí po vyplnění rozměrů.</p>';
    var t = Math.round(Math.abs(r.turnDeg)), note = 'Pohled shora · skupina 1 je dole, šipka ukazuje směr výstupu';
    if (t >= 1) note += ' · otočení ' + t + '°';
    var target = Math.abs(Calc.STAIR_TYPES.filter(function (x) { return x.id === stairType; }).concat([{ turn: 0 }])[0].turn);
    var warn = target && Math.abs(t - target) > 5
      ? '<p class="small plan-warn">Schodiště má vyjít na ' + target + '°, z rozměrů vychází ' + t + '°. Upravte hloubky šikmých schodů nebo doplňte podestu.</p>' : '';
    return r.svg + '<p class="small muted plan-note">' + note + '</p>' + warn;
  }

  /* Kreslený náhled schodiště v prostoru: stejné rozměry jako půdorys, navíc výška podstupnic.
   * Nášlapy (a obkládané podstupnice) jsou potažené obrázkem vybraného vzoru; img = URL nebo data URI, bez něj neutrální barva.
   * Pohled je rovnoběžný (bez perspektivy), plochy se kreslí odzadu dopředu. */
  var uidSeq = 0;
  function view3d(groups, stairType, side, img) {
    var lay = layout(groups, stairType, side), steps = lay.steps;
    if (!steps.length) return '';
    // pohled z boku a shora: stoupají v něm obě ramena, i to, které se vrací. Díváme se ze strany prvního ramene,
    // takže rameno po otočce je vzadu a výš a nezakrývá ho.
    var th = (lay.turnDeg > 1 ? -1 : 1) * 60 * Math.PI / 180, ph = 34 * Math.PI / 180, ct = Math.cos(th), sn = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
    var view = [sn, ct]; // směr pohledu v půdorysu
    function proj(p, z) { var xr = p[0] * ct - p[1] * sn, yr = p[0] * sn + p[1] * ct; return { x: xr, y: -(z * cp + yr * sp), d: yr * cp - z * sp }; }
    var faces = [], z = 0, uid = 'pv' + (++uidSeq), angles = {};
    steps.forEach(function (s) {
      var z0 = z, z1 = z + s.rh, P = s.poly; z = z1;
      var fr = proj(P[1], 0), fl = proj(P[0], 0), ang = Math.round(Math.atan2(fr.y - fl.y, fr.x - fl.x) * DEG / 5) * 5;
      angles[ang] = 1;
      faces.push({ q: P.map(function (p) { return proj(p, z1); }), kind: 'tread', ang: ang });
      for (var e = 0; e < P.length; e++) {
        var a = P[e], b = P[(e + 1) % P.length], nx = b[1] - a[1], ny = -(b[0] - a[0]);
        if (nx * view[0] + ny * view[1] >= 0) continue; // odvrácená strana
        var lo = e === 0 || e === s.back ? z0 : Math.max(0, z0 - s.rh); // boky tvoří schodnici, čelo a zadní hrana jen výšku stupně
        faces.push({ q: [proj(a, lo), proj(b, lo), proj(b, z1), proj(a, z1)], kind: e === 0 ? (s.cover ? 'riser' : 'bare') : 'side', ang: ang });
      }
    });
    faces.forEach(function (f) { f.d = f.q.reduce(function (t, p) { return t + p.d; }, 0) / f.q.length; });
    faces.sort(function (a, b) { return b.d - a.d; });
    var xs = [], ys = [];
    faces.forEach(function (f) { f.q.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var pad = 10, k = Math.min(320 / (maxX - minX), 250 / (maxY - minY), 1.5), W = (maxX - minX) * k + pad * 2, H = (maxY - minY) * k + pad * 2;
    function pts(q) { return q.map(function (p) { return (pad + (p.x - minX) * k).toFixed(1) + ',' + (pad + (p.y - minY) * k).toFixed(1); }).join(' '); }
    var out = '<svg viewBox="0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0) + '" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" role="img" aria-label="Náhled schodiště s vybraným vzorem">';
    if (img) {
      // vzor běží po šířce schodu, proto je pro každý směr ramene natočený zvlášť
      out += '<defs>' + Object.keys(angles).map(function (a) {
        return '<pattern id="' + uid + '_' + String(a).replace('-', 'm') + '" patternUnits="userSpaceOnUse" width="160" height="100" patternTransform="rotate(' + a + ')"><image href="' + String(img).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" width="160" height="100" preserveAspectRatio="xMidYMid slice"/></pattern>';
      }).join('') + '</defs>';
    }
    faces.forEach(function (f) {
      var tex = img && (f.kind === 'tread' || f.kind === 'riser'), p = pts(f.q);
      out += '<polygon class="v-' + f.kind + (tex ? '' : ' v-plain') + '" points="' + p + '"' + (tex ? ' fill="url(#' + uid + '_' + String(f.ang).replace('-', 'm') + ')"' : '') + '/>';
      if (tex && f.kind === 'riser') out += '<polygon class="v-shade" points="' + p + '"/>';
    });
    return out + '</svg>';
  }

  return { layout: layout, svg: svg, html: html, view3d: view3d };
})();
if (typeof module !== 'undefined') module.exports = Plan;
