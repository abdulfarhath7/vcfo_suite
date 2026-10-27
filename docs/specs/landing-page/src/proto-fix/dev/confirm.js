/* Developer console: every change asks first. Any element with data-dev-confirm="Title" opens this dialog;
   data-what, data-before, data-after describe the change; data-flag="key" flips a feature flag.
   Confirm writes the change to the session's audit list (DEV.log) and shows a toast. Prototype only. */
(function () {
  var open = null, last = null;
  function close() { if (!open) return; open.remove(); open = null; if (last && last.focus) last.focus(); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(b) {
    close(); last = document.activeElement;
    var title = b.getAttribute('data-dev-confirm'), what = b.getAttribute('data-what') || title, before = b.getAttribute('data-before'), after = b.getAttribute('data-after');
    var danger = b.hasAttribute('data-danger');
    var scrim = document.createElement('div'); scrim.className = 'ds-dlg-scrim';
    scrim.innerHTML = '<div class="ds-dlg" role="dialog" aria-modal="true" aria-labelledby="dv-t"><h2 id="dv-t">' + esc(title) + '</h2>' +
      '<p class="ds-dlg-p">' + esc(what) + '</p>' +
      (before || after ? '<div class="ds-row2"><div class="ds-f"><span>Now</span><div class="dv-box">' + esc(before || '-') + '</div></div><div class="ds-f"><span>After</span><div class="dv-box">' + esc(after || '-') + '</div></div></div>' : '') +
      '<p class="ds-dlg-p" style="margin:0">This is recorded in the audit log with your name.</p>' +
      '<div class="ds-dlg-f"><button type="button" class="btn" data-x>Cancel</button><button type="button" class="btn btnp" data-ok' + (danger ? ' style="background:#b5302a;border-color:#b5302a"' : '') + '>' + esc(b.getAttribute('data-ok') || 'Confirm') + '</button></div></div>';
    document.body.appendChild(scrim); open = scrim;
    scrim.addEventListener('click', function (e) { if (e.target === scrim || e.target.closest('[data-x]')) close(); });
    scrim.querySelector('[data-ok]').addEventListener('click', function () {
      var flag = b.getAttribute('data-flag');
      if (flag) { var o = {}; try { o = JSON.parse(sessionStorage.getItem('vcfo.devflags') || '{}'); } catch (e) {} o[flag] = after === 'On'; try { sessionStorage.setItem('vcfo.devflags', JSON.stringify(o)); } catch (e) {} }
      if (window.DEV) window.DEV.log(what, before, after);
      if (window.vcfoToast) window.vcfoToast(b.getAttribute('data-toast') || (title + ' · done'));
      close();
    });
    setTimeout(function () { var ok = scrim.querySelector('[data-ok]'); if (ok) ok.focus(); }, 0);
  }
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-dev-confirm]'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); show(b);
  }, true);
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); } }, true);
})();
