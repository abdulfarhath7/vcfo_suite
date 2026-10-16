/* Compliances page: show one board of the design page as a full screen, chosen by #section-id.
   v7: the board is fluid (html.comp-live switches on the responsive rules in s/comp/index.html). */
(function () {
  function pick() {
    var id = (location.hash || '#cal-redesign').slice(1), s = document.getElementById(id);
    if (!s) return false;
    var frame = s.querySelector('.ab'); if (!frame) return false;
    var de = document.documentElement;
    de.classList.add('comp-live'); de.setAttribute('data-comp', id);
    if (id === 'cal-mobile') { de.classList.add('vp-mobile', 'comp-phone'); frame.style.width = '100%'; }
    var side = frame.querySelector('.side'); if (side) side.setAttribute('data-vp', 'side');
    var keep = document.createElement('div'); keep.id = 'comp-screen'; keep.appendChild(frame);
    [].slice.call(document.body.children).forEach(function (c) { if (c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE' && c.tagName !== 'LINK') c.style.display = 'none'; });
    document.body.insertBefore(keep, document.body.firstChild);
    document.body.style.margin = '0'; document.body.style.padding = '0';
    window.scrollTo(0, 0);
    /* the sliding pills measured their buttons inside the wide design canvas: measure again in place */
    function replace() { [].forEach.call(keep.querySelectorAll('.seg'), function (sg) { var th = sg.querySelector('.thumb'), on = sg.querySelector('button.on') || sg.querySelector('button'); if (th && on) { th.style.width = on.offsetWidth + 'px'; th.style.transform = 'translateX(' + on.offsetLeft + 'px)'; } }); }
    requestAnimationFrame(replace); if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
    addEventListener('resize', function () { requestAnimationFrame(replace); });
    return true;
  }
  var n = 0; (function t() { if (!pick() && n++ < 40) setTimeout(t, 50); })();
  addEventListener('hashchange', function () { location.reload(); });
})();
