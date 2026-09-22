/* MCA V3 passive recorder — content script.
 * Records page structure and interaction sequence. Field VALUES are never
 * stored raw: only length + character class, so PAN/Aadhaar/phone/OTP/DSC
 * details never leave the page. Password fields are skipped entirely.
 */
(() => {
  if (window.__vcfoRecorder) return;
  window.__vcfoRecorder = true;

  const MAX_OPTIONS = 80;
  const frame = window.top === window ? 'top' : (window.name || location.pathname.slice(0, 40));

  const shape = (v) => {
    if (v == null || v === '') return '';
    const s = String(v);
    const cls = /^\d+$/.test(s) ? 'digits' : /^[A-Za-z ]+$/.test(s) ? 'alpha' : /^[A-Z0-9]+$/.test(s) ? 'upperalnum' : 'mixed';
    return `<${s.length} ${cls}>`;
  };

  const text = (el) => (el?.innerText || el?.textContent || '').trim().replace(/\s+/g, ' ');

  const labelFor = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (text(l)) return text(l);
    }
    const wrap = el.closest('label');
    if (text(wrap)) return text(wrap);
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.getAttribute('aria-labelledby')) {
      const l = document.getElementById(el.getAttribute('aria-labelledby'));
      if (text(l)) return text(l);
    }
    const box = el.closest('.form-group, .field, .form-field, mat-form-field, .cmp-form-text, .cmp-form-options, .col, .row, div');
    if (box) {
      const lab = box.querySelector('label, .label, .control-label, mat-label, legend');
      if (text(lab)) return text(lab).slice(0, 200);
    }
    return '';
  };

  const cssPath = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 6) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(`${p}#${cur.id}`); break; }
      const name = cur.getAttribute('name');
      if (name) { parts.unshift(`${p}[name="${name}"]`); break; }
      const sib = cur.parentElement ? Array.from(cur.parentElement.children).filter((c) => c.tagName === cur.tagName) : [];
      if (sib.length > 1) p += `:nth-of-type(${sib.indexOf(cur) + 1})`;
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };

  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || (tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : 'text');
    if (type === 'password') return null;
    const rect = el.getBoundingClientRect();
    const out = {
      tag, type,
      id: el.id || '',
      name: el.getAttribute('name') || '',
      path: cssPath(el),
      label: labelFor(el),
      placeholder: el.getAttribute('placeholder') || '',
      required: !!(el.required || el.getAttribute('aria-required') === 'true'),
      maxLength: el.maxLength > 0 ? el.maxLength : null,
      pattern: el.getAttribute('pattern') || '',
      disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      readOnly: !!el.readOnly,
      visible: !!(rect.width || rect.height),
      dataAttrs: Object.fromEntries(Array.from(el.attributes).filter((a) => a.name.startsWith('data-')).map((a) => [a.name, a.value.slice(0, 80)])),
      value: shape(el.value),
    };
    if (tag === 'select') {
      out.options = Array.from(el.options).slice(0, MAX_OPTIONS).map((o) => ({ v: o.value, t: o.text.trim() }));
      out.optionCount = el.options.length;
      out.selectedText = el.selectedOptions[0]?.text?.trim() || '';
    }
    if (type === 'radio' || type === 'checkbox') out.checked = el.checked;
    return out;
  };

  const controls = () =>
    Array.from(document.querySelectorAll('input, select, textarea, [contenteditable="true"], [role="combobox"], [role="textbox"]'))
      .filter((el) => el.type !== 'hidden');

  const snapshot = (reason) => ({
    kind: 'snapshot',
    reason,
    frame,
    url: location.href.split('?')[0],
    query: Object.keys(Object.fromEntries(new URLSearchParams(location.search))),
    title: document.title,
    headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, legend, .panel-title, .section-title, .cmp-title__text')).map(text).filter(Boolean).slice(0, 60),
    steps: Array.from(document.querySelectorAll('[role="tab"], .nav-tabs li, .mat-tab-label, .step-title, .stepper li, .wizard-step, .cmp-tabs__tab')).map((t) => ({ text: text(t).slice(0, 80), active: /active|selected|current/.test(t.className) || t.getAttribute('aria-selected') === 'true' })).filter((t) => t.text).slice(0, 60),
    buttons: Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, [role="button"]')).map((b) => ({ text: (b.innerText || b.value || '').trim().slice(0, 60), id: b.id || '', disabled: !!b.disabled })).filter((b) => b.text).slice(0, 60),
    errors: Array.from(document.querySelectorAll('.error, .invalid-feedback, .field-error, [role="alert"], .cmp-form-text__error, .text-danger')).map(text).filter(Boolean).slice(0, 40),
    fields: controls().map(describe).filter(Boolean),
  });

  const send = (ev) => {
    try { chrome.runtime.sendMessage({ t: Date.now(), ...ev }); } catch { /* extension reloaded; ignore */ }
  };

  send(snapshot('load'));

  let mutTimer = null;
  let lastFieldCount = -1;
  const scheduleSnapshot = (reason) => {
    clearTimeout(mutTimer);
    mutTimer = setTimeout(() => {
      const n = controls().length;
      if (n !== lastFieldCount) { lastFieldCount = n; send(snapshot(reason)); }
    }, 800);
  };
  new MutationObserver(() => scheduleSnapshot('dom-change')).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    const d = describe(el);
    if (!d) return;
    send({ kind: 'change', frame, url: location.href.split('?')[0], field: d });
  }, true);

  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest('button, a, input[type="submit"], input[type="button"], [role="button"], [role="tab"], li') : null;
    if (!el) return;
    send({ kind: 'click', frame, url: location.href.split('?')[0], text: (el.innerText || el.value || '').trim().slice(0, 80), id: el.id || '', path: cssPath(el) });
  }, true);

  document.addEventListener('submit', (e) => {
    const f = e.target;
    send({ kind: 'submit', frame, url: location.href.split('?')[0], formId: f.id || '', action: f.getAttribute('action') || '', fieldCount: f.elements.length });
  }, true);

  const onRoute = () => scheduleSnapshot('route');
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function (...a) { const r = orig.apply(this, a); onRoute(); return r; };
  }
  window.addEventListener('popstate', onRoute);
  window.addEventListener('hashchange', onRoute);
  window.addEventListener('beforeunload', () => send({ kind: 'unload', frame, url: location.href.split('?')[0] }));
})();
