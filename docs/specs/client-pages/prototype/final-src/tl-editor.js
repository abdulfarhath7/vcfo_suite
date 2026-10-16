/* Timeline editor (Home card 5): drag / resize phases with day snap, cascade to later phases,
   before/after comparison, undo, manager save or client change request. Mouse, touch and keyboard. */
(function () {
  if (window.vcfoTimeline) return;
  var DAY = 864e5, T0 = Date.UTC(2026, 8, 12), SPAN = 57;            // axis 12 Sep → 8 Nov 2026 (matches the card)
  var TODAY = Date.UTC(2026, 9, 6);
  var W0 = -42, W1 = 110;                                              // zoomable world: 1 Aug → 31 Dec 2026 (days from 12 Sep)
  var ZMAX = 48, zoom = null;                                          // px per day; null = fit 12 Sep → 8 Nov
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function d2s(n) { var d = new Date(T0 + n * DAY); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function day(dd, mm) { return Math.round((Date.UTC(2026, mm - 1, dd) - T0) / DAY); }
  var BASE = [
    { id: 'a', name: 'Phase 1 · Name Application', s: day(12, 9), e: day(24, 9), done: true, color: 'var(--ok,#1f9d7a)' },
    { id: 'b', name: 'Phase 2 · Incorporation', s: day(25, 9), e: day(20, 10), color: 'var(--navy-3,#1b4f94)' },
    { id: 'm', name: 'MCA review', s: day(20, 10), e: day(28, 10), color: 'oklch(70% .03 255)' },
    { id: 'c', name: 'COI', s: day(28, 10), e: day(28, 10), ms: true, color: 'var(--gold,#c9a24b)' }
  ];
  var store = {
    get: function (k, d) { try { var v = sessionStorage.getItem('vcfo.tl.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { sessionStorage.setItem('vcfo.tl.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function clone(a) { return JSON.parse(JSON.stringify(a)); }
  function saved() { return store.get('saved', clone(BASE)); }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function toast(m, u, cb) { if (window.vcfoToast) window.vcfoToast(m, u, cb); }

  var css = document.createElement('style');
  css.textContent = [
    '#tle-scrim{position:fixed;inset:0;z-index:2147483100;background:rgba(8,20,40,.5);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .18s}',
    '#tle-scrim.on{opacity:1}',
    '#tle{width:min(1080px,100%);max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);overflow:auto;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:12px;box-shadow:0 30px 80px -20px rgba(8,20,40,.6);font:500 13px/1.45 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));transform:translateY(10px) scale(.98);transition:transform .26s cubic-bezier(.22,1,.36,1)}',
    '#tle-scrim.on #tle{transform:none}',
    '#tle .h{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));flex-wrap:wrap}',
    '#tle .h h2{margin:0;font:800 17px Manrope;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#tle .seg{position:relative;display:inline-flex;padding:2px;border-radius:8px;background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));box-shadow:inset 0 0 0 1px #e3e8ef}',
    '#tle .seg button{position:relative;z-index:1;border:0;background:none;height:30px;padding:0 12px;border-radius:6px;font:600 12px Manrope;color:#5a6b82;cursor:pointer}',
    '#tle .seg button[aria-pressed=true]{background:#0f2a4a;color:#fff}',
    '#tle .x{margin-left:auto;width:36px;height:36px;border-radius:6px;border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#fff, oklch(13% 0 89.9));cursor:pointer;font-size:18px;color:#5a6b82}',
    '#tle .tools{display:flex;align-items:center;gap:8px;padding:12px 18px;flex-wrap:wrap}',
    '#tle .btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:6px;border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#fff, oklch(13% 0 89.9));font:700 13px Manrope;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));cursor:pointer}',
    '#tle .btn:disabled{opacity:.45;cursor:default}',
    '#tle .btn.n{background:#0f2a4a;color:#fff;border-color:#0f2a4a}',
    '#tle .hint{color:#5a6b82;font-size:12px}',
    '#tle .grid{position:relative;margin:4px 18px 0;user-select:none;-webkit-user-select:none;display:grid;grid-template-columns:170px minmax(0,1fr) 150px}',
    '#tle .col-n>div,#tle .col-d>div{height:52px;display:flex;align-items:center;border-top:1px solid light-dark(#eef1f5, oklch(23.7% 0.006 255.5))}',
    '#tle .col-n>.sp,#tle .col-d>.sp{height:44px;border-top:0}',
    '#tle .col-n .n{font:700 12.5px Manrope;gap:6px}',
    '#tle .col-d .d{display:block;font:600 11.5px "IBM Plex Mono",monospace;color:light-dark(#46546b, oklch(82.3% 0.029 260.2));text-align:right;padding:9px 0 0 10px}',
    '#tle .vp{position:relative;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x;cursor:grab;border-radius:6px;box-shadow:inset 1px 0 0 #eef1f5,inset -1px 0 0 #eef1f5}',
    '#tle .vp::-webkit-scrollbar{display:none}',
    '#tle .vp.pan{cursor:grabbing}',
    '#tle .world{position:relative}',
    '#tle .ruler{position:relative;height:44px;border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7))}',
    '#tle .ruler .mo{position:absolute;top:4px;font:800 11px Manrope;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4));white-space:nowrap;padding-left:6px;border-left:1px solid light-dark(#cdd5e0, oklch(27.2% 0.012 256.3));height:16px;line-height:16px}',
    '#tle .ruler .tk{position:absolute;bottom:4px;transform:translateX(-50%);font:600 11px "IBM Plex Mono",monospace;color:#7a889c;white-space:nowrap}',
    '#tle .ruler .tk.we{color:#b3bdca}',
    '#tle .ruler .tk:before{content:"";position:absolute;left:50%;top:-6px;width:1px;height:4px;background:light-dark(#cdd5e0, oklch(33.9% 0.018 256.3))}',
    '#tle .lanes .lane{border-top:1px solid light-dark(#eef1f5, oklch(23.7% 0.006 255.5))}',
    '#tle .row .d b{display:block;font:800 11px Manrope;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3))}',
    '#tle .row .d .chg{font:800 11px Manrope;padding:1px 5px;border-radius:4px}',
    '#tle .lane{position:relative;height:52px}',
    '#tle .zoom{display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding:3px;border-radius:8px;background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));box-shadow:inset 0 0 0 1px #e3e8ef}',
    '#tle .zoom button{width:30px;height:30px;border:0;border-radius:6px;background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4));font:800 16px/1 Manrope;cursor:pointer;box-shadow:0 1px 2px rgba(15,42,74,.12)}',
    '#tle .zoom button.fit{width:auto;padding:0 10px;font-size:12px}',
    '#tle .zoom input{width:120px;accent-color:#0f2a4a}',
    '#tle .zoom .lv{min-width:52px;text-align:center;font:700 11.5px Manrope;color:light-dark(#46546b, oklch(82.3% 0.029 260.2))}',
    '#tle .ghost{position:absolute;top:13px;height:26px;border-radius:5px;border:1.5px dashed #9aa8bb;background:transparent;pointer-events:none}',
    '#tle .bar{position:absolute;top:13px;height:26px;border-radius:5px;cursor:grab;touch-action:none;box-shadow:0 2px 6px -2px rgba(8,20,40,.35);outline:none;transition:left .18s,width .18s}',
    '#tle .bar.drag{cursor:grabbing;transition:none;box-shadow:0 0 0 3px rgba(201,162,75,.55),0 8px 18px -6px rgba(8,20,40,.45)}',
    '#tle .bar:focus-visible{box-shadow:0 0 0 3px rgba(84,112,255,.5)}',
    '#tle .bar.lock{cursor:not-allowed;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.25) 0 6px,transparent 6px 12px)}',
    '#tle .bar .hd{position:absolute;top:0;bottom:0;width:12px;cursor:ew-resize;touch-action:none}',
    '#tle .bar .hd:after{content:"";position:absolute;top:6px;bottom:6px;left:5px;width:2px;border-radius:1px;background:light-dark(rgba(255,255,255,.85), oklch(13% 0 89.9 / 0.85))}',
    '#tle .bar .hd.l{left:-2px}#tle .bar .hd.r{right:-2px}',
    '#tle .bar.ms{width:18px!important;margin-left:-9px;border-radius:3px;transform:rotate(45deg) scale(.78)}',
    '#tle .bar.ms .hd{display:none}',
    '#tle .read{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#0f2a4a;color:#fff;font:700 11.5px Manrope;padding:4px 8px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s}',
    '#tle .bar.drag .read,#tle .bar:hover .read,#tle .bar:focus .read{opacity:1}',
    '#tle .bar.ms .read{transform:translateX(-50%) rotate(-45deg)}',
    '#tle .today{position:absolute;top:44px;bottom:0;width:2px;margin-left:-1px;background:#d64545;pointer-events:none;z-index:2}',
    '#tle .today:after{content:"Today 6 Oct";position:absolute;top:3px;left:4px;font:800 11px Manrope;color:#fff;background:#d64545;padding:1px 6px;border-radius:4px;white-space:nowrap}',
    '#tle .sum{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 18px 0;padding:12px 14px;border-radius:8px;background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3))}',
    '#tle .sum .big{font:800 15px Manrope}',
    '#tle .sum .pill{font:800 12px Manrope;padding:3px 8px;border-radius:5px}',
    '#tle .late{background:light-dark(#fde8e6, oklch(25.2% 0.066 24.1));color:#b42318}#tle .early{background:light-dark(#e3f6ee, oklch(24.6% 0.064 168.7));color:#0f7a55}#tle .same{background:light-dark(#eef1f5, oklch(19.4% 0.006 255.5));color:light-dark(#46546b, oklch(82.3% 0.029 260.2))}',
    '#tle .cmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 18px 0}',
    '#tle .cmp>div{border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));border-radius:8px;padding:10px 12px}',
    '#tle .cmp h4{margin:0 0 6px;font:800 11px Manrope;letter-spacing:.07em;text-transform:uppercase;color:#7a889c}',
    '#tle .cmp li{list-style:none;display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:12.5px}',
    '#tle .cmp ul{margin:0;padding:0}',
    '#tle .client{margin:12px 18px 0}',
    '#tle .client label{display:block;font:700 12px Manrope;margin-bottom:6px}',
    '#tle .client textarea{width:100%;min-height:70px;box-sizing:border-box;border:1px solid light-dark(#d6dde7, oklch(26.2% 0.012 257.2));border-radius:8px;padding:10px 12px;font:500 13px Manrope;resize:vertical}',
    '#tle .client .err{color:#b42318;font-size:12px;margin-top:4px;display:none}',
    '#tle .f{display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:16px 18px;border-top:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));margin-top:16px;flex-wrap:wrap}',
    '#tle .f .warn{margin-right:auto;font-size:12px;color:light-dark(#46546b, oklch(82.3% 0.029 260.2));display:flex;align-items:center;gap:6px}',
    '.tle-pend{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:4px;background:light-dark(#fdecd3, oklch(25% 0.101 77.6));color:light-dark(#8a4b0f, oklch(80.8% 0.076 57.3));font:800 11px Manrope,sans-serif;border:0;cursor:pointer}',
    '@media (max-width:1023px){#tle .grid{grid-template-columns:140px minmax(0,1fr) 120px}}',
    '@media (max-width:767px){#tle .grid{grid-template-columns:96px minmax(0,1fr);margin:4px 12px 0}#tle .col-d{display:none}#tle .col-n .n{font-size:12px;line-height:1.25}#tle .h,#tle .tools,#tle .f{padding-left:12px;padding-right:12px}#tle .sum,#tle .cmp,#tle .client{margin-left:12px;margin-right:12px}#tle .zoom{margin-left:0;flex-wrap:wrap}#tle .zoom input{width:80px}#tle .cmp{grid-template-columns:1fr}#tle-scrim{padding:0;align-items:flex-end}#tle{max-width:100vw;border-radius:14px 14px 0 0;max-height:92dvh}#tle .btn{height:40px}#tle .x{width:40px;height:40px}#tle .zoom button{width:36px;height:36px}#tle .seg button{height:36px;padding:0 10px}#tle .h{row-gap:10px}#tle .h h2{flex:1}#tle .h .seg{order:3;flex:1 1 100%;flex-wrap:wrap;margin:0!important}#tle .h .seg button{flex:1 1 auto}#tle .hint{flex-basis:100%}}',
    '@media (prefers-reduced-motion: reduce){#tle,#tle-scrim,#tle .bar{transition:none}}'
  ].join('\n');
  document.head.appendChild(css);

  var st;   // { mode, ph, hist, base }
  function open(opts) {
    opts = opts || {};
    var base = saved();
    st = { mode: opts.mode || store.get('mode', 'manager'), ph: clone(base), base: clone(base), hist: [] };
    var scrim = document.createElement('div'); scrim.id = 'tle-scrim';
    scrim.innerHTML = '<div id="tle" role="dialog" aria-modal="true" aria-labelledby="tle-t">' +
      '<div class="h"><h2 id="tle-t">Edit timeline</h2><span class="seg" role="group" aria-label="Who is editing"><button type="button" data-mode="manager">Manager · direct edit</button><button type="button" data-mode="client">Client · change request</button></span><button type="button" class="x" aria-label="Close editor">×</button></div>' +
      '<div class="tools"><button type="button" class="btn" data-act="undo" aria-label="Undo last change">↶ Undo</button><button type="button" class="btn" data-act="reset">Reset</button><span class="hint" id="tle-hint"></span><span class="zoom" role="group" aria-label="Zoom the timeline"><button type="button" data-act="zout" aria-label="Zoom out">−</button><input type="range" id="tle-z" min="0" max="1000" aria-label="Zoom level"><button type="button" data-act="zin" aria-label="Zoom in">+</button><span class="lv" id="tle-lv"></span><button type="button" class="fit" data-act="fit">Fit</button></span></div>' +
      '<div class="grid" id="tle-grid"></div>' +
      '<div class="sum" id="tle-sum"></div>' +
      '<div class="cmp" id="tle-cmp"></div>' +
      '<div class="client" id="tle-client"><label for="tle-reason">Why do you need this change?</label><textarea id="tle-reason" placeholder="For example: our director is travelling until 14 Oct, so the KYC video call has to move."></textarea><div class="err" id="tle-err">Add a short reason so Northwind’s project manager can approve it.</div></div>' +
      '<div class="f"><span class="warn" id="tle-warn"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn n" data-act="save" id="tle-save">Save timeline</button></div></div>';
    document.body.appendChild(scrim);
    requestAnimationFrame(function () { scrim.classList.add('on'); });
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim) return close();
      var m = e.target.closest('[data-mode]'); if (m) { st.mode = m.getAttribute('data-mode'); store.set('mode', st.mode); paintMode(); return; }
      if (e.target.closest('.x')) return close();
      var a = e.target.closest('[data-act]'); if (!a) return;
      var k = a.getAttribute('data-act');
      if (k === 'undo') undo(); else if (k === 'reset') { push(); st.ph = clone(st.base); paint(); toast('Reset to the saved timeline'); }
      else if (k === 'cancel') close(); else if (k === 'save') commit();
      else if (k === 'zin') zoomTo(ppd * 1.5); else if (k === 'zout') zoomTo(ppd / 1.5); else if (k === 'fit') { zoomTo(fitPpd(), null, T0d()); }
    });
    document.addEventListener('keydown', esc, true);
    buildGrid(); paint(); paintMode(); wireZoom();
    setTimeout(function () { var f = scrim.querySelector('.bar:not(.lock)'); f && f.focus({ preventScroll: true }); }, 60);
  }
  function esc(e) { if (e.key === 'Escape' && document.getElementById('tle-scrim')) { e.stopPropagation(); close(); } }
  function close() {
    var s = document.getElementById('tle-scrim'); if (!s) return;
    document.removeEventListener('keydown', esc, true);
    s.classList.remove('on'); setTimeout(function () { s.remove(); }, reduce ? 0 : 180);
  }
  function push() { st.hist.push(clone(st.ph)); if (st.hist.length > 60) st.hist.shift(); }
  function undo() { if (!st.hist.length) return toast('Nothing to undo'); st.ph = st.hist.pop(); paint(); }
  function pct(n) { return (n / SPAN * 100) + '%'; }               // dashboard card (fixed 12 Sep → 8 Nov axis)
  var ppd = 12;                                                      // editor: px per day
  function X(n) { return (n - W0) * ppd; }
  function vpW() { var v = document.querySelector('#tle .vp'); return v ? v.clientWidth : 700; }
  function fitPpd() { return Math.max(minPpd(), Math.min(ZMAX, vpW() / SPAN)); }
  function minPpd() { return vpW() / (W1 - W0); }
  function T0d() { return 0; }
  function snap() { return ppd < 8 ? 7 : 1; }
  function level() { return ppd >= 22 ? 'Days' : ppd >= 8 ? 'Weeks' : 'Months'; }
  function dow(n) { return new Date(T0 + n * DAY).getUTCDay(); }

  function buildGrid() {
    var g = document.getElementById('tle-grid');
    var names = '<div class="col-n"><div class="sp"></div>', lanes = '', dates = '<div class="col-d"><div class="sp"></div>';
    st.ph.forEach(function (p, i) {
      names += '<div class="row" data-i="' + i + '"><span class="n">' + (p.done ? '<span aria-label="Done · locked">🔒</span>' : '') + p.name + '</span></div>';
      lanes += '<div class="lane row" data-i="' + i + '"><span class="ghost"></span>' +
        '<span class="bar' + (p.done ? ' lock' : '') + (p.ms ? ' ms' : '') + '" role="slider" tabindex="0" aria-label="' + p.name + '" style="background:' + p.color + '">' +
        '<span class="hd l" data-h="l" aria-hidden="true"></span><span class="hd r" data-h="r" aria-hidden="true"></span><span class="read"></span></span></div>';
      dates += '<div class="row" data-i="' + i + '"><span class="d"></span></div>';
    });
    g.innerHTML = names + '</div><div class="vp" id="tle-vp"><div class="world" id="tle-world"><div class="ruler" id="tle-ruler"></div><div class="lanes">' + lanes + '</div><span class="today"></span></div></div>' + dates + '</div>';
    [].forEach.call(g.querySelectorAll('.bar'), function (b) {
      var i = +b.closest('.row').getAttribute('data-i');
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); startDrag(e, i, b); });
      b.addEventListener('keydown', function (e) { key(e, i); });
    });
    ppd = zoom || fitPpd(); layout(); document.getElementById('tle-vp').scrollLeft = X(0) - 4;
  }
  /* ruler, grid lines, today line: everything rescales with ppd */
  function layout() {
    var w = (W1 - W0) * ppd, world = document.getElementById('tle-world'); if (!world) return;
    world.style.width = w + 'px';
    var r = '', lv = level();
    for (var n = W0; n <= W1; n++) {
      var d = new Date(T0 + n * DAY), x = X(n);
      if (d.getUTCDate() === 1 || n === W0) r += '<span class="mo" style="left:' + x + 'px">' + MON[d.getUTCMonth()] + ' 2026</span>';
      if (lv === 'Days') r += '<span class="tk' + (d.getUTCDay() % 6 === 0 ? ' we' : '') + '" style="left:' + (x + ppd / 2) + 'px">' + (ppd >= 34 ? DOW[d.getUTCDay()].slice(0, 2) + ' ' : '') + d.getUTCDate() + '</span>';
      else if (lv === 'Weeks' && d.getUTCDay() === 1) r += '<span class="tk" style="left:' + x + 'px">' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + '</span>';
      else if (lv === 'Months' && d.getUTCDay() === 1 && ppd * 7 >= 30) r += '<span class="tk we" style="left:' + x + 'px">' + d.getUTCDate() + '</span>';
    }
    document.getElementById('tle-ruler').innerHTML = r;
    var off = ((-W0) % 7 + 7) % 7, line = lv === 'Months' ? ppd * 7 : ppd;      // grid: day lines, or week lines when zoomed out
    var startShift = lv === 'Months' ? (((1 - dow(W0)) + 7) % 7) * ppd : 0;
    [].forEach.call(document.querySelectorAll('#tle .lanes .lane'), function (l) { l.style.backgroundImage = 'repeating-linear-gradient(to right,transparent 0,transparent ' + (line - 1) + 'px,#eef1f5 ' + (line - 1) + 'px,#eef1f5 ' + line + 'px)'; l.style.backgroundPosition = startShift + 'px 0'; });
    document.querySelector('#tle .today').style.left = X((TODAY - T0) / DAY) + 'px';
    var z = document.getElementById('tle-z'); if (z) z.value = Math.round(Math.log(ppd / minPpd()) / Math.log(ZMAX / minPpd()) * 1000);
    var lvEl = document.getElementById('tle-lv'); if (lvEl) lvEl.textContent = lv;
    var hint = document.getElementById('tle-hint'); if (hint) hint.textContent = 'Drag a bar to move it · drag its edges to change dates · snaps to ' + (snap() === 7 ? 'weeks' : 'days') + ' · ctrl + scroll or pinch to zoom';
    var zi = document.querySelector('#tle [data-act=zin]'), zo = document.querySelector('#tle [data-act=zout]');
    if (zi) zi.disabled = ppd >= ZMAX - .01; if (zo) zo.disabled = ppd <= minPpd() + .01;
    if (st) paint();
  }
  /* zoom keeping the date under the anchor (cursor or centre) still */
  function zoomTo(np, anchorPx, anchorDay) {
    var vp = document.getElementById('tle-vp'); if (!vp) return;
    np = Math.max(minPpd(), Math.min(ZMAX, np));
    var ax = anchorPx == null ? vp.clientWidth / 2 : anchorPx;
    var dayAt = anchorDay != null ? anchorDay : (vp.scrollLeft + ax) / ppd + W0;
    ppd = np; zoom = np; layout();
    vp.scrollLeft = anchorDay != null ? X(anchorDay) - 4 : (dayAt - W0) * ppd - ax;
  }
  function wireZoom() {
    var vp = document.getElementById('tle-vp'), z = document.getElementById('tle-z');
    z.addEventListener('input', function () { var np = minPpd() * Math.pow(ZMAX / minPpd(), z.value / 1000); zoomTo(np); });
    vp.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); var r = vp.getBoundingClientRect(); zoomTo(ppd * Math.exp(-e.deltaY * 0.01), e.clientX - r.left); }
      else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && ppd > fitPpd() + .5) { e.preventDefault(); vp.scrollLeft += e.deltaY; }
    }, { passive: false });
    /* pan with a mouse drag on empty lane space; pinch with two fingers */
    var pts = {}, pinch = null, pan = null;
    vp.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = e.clientX; var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]], r = vp.getBoundingClientRect(); pinch = { d: Math.abs(a - b) || 1, p: ppd, mid: (a + b) / 2 - r.left }; pan = null; return; }
      if (e.pointerType === 'mouse' && e.button === 0) { pan = { x: e.clientX, s: vp.scrollLeft }; vp.classList.add('pan'); vp.setPointerCapture && vp.setPointerCapture(e.pointerId); }
    });
    vp.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId] != null) pts[e.pointerId] = e.clientX;
      var ids = Object.keys(pts);
      if (pinch && ids.length === 2) { var d = Math.abs(pts[ids[0]] - pts[ids[1]]) || 1; zoomTo(pinch.p * d / pinch.d, pinch.mid); return; }
      if (pan) vp.scrollLeft = pan.s - (e.clientX - pan.x);
    });
    function end(e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (pan) { pan = null; vp.classList.remove('pan'); } }
    vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end); vp.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse') end(e); });
    addEventListener('resize', function () { if (document.getElementById('tle-vp')) { if (!zoom) ppd = fitPpd(); layout(); } });
  }
  function paint() {
    var lanes = document.querySelectorAll('#tle .lanes .lane'), ds = document.querySelectorAll('#tle .col-d .row');
    st.ph.forEach(function (p, i) {
      var r = lanes[i], b0 = st.base[i];
      var bar = r.querySelector('.bar'), gh = r.querySelector('.ghost');
      bar.style.left = X(p.s) + 'px'; bar.style.width = p.ms ? '' : Math.max(1, p.e - p.s) * ppd + 'px';
      gh.style.left = X(b0.s) + 'px'; gh.style.width = b0.ms ? '18px' : Math.max(1, b0.e - b0.s) * ppd + 'px';
      gh.style.display = (b0.s !== p.s || b0.e !== p.e) ? '' : 'none'; if (b0.ms) gh.style.marginLeft = '-9px';
      bar.querySelector('.read').textContent = p.ms ? d2s(p.s) : d2s(p.s) + ' – ' + d2s(p.e) + ' · ' + (p.e - p.s) + ' days';
      bar.setAttribute('aria-valuetext', bar.querySelector('.read').textContent);
      var dd = p.e - b0.e, chg = dd ? '<span class="chg ' + (dd > 0 ? 'late' : 'early') + '">' + (dd > 0 ? '+' : '') + dd + ' d</span>' : '';
      ds[i].querySelector('.d').innerHTML = '<b>' + (p.ms ? d2s(p.s) : d2s(p.s) + ' – ' + d2s(p.e)) + '</b>' + chg;
    });
    var coi = st.ph[3].s, coi0 = st.base[3].s, slip = coi - coi0;
    var cls = slip > 0 ? 'late' : slip < 0 ? 'early' : 'same';
    var msg = slip > 0 ? 'Slipped by ' + slip + ' day' + (slip > 1 ? 's' : '') : slip < 0 ? 'Pulled in by ' + (-slip) + ' day' + (slip < -1 ? 's' : '') : 'No change to the COI date';
    document.getElementById('tle-sum').innerHTML = '<span class="big">COI ' + d2s(coi0) + (slip ? ' → ' + d2s(coi) : '') + '</span><span class="pill ' + cls + '">' + msg + '</span>' +
      (slip > 0 ? '<span class="hint">MCA review and the COI move with Phase 2. The client is told by email and WhatsApp.</span>' : '');
    var li = function (a) { return '<ul>' + a.map(function (p) { return '<li><span>' + p.name + '</span><b>' + (p.ms ? d2s(p.s) : d2s(p.s) + ' – ' + d2s(p.e)) + '</b></li>'; }).join('') + '</ul>'; };
    document.getElementById('tle-cmp').innerHTML = '<div><h4>Before</h4>' + li(st.base) + '</div><div><h4>After</h4>' + li(st.ph) + '</div>';
    var u = document.querySelector('#tle [data-act=undo]'); if (u) u.disabled = !st.hist.length;
  }
  function paintMode() {
    [].forEach.call(document.querySelectorAll('#tle [data-mode]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === st.mode)); });
    var cl = st.mode === 'client';
    document.getElementById('tle-client').style.display = cl ? '' : 'none';
    document.getElementById('tle-save').textContent = cl ? 'Send request' : 'Save timeline';
    document.getElementById('tle-t').textContent = cl ? 'Request a timeline change' : 'Edit timeline';
    document.getElementById('tle-warn').textContent = cl ? 'Priya Raman (Project Manager) approves requests. Northwind’s dates stay as they are until then.' : 'Saving updates the dashboard for everyone on Northwind.';
  }
  /* cascade: a phase never starts before the previous one ends; later phases keep their gaps */
  function apply(i, ns, ne, mode) {
    var p = st.ph[i]; if (p.done) return;
    var minS = i ? st.ph[i - 1].e : 0;
    if (p.ms) { ns = Math.max(minS, Math.min(W1, ns)); ne = ns; }
    else { ns = Math.max(minS, ns); ne = Math.max(ns + 1, Math.min(W1, ne)); if (mode === 'move') { var w = p.e - p.s; ne = Math.min(W1, ns + w); ns = ne - w; } }
    var shift = ne - p.e; p.s = ns; p.e = ne;
    for (var j = i + 1; j < st.ph.length; j++) {
      var q = st.ph[j], prev = st.ph[j - 1];
      if (shift > 0 || q.s > prev.e) { var w2 = q.e - q.s; q.s = Math.max(prev.e, q.s + shift); q.e = Math.min(W1, q.s + w2); if (q.ms) q.e = q.s; }
      if (q.s < prev.e) { var w3 = q.e - q.s; q.s = prev.e; q.e = q.s + w3; }
    }
  }
  function startDrag(e, i, bar) {
    var p = st.ph[i];
    if (p.done) { toast('Phase 1 is done, so its dates are locked'); return; }
    e.preventDefault(); bar.focus({ preventScroll: true });
    var h = e.target.closest('.hd'), mode = h ? (h.getAttribute('data-h') === 'l' ? 'start' : 'end') : 'move';
    var x0 = e.clientX, s0 = p.s, e0 = p.e, moved = false, sn = snap();
    push(); bar.classList.add('drag'); bar.setPointerCapture && bar.setPointerCapture(e.pointerId);
    function mv(ev) {
      var dd = Math.round((ev.clientX - x0) / ppd / sn) * sn; if (dd) moved = true;
      if (mode === 'move') apply(i, s0 + dd, e0 + dd, 'move');
      else if (mode === 'start') apply(i, Math.min(e0 - 1, s0 + dd), e0, 'start');
      else apply(i, s0, Math.max(s0 + 1, e0 + dd), 'end');
      paint();
    }
    function up() {
      bar.classList.remove('drag'); bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
      if (!moved) st.hist.pop(); paint();
    }
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  }
  function key(e, i) {
    var k = e.key; if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
    e.preventDefault(); var p = st.ph[i]; if (p.done) return toast('Phase 1 is done, so its dates are locked');
    var d = (k === 'ArrowRight' ? 1 : -1) * snap(); push();
    if (e.shiftKey && !p.ms) apply(i, p.s, p.e + d, 'end'); else apply(i, p.s + d, p.e + d, 'move');
    paint();
  }
  function commit() {
    var changed = JSON.stringify(st.ph) !== JSON.stringify(st.base);
    if (!changed) { toast('No changes to save'); return; }
    var slip = st.ph[3].s - st.base[3].s;
    if (st.mode === 'client') {
      var r = document.getElementById('tle-reason');
      if (!r.value.trim()) { document.getElementById('tle-err').style.display = 'block'; r.focus(); return; }
      store.set('pending', { ph: st.ph, reason: r.value.trim(), slip: slip });
      close(); syncCard();
      toast('Change request sent to Priya Raman', true, function () { store.set('pending', null); syncCard(); });
      return;
    }
    var prev = saved(); store.set('saved', st.ph); store.set('pending', null);
    close(); syncCard(true);
    toast('Timeline saved · COI ' + d2s(st.ph[3].s) + (slip ? (slip > 0 ? ' · slipped by ' + slip + ' d' : ' · pulled in by ' + (-slip) + ' d') : ''), true, function () { store.set('saved', prev); syncCard(true); });
  }

  /* ---------- the dashboard card: bars, labels, pending chip ---------- */
  function card() {
    var h = [].find.call(document.querySelectorAll('h3,h2'), function (x) { return /^\s*Timeline\s*$/i.test(x.textContent) && x.closest('section,.card'); });
    return h && h.closest('section,.card');
  }
  function syncCard(anim) {
    var c = card(); if (!c) return;
    var ph = saved(), pend = store.get('pending', null);
    [['Phase 1', 0], ['Phase 2', 1], ['MCA review', 2], ['COI', 3]].forEach(function (m) {
      var bar = c.querySelector('[aria-label="' + m[0] + '"]'); if (!bar) return;
      var p = ph[m[1]]; if (anim && !reduce) bar.style.transition = 'left .5s cubic-bezier(.22,1,.36,1), width .5s cubic-bezier(.22,1,.36,1)';
      bar.style.left = pct(p.s); bar.style.width = p.ms ? '1.76%' : pct(p.e - p.s);
      var tt = bar.querySelector('.tt'); if (tt) tt.textContent = p.ms ? 'COI · expected ' + d2s(p.s) : p.name + ' · ' + d2s(p.s) + ' – ' + d2s(p.e);
      var lab = bar.nextElementSibling;
      if (lab) { lab.style.left = 'calc(' + pct(p.e) + ' + 8px)'; if (m[1] === 3) lab.textContent = d2s(p.s); }
    });
    var head = c.firstElementChild, old = c.querySelector('.tle-pend'); if (old) old.remove();
    if (pend) {
      var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'tle-pend';
      chip.textContent = 'Change request pending · COI ' + d2s(pend.ph[3].s);
      chip.setAttribute('aria-label', 'Change request pending, waiting for Priya Raman');
      chip.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toast('Waiting for Priya Raman to approve · “' + pend.reason.slice(0, 60) + '”'); });
      var edit = [].find.call(head.querySelectorAll('a,button'), function (b) { return /^\s*Edit\s*$/.test(b.textContent); });
      (edit ? edit.parentNode : head).insertBefore(chip, edit || null);
    }
    var pop = c.querySelector('.pop'); if (pop && anim && pop.firstChild && pop.firstChild.nodeType === 3) pop.firstChild.textContent = 'Last changed by Northwind just now';
  }
  window.vcfoTimeline = { open: open, sync: syncCard };
  var tries = 0; (function t() { if (card()) syncCard(); else if (tries++ < 40) setTimeout(t, 150); })();
})();
