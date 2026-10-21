/* Compliances calendar · v5: view pill Month · Year · Timeline.
   Year = 12 mini months with coloured dots and counts. Timeline = Gantt-like strip of filing windows,
   edited inline (drag / resize) with the same zoomable ruler as the Home timeline editor.
   Uses the page's own data and helpers (OCT, FIL, AREAS, ST, status, monthGrid, fmt, TODAY). */
(function () {
  var DAY = 864e5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function iso(d) { return d.toISOString().slice(0, 10); }
  function D(s) { return new Date(s + 'T00:00:00Z'); }
  function toast(m, u, cb) { if (window.vcfoToast) window.vcfoToast(m, u, cb); }
  var STC = { ok: 'var(--ok)', due: 'var(--due)', over: 'var(--over)', up: 'var(--navy)' };

  /* ---------- a full FY of deadlines: October is the page's real data, the rest follows the statutory pattern ---------- */
  var YEAR = (function () {
    var out = [], id = 0;
    function add(y, m, d, area, name, freq, auth, period) {
      var due = new Date(Date.UTC(y, m, Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())));
      var s = iso(due); if (s.slice(0, 7) === '2026-10') return;            // October comes from OCT
      var past = s < TODAY;
      out.push({ id: 'y' + (id++), due: s, area: area, name: name, period: period || MON[(m + 11) % 12] + ' ' + (m === 0 ? y - 1 : y), filed: past ? iso(new Date(due - 2 * DAY)) : null, freq: freq, auth: auth });
    }
    for (var k = 0; k < 12; k++) {
      var m = (3 + k) % 12, y = 2026 + (3 + k >= 12 ? 1 : 0);
      add(y, m, 7, 'IT', 'TDS/TCS challan', 'Monthly', 'Income Tax Dept');
      add(y, m, 10, 'PAY', 'Professional tax payment', 'Monthly', 'State PT Dept');
      add(y, m, 11, 'GST', 'GSTR-1', 'Monthly', 'GSTN');
      add(y, m, 15, 'PAY', 'PF & ESI payment', 'Monthly', 'EPFO · ESIC');
      add(y, m, 20, 'GST', 'GSTR-3B', 'Monthly', 'GSTN');
      add(y, m, 30, 'FEMA', 'Softex filing', 'Monthly', 'STPI');
    }
    [[2026, 5, 15, 'IT', 'Advance tax Q1', 'Quarterly'], [2026, 8, 15, 'IT', 'Advance tax Q2', 'Quarterly'], [2026, 11, 15, 'IT', 'Advance tax Q3', 'Quarterly'], [2027, 2, 15, 'IT', 'Advance tax Q4', 'Quarterly'],
     [2026, 6, 31, 'IT', 'TDS return Q1', 'Quarterly'], [2027, 0, 31, 'IT', 'TDS return Q3', 'Quarterly'],
     [2026, 3, 30, 'MCA', 'MSME-1', 'Half-yearly'], [2026, 5, 30, 'MCA', 'DPT-3', 'Annual'], [2026, 6, 15, 'FEMA', 'FLA return', 'Annual'],
     [2026, 8, 30, 'MCA', 'DIR-3 KYC', 'Annual'], [2026, 10, 28, 'MCA', 'MGT-7 (annual return)', 'Annual'], [2027, 0, 7, 'FEMA', 'ECB-2 return', 'Quarterly'], [2026, 3, 25, 'GST', 'ITC-04', 'Half-yearly']
    ].forEach(function (r) { add(r[0], r[1], r[2], r[3], r[4], r[5], r[3] === 'MCA' ? 'MCA' : r[3] === 'FEMA' ? 'RBI' : r[3] === 'GST' ? 'GSTN' : 'Income Tax Dept', r[4].indexOf('Q') > 0 ? 'FY 2026-27' : 'FY 2025-26'); });
    return out.concat(OCT).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
  })();
  function rowsFor(area) { return YEAR.filter(function (r) { return area === 'all' || r.area === area; }); }
  function worstOf(list) { var o = ['over', 'due', 'up', 'ok']; for (var i = 0; i < o.length; i++) if (list.some(function (r) { return status(r) === o[i]; })) return o[i]; return ''; }

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.yv{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,196px),1fr));gap:12px}',
    '.ym{border:1px solid var(--border);border-radius:10px;padding:10px 10px 8px;background:var(--panel);cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;text-align:left;font:inherit;color:inherit}',
    '.ym:hover{border-color:oklch(54.6% 0.215 263 / .45);box-shadow:0 8px 20px -12px oklch(28% 0.08 264 / .35);transform:translateY(-1px)}',
    '.ym.now{box-shadow:inset 0 0 0 2px var(--navy)}',
    '.ym-h{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
    '.ym-h b{font:700 12.5px Manrope;color:var(--navy);flex:1}',
    '.ym-h .n{font:600 11px "IBM Plex Mono",monospace;color:var(--muted)}',
    '.ym-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}',
    '.ym-g span{height:20px;display:grid;place-items:center;font:500 11px "IBM Plex Mono",monospace;letter-spacing:-.03em;color:var(--subtle);border-radius:4px;min-width:0}',
    '.ym-g span.f{color:#fff;font-weight:700}',
    '.ym-g span.t{box-shadow:inset 0 0 0 1.5px var(--navy);color:var(--navy);font-weight:700}',
    '.ym-s{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:7px;font:600 11px Manrope;color:var(--muted)}',
    '.ym-s i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px;vertical-align:0}',
    /* timeline */
    '.tlv{display:flex;flex-direction:column;gap:10px}',
    '.tlv-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.tlv-tools .hint{font-size:11.5px;color:var(--muted);flex:1 1 200px;min-width:0}',
    '.tlv-z{display:inline-flex;align-items:center;gap:6px;padding:3px;border-radius:8px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)}',
    '.tlv-z button{width:28px;height:28px;border:0;border-radius:6px;background:#fff;color:var(--navy);font:800 15px/1 Manrope;cursor:pointer;box-shadow:0 1px 2px rgba(15,42,74,.12)}',
    '.tlv-z button:disabled{opacity:.4;cursor:default}',
    '.tlv-z button.fit{width:auto;padding:0 9px;font-size:11.5px}',
    '.tlv-z input{width:clamp(70px,10vw,110px);accent-color:#0f2a4a}',
    '.tlv-z .lv{min-width:50px;text-align:center;font:700 11px Manrope;color:var(--muted)}',
    '.tlv-g{display:grid;grid-template-columns:clamp(110px,14vw,150px) minmax(0,1fr);user-select:none;-webkit-user-select:none;border:1px solid var(--border);border-radius:8px;overflow:hidden}',
    '.tlv-n>div{height:30px;display:flex;align-items:center;padding:0 10px;font:600 12px Manrope;border-top:1px solid var(--hair);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tlv-n>div.ar{height:24px;font:800 11px Manrope;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);background:var(--raised)}',
    '.tlv-n>.sp{height:40px;border-top:0}',
    '.tlv-vp{position:relative;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x;cursor:grab;border-left:1px solid var(--border)}',
    '.tlv-vp::-webkit-scrollbar{display:none}',
    '.tlv-vp.pan{cursor:grabbing}',
    '.tlv-w{position:relative}',
    '.tlv-r{position:relative;height:40px;border-bottom:1px solid var(--border);background:var(--panel)}',
    '.tlv-r .mo{position:absolute;top:4px;padding-left:6px;border-left:1px solid var(--border);font:800 11px Manrope;color:var(--navy);white-space:nowrap;height:14px;line-height:14px}',
    '.tlv-r .tk{position:absolute;bottom:4px;transform:translateX(-50%);font:600 11px "IBM Plex Mono",monospace;color:var(--subtle);white-space:nowrap}',
    '.tlv-l{position:relative;height:30px;border-top:1px solid var(--hair)}',
    '.tlv-l.ar{height:24px;background:var(--raised)}',
    '.tlv-b{position:absolute;top:7px;height:16px;border-radius:4px;cursor:grab;touch-action:none;box-shadow:0 1px 3px -1px rgba(8,20,40,.35);outline:none;transition:box-shadow .15s}',
    '.tlv-b.drag{cursor:grabbing;box-shadow:0 0 0 3px rgba(201,162,75,.55),0 8px 16px -6px rgba(8,20,40,.45);z-index:3}',
    '.tlv-b:focus-visible{box-shadow:0 0 0 3px rgba(84,112,255,.55)}',
    '.tlv-b.late{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.35) 0 4px,transparent 4px 8px)!important}',
    '.tlv-b.lock{cursor:default;opacity:.75}',
    '.tlv-b .hd{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize}',
    '.tlv-b .hd.l{left:-2px}.tlv-b .hd.r{right:-2px}',
    '.tlv-d{position:absolute;top:9px;width:11px;height:11px;margin-left:-5.5px;transform:rotate(45deg);border-radius:2px;background:var(--navy);box-shadow:0 0 0 2px #fff;pointer-events:none;z-index:2}',
    '.tlv-today{position:absolute;top:40px;bottom:0;width:2px;margin-left:-1px;background:#d64545;pointer-events:none;z-index:4}',
    '.tlv-today:after{content:"Today";position:absolute;top:2px;left:4px;font:800 11px Manrope;color:#fff;background:#d64545;padding:1px 5px;border-radius:3px}',
    '.tlv-read{position:fixed;z-index:2147483002;pointer-events:none;background:var(--navy);color:#fff;font:700 11.5px Manrope;padding:4px 8px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-130%)}',
    '@media (prefers-reduced-motion: reduce){.ym{transition:none}}',
    /* comp-route.js sets inline display:none on every body child; the shared hover tooltip (.tipb) is one of them, so keep it on */
    'body>.tipb{display:block!important}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- Year ---------- */
  function yearView(area) {
    var rows = rowsFor(area), h = '<div class="yv">';
    for (var k = 0; k < 12; k++) {
      var m = (3 + k) % 12, y = 2026 + (3 + k >= 12 ? 1 : 0), key = y + '-' + String(m + 1).padStart(2, '0');
      var mr = rows.filter(function (r) { return r.due.slice(0, 7) === key; });
      var c = { ok: 0, due: 0, over: 0, up: 0 }; mr.forEach(function (r) { c[status(r)]++; });
      var first = new Date(Date.UTC(y, m, 1)), start = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      var g = ''; for (var i = 0; i < start; i++) g += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var di = key + '-' + String(d).padStart(2, '0'), it = mr.filter(function (r) { return r.due === di; }), w = it.length ? worstOf(it) : '';
        g += '<span class="' + (w ? 'f' : '') + (di === TODAY ? ' t' : '') + '"' + (w ? ' style="background:' + STC[w] + '" data-tip="' + fmt(di, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + it.map(function (r) { return r.name; }).slice(0, 3).join(', ') + (it.length > 3 ? ' +' + (it.length - 3) : '') + '"' : '') + '>' + d + '</span>';
      }
      var sum = ['over', 'due', 'ok', 'up'].filter(function (s) { return c[s]; }).map(function (s) { return '<span><i style="background:' + STC[s] + '"></i>' + c[s] + '</span>'; }).join('');
      h += '<button type="button" class="ym' + (key === TODAY.slice(0, 7) ? ' now' : '') + '" data-month="' + key + '" aria-label="' + MON[m] + ' ' + y + ' · ' + mr.length + ' filings · open the month"><div class="ym-h"><b>' + MON[m] + ' ' + y + '</b><span class="n">' + mr.length + '</span></div><div class="ym-g">' + g + '</div><div class="ym-s">' + (sum || '<span>Nothing due</span>') + '</div></button>';
    }
    return h + '</div>';
  }

  /* ---------- Timeline (editable, zoomable) ---------- */
  var W0 = Date.UTC(2026, 8, 1), W1 = Date.UTC(2027, 2, 31), NDAYS = Math.round((W1 - W0) / DAY), ZMAX = 40;
  var PREP = { Monthly: 5, Quarterly: 10, 'Half-yearly': 10, Annual: 21 };
  function dayN(s) { return Math.round((D(s) - W0) / DAY); }
  function nStr(n) { var d = new Date(W0 + n * DAY); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function saved() { try { return JSON.parse(sessionStorage.getItem('vcfo.calwin')) || {}; } catch (e) { return {}; } }
  function store(o) { try { sessionStorage.setItem('vcfo.calwin', JSON.stringify(o)); } catch (e) {} }
  function timelineView(host, area) {
    var rows = rowsFor(area).filter(function (r) { return r.due >= '2026-09-01' && r.due <= '2027-03-31'; });
    var AREA_ORDER = ['MCA', 'GST', 'IT', 'PAY', 'FEMA'], names = {}, lanes = [];
    AREA_ORDER.forEach(function (a) {
      var inA = rows.filter(function (r) { return r.area === a; }); if (!inA.length) return;
      lanes.push({ ar: a });
      inA.forEach(function (r) { var k = a + '|' + r.name; if (!names[k]) { names[k] = { name: r.name, items: [] }; lanes.push(names[k]); } names[k].items.push(r); });
    });
    var W = saved(), hist = [], ppd = 0, zoomed = false;
    host.innerHTML = '<div class="tlv"><div class="tlv-tools"><button type="button" class="btn btn-o btn-s" data-tl="undo" disabled>↶ Undo</button><span class="hint" data-tl="hint"></span>' +
      '<span class="tlv-z" role="group" aria-label="Zoom the timeline"><button type="button" data-tl="out" aria-label="Zoom out">−</button><input type="range" min="0" max="1000" data-tl="z" aria-label="Zoom level"><button type="button" data-tl="in" aria-label="Zoom in">+</button><span class="lv" data-tl="lv"></span><button type="button" class="fit" data-tl="fit">Fit</button></span></div>' +
      '<div class="tlv-g"><div class="tlv-n"><div class="sp"></div>' + lanes.map(function (l) { return l.ar ? '<div class="ar">' + (AREAS.find(function (a) { return a.id === l.ar; }) || {}).label + '</div>' : '<div title="">' + l.name + '</div>'; }).join('') + '</div>' +
      '<div class="tlv-vp"><div class="tlv-w"><div class="tlv-r"></div>' + lanes.map(function (l, li) { return '<div class="tlv-l' + (l.ar ? ' ar' : '') + '" data-li="' + li + '"></div>'; }).join('') + '<span class="tlv-today"></span></div></div></div></div>';
    var vp = host.querySelector('.tlv-vp'), world = host.querySelector('.tlv-w');
    function minP() { return vp.clientWidth / NDAYS; }
    function fitP() { return Math.max(minP(), Math.min(ZMAX, vp.clientWidth / 61)); }
    function X(n) { return n * ppd; }
    function snap() { return ppd < 7 ? 7 : 1; }
    function lv() { return ppd >= 20 ? 'Days' : ppd >= 7 ? 'Weeks' : 'Months'; }
    function win(r) { var w = W[r.id], due = dayN(r.due), p = PREP[r.freq] || 5; return w ? { s: w[0], e: w[1], due: due } : { s: due - p, e: due, due: due }; }
    function paint() {
      world.style.width = X(NDAYS) + 'px';
      var R = '', level = lv();
      for (var n = 0; n <= NDAYS; n++) {
        var d = new Date(W0 + n * DAY);
        if (d.getUTCDate() === 1) R += '<span class="mo" style="left:' + X(n) + 'px">' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '</span>';
        if (level === 'Days') R += '<span class="tk" style="left:' + (X(n) + ppd / 2) + 'px">' + d.getUTCDate() + '</span>';
        else if (level === 'Weeks' && d.getUTCDay() === 1) R += '<span class="tk" style="left:' + X(n) + 'px">' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + '</span>';
        else if (level === 'Months' && d.getUTCDate() === 15) R += '<span class="tk" style="left:' + X(n) + 'px">15</span>';
      }
      host.querySelector('.tlv-r').innerHTML = R;
      var line = level === 'Months' ? ppd * 7 : ppd;
      lanes.forEach(function (l, li) {
        var el = world.querySelector('[data-li="' + li + '"]'); if (l.ar) { el.innerHTML = ''; return; }
        el.style.backgroundImage = 'repeating-linear-gradient(to right,transparent 0,transparent ' + (line - 1) + 'px,var(--hair) ' + (line - 1) + 'px,var(--hair) ' + line + 'px)';
        el.innerHTML = l.items.map(function (r) {
          var w = win(r), st = status(r), late = w.e > w.due && !r.filed, col = r.filed ? 'var(--ok)' : STC[st];
          var tip = r.name + ' · ' + r.period + ' · window ' + nStr(w.s) + ' – ' + nStr(w.e) + ' · due ' + nStr(w.due) + (r.filed ? ' · filed' : late ? ' · ends ' + (w.e - w.due) + ' d after the due date' : '');
          return '<span class="tlv-b' + (late ? ' late' : '') + (r.filed ? ' lock' : '') + '" role="slider" tabindex="0" data-id="' + r.id + '" aria-label="' + tip + '" data-tip="' + tip + '" style="left:' + X(w.s) + 'px;width:' + Math.max(6, X(w.e - w.s)) + 'px;background:' + col + '"><span class="hd l" data-h="l"></span><span class="hd r" data-h="r"></span></span><span class="tlv-d" style="left:' + X(w.due) + 'px;background:' + (late ? 'var(--over)' : 'var(--navy)') + '"></span>';
        }).join('');
      });
      host.querySelector('.tlv-today').style.left = X(dayN(TODAY)) + 'px';
      var z = host.querySelector('[data-tl=z]'); z.value = Math.round(Math.log(ppd / minP()) / Math.log(ZMAX / minP()) * 1000);
      host.querySelector('[data-tl=lv]').textContent = level;
      host.querySelector('[data-tl=hint]').textContent = 'Drag a filing window to move it · drag its edges to resize · snaps to ' + (snap() === 7 ? 'weeks' : 'days') + ' · ctrl + scroll or pinch to zoom';
      host.querySelector('[data-tl=in]').disabled = ppd >= ZMAX - .01; host.querySelector('[data-tl=out]').disabled = ppd <= minP() + .01;
      host.querySelector('[data-tl=undo]').disabled = !hist.length;
    }
    function zoomTo(np, ax, anchorDay) {
      np = Math.max(minP(), Math.min(ZMAX, np)); ax = ax == null ? vp.clientWidth / 2 : ax;
      var dayAt = anchorDay != null ? anchorDay : (vp.scrollLeft + ax) / ppd;
      ppd = np; zoomed = true; paint(); vp.scrollLeft = anchorDay != null ? X(anchorDay) - 4 : dayAt * ppd - ax;
    }
    ppd = fitP(); paint(); vp.scrollLeft = X(dayN('2026-10-01')) - 4;
    host.querySelector('[data-tl=z]').addEventListener('input', function () { zoomTo(minP() * Math.pow(ZMAX / minP(), this.value / 1000)); });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tl]'); if (!b || b.tagName === 'INPUT') return;
      var k = b.getAttribute('data-tl');
      if (k === 'in') zoomTo(ppd * 1.5); else if (k === 'out') zoomTo(ppd / 1.5); else if (k === 'fit') { var fitted = Math.abs(ppd - fitP()) < .01; zoomTo(fitP(), null, dayN('2026-10-01')); if (fitted) toast('Timeline fitted to the screen · from October'); }
      else if (k === 'undo' && hist.length) { W = hist.pop(); store(W); paint(); toast('Undone'); }
    });
    vp.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); var r = vp.getBoundingClientRect(); zoomTo(ppd * Math.exp(-e.deltaY * 0.01), e.clientX - r.left); } }, { passive: false });
    /* drag a window (move / resize), or pan / pinch the strip */
    var pts = {}, pinch = null, pan = null, drag = null, read = null;
    function readout(x, y, t) { if (!read) { read = document.createElement('div'); read.className = 'tlv-read'; document.body.appendChild(read); } read.textContent = t; read.style.left = x + 'px'; read.style.top = y + 'px'; }
    vp.addEventListener('pointerdown', function (e) {
      var bar = e.target.closest('.tlv-b');
      if (bar) {
        var r = YEAR.find(function (x) { return x.id === bar.getAttribute('data-id'); });
        if (r.filed) { toast(r.name + ' is already filed, so its window is locked'); return; }
        e.preventDefault(); e.stopPropagation(); bar.focus({ preventScroll: true });
        var h = e.target.closest('.hd'), w = win(r);
        drag = { id: r.id, r: r, mode: h ? (h.getAttribute('data-h') === 'l' ? 'start' : 'end') : 'move', x0: e.clientX, s0: w.s, e0: w.e, moved: false, sn: snap() };
        hist.push(JSON.parse(JSON.stringify(W))); vp.setPointerCapture && vp.setPointerCapture(e.pointerId); bar.classList.add('drag');
        return;
      }
      pts[e.pointerId] = e.clientX; var ids = Object.keys(pts);
      if (ids.length === 2) { var rr = vp.getBoundingClientRect(); pinch = { d: Math.abs(pts[ids[0]] - pts[ids[1]]) || 1, p: ppd, mid: (pts[ids[0]] + pts[ids[1]]) / 2 - rr.left }; pan = null; return; }
      if (e.pointerType === 'mouse' && e.button === 0) { pan = { x: e.clientX, s: vp.scrollLeft }; vp.classList.add('pan'); }
    });
    vp.addEventListener('pointermove', function (e) {
      if (drag) {
        var dd = Math.round((e.clientX - drag.x0) / ppd / drag.sn) * drag.sn; if (dd) drag.moved = true;
        var s = drag.s0, en = drag.e0;
        if (drag.mode === 'move') { s += dd; en += dd; } else if (drag.mode === 'start') s = Math.min(en - 1, s + dd); else en = Math.max(s + 1, en + dd);
        s = Math.max(0, s); en = Math.min(NDAYS, en); W[drag.id] = [s, en]; paint();
        var nb = world.querySelector('.tlv-b[data-id="' + drag.id + '"]'); nb && nb.classList.add('drag');
        var due = dayN(drag.r.due); readout(e.clientX, e.clientY, nStr(s) + ' – ' + nStr(en) + ' · ' + (en - s) + ' days' + (en > due ? ' · after the due date' : ''));
        return;
      }
      if (pts[e.pointerId] != null) pts[e.pointerId] = e.clientX;
      var ids = Object.keys(pts);
      if (pinch && ids.length === 2) { zoomTo(pinch.p * (Math.abs(pts[ids[0]] - pts[ids[1]]) || 1) / pinch.d, pinch.mid); return; }
      if (pan) vp.scrollLeft = pan.s - (e.clientX - pan.x);
    });
    function end(e) {
      if (drag) {
        var d = drag; drag = null; if (read) { read.remove(); read = null; }
        if (!d.moved) { hist.pop(); paint(); return; }
        store(W); paint(); var w = win(d.r);
        toast(d.r.name + ' window · ' + nStr(w.s) + ' – ' + nStr(w.e) + (w.e > w.due ? ' · ends after the due date' : ''), true, function () { if (hist.length) { W = hist.pop(); store(W); paint(); } });
        return;
      }
      delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (pan) { pan = null; vp.classList.remove('pan'); }
    }
    vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
    vp.addEventListener('keydown', function (e) {
      var bar = e.target.closest && e.target.closest('.tlv-b'); if (!bar || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      var r = YEAR.find(function (x) { return x.id === bar.getAttribute('data-id'); }); if (r.filed) return;
      e.preventDefault(); var w = win(r), d = (e.key === 'ArrowRight' ? 1 : -1) * snap(); hist.push(JSON.parse(JSON.stringify(W)));
      W[r.id] = e.shiftKey ? [w.s, Math.max(w.s + 1, w.e + d)] : [w.s + d, w.e + d]; store(W); paint();
      var nb = world.querySelector('.tlv-b[data-id="' + r.id + '"]'); nb && nb.focus({ preventScroll: true });
    });
    addEventListener('resize', function () { if (!host.isConnected) return; if (!zoomed) ppd = fitP(); paint(); });
  }

  /* ---------- wiring: the view pill swaps the calendar card; the area pill filters every view ---------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function monthLabel(key) { var p = key.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function stepMonth(key, k) { var p = key.split('-'), t = (+p[0]) * 12 + (+p[1] - 1) + k; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); }
  function wire() {
    [].forEach.call(document.querySelectorAll('[data-calview]'), function (pill) {
      if (pill.__wired) return; pill.__wired = true;
      /* a pill binds only to the calendar in its own .shell; a bare header option (no shell) must not drive the first calendar on the page */
      var frame = pill.closest('.shell'); if (!frame) return;
      var body = frame.querySelector('[data-calbody]'), nav = frame.querySelector('[data-calnav]');
      if (!body) return;
      var month0 = body.innerHTML, view = 0, area = 'all', month = '2026-10';
      var monthNavEl = nav && nav.querySelector('[data-calnavr]');
      var monthLbl = monthNavEl && monthNavEl.querySelector('b');
      var prevBtn = monthNavEl && monthNavEl.querySelector('[aria-label="Previous month"]');
      var nextBtn = monthNavEl && monthNavEl.querySelector('[aria-label="Next month"]');
      function render() {
        if (view === 0) body.innerHTML = (area === 'all' && month === '2026-10') ? month0 : monthGrid({ month: month, rows: rowsFor(area) });
        else if (view === 1) body.innerHTML = yearView(area);
        else timelineView(body, area);
        if (monthNavEl) monthNavEl.style.visibility = view === 0 ? '' : 'hidden';
        if (monthLbl) monthLbl.textContent = monthLabel(month);
        body.setAttribute('data-view', ['month', 'year', 'timeline'][view]);
      }
      pill.addEventListener('pick', function (e) { e.stopPropagation(); view = e.detail; render(); });
      var areaSeg = nav && nav.querySelector('.seg');
      if (areaSeg) areaSeg.addEventListener('pick', function (e) { e.stopPropagation(); area = AREAS[e.detail].id; render(); });
      /* previous / next month: +/-1 across year boundaries (Dec 2026 -> Jan 2027) */
      if (prevBtn) prevBtn.addEventListener('click', function () { month = stepMonth(month, -1); render(); });
      if (nextBtn) nextBtn.addEventListener('click', function () { month = stepMonth(month, 1); render(); });
      body.addEventListener('click', function (e) {
        var m = e.target.closest('[data-month]'); if (!m) return;
        month = m.getAttribute('data-month'); view = 0;
        var bs = pill.querySelectorAll('button'); bs[0] && bs[0].click();
      });
    });
  }
  window.vcfoCalViews = { wire: wire };
  var n = 0; (function t() { wire(); if (n++ < 20) setTimeout(t, 150); })();
})();
