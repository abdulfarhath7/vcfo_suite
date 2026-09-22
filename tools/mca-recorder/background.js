/* Service worker: buffers events from content scripts + XHR shapes, persists
 * to chrome.storage.local, exports as one JSON file on demand. */
const KEY = 'events';
let buffer = [];
let flushTimer = null;

const flush = async () => {
  flushTimer = null;
  if (!buffer.length) return;
  const { [KEY]: stored = [] } = await chrome.storage.local.get(KEY);
  const next = stored.concat(buffer);
  buffer = [];
  await chrome.storage.local.set({ [KEY]: next });
};
const push = (ev) => {
  buffer.push(ev);
  if (!flushTimer) flushTimer = setTimeout(flush, 1500);
};

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.cmd) return;
  push({ ...msg, tabId: sender.tab?.id ?? null });
});

// Request shapes only: method, url (query keys, not values), status. No bodies.
const stripUrl = (u) => {
  try { const x = new URL(u); return `${x.origin}${x.pathname}${x.search ? '?' + Array.from(x.searchParams.keys()).join('&') : ''}`; } catch { return u; }
};
chrome.webRequest.onCompleted.addListener(
  (d) => {
    if (!['xmlhttprequest', 'main_frame', 'sub_frame'].includes(d.type)) return;
    push({ t: Date.now(), kind: 'net', type: d.type, method: d.method, url: stripUrl(d.url), status: d.statusCode, tabId: d.tabId });
  },
  { urls: ['*://*.mca.gov.in/*'] }
);

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (!msg?.cmd) return;
  (async () => {
    await flush();
    if (msg.cmd === 'count') {
      const { [KEY]: stored = [] } = await chrome.storage.local.get(KEY);
      reply({ count: stored.length });
    } else if (msg.cmd === 'export') {
      const { [KEY]: stored = [] } = await chrome.storage.local.get(KEY);
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), events: stored }, null, 1);
      const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await chrome.downloads.download({ url, filename: `mca-recording-${stamp}.json`, saveAs: true });
      reply({ ok: true, count: stored.length });
    } else if (msg.cmd === 'clear') {
      await chrome.storage.local.remove(KEY);
      reply({ ok: true });
    }
  })();
  return true;
});
