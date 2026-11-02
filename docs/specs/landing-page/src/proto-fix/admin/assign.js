/* The admin's one action: assign a client to a manager (or, rarely, one task). Any element with
   data-admin-assign="client" | "task" (optional data-client="NT") opens this dialog. Prototype only:
   a client assignment is kept for the session (ADM.assign) and every admin screen re-renders. */
(function () {
  var open = null, last = null;
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function close() { if (!open) return; open.remove(); open = null; if (last && last.focus) last.focus(); }
  function opt(v, t, sel) { return '<option value="' + v + '"' + (sel ? ' selected' : '') + '>' + t + '</option>'; }
  function show(mode, k, extra) {
    var A = window.ADM; if (!A) return;
    close(); last = document.activeElement;
    var all = A.clients(), cur = k || (mode === 'client' ? all[0].k : 'NT');
    var scrim = el('div', { 'class': 'ds-dlg-scrim' });
    var box = el('div', { 'class': 'ds-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ds-dlg-t' });
    var isNew = !!(extra && k && !A.C[k]);
    var clientSel = '<label class="ds-f"><span>Client</span><select id="ds-dlg-c">' + (isNew ? opt(k, extra + ' · no manager', true) : '') + all.map(function (c) { return opt(c.k, c.name + ' · ' + A.MGR[c.mgr].name, c.k === cur); }).join('') + '</select></label>';
    var body;
    if (mode === 'client') {
      body = clientSel + '<div class="ds-f"><span>Manager</span><div class="ds-mgrs" role="radiogroup" aria-label="Manager">' + Object.keys(A.MGR).map(function (id) {
        var s = A.mgrStats(id);
        return '<label class="ds-mc"><input type="radio" name="ds-dlg-m" value="' + id + '"><span class="pt">' + A.MGR[id].ini + '</span><span><b>' + A.MGR[id].name + '</b><em>' + s.clients.length + ' clients · ' + s.open + ' open · ' + s.overdue + ' late</em></span></label>';
      }).join('') + '</div></div>';
    } else {
      body = clientSel + '<label class="ds-f"><span>Task</span><input id="ds-dlg-t2" type="text" placeholder="For example: Review the FC-GPR draft"></label>' +
        '<div class="ds-row2"><label class="ds-f"><span>Manager</span><select id="ds-dlg-m2">' + Object.keys(A.MGR).map(function (id) { return opt(id, A.MGR[id].name, id === A.mgrOf(cur)); }).join('') + '</select></label>' +
        '<label class="ds-f"><span>Due</span><input id="ds-dlg-d" type="date" value="2026-10-23"></label></div>';
    }
    box.innerHTML = '<h2 id="ds-dlg-t">' + (mode === 'client' ? 'Assign a client to a manager' : 'Assign a task to a manager') + '</h2>' +
      '<p class="ds-dlg-p">' + (mode === 'client' ? 'The manager owns the whole engagement and picks the project lead.' : 'Use this only for one-off work; engagements are assigned whole.') + '</p>' + body +
      '<div class="ds-dlg-f"><button type="button" class="btn" data-x>Cancel</button><button type="button" class="btn btnp" data-ok>Assign</button></div>';
    scrim.appendChild(box); document.body.appendChild(scrim); open = scrim;
    var csel = box.querySelector('#ds-dlg-c');
    function syncRadio() { var m = A.C[csel.value] ? A.mgrOf(csel.value) : ''; [].forEach.call(box.querySelectorAll('input[name="ds-dlg-m"]'), function (r) { r.checked = r.value === m; }); var ms = box.querySelector('#ds-dlg-m2'); if (ms) ms.value = m; }
    csel.addEventListener('change', syncRadio); syncRadio();
    scrim.addEventListener('click', function (e) { if (e.target === scrim || e.target.closest('[data-x]')) close(); });
    box.querySelector('[data-ok]').addEventListener('click', function () {
      var c = A.C[csel.value] ? A.C[csel.value][0] : extra;
      if (mode === 'client') {
        var r = box.querySelector('input[name="ds-dlg-m"]:checked'); if (!r) return;
        A.assign(csel.value, r.value);
        if (window.vcfoToast) window.vcfoToast(c + ' is now with ' + A.MGR[r.value].name);
      } else {
        var t = (box.querySelector('#ds-dlg-t2').value || '').trim() || 'New task';
        var m = box.querySelector('#ds-dlg-m2').value;
        if (window.vcfoToast) window.vcfoToast('Assigned to ' + A.MGR[m].name + ': ' + t + ' · ' + c);
      }
      close();
    });
    setTimeout(function () { csel.focus(); }, 0);
  }
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-admin-assign]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    show(b.getAttribute('data-admin-assign'), b.getAttribute('data-client'), b.getAttribute('data-client-name'));
  }, true);
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); } }, true);
})();
