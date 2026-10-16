/* VCFO Suite prototype glue: routing between screens, the floating Prototype control,
   sidebar/top-bar navigation, icon tooltips (rule 17) and a feedback fallback so no control is dead. */
(function () {
  if (window.__vcfoProto) return; window.__vcfoProto = true;

  /* ---------- theme: light, dark (True black) or follow the system; remembered across pages ---------- */
  (function () {
    var KEY = 'vcfo.theme', mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    function saved() { try { var v = JSON.parse(localStorage.getItem(KEY)); return v === 'dark' || v === 'system' ? v : 'light'; } catch (e) { return 'light'; } }
    function resolved() { var m = saved(); return m === 'system' ? (mq && mq.matches ? 'dark' : 'light') : m; }
    function apply() {
      var t = resolved(), r = document.documentElement;
      r.setAttribute('data-theme', t); r.style.colorScheme = t;
      [].forEach.call(document.querySelectorAll('button[aria-label],a[aria-label],[role="button"][aria-label]'), function (b) {
        if (!/theme/i.test(b.getAttribute('aria-label'))) return;
        var lab = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
        b.setAttribute('aria-label', lab); b.setAttribute('aria-pressed', String(t === 'dark'));
        if (b.hasAttribute('data-tip')) b.setAttribute('data-tip', lab);
        if (b.hasAttribute('title')) b.setAttribute('title', lab);
      });
    }
    window.vcfoSetTheme = function (m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} apply(); };
    window.vcfoToggleTheme = function () { window.vcfoSetTheme(resolved() === 'dark' ? 'light' : 'dark'); };
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (saved() === 'system') apply(); });
    window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
    apply();
    document.addEventListener('DOMContentLoaded', apply);
    window.addEventListener('load', function () { apply(); setTimeout(apply, 400); });
    /* every moon / sun button in the prototype is labelled "...theme..."; one handler for all of them */
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[aria-label],a[aria-label],[role="button"][aria-label]');
      if (!b || !/theme/i.test(b.getAttribute('aria-label'))) return;
      e.preventDefault(); e.stopPropagation(); window.vcfoToggleTheme();
    }, true);
    var ds = document.createElement('style'); ds.id = 'vp-dark';
    ds.textContent = [
      'html{color-scheme:light}',
      'html[data-theme="dark"]{color-scheme:dark;' +
        '--bg:#000;--panel:oklch(13% 0.006 260);--raised:oklch(17% 0.008 260);--border:oklch(24% 0.01 260);--hair:oklch(19% 0.008 260);' +
        '--fg:oklch(92% 0.005 260);--muted:oklch(72% 0.008 260);--subtle:oklch(60% 0.01 260);' +
        '--primary:oklch(68% 0.16 255);--primary-dark:oklch(76% 0.13 255);--primary-light:oklch(22% 0.06 258);--primary-chip:oklch(50% 0.17 258);' +
        '--navy:oklch(46% 0.15 258);--navy-ink:oklch(94% 0.008 255);--navy-2:oklch(52% 0.15 258);--navy-3:oklch(56% 0.15 255);' +
        '--navy-deep:oklch(19% 0.05 258);--navy-2-deep:oklch(23% 0.07 258);--navy-3-deep:oklch(29% 0.1 255);--primary-fill:oklch(52% 0.19 258);--primary-fill-2:oklch(58% 0.18 258);' +
        '--gold:#e0bd66;--gold-2:#ecd08a;--gold-soft:oklch(25% 0.05 85);--gold-text:#e8c97d;' +
        '--ok:oklch(68% 0.14 165);--ok-light:oklch(23% 0.05 165);--ok-text:oklch(80% 0.1 165);--ok-chip:oklch(50% 0.12 165);' +
        '--due:oklch(74% 0.15 62);--due-light:oklch(25% 0.06 60);--due-text:oklch(84% 0.11 68);--due-chip:oklch(54% 0.15 45);' +
        '--over:oklch(66% 0.19 22);--over-light:oklch(23% 0.07 22);--over-text:oklch(80% 0.12 22);--over-chip:oklch(52% 0.19 22);' +
        '--prog:oklch(66% 0.15 252);--prog-light:oklch(23% 0.06 252);--prog-text:oklch(80% 0.1 252);--prog-chip:oklch(50% 0.16 252);' +
        '--up:oklch(40% 0.015 255);--up-light:oklch(18% 0.008 255);--up-text:oklch(72% 0.01 255);--up-chip:oklch(40% 0.02 258);' +
        '--violet:oklch(68% 0.15 292);--violet-light:oklch(24% 0.06 292);--violet-chip:oklch(52% 0.16 292);--violet-text:oklch(80% 0.1 292);--violet-soft:oklch(28% 0.07 292);' +
        '--sky:oklch(68% 0.11 228);--sky-light:oklch(23% 0.05 228);--sky-chip:oklch(52% 0.11 230);' +
        '--teal:oklch(66% 0.1 195);--teal-light:oklch(23% 0.05 195);--teal-chip:oklch(58% 0.09 195);' +
        '--you:oklch(70% 0.15 55);--you-light:oklch(25% 0.06 55);--you-text:oklch(84% 0.1 60);' +
        '--with:oklch(66% 0.15 262);--with-light:oklch(23% 0.06 262);--with-text:oklch(80% 0.1 262);' +
        '--own-you:oklch(26% 0.05 85);--own-you-t:#e8c97d;--own-sbc:oklch(23% 0.05 262);--own-sbc-t:oklch(80% 0.1 262);' +
        '--folder:oklch(72% 0.1 255);--folder-open:oklch(78% 0.1 255);--sk:oklch(20% 0.008 260);--cv:oklch(20% 0.008 260);' +
        '--shadow:0 0 0 1px oklch(20% 0.008 260);--pop:0 18px 44px -12px rgba(0,0,0,.9)}',
      'html[data-theme="dark"],html[data-theme="dark"] body{background:#000}',
      /* the sidebar and the page-level sidebar placeholders are hard-coded navy; True black takes them to black */
      'html[data-theme="dark"] .vps,html[data-theme="dark"] .vh-side,html[data-theme="dark"] .tb-side{background:#000!important}',
      'html[data-theme="dark"] .vps:not(.vps-mbar){box-shadow:inset -1px 0 0 oklch(20% 0.008 260)}',
      'html[data-theme="dark"] .vps .vps-i[aria-current=page]{background:oklch(17% 0.02 260)}',
      'html[data-theme="dark"] .vps.vps-icons .vps-i .vps-b{box-shadow:0 0 0 2px #000}',
      /* switch knobs stay light so on/off reads at a glance */
      'html[data-theme="dark"] .tgl::after{background:oklch(92% 0.005 260)}',
      /* document previews: a light-only island, white paper with the original ink */
      'html[data-theme="dark"] [data-paper]{color-scheme:light;background:#fff!important;color:oklch(21% 0.042 264);' +
        '--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--hair:oklch(94.8% 0.007 255);' +
        '--border:oklch(92.2% 0.011 255);--raised:oklch(96.6% 0.007 255);--panel:#fff;--navy:#0f2a4a;--navy-ink:#0f2a4a}',
      /* Credentials: per-authority colours, slate accent */
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=mca]{--a:oklch(62% 0.15 278);--a-bg:oklch(24% 0.06 278);--a-fg:oklch(84% 0.08 278)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=it]{--a:oklch(62% 0.1 200);--a-bg:oklch(23% 0.05 200);--a-fg:oklch(84% 0.07 200)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=gst]{--a:oklch(62% 0.12 155);--a-bg:oklch(23% 0.05 155);--a-fg:oklch(84% 0.08 155)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=oth]{--a:oklch(70% 0.13 72);--a-bg:oklch(25% 0.06 72);--a-fg:oklch(86% 0.09 75)}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(ds);
  })();
  var me = document.currentScript && document.currentScript.src || '';
  var ROOT = '';   // v6: one file, every path is root-relative (the shell serves them)
  function curPath() { return window.__VPATH || location.pathname; }
  function curUrl() { return curPath() + location.hash; }
  function pathOf(u) { return String(u).split('#')[0]; }
  function hashOf(u) { var i = String(u).indexOf('#'); return i < 0 ? '' : String(u).slice(i); }
  function injectScript(name, onload) { if (window.__vcfoInject) { var s = window.__vcfoInject(name); if (onload) onload(); return s; } var sc = document.createElement('script'); sc.src = resolveRoot(name); sc.onload = onload || null; document.head.appendChild(sc); return sc; }
  function resolveRoot(u) { try { if (/^https?:$/.test(location.protocol)) return new URL(u, location.origin + '/').href; } catch (e) {} return u; }   // dev server: paths are root-relative
  function vcfoNav(u) { if (window.vcfoNav) return window.vcfoNav(u); location.href = resolveRoot(u); }
  function samePage(u) { return pathOf(u).replace(/^\/+/, '') === String(curPath()).replace(/^\/+/, ''); }
  var R = window.__VCFO_ROUTES || {};          // route -> {d: desktop path, m: mobile path, t: title}
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('vcfo.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('vcfo.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function device() { var d = store.get('device', null); return d || (innerWidth < 700 ? 'mobile' : 'desktop'); }
  function pathFor(route) {
    var r = R[route]; if (!r) return null;
    if (route === 'home' && store.get('after', false)) r = R['home-after'] || r;
    return (device() === 'mobile' && r.m) ? r.m : r.d;
  }
  function here() {
    var p = curPath(), best = null;
    Object.keys(R).forEach(function (k) {
      [R[k].d, R[k].m].forEach(function (x) { if (x && p.slice(-x.split('#')[0].length) === x.split('#')[0] && (!x.split('#')[1] || location.hash === '#' + x.split('#')[1])) best = best || k; });
    });
    if (!best) Object.keys(R).forEach(function (k) { [R[k].d, R[k].m].forEach(function (x) { if (x && p.slice(-x.split('#')[0].length) === x.split('#')[0]) best = best || k; }); });
    return best;
  }
  function go(route, extra) {
    var p = pathFor(route); if (!p) { toast('“' + route + '” is not part of this prototype'); return; }
    var url = ROOT + p + (extra || '');
    if (curUrl() === url || (here() === route && !extra)) { toast('You are already on ' + ((R[route] && R[route].t) || route)); return; }
    if (pathOf(url) === curPath() && hashOf(url) !== location.hash) { location.hash = hashOf(url); return; }
    if (reduce) { vcfoNav(url); return; }
    document.documentElement.classList.add('vp-leave'); setTimeout(function () { vcfoNav(url); }, 140);
  }
  window.vcfoGo = go; window.vcfoHere = here;

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#vp-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:6px;padding:5px;border-radius:10px;background:#0f2a4a;box-shadow:0 12px 30px -10px rgba(8,20,40,.55);font:600 12px Manrope,system-ui,sans-serif;color:#fff}',
    '#vp-bar .vp-tag{padding:0 8px;color:#c9a24b;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:11px}',
    '#vp-bar .vp-seg{position:relative;display:flex;background:rgba(255,255,255,.1);border-radius:7px;padding:2px}',
    '#vp-bar .vp-seg button{position:relative;z-index:1;border:0;background:none;color:rgba(255,255,255,.75);font:600 12px Manrope,sans-serif;height:26px;padding:0 10px;border-radius:5px;cursor:pointer}',
    '#vp-bar .vp-seg button[aria-pressed=true]{background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-bar select{height:30px;border-radius:6px;border:0;background:rgba(255,255,255,.12);color:#fff;font:600 12px Manrope,sans-serif;padding:0 8px;max-width:210px}',
    '#vp-bar select option{color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-bar .vp-x{width:26px;height:26px;border:0;border-radius:6px;background:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:14px}',
    '#vp-mini{position:fixed;left:14px;bottom:14px;z-index:2147483000;border:0;border-radius:8px;background:#0f2a4a;color:#c9a24b;font:800 11px Manrope,sans-serif;letter-spacing:.08em;padding:8px 10px;cursor:pointer;box-shadow:0 8px 20px -8px rgba(8,20,40,.5)}',
    '#vp-toast{position:fixed;left:50%;bottom:64px;transform:translate(-50%,12px);opacity:0;z-index:2147483001;display:flex;align-items:center;gap:12px;max-width:min(560px,calc(100vw - 32px));padding:10px 12px 10px 14px;border-radius:8px;background:#0f2a4a;color:#fff;font:600 13px Manrope,sans-serif;box-shadow:0 18px 40px -14px rgba(8,20,40,.6);transition:opacity .18s,transform .22s cubic-bezier(.22,1,.36,1);pointer-events:none}',
    '#vp-toast.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}',
    '#vp-toast button{border:0;background:rgba(255,255,255,.14);color:#e6c46e;font:700 12px Manrope,sans-serif;height:28px;padding:0 10px;border-radius:6px;cursor:pointer}',
    '#vp-tip{position:fixed;z-index:2147483002;pointer-events:none;background:#0f2a4a;color:#fff;font:700 12px/1.3 Manrope,sans-serif;padding:5px 9px;border-radius:6px;white-space:nowrap;opacity:0;transform:translateY(3px);transition:opacity .12s,transform .12s}',
    '#vp-tip.on{opacity:1;transform:none}',
    'html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1) both}',
    'html.vp-leave body{opacity:.35;transition:opacity .14s}',
    '@keyframes vpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    'html.vp-mobile body{background:light-dark(#dfe5ee, oklch(25% 0.01 258.3))}',
    /* pop-ups always on top: drill-downs and dialogs escape their card's stacking context (rule 14 · item 14) */
    /* no visible scrollbars anywhere; scrolling still works (item 11) */
    'html,body,*{scrollbar-width:none!important}',
    '*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}',
    '.ov{position:fixed!important;inset:0!important;z-index:2147482000!important}',
    '.ddscrim{position:fixed!important;inset:0!important;z-index:2147482000!important}',
    '.dd{position:fixed!important;z-index:2147482001!important;top:max(72px,8vh)!important;max-height:calc(100vh - 110px);overflow:auto!important}',
    ':is(.card,.kpi,section,.stag>*,.sc-host,dc-import):has([style*="z-index:201"],[style*="z-index: 201"]){transform:none!important;z-index:2147481500!important;position:relative}',
    '#vp-drill-scrim{position:fixed;inset:0;z-index:2147482000;background:rgba(8,20,40,.5);display:flex;align-items:flex-start;justify-content:center;padding:max(72px,8vh) 16px 16px;opacity:0;transition:opacity .18s}',
    '#vp-drill-scrim.on{opacity:1}',
    'html.vp-mobile x-dc~div,html.vp-mobile body>div:first-of-type{margin:0 auto}',
    '@media (max-width:700px){#vp-bar{top:62px;bottom:auto;flex-wrap:wrap;justify-content:center;width:calc(100% - 20px)}#vp-bar select{max-width:none;flex:1}#vp-toast{bottom:100px}}',
    '@media (prefers-reduced-motion: reduce){html.vp-enter body{animation:none}#vp-toast,#vp-tip{transition:none}}'
  ].join('\n');
  document.head.appendChild(css);
  document.documentElement.classList.add('vp-enter');
  if (device() === 'mobile' && R[here()] && R[here()].m && curPath().indexOf(R[here()].m.split('#')[0]) >= 0) document.documentElement.classList.add('vp-mobile');

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg, undo, cb) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'vp-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = '';
    var s = document.createElement('span'); s.textContent = msg; toastEl.appendChild(s);
    if (undo) { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo'; b.onclick = function () { if (typeof cb === 'function') cb(); toast('Undone'); }; toastEl.appendChild(b); }
    toastEl.classList.add('on'); toastEl.setAttribute('data-n', String((+toastEl.getAttribute('data-n') || 0) + 1)); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 3200);
  }
  window.vcfoToast = toast;

  /* ---------- floating Prototype control ---------- */
  function buildBar() {
    if (store.get('barHidden', innerWidth < 700)) {
      var mini = document.createElement('button'); mini.id = 'vp-mini'; mini.type = 'button'; mini.textContent = 'PROTOTYPE';
      mini.onclick = function () { store.set('barHidden', false); mini.remove(); buildBar(); };
      document.body.appendChild(mini); return;
    }
    var bar = document.createElement('div'); bar.id = 'vp-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Prototype controls');
    var tag = document.createElement('span'); tag.className = 'vp-tag'; tag.textContent = 'Prototype'; bar.appendChild(tag);
    function seg(opts, cur, on) {
      var g = document.createElement('div'); g.className = 'vp-seg';
      opts.forEach(function (o) { var b = document.createElement('button'); b.type = 'button'; b.textContent = o[1]; b.setAttribute('aria-pressed', String(o[0] === cur)); b.onclick = function () { on(o[0]); }; g.appendChild(b); });
      bar.appendChild(g);
    }
    seg([[false, 'Before COI'], [true, 'After COI']], store.get('after', false), function (v) { setAfter(v); });
    seg([['desktop', 'Desktop'], ['mobile', 'Mobile 390']], device(), function (v) { store.set('device', v); var h = here() || 'home'; go(h.indexOf('home') === 0 ? 'home' : h); });
    var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Go to page');
    var cur = here();
    Object.keys(R).forEach(function (k) { if (R[k].hide) return; var o = document.createElement('option'); o.value = k; o.textContent = R[k].t || k; if (k === cur) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { go(sel.value); };
    bar.appendChild(sel);
    var x = document.createElement('button'); x.className = 'vp-x'; x.type = 'button'; x.setAttribute('aria-label', 'Hide prototype controls'); x.textContent = '×';
    x.onclick = function () { store.set('barHidden', true); bar.remove(); buildBar(); };
    bar.appendChild(x);
    document.body.appendChild(bar);
  }

  /* Before | After: one stored state (vcfo.after) shared by the bottom bar, the top-bar pill and the phone drawer */
  function syncAfter() {
    var v = !!store.get('after', false), seg = document.querySelector('#vp-bar .vp-seg');
    if (seg) [].forEach.call(seg.querySelectorAll('button'), function (b, i) { b.setAttribute('aria-pressed', String((i === 1) === v)); });
    if (window.vcfoSyncBA) window.vcfoSyncBA();
  }
  function goHome() {
    var p = pathFor('home'); if (!p) return;
    var url = ROOT + p; if (curUrl() === url) return;
    var same = samePage(url);
    var run = function () {
      if (window.vcfoNav) return window.vcfoNav(url);
      if (same) { location.hash = hashOf(url); location.reload(); return; }   // mobile.html reads #after once, at load
      location.href = resolveRoot(url);
    };
    if (reduce) return run();
    document.documentElement.classList.add('vp-leave'); setTimeout(run, 140);
  }
  function setAfter(v) {
    v = !!v; store.set('after', v); syncAfter();
    try { document.dispatchEvent(new CustomEvent('vcfo-after', { detail: v })); } catch (e) {}   // screens that are not Home re-render in place
    var h = here();
    if (!h || h.indexOf('home') === 0) goHome(); else toast(v ? 'Showing the company after incorporation' : 'Showing the company before incorporation');
  }
  window.vcfoSetAfter = setAfter;

  /* ---------- navigation map ---------- */
  var SIDE = [['Home', 'home'], ['Updates', 'notifications'], ['Incorporation', 'incorporation'], ['Compliances', 'compliances'], ['Calendar', 'compliances'], ['Filings', 'filings'], ['Documents', 'documents'], ['Library', 'knowledge-bank'], ['Knowledge Bank', 'knowledge-bank'], ['Team', 'team'], ['Audit', 'audit']];
  function label(el) { return ((el.getAttribute('aria-label') || el.getAttribute('data-tip') || el.textContent || el.title || '') + '').replace(/\s+/g, ' ').trim(); }
  function navTarget(el) {
    var t = label(el);
    var inSide = el.closest('aside, .snav, nav[aria-label="Main"]');
    if (inSide) {
      for (var i = 0; i < SIDE.length; i++) if (t.indexOf(SIDE[i][0]) === 0) return SIDE[i][1];
      if (/· Client|Account|Settings/.test(t)) return 'settings';
    }
    if (/^Announcements/.test(t)) return 'announcements';
    if (/^Notifications/.test(t)) return 'notifications';
    if (/^Open Ask VCFO|^Ask VCFO( about this| why)?$|^Ask VCFO about/.test(t)) return 'chat';
    if (/^Settings$/.test(t)) return 'settings';
    return null;
  }
  var KIND = [
    [/download/i, function (t) { return ['Download started · ' + t.replace(/^download\s*/i, ''), false]; }],
    [/zip/i, function () { return ['Preparing the ZIP…', false]; }],
    [/upload|choose file|take photo/i, function () { return ['Choose a file to upload', false]; }],
    [/copy/i, function () { return ['Link copied', false]; }],
    [/whatsapp|call |^call|email|teams/i, function (t) { return ['Opening ' + t + '…', false]; }],
    [/portal|↗/i, function (t) { return ['Opens the official portal in a new tab', false]; }],
    [/approve|submit|send|save|mark|confirm|request|remind|resend|cancel invite|hand off|turn on|turn off/i, function (t) { return [t + ' · done', true]; }],
    [/search/i, function () { return ['Search · type to find steps, filings and documents', false]; }]
  ];
  function chatQuestion(el) {
    if (!/about this/i.test(label(el))) return '';
    var box = el.closest('section,.card,[role="dialog"],.pop,article,li');
    var h = box && box.querySelector('h1,h2,h3,h4,strong,b');
    var t = h ? (h.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return t ? 'Tell me about ' + t : 'Tell me more about this';
  }
  function fallbackMsg(el) {
    var t = label(el) || 'This control';
    for (var i = 0; i < KIND.length; i++) if (KIND[i][0].test(t)) return KIND[i][1](t);
    return [t.length > 60 ? t.slice(0, 57) + '…' : t, false];
  }

  /* ---------- click handling ---------- */
  var muts = 0;
  function countMuts(l) { l.forEach(function (m) { var t = m.target.nodeType === 1 ? m.target : m.target.parentNode; if (!t || !t.closest || !t.closest('#vp-tip,#vp-toast,#vp-bar,#vp-mini,#vp-launch,#vp-chat,.vps,#vp-drawer-scrim,#vp-drill-scrim')) muts++; }); }
  var muObs = new MutationObserver(countMuts); window.vcfoQuiet = function (fn) { countMuts(muObs.takeRecords()); fn(); muObs.takeRecords(); }; muObs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  document.addEventListener('click', function (e) {
    var dg = e.target.closest && e.target.closest('[data-go]');
    /* a control inside a data-go tile (info "i", button, link, field) handles its own click: the tile does not navigate */
    var inner = dg && e.target.closest('a[href],button,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],input,select,textarea,label,summary,.info');
    if (inner && inner !== dg && dg.contains(inner)) dg = null;
    if (dg && !dg.closest('.vps') && R[dg.getAttribute('data-go')]) { e.preventDefault(); e.stopPropagation(); go(dg.getAttribute('data-go'), dg.getAttribute('data-go-hash') || ''); return; }
    var el = e.target.closest && e.target.closest('a,button,[role="button"],[role="tab"],[role="menuitem"],summary');
    if (!el || el.closest('#vp-bar,#vp-toast,#vp-mini,#vp-chat,#vp-launch,#tle-scrim,.vps,#vp-drill-scrim,.vp-ba')) return;
    var nav = navTarget(el);
    if (nav === 'chat') { e.preventDefault(); e.stopPropagation(); if (window.vcfoChat) window.vcfoChat(chatQuestion(el)); return; }
    if (/^\s*Edit\s*$/.test(el.textContent || '') && el.closest('section,.card') && /Timeline/.test((el.closest('section,.card').querySelector('h3,h2') || {}).textContent || '')) { e.preventDefault(); e.stopPropagation(); openTimeline(); return; }
    if (nav && R[nav]) { e.preventDefault(); e.stopPropagation(); go(nav); return; }
    var href = el.tagName === 'A' ? el.getAttribute('href') : null;
    if (href && !/^#/.test(href)) {
      if (/^https?:/i.test(href)) { e.preventDefault(); toast('Opens ' + (label(el) || 'the official portal') + ' in the full app'); return; }
      if (!window.__vcfoResolve) { /* plain file server (dev): normal navigation */ }
      else {
        var rk = window.__vcfoResolve(href);   // a real screen of this prototype
        if (rk) { e.preventDefault(); vcfoNav(rk.path + rk.hash); return; }
        e.preventDefault(); toast(label(el) + ' · opens in the full app'); return;
      }
    }
    if (href === '#' || href === '' ) e.preventDefault();
    var before = muts, url = curUrl();
    if (el.getAttribute('aria-selected') === 'true' && el.getAttribute('role') === 'tab') { setTimeout(function () { toast('Already showing ' + label(el).replace(/\d+$/, '').trim()); }, 120); return; }
    setTimeout(function () {
      if (muts !== before || curUrl() !== url) return;   // the screen reacted on its own
      var m = fallbackMsg(el); toast(m[0], m[1]);
    }, 380);
  }, true);

  /* ---------- rule 17: icon-only controls explain themselves ---------- */
  var tip;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('a,button,[role="button"]');
    if (!el || el.closest('#vp-bar,.vps,[data-notip]')) return hideTip();
    var txt = (el.textContent || '').trim();
    var lab = el.getAttribute('aria-label');
    if (!lab || txt.length > 2 || el.hasAttribute('data-tip') || el.querySelector('.tt') || OBVIOUS.test(lab)) return hideTip();
    if (!tip) { tip = document.createElement('div'); tip.id = 'vp-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = lab; var r = el.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (r.top - 32 < 4 ? r.bottom + 6 : r.top - 32) + 'px';
    clearTimeout(tip._t); tip._t = setTimeout(function () { tip.classList.add('on'); }, 120);
  });
  function hideTip() { if (tip) { clearTimeout(tip._t); tip.classList.remove('on'); } }
  document.addEventListener("pointerdown", hideTip, true);
  document.addEventListener('scroll', hideTip, true);


  /* ---------- Ask VCFO: one launcher + chat window, fixed bottom-right on every route ---------- */
  var CHAT_OWN = !!window.__vcfoOwnChat;
  var ccss = document.createElement('style');
  ccss.textContent = [
    /* sizes shared by the launcher and the chat; the bottom-right inset follows the page gutter (a page or the shell may set --vp-inset on :root) */
    ':root{--vpl-in:var(--vp-inset,clamp(14px,1.25vw + 8px,24px));--vpl-w:clamp(96px,4.5vw + 72px,148px);--vpk-w:clamp(96px,3vw + 72px,128px);--vpl-ph:36px;'+
      '--vp-launch-h:calc(var(--vpl-ph) + 2 * var(--vpl-in));--vp-launch-w:calc(var(--vpl-w) + 4px + 108px + var(--vpl-in));scroll-padding-bottom:var(--vp-launch-h)}',
    '@media (max-width:767px){:root{--vpl-ph:40px}}',
    /* bottom spacer: every screen can scroll its last row clear of the floating pills (Ask VCFO, PROTOTYPE). 1 px wide, so never a horizontal scroll */
    'html.vp-endpad body::after,.vp-endpad-box::after{content:"";display:block;flex:none;grid-column:1/-1;width:1px;height:var(--vp-launch-h);margin:0;padding:0;pointer-events:none}',
    'html.vp-endpad body::after{width:100%;background:var(--vp-endpad-bg,transparent)}',
    /* launcher = the owner character gripping the viewport bottom edge + an always-visible "Ask VCFO" pill in the corner */
    '#vp-launch{position:fixed;right:var(--vpl-in);bottom:0;z-index:2147482500;display:flex;align-items:flex-end;gap:4px;pointer-events:none}',
    '#vp-launch .vpl-char{position:relative;display:block;flex:none;width:var(--vpl-w);height:calc(var(--vpl-w) * 200 / 340);overflow:hidden;pointer-events:none}',
    '#vp-launch .vpl-lift{display:block;width:100%;height:calc(var(--vpl-w) * 216 / 340);transform:translate3d(0,0,0);transition:transform .5s cubic-bezier(.34,1.45,.5,1)}',
    '#vp-launch .vpl-lift>svg{display:block;width:100%;height:100%}',
    '#vp-launch .vpv-head{pointer-events:visiblePainted;cursor:pointer}',
    /* yield: the character ducks under the edge while scrolling, while the chat is open, or when it would cover a control */
    '#vp-launch.yield .vpl-lift,#vp-launch.open .vpl-lift,body.sheet-open #vp-launch .vpl-lift{transform:translate3d(0,100%,0);transition:transform .32s cubic-bezier(.5,0,.75,.4)}',
    '#vp-launch.yield .vpv-head,#vp-launch.open .vpv-head{pointer-events:none}',
    '#vp-launch .vpl-pill{pointer-events:auto;flex:none;position:relative;display:inline-flex;align-items:center;gap:7px;height:var(--vpl-ph);margin:0 0 var(--vpl-in);padding:0 14px 0 12px;border:0;border-radius:8px;background:#0f2a4a;color:#fff;font:700 13px/1 Manrope,system-ui,sans-serif;letter-spacing:0;white-space:nowrap;cursor:pointer;box-shadow:0 10px 24px -10px rgba(8,20,40,.6),inset 0 0 0 1px rgba(255,255,255,.08);-webkit-tap-highlight-color:transparent;transition:background-color .15s,transform .15s,opacity .2s,visibility .2s}',
    '#vp-launch .vpl-pill:hover{background:#17396b}#vp-launch .vpl-pill:active{transform:scale(.97)}',
    '#vp-launch .vpl-pill:focus-visible{outline:3px solid light-dark(#7DD3FC, oklch(32% 0.1 230.3));outline-offset:2px}',
    '#vp-launch .vpl-dot{flex:none;width:8px;height:8px;border-radius:50%;background:#2DD4BF;box-shadow:0 0 0 3px rgba(45,212,191,.22)}',
    '#vp-launch .vpl-c{display:none;align-items:center;gap:6px}#vp-launch .vpl-c svg{width:14px;height:14px}',
    '#vp-launch.open .vpl-t,#vp-launch.open .vpl-dot{display:none}#vp-launch.open .vpl-c{display:inline-flex}',
    'body.sheet-open #vp-launch .vpl-pill{opacity:0;visibility:hidden}',
    /* the character (inputs/visor-avatar-animated.svg): the file keyframes and 20.5 s loop, unchanged, scoped to .vpv-loop */
    '.vpv .vpv-eye{transform-box:fill-box;transform-origin:center}',
    '.vpv-loop .vpv-head{animation:vpvRise 20.5s infinite}',
    '.vpv-loop .vpv-eyes{animation:vpvLook 20.5s infinite ease-in-out}',
    '.vpv-loop .vpv-eye{animation:vpvBlink 20.5s infinite}',
    '.vpv-loop .vpv-hand{animation:vpvGrip 20.5s infinite ease-out}',
    '.vpv-loop .vpv-hand-r{animation-delay:.09s}',
    '.vpv-loop .vpv-hand{animation-fill-mode:backwards}',
    '@keyframes vpvRise{0%,2.4%{transform:translateY(232px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}14.1%,25.4%{transform:translateY(72px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}33.2%,40%{transform:translateY(44px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}48.3%,66.3%{transform:translateY(0);animation-timing-function:ease-in-out}74.6%,80%{transform:translateY(72px);animation-timing-function:cubic-bezier(.5,0,.75,.4)}89.3%,100%{transform:translateY(232px)}}',
    '@keyframes vpvLook{0%,14.1%{transform:translate(0,0)}15.5%,19.5%{transform:translate(-12px,-2px)}21%,24%{transform:translate(12px,-2px)}25.5%,50%{transform:translate(0,0)}51.5%,55%{transform:translate(-12px,3px)}56.5%,60%{transform:translate(12px,-4px)}61.5%,74.6%{transform:translate(0,0)}76%,79%{transform:translate(10px,-3px)}80.5%,100%{transform:translate(0,0)}}',
    '@keyframes vpvBlink{0%,25.6%,26.4%,34.4%,35.2%,35.8%,36.6%,63%,63.8%,100%{transform:scaleY(1)}26%,34.8%,36.2%,63.4%{transform:scaleY(.08)}}',
    '@keyframes vpvGrip{0%{opacity:0;translate:0 14px}2.4%,89.3%{opacity:1;translate:0 0}91.5%,100%{opacity:0;translate:0 16px}}',
    /* chat window: floating card above the pill (tablet/desktop), full-width bottom sheet on phones */
    '#vp-chat{position:fixed;right:var(--vpl-in);bottom:calc(var(--vpl-lift,0px) + var(--vpl-in) + var(--vpl-ph) + 14px);z-index:2147482501;box-sizing:border-box;width:clamp(340px,24vw + 40px,440px);max-width:calc(100vw - 2 * var(--vpl-in));height:min(clamp(480px,62vh,680px),calc(100dvh - var(--vpl-lift,0px) - var(--vpl-in) - var(--vpl-ph) - 26px - var(--vpk-w) * .6));min-height:min(320px,calc(100dvh - 24px));max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:12px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));box-shadow:0 24px 60px -20px rgba(8,20,40,.5);font:500 13px/1.5 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));transform-origin:100% 100%;transform:translateY(12px) scale(.96);opacity:0;visibility:hidden;transition:transform .26s cubic-bezier(.22,1,.36,1),opacity .18s,visibility .18s}',
    '#vp-chat.on{transform:none;opacity:1;visibility:visible}',
    '#vp-chat .vpc-h{position:relative;display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff;border-radius:11px 11px 0 0}',
    '#vp-chat .vpc-av{flex:0 0 auto;width:36px;height:36px;border-radius:50%;background:light-dark(#fff, oklch(13% 0 89.9));display:grid;place-items:center;overflow:hidden}#vp-chat .vpc-av svg{width:31px;height:39px;margin-top:9px}',
    '#vp-chat .vpc-h b{display:block;font:800 14px Manrope,system-ui,sans-serif}#vp-chat .vpc-h small{font-size:11.5px;color:#c7d2e2}',
    '#vp-chat .vpc-h button{margin-left:auto;flex:none;width:36px;height:36px;border-radius:6px;border:0;background:rgba(255,255,255,.12);color:#fff;font:400 22px/1 Manrope,system-ui,sans-serif;cursor:pointer}',
    '#vp-chat .vpc-ms{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 0}',
    '#vp-chat .vpc-m{margin:6px 14px;max-width:84%;padding:9px 12px;border-radius:10px;overflow-wrap:anywhere}',
    '#vp-chat .vpc-m.vpc-u{margin-left:auto;background:#0f2a4a;color:#fff;border-radius:10px 10px 2px 10px}',
    '#vp-chat .vpc-m.vpc-a{background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));border-radius:10px 10px 10px 2px}',
    '#vp-chat .vpc-m.vpc-a button{margin-top:8px;min-height:32px;padding:0 10px;border-radius:6px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));background:light-dark(#fff, oklch(13% 0 89.9));font:700 12px Manrope,system-ui,sans-serif;cursor:pointer;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-chat .vpc-ty i{display:inline-block;width:6px;height:6px;margin-right:3px;border-radius:50%;background:#7a889c;animation:vpTh 1s infinite}#vp-chat .vpc-ty i:nth-child(2){animation-delay:.2s}#vp-chat .vpc-ty i:nth-child(3){animation-delay:.4s}',
    '#vp-chat .vpc-sg{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;max-height:40%;overflow:auto}',
    '#vp-chat .vpc-sg button{min-height:32px;max-width:100%;padding:4px 10px;border-radius:6px;border:1px solid rgba(46,92,255,.35);background:light-dark(#eef2ff, oklch(18.7% 0.01 272.3));color:light-dark(#2a4fd6, oklch(80.3% 0.14 266.4));font:600 12px/1.3 Manrope,system-ui,sans-serif;text-align:left;cursor:pointer}',
    '#vp-chat form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid light-dark(#eef1f5, oklch(23.7% 0.006 255.5))}',
    '#vp-chat input{flex:1;min-width:0;height:40px;box-sizing:border-box;border-radius:8px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));padding:0 12px;font:500 14px Manrope,system-ui,sans-serif}',
    '#vp-chat form button{flex:none;height:40px;padding:0 14px;border-radius:6px;border:0;background:#0f2a4a;color:#fff;font:700 13px Manrope,system-ui,sans-serif;cursor:pointer}',
    '@keyframes vpTh{0%,100%{opacity:.3}50%{opacity:1}}',
    /* What\u2019s this? answer card (owner board vs_ask): title, explanation, why it matters, source, a way to the step */
    '#vp-chat .vpc-card{margin:6px 14px;padding:12px 14px 14px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));border-radius:10px;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 1px 2px rgba(15,27,45,.04),0 8px 20px -14px rgba(15,27,45,.25);overflow-wrap:anywhere}',
    '#vp-chat .vpc-card b.vpc-ct{display:block;font:800 14px/1.35 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));margin:0 0 6px}',
    '#vp-chat .vpc-card p{margin:0;font-size:13.5px;line-height:1.55;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3))}',
    '#vp-chat .vpc-card .vpc-why{margin-top:10px;font-size:12.5px;line-height:1.5;color:light-dark(#4a5a70, oklch(81.5% 0.029 256.4))}#vp-chat .vpc-card .vpc-why b{display:block;font:800 12px Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));margin-bottom:2px}',
    '#vp-chat .vpc-card .vpc-src{margin-top:8px;font-size:11.5px;line-height:1.45;color:#6b7a90}',
    '#vp-chat .vpc-card button{display:inline-flex;align-items:center;gap:6px;margin-top:12px;min-height:34px;max-width:100%;padding:0 12px;border-radius:6px;border:1px solid #2e5cff;background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#2a4fd6, oklch(80.3% 0.14 266.4));font:700 12.5px Manrope,system-ui,sans-serif;text-align:left;cursor:pointer}',
    '#vp-chat .vpc-card button:hover{background:light-dark(#eef2ff, oklch(18.7% 0.01 272.3))}#vp-chat .vpc-card button svg{flex:none;width:14px;height:14px}',
    /* the same character peeks over the top edge of the window once per open: hands grip the edge, head rises, a look around, then a slow blink.
       Moods only through colour and motion: antenna teal = idle, pulsing = thinking, green + hop = answered, grey + dip = cannot answer. The smile never changes. */
    '#vp-chat .vpc-pk{position:absolute;right:clamp(16px,6%,30px);bottom:100%;width:var(--vpk-w);height:calc(var(--vpk-w) * 216 / 340);margin-bottom:calc(var(--vpk-w) * -16 / 340);pointer-events:none;z-index:2}',
    '#vp-chat .vpc-pk>svg{display:block;width:100%;height:100%;overflow:visible}',
    '#vp-chat .vpv-peek .vpv-head{transform:translateY(232px)}',
    '#vp-chat .vpv-peek .vpv-hand{opacity:0}',
    '#vp-chat.on .vpv-peek .vpv-head{animation:vpvPeek .95s cubic-bezier(.3,.75,.35,1) .22s both}',
    '#vp-chat.on .vpv-peek .vpv-hand{animation:vpvGripIn .32s ease-out .08s both}#vp-chat.on .vpv-peek .vpv-hand-r{animation-delay:.17s}',
    '#vp-chat.on .vpv-peek .vpv-eyes{animation:vpvPeekLook 2.2s ease-in-out 1.25s both}',
    '#vp-chat.on .vpv-peek .vpv-eye{animation:vpvPeekBlink 6.5s 3.5s infinite}',
    '@keyframes vpvPeek{from{transform:translateY(232px)}to{transform:translateY(0)}}',
    '@keyframes vpvGripIn{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}',
    '@keyframes vpvPeekLook{0%,100%{transform:translate(0,0)}14%,38%{transform:translate(-12px,-2px)}52%,78%{transform:translate(12px,-2px)}}',
    '@keyframes vpvPeekBlink{0%,3%,6%,100%{transform:scaleY(1)}4.5%{transform:scaleY(.08)}}',
    '#vp-chat .vpv-ant{transition:fill .3s}',
    '#vp-chat.vpc-ok .vpv-ant{fill:#22C55E}#vp-chat.vpc-nan .vpv-ant{fill:#94A3B8}',
    '#vp-chat.vpc-think .vpv-ant{animation:vpvAnt 1s ease-in-out infinite}',
    '#vp-chat.vpc-ok .vpv-peek .vpv-mood{animation:vpvHop .7s cubic-bezier(.3,1.5,.5,1)}',
    '#vp-chat.vpc-nan .vpv-peek .vpv-mood{animation:vpvDip 1.2s ease-in-out}',
    '@keyframes vpvAnt{50%{opacity:.3}}',
    '@keyframes vpvHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}}',
    '@keyframes vpvDip{0%,100%{transform:translateY(0)}35%,70%{transform:translateY(14px)}}',
    '.vp-hide-bot{display:none!important}',
    /* phones: the sheet owns the bottom of the screen, so the prototype control steps aside while it is open */
    '@media (max-width:767px){html.vp-chat-on #vp-mini,html.vp-chat-on #vp-bar{visibility:hidden}}',
    '@media (max-width:767px){#vp-chat{left:0;right:0;bottom:0;width:auto;max-width:none;height:min(640px,calc(100dvh - 20px - var(--vpk-w) * .6));min-height:0;max-height:calc(100dvh - 12px);border-radius:16px 16px 0 0;border-width:1px 0 0;padding-bottom:env(safe-area-inset-bottom);transform-origin:50% 100%;transform:translateY(24px)}' +
      '#vp-chat .vpc-h{border-radius:15px 15px 0 0}#vp-chat .vpc-h button,#vp-chat .vpc-sg button,#vp-chat .vpc-m.vpc-a button,#vp-chat .vpc-card button{min-height:40px;min-width:40px}#vp-chat .vpc-h button{width:40px;height:40px}#vp-chat input{height:44px;font-size:16px}#vp-chat form button{height:44px}}',
    /* reduced motion: a static, fully visible head, no loop, no peek motion (colour still shows the mood) */
    '@media (prefers-reduced-motion: reduce){#vp-launch *,#vp-chat .vpc-ty i,#vp-chat .vpc-pk *{animation:none!important;transition:none!important}#vp-launch .vpv-head,#vp-chat .vpv-peek .vpv-head{transform:none}#vp-launch .vpv-hand,#vp-chat .vpv-peek .vpv-hand{opacity:1}#vp-chat{transition:none}}'
  ].join('\n');
  document.head.appendChild(ccss);
  var AFTER = store.get('after', false);
  var QA = AFTER ? {
    'What is due next?': 'TDS Payment · Oct 2026 is overdue by 1 day. Next are EPF and ESI on 15 Nov.',
    'Which registrations are pending?': 'Two are with SBC: PT Registration (est. 12 Nov) and IEC (est. 14 Nov).',
    'When is FC-GPR due?': '2 Dec 2026, day 6 of the 30-day window. Upload the bank FIRC + KYC letter first.'
  } : {
    'What is my next step?': 'Step 7 · Registered Office Address is waiting for Northwind. Upload the utility bill and the owner NOC by 9 Oct, then approve. Steps 8 Proposed Directors and 9 Subscriber Details are also in progress with Northwind.',
    'Where is my incorporation now?': 'Northwind is in Phase 2 · Incorporation: 1 of 9 steps done, 6 of 14 SPICe+ steps overall (43%). Step 7 is waiting for Northwind, steps 8 and 9 are in progress with Northwind, and step 10 KYC Review & DSC is with SBC. The COI is expected on 28 Oct.',
    'Which documents are missing?': 'Two, both for step 7 · Registered Office Address: the office utility bill and the NOC from the owner. Both are due 9 Oct.'
  };
  function chatLog() { try { return JSON.parse(sessionStorage.getItem('vcfo.chat') || '[]'); } catch (e) { return []; } }
  function saveLog(l) { try { sessionStorage.setItem('vcfo.chat', JSON.stringify(l)); } catch (e) {} }
  var launch, win, lastFocus;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function renderLog() {
    var box = win.querySelector('.vpc-ms'); var l = chatLog();
    box.innerHTML = '<div class="vpc-m vpc-a">Hello. Ask me anything about Northwind’s setup, or pick a question below.</div>' + l.map(function (m) {
      if (m.w) return wtCard(m.w);
      return '<div class="vpc-m ' + (m.r === 'u' ? 'vpc-u' : 'vpc-a') + '">' + esc(m.t) + (m.h ? '<br><button type="button" data-handoff>Hand off to Arjun Mehta</button>' : '') + '</div>';
    }).join('');
    box.scrollTop = 1e6;
    var lastK = l.filter(function (m) { return m.k; }).pop();
    setMood(lastK && lastK.k);
  }
  /* What's this? answers come from the screen (window.vcfoWhatsThis on the Incorporation pages) and render as the answer card */
  function whatsThis(q) { try { var w = typeof window.vcfoWhatsThis === 'function' && window.vcfoWhatsThis(q); return w && (w.title || w.text) ? { title: String(w.title || ''), text: String(w.text || ''), why: String(w.why || ''), source: String(w.source || ''), go: w.go ? String(w.go) : '' } : null; } catch (e) { return null; } }
  function wtCard(w) {
    var lbl = /^inc-step-\d+$/.test(w.go) ? 'Open this step' : 'Open ' + ((R[w.go] && R[w.go].t) || 'this page');
    return '<div class="vpc-card" role="group" aria-label="' + esc(w.title || 'Answer') + '">' + (w.title ? '<b class="vpc-ct">' + esc(w.title) + '</b>' : '') + (w.text ? '<p>' + esc(w.text) + '</p>' : '') +
      (w.why ? '<div class="vpc-why"><b>Why it matters to Northwind</b>' + esc(w.why) + '</div>' : '') + (w.source ? '<div class="vpc-src">Source: ' + esc(w.source) + '</div>' : '') +
      (w.go ? '<button type="button" data-wgo="' + esc(w.go) + '">' + esc(lbl) + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' : '') + '</div>';
  }
  /* mood = antenna colour + a small motion of the peeking character (never the mouth): ok = green + hop, nan = grey + dip */
  function setMood(k, replay) {
    win.classList.remove('vpc-think');
    if (replay) { win.classList.remove('vpc-ok', 'vpc-nan'); void win.offsetWidth; }
    win.classList.toggle('vpc-ok', k === 'ok'); win.classList.toggle('vpc-nan', k === 'nan');
  }
  /* the owner character (inputs/visor-avatar-animated.svg, smile included). Each instance gets its own gradient/filter/clip ids. */
  var VPV = 0;
  function vpvDefs(u, full) {
    return '<defs><linearGradient id="' + u + 'h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient>' +
      (full ? '<linearGradient id="' + u + 'k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"/><stop offset="1" stop-color="#2563EB"/></linearGradient><clipPath id="' + u + 'c"><rect x="0" y="0" width="340" height="200"/></clipPath>' : '') +
      '<filter id="' + u + 'g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  }
  function vpvFace(u) {
    return '<line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"/><circle class="vpv-ant" cx="120" cy="18" r="8" fill="#2DD4BF"/>' +
      '<rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"/><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"/>' +
      '<rect x="30" y="44" width="180" height="210" rx="56" fill="url(#' + u + 'h)"/><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"/><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"/>' +
      '<g class="vpv-eyes" filter="url(#' + u + 'g)" fill="#7DD3FC"><rect class="vpv-eye" x="88" y="109" width="22" height="30" rx="11"/><rect class="vpv-eye" x="130" y="109" width="22" height="30" rx="11"/>' +
      '<path class="vpv-smile" d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"/></g>' +
      '<rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"/>';
  }
  function vpvHand(u, cls, x) {
    return '<g class="' + cls + '" transform="translate(' + x + ' 178)"><rect x="2" y="4" width="46" height="22" rx="11" fill="url(#' + u + 'k)" stroke="#1D4ED8" stroke-opacity=".5"/>' +
      '<g fill="#1D4ED8"><rect x="6" y="18" width="8.5" height="17" rx="4.25"/><rect x="16" y="18" width="8.5" height="17" rx="4.25"/><rect x="26" y="18" width="8.5" height="17" rx="4.25"/><rect x="36" y="18" width="8.5" height="17" rx="4.25"/></g>' +
      '<path d="M12 10 h18" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/></g>';
  }
  /* full character: head clipped at the edge (y = 200), hands gripping it; cls picks the motion (vpv-loop = the file's 20.5 s loop, vpv-peek = one peek) */
  function charSVG(cls) {
    var u = 'vpv' + (++VPV);
    return '<svg class="vpv ' + cls + '" viewBox="0 0 340 216" aria-hidden="true" focusable="false">' + vpvDefs(u, true) +
      '<g clip-path="url(#' + u + 'c)"><g transform="translate(50 0)"><g class="vpv-head"><g class="vpv-mood">' + vpvFace(u) + '</g></g></g></g>' +
      vpvHand(u, 'vpv-hand', 4) + vpvHand(u, 'vpv-hand vpv-hand-r', 286) + '</svg>';
  }
  /* static head (no loop): chat header avatar and window.vcfoBotSVG (empty-state bots on the Incorporation pages). Same 240x302 box as v6. */
  function headSVG(u) { return '<svg class="vpv vpv-s" viewBox="0 0 240 302" aria-hidden="true" focusable="false">' + vpvDefs(u, false) + vpvFace(u) + '</svg>'; }
  var BOT = headSVG('vpvS');
  window.vcfoBotSVG = BOT;
  /* the character never covers a control: it ducks while a button/link/field sits under it, while scrolling, or while the chat is open */
  var ACT = 'a[href],button,[role=button],[role=link],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=menuitem],[role=option],input,select,textarea,summary,label,[data-go],[onclick],[contenteditable=""],[contenteditable=true]';
  function coversControl() {
    var c = launch && launch.querySelector('.vpl-char'); if (!c) return false;
    var r = c.getBoundingClientRect(); if (!r.width || !r.height) return false;
    var seen = [];
    for (var i = 0; i < 6; i++) for (var j = 0; j < 4; j++) {
      var x = r.left + r.width * (0.08 + 0.168 * i), y = r.top + r.height * (0.08 + 0.28 * j);
      var st = document.elementsFromPoint(x, y);
      for (var k = 0; k < st.length; k++) {
        var e = st[k]; if (launch.contains(e)) continue;
        var a = e.closest && e.closest(ACT); if (!a || seen.indexOf(a) >= 0) break; seen.push(a);
        var b = a.getBoundingClientRect(), ow = Math.min(b.right, r.right) - Math.max(b.left, r.left), oh = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
        if (ow > 0 && oh > 0 && (ow * oh) / Math.max(1, b.width * b.height) > 0.2) return true;
        break;
      }
    }
    return false;
  }
  /* bottom spacer, switched on only where it helps: the page already scrolls, a control sits under a floating pill,
     or an inner scroll panel ends under one. Controls inside fixed/sticky layers are left alone (a spacer cannot move them). */
  /* paint the spacer like the background right above it: from the lowest piece of content, the first edge-to-edge
     ancestor with a colour (cards have side margins, so they are skipped). Re-read for the first seconds while the screen renders. */
  var bgTicks = 0;
  function endPadBg() {
    var de = document.documentElement, b = document.body;
    var bg = '', low = null, cand = [];
    [].forEach.call(b.querySelectorAll('*'), function (k) {
      if (/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(k.tagName)) return;
      var rk = k.getBoundingClientRect(); if (rk.height && rk.width) cand.push([Math.round(rk.bottom), k, cand.length]);
    });
    cand.sort(function (x, y) { return y[0] - x[0] || y[2] - x[2]; });   /* ties: the deepest (latest) element first */
    for (var ci = 0; ci < cand.length && ci < 400 && !low; ci++) {   /* lowest in-flow, visible element (not in a fixed/absolute layer such as a sheet) */
      var k = cand[ci][1], ok = getComputedStyle(k).visibility !== 'hidden';
      for (var a = k; ok && a && a !== b; a = a.parentElement) { var pa = getComputedStyle(a).position; if (pa === 'fixed' || pa === 'absolute' || /^vp-/.test(a.id)) ok = false; }
      if (ok) low = k;
    }
    for (var n2 = low; n2 && n2 !== de; n2 = n2.parentElement) {
      var rb = n2.getBoundingClientRect(), c = getComputedStyle(n2).backgroundColor;
      if (rb.right >= innerWidth - 2 && rb.width >= innerWidth * 0.6 && c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
    }
    if (bg && de.style.getPropertyValue('--vp-endpad-bg') !== bg) de.style.setProperty('--vp-endpad-bg', bg);
  }
  var padLock = false;
  function endPad(reset) {
    var de = document.documentElement, b = document.body; if (!b || !launch) return;
    if (reset) { padLock = false; bgTicks = 0; de.classList.remove('vp-endpad'); }
    /* a screen that lifts the launcher above its own bottom bar (sticky action bar) owns its bottom: no root spacer there,
       it would unstick that bar early and slide it under the lifted pill */
    if (innerHeight - launch.getBoundingClientRect().bottom > 1) { padLock = false; if (de.classList.contains('vp-endpad')) de.classList.remove('vp-endpad'); return; }
    var zones = [];
    [launch.querySelector('.vpl-pill'), document.getElementById('vp-mini'), document.getElementById('vp-bar')].forEach(function (e) {
      if (!e) return; var cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return; var r = e.getBoundingClientRect(); if (r.width && r.height) zones.push(r);
    });
    var under = false, boxes = [];
    zones.forEach(function (r) {
      for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) {
        var st = document.elementsFromPoint(r.left + r.width * (0.15 + 0.35 * i), r.top + r.height * (0.25 + 0.5 * j)), e = null;
        for (var k = 0; k < st.length; k++) if (!st[k].closest('#vp-launch,#vp-chat,#vp-mini,#vp-bar,#vp-toast,#vp-tip')) { e = st[k]; break; }
        if (!e || e === b || e === de) continue;
        var fixed = false, sc = null;
        for (var n = e; n && n !== b && n !== de; n = n.parentElement) {
          var cs = getComputedStyle(n);
          if (cs.position === 'fixed' || cs.position === 'sticky') { fixed = true; break; }
          if (!sc && /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.clientHeight > innerHeight * 0.3) sc = n;
        }
        if (fixed) continue;
        if (sc) { if (boxes.indexOf(sc) < 0) boxes.push(sc); } else if (e.closest(ACT)) under = true;
      }
    });
    boxes.forEach(function (n) { if (!n.classList.contains('vp-endpad-box') && getComputedStyle(n, '::after').content === 'none') n.classList.add('vp-endpad-box'); });
    if (de.classList.contains('vp-endpad')) { if (bgTicks++ < 8) endPadBg(); return; }
    if (getComputedStyle(b, '::after').content !== 'none') return;   // the screen uses body::after itself
    if (padLock || under || de.scrollHeight > innerHeight + 1) {
      endPadBg(); padLock = true; de.classList.add('vp-endpad');
    }
  }
  var scrolling = false;
  function updYield() {
    if (!launch) return;
    var y = scrolling || launch.classList.contains('open') || document.body.classList.contains('sheet-open') || coversControl();
    if (launch.classList.contains('yield') !== y) launch.classList.toggle('yield', y);
    if (win) { var lift = Math.max(0, Math.round(innerHeight - launch.getBoundingClientRect().bottom)) + 'px'; if (win.__lift !== lift) { win.__lift = lift; win.style.setProperty('--vpl-lift', lift); } }
  }
  function buildChat() {
    if (document.getElementById('vp-launch')) return;
    launch = document.createElement('div'); launch.id = 'vp-launch';
    launch.innerHTML = '<span class="vpl-char" aria-hidden="true"><span class="vpl-lift">' + charSVG('vpv-loop') + '</span></span>' +
      '<button type="button" class="vpl-pill" aria-label="Open Ask VCFO chat" aria-expanded="false"' + (CHAT_OWN ? '' : ' aria-controls="vp-chat"') + ' data-notip>' +
      '<i class="vpl-dot" aria-hidden="true"></i><span class="vpl-t">Ask VCFO</span><span class="vpl-c" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Close</span></button>';
    var pill = launch.querySelector('.vpl-pill'), chr = launch.querySelector('.vpl-char');
    var scrollT, lastTop = new WeakMap(); addEventListener('scroll', function (e) { if (launch.classList.contains('open')) return; var tg = e.target && e.target.nodeType === 1 ? e.target : document.documentElement, top = tg === document.documentElement ? scrollY : tg.scrollTop; if (lastTop.get(tg) === top) return; lastTop.set(tg, top); scrolling = true; updYield(); clearTimeout(scrollT); scrollT = setTimeout(function () { scrolling = false; updYield(); var de = document.documentElement; if (de.classList.contains('vp-endpad') && innerHeight + scrollY >= de.scrollHeight - 240) endPadBg(); }, 650); }, { passive: true, capture: true });
    var rzT; addEventListener('resize', function () { updYield(); clearTimeout(rzT); rzT = setTimeout(function () { endPad(true); }, 250); }); setTimeout(updYield, 60); setTimeout(endPad, 400);
    setInterval(function () { if (!document.hidden) { updYield(); endPad(); } }, 1000);
    if (CHAT_OWN) { document.body.appendChild(launch); var own = function (e) { e.preventDefault(); e.stopPropagation(); var b = document.getElementById('botBtn'); b && b.click(); }; pill.addEventListener('click', own); chr.addEventListener('click', own); return; }
    win = document.createElement('section'); win.id = 'vp-chat'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', 'Ask VCFO chat');
    win.innerHTML = '<span class="vpc-pk" aria-hidden="true">' + charSVG('vpv-peek') + '</span><div class="vpc-h"><span class="vpc-av">' + headSVG('vpvA') + '</span><span><b>Ask VCFO</b><small>Answers from Northwind’s project data</small></span><button type="button" aria-label="Close chat" data-close>×</button></div><div class="vpc-ms" aria-live="polite"></div><div class="vpc-sg">' +
      Object.keys(QA).map(function (q) { return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div><form><input aria-label="Type a question" placeholder="Type a question"><button type="submit">Send</button></form>';
    document.body.appendChild(win); document.body.appendChild(launch);
    var toggle = function (e) { e.preventDefault(); e.stopPropagation(); win.classList.contains('on') ? closeChat() : openChat(); };
    pill.addEventListener('click', toggle); chr.addEventListener('click', toggle);
    win.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('[data-close]')) return closeChat();
      var q = e.target.closest('[data-q]'); if (q) return ask(q.getAttribute('data-q'));
      var wg = e.target.closest('[data-wgo]'); if (wg) { var g = wg.getAttribute('data-wgo'); if (/[\/.]/.test(g)) vcfoNav(g); else go(g); return; }
      if (e.target.closest('[data-handoff]')) { var l = chatLog(); l.push({ r: 'a', t: 'Sent to Arjun Mehta. You will get a reply by email within 1 working day.' }); saveLog(l); renderLog(); toast('Handed off to Arjun Mehta', true); }
    });
    win.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var i = win.querySelector('input'); var v = i.value.trim(); if (v) { ask(v); i.value = ''; } else { i.focus(); toast('Type a question first, or pick one above'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && win.classList.contains('on')) closeChat(); });
    renderLog();
    if (/(^|[#&])chat\b/.test(location.hash) || store.get('openChat', false)) { store.set('openChat', false); setTimeout(openChat, 500); }
  }
  function openChat(q) {
    if (CHAT_OWN) { var b = document.querySelector('[aria-label="Chat with Ask VCFO"]'); b && b.click(); return; }
    if (!launch || !win) buildChat();   // a What's this? click can arrive before boot has built the chat
    if (!launch || !win) return;
    var pill = launch.querySelector('.vpl-pill');
    lastFocus = document.activeElement; win.classList.add('on'); launch.classList.add('open'); document.documentElement.classList.add('vp-chat-on'); updYield();
    pill.setAttribute('aria-expanded', 'true'); pill.setAttribute('aria-label', 'Close Ask VCFO chat');
    renderLog(); setTimeout(function () { win.querySelector('input').focus({ preventScroll: true }); }, 60);
    if (q) ask(q);
  }
  function closeChat() {
    if (!launch || !win) return;
    var pill = launch.querySelector('.vpl-pill');
    win.classList.remove('on'); launch.classList.remove('open'); document.documentElement.classList.remove('vp-chat-on'); updYield();
    pill.setAttribute('aria-expanded', 'false'); pill.setAttribute('aria-label', 'Open Ask VCFO chat');
    pill.focus({ preventScroll: true });
  }
  function ask(q) {
    var l = chatLog(); l.push({ r: 'u', t: q }); saveLog(l); renderLog();
    var box = win.querySelector('.vpc-ms'); box.insertAdjacentHTML('beforeend', '<div class="vpc-m vpc-a vpc-ty"><i></i><i></i><i></i></div>'); box.scrollTop = 1e6;
    win.classList.add('vpc-think');
    setTimeout(function () {
      var w = whatsThis(q), a = QA[q], l2 = chatLog(), m = w ? { r: 'a', t: w.title, w: w, k: 'ok' } : a ? { r: 'a', t: a, k: 'ok' } : { r: 'a', t: 'I can’t answer that one yet. I can pass it to Northwind’s project lead.', h: true, k: 'nan' };
      l2.push(m); saveLog(l2); renderLog(); setMood(m.k, true);
    }, reduce ? 0 : 900);
  }
  window.vcfoChat = function (q) { openChat(q); };
  /* hide robots drawn inside the boards: the global launcher replaces them */
  function hideBoardBots() {
    if (CHAT_OWN) return;
    [].forEach.call(document.querySelectorAll('[aria-label="Open Ask VCFO"], button.face, .bot > .face'), function (b) {
      if (b.closest('#vp-launch')) return;
      var n = b, hop = 0;
      while (n && n !== document.body && hop++ < 8) { var cs = getComputedStyle(n); if (cs.position === 'absolute' || cs.position === 'fixed') break; n = n.parentElement; }
      (n && n !== document.body ? n : b).classList.add('vp-hide-bot');
    });
    [].forEach.call(document.querySelectorAll('[aria-label="Ask VCFO chat"],#ask-panel'), function (p) { if (!p.closest('#vp-chat')) p.classList.add('vp-hide-bot'); });
  }

  /* ---------- fixed navigation: the sidebar and the top bar never scroll away ---------- */
  function unclip(el) { for (var a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { var o = getComputedStyle(a); if (/hidden|auto|scroll/.test(o.overflow + o.overflowX + o.overflowY) && a !== document.body) a.style.overflow = 'clip'; } }
  function pinNav() {
    if (window.__vcfoNoPin) return true;
    var done = 0, all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length; i++) {
      var e = all[i]; if (e.closest('#vp-chat,#vp-launch,#vp-bar,#tle-scrim,.vps,#vp-drawer-scrim')) continue;
      if (!e.__vpSide && e.getAttribute('data-vp') !== 'side') {
        var r = e.getBoundingClientRect(), cs;
        if (r.width >= 236 && r.width <= 260 && r.height >= 600 && r.left < 4 + (innerWidth > 1440 ? (innerWidth - 1440) / 2 : 0) && (cs = getComputedStyle(e)) && /^rgba?\(15, 42, 74/.test(cs.backgroundColor) && !e.parentElement.closest('[data-vp="side"]')) {
          e.setAttribute('data-vp', 'side'); unclip(e);
          e.style.position = 'sticky'; e.style.top = '0'; e.style.alignSelf = 'flex-start'; e.style.height = '100vh'; e.style.maxHeight = '100vh'; e.style.overflowY = 'auto'; e.style.overflowX = 'hidden'; e.style.zIndex = '30';
          [].forEach.call(e.querySelectorAll('*'), function (k) { var kr = k.getBoundingClientRect(); if (kr.width >= 236 && /min-height/.test(k.getAttribute('style') || '')) k.style.minHeight = '100vh'; });
          done++;
        }
      }
    }
    var h = [].find.call(document.querySelectorAll('header'), function (x) { var r = x.getBoundingClientRect(); return r.height >= 48 && r.height <= 60 && r.width > Math.min(600, innerWidth - 40) && r.top + scrollY < 4 && !x.closest('#vp-chat,#tle-scrim'); });
    if (h && !h.closest('[data-vp="top"]')) {
      var w = h; while (w.parentElement && w.parentElement !== document.body && Math.abs(w.parentElement.getBoundingClientRect().height - h.getBoundingClientRect().height) < 2) w = w.parentElement;
      w.setAttribute('data-vp', 'top'); unclip(w); w.style.position = 'sticky'; w.style.top = '0'; w.style.zIndex = '40';
      if (getComputedStyle(h).backgroundColor === 'rgba(0, 0, 0, 0)') h.style.background = '#fff';
      done++;
    }
    return done > 0 || !!document.querySelector('[data-vp]');
  }

  /* item 13: keep tooltips only where the meaning is not obvious (rule 17 spirit) */
  var OBVIOUS = /^(WhatsApp|Call|Email|Teams|Phone|Message)\b|^About\b|^More actions\b|^Notifications(,|$)|^(More information|Close|Ask VCFO|Open Ask VCFO|SBC home|Search( \(⌘K\))?|Details|Open|Open menu|Announcements|Photo placeholder|PDF file|Word document|Excel (sheet|file)|PowerPoint( deck| file)?|Text file|CSV file|Image \([A-Z]+\))$/i;
  function tidyTips() {
    [].forEach.call(document.querySelectorAll('[data-tip]'), function (e) {
      if (e.closest('.vps')) return;
      var t = e.getAttribute('data-tip') || '', txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (OBVIOUS.test(t) || (txt.length > 2 && txt.toLowerCase().indexOf(t.toLowerCase()) === 0)) { e.removeAttribute('data-tip'); e.classList.remove('tip'); e.setAttribute('data-notip', ''); }
    });
    [].forEach.call(document.querySelectorAll('[title]'), function (e) {
      if (e.closest('svg') || e.tagName === 'IFRAME' || e.tagName === 'LINK' || e.tagName === 'STYLE') return;
      var t = e.getAttribute('title'); if (!e.getAttribute('aria-label') && !(e.textContent || '').trim() && /^(A|BUTTON)$/.test(e.tagName)) e.setAttribute('aria-label', t);
      e.removeAttribute('title');
    });
    [].forEach.call(document.querySelectorAll('a[aria-label],button[aria-label],[role="button"][aria-label]'), function (e) { if (OBVIOUS.test(e.getAttribute('aria-label')) && !e.hasAttribute('data-notip')) e.setAttribute('data-notip', ''); });
  }
  var pinTries = 0;
  function upkeep() { countMuts(muObs.takeRecords()); buildChat(); hideBoardBots(); pinNav(); tidyTips(); muObs.takeRecords(); if (pinTries++ < 30) setTimeout(upkeep, 200); }

  function openTimeline() {
    if (window.vcfoTimeline) return window.vcfoTimeline.open();
    injectScript('tl-editor.js', function () { window.vcfoTimeline.open(); });
  }
  window.vcfoOpenTimeline = openTimeline;
  /* ---------- one drill-down pop-up for charts drawn outside the boards (rule 14) ---------- */
  var dcss = document.createElement('style');
  dcss.textContent = [
    '#vp-drill{width:min(600px,100%);max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:12px;box-shadow:0 30px 70px -20px rgba(8,20,40,.6);overflow:hidden;font:500 13px/1.45 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));transform:translateY(10px) scale(.98);transition:transform .24s cubic-bezier(.22,1,.36,1)}',
    '#vp-drill-scrim.on #vp-drill{transform:none}',
    '#vp-drill .top{display:flex;align-items:center;gap:8px;padding:9px 18px;background:light-dark(#eef3ff, oklch(18.4% 0.01 267.8));border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));font-size:12px;color:#5a6b82}',
    '#vp-drill .top a{margin-left:auto;font-weight:800;font-size:12.5px;color:#2e5cff;text-decoration:none;white-space:nowrap}',
    '#vp-drill .hd{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7))}',
    '#vp-drill .hd b{flex:1;font:700 15px Manrope;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-drill .hd small{display:block;font:500 12px Manrope;color:#5a6b82}',
    '#vp-drill .x{width:32px;height:32px;border-radius:6px;border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#fff, oklch(13% 0 89.9));color:#5a6b82;cursor:pointer;font-size:18px;line-height:1}',
    '#vp-drill .tabs{display:flex;gap:2px;margin:14px 18px 0;padding:2px;border-radius:8px;background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));box-shadow:inset 0 0 0 1px #e3e8ef}',
    '#vp-drill .tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;border:0;border-radius:6px;background:none;font:600 12px Manrope;color:#5a6b82;cursor:pointer;white-space:nowrap}',
    '#vp-drill .tabs button i{width:8px;height:8px;border-radius:2px;display:inline-block}',
    '#vp-drill .tabs button span{font:600 11px "IBM Plex Mono",monospace;opacity:.75}',
    '#vp-drill .tabs button[aria-selected=true]{background:#0f2a4a;color:#fff}',
    '#vp-drill .list{flex:1;min-height:0;overflow:auto;padding:8px 18px 6px;scrollbar-width:none}',
    '#vp-drill .list::-webkit-scrollbar{display:none}',
    '#vp-drill .r{display:grid;grid-template-columns:minmax(0,1fr) auto auto 16px;align-items:center;gap:12px;padding:9px 10px;margin:0 -10px;border-radius:6px;cursor:pointer;color:inherit;text-decoration:none}',
    '#vp-drill .r:hover{background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3))}',
    '#vp-drill .r b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#vp-drill .r em{font:500 12px "IBM Plex Mono",monospace;font-style:normal;color:#5a6b82;white-space:nowrap}',
    '#vp-drill .r .c{font:700 11px Manrope;padding:2px 7px;border-radius:4px;color:#fff;white-space:nowrap}',
    '#vp-drill .r .a{color:#2e5cff}',
    '#vp-drill .ft{padding:10px 18px;border-top:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3));font-size:12px;color:#5a6b82}',
    '@media (max-width:700px){#vp-drill-scrim{align-items:flex-end;padding:0}#vp-drill{width:100%;border-radius:14px 14px 0 0;max-height:86vh}}'
  ].join('\n');
  document.head.appendChild(dcss);
  function drill(cfg) {
    var old = document.getElementById('vp-drill-scrim'); if (old) old.remove();
    var tab = cfg.active || 0, last = document.activeElement;
    var sc = document.createElement('div'); sc.id = 'vp-drill-scrim';
    sc.innerHTML = '<div id="vp-drill" role="dialog" aria-modal="true" aria-labelledby="vp-drill-t">' +
      (cfg.link ? '<div class="top"><span>' + cfg.link.lead + '</span><a href="#" data-dlink>' + cfg.link.text + '</a></div>' : '') +
      '<div class="hd"><b id="vp-drill-t">' + cfg.title + (cfg.sub ? '<small>' + cfg.sub + '</small>' : '') + '</b><button type="button" class="x" aria-label="Close">×</button></div>' +
      '<div class="tabs" role="tablist"></div><div class="list"></div><div class="ft"></div></div>';
    document.body.appendChild(sc); requestAnimationFrame(function () { sc.classList.add('on'); });
    function paint() {
      sc.querySelector('.tabs').innerHTML = cfg.tabs.map(function (t, i) { return '<button type="button" role="tab" aria-selected="' + (i === tab) + '" data-t="' + i + '">' + (t.color ? '<i style="background:' + t.color + '"></i>' : '') + t.label + '<span>' + (t.n != null ? t.n : t.rows.length) + '</span></button>'; }).join('');
      var t = cfg.tabs[tab], rows = t.rows;
      sc.querySelector('.list').innerHTML = rows.length ? rows.map(function (r, i) { return '<a href="#" class="r" data-r="' + i + '"><b>' + r[0] + '</b><em>' + (r[1] || '') + '</em>' + (r[2] ? '<span class="c" style="background:' + (r[3] || '#5a6b82') + '">' + r[2] + '</span>' : '<span></span>') + '<span class="a">→</span></a>'; }).join('') : '<div style="padding:16px 0;color:#5a6b82">Nothing here.</div>';
      var total = t.n != null ? t.n : rows.length;
      sc.querySelector('.ft').textContent = rows.length < total ? 'Showing ' + rows.length + ' of ' + total + ' · the full list is in ' + (cfg.link ? cfg.link.where || 'the app' : 'the app') : 'Showing all ' + total;
    }
    function close() { document.removeEventListener('keydown', key, true); sc.classList.remove('on'); setTimeout(function () { sc.remove(); }, reduce ? 0 : 160); last && last.focus && last.focus({ preventScroll: true }); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    sc.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target === sc || e.target.closest('.x')) { e.preventDefault(); return close(); }
      var b = e.target.closest('[data-t]'); if (b) { tab = +b.getAttribute('data-t'); paint(); return; }
      if (e.target.closest('[data-dlink]')) { e.preventDefault(); close(); if (cfg.link.go) go(cfg.link.go); else if (cfg.link.onClick) cfg.link.onClick(); return; }
      var r = e.target.closest('[data-r]'); if (r) { e.preventDefault(); var row = cfg.tabs[tab].rows[+r.getAttribute('data-r')]; close(); if (row[4]) go(row[4]); else toast('Opening ' + row[0] + '…'); }
    });
    paint(); setTimeout(function () { var f = sc.querySelector('.x'); f && f.focus({ preventScroll: true }); }, 40);
  }
  window.vcfoDrill = drill;
  /* a tooltip at a point, for charts drawn as pictures (rule 14 hover) */
  window.vcfoTipAt = function (x, y, txt) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'vp-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    if (txt == null) { tip.classList.remove('on'); return; }
    tip.textContent = txt; tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x - tip.offsetWidth / 2)) + 'px'; tip.style.top = (y - 40 < 4 ? y + 18 : y - 40) + 'px'; tip.classList.add('on');
  };
  window.vcfoToast = function (m, u, cb) { toast(m, u, cb); };
  injectScript('shell.js');
  function boot() { buildBar(); upkeep(); if ([].some.call(document.querySelectorAll('script'), function () { return true; }) && /\/s\/home\//.test(curPath())) { injectScript('tl-editor.js'); } setTimeout(function () { document.documentElement.classList.remove('vp-enter'); }, 400); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
