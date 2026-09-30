/* ============================================================
   MCA V3 FIELD CAPTURE
   Paste this whole file into the Chrome DevTools Console on any
   SPICe+ form page, press Enter. The result is copied to your
   clipboard as JSON. Paste it into a numbered .json file.

   Values are REDACTED by default. Field names, ids, labels and
   dropdown options are kept — those are what the field map needs.
   ============================================================ */

(() => {
  const REDACT_VALUES = true;          // keep true when using real client data
  const KEEP_OPTIONS  = true;          // dropdown option lists (useful for NIC, state, etc.)
  const MAX_OPTIONS   = 60;            // truncate very long option lists

  const redact = (v) => {
    if (!REDACT_VALUES || v == null || v === '') return v ?? '';
    return `<${String(v).length} chars>`;
  };

  const labelFor = (el) => {
    // 1. explicit <label for="id">
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l?.innerText?.trim()) return l.innerText.trim();
    }
    // 2. wrapping label
    const wrap = el.closest('label');
    if (wrap?.innerText?.trim()) return wrap.innerText.trim();
    // 3. aria
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    // 4. nearest preceding text in the same form-field container
    const box = el.closest('.form-group, .field, mat-form-field, .col, .row, div');
    if (box) {
      const lab = box.querySelector('label, .label, .control-label, mat-label');
      if (lab?.innerText?.trim()) return lab.innerText.trim();
    }
    return '';
  };

  const describe = (el, index) => {
    const rect = el.getBoundingClientRect();
    const out = {
      i: index,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || (el.tagName.toLowerCase() === 'select' ? 'select' : 'text'),
      id: el.id || '',
      name: el.getAttribute('name') || '',
      formControlName:
        el.getAttribute('formcontrolname') ||
        el.getAttribute('ng-reflect-name') ||
        el.getAttribute('data-placeholder') || '',
      label: labelFor(el),
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      required: el.required || el.getAttribute('aria-required') === 'true',
      maxLength: el.maxLength > 0 ? el.maxLength : null,
      disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      readOnly: el.readOnly || false,
      visible: !!(rect.width || rect.height),
      classes: (el.className || '').toString().slice(0, 120),
      value: redact(el.value),
    };
    if (el.tagName.toLowerCase() === 'select' && KEEP_OPTIONS) {
      const opts = Array.from(el.options).slice(0, MAX_OPTIONS)
        .map((o) => ({ v: o.value, t: o.text.trim() }));
      out.options = opts;
      out.optionCount = el.options.length;
    }
    if (out.type === 'radio' || out.type === 'checkbox') {
      out.checked = el.checked;
    }
    return out;
  };

  const controls = Array.from(
    document.querySelectorAll('input, select, textarea, [contenteditable="true"]')
  ).filter((el) => el.type !== 'hidden');

  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, legend, .panel-title, .section-title'))
    .map((h) => h.innerText.trim())
    .filter(Boolean)
    .slice(0, 40);

  const tabs = Array.from(document.querySelectorAll('[role="tab"], .nav-tabs li, .mat-tab-label, .step-title'))
    .map((t) => t.innerText.trim())
    .filter(Boolean)
    .slice(0, 40);

  const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn'))
    .map((b) => ({
      text: (b.innerText || b.value || '').trim().slice(0, 60),
      id: b.id || '',
      classes: (b.className || '').toString().slice(0, 80),
      disabled: b.disabled || false,
    }))
    .filter((b) => b.text)
    .slice(0, 40);

  const payload = {
    capturedAt: new Date().toISOString(),
    url: location.href.split('?')[0],
    pageTitle: document.title,
    headings,
    tabs,
    buttons,
    fieldCount: controls.length,
    fields: controls.map(describe),
  };

  const json = JSON.stringify(payload, null, 2);
  console.log(`Captured ${controls.length} fields — ${(json.length / 1024).toFixed(1)} KB. Copied to clipboard.`);
  try { copy(json); } catch (e) { console.log(json); }
  return payload;
})();
