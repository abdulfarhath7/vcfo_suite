const n = document.getElementById('n');
const refresh = () => chrome.runtime.sendMessage({ cmd: 'count' }, (r) => { n.textContent = r?.count ?? '0'; });
refresh();
document.getElementById('export').onclick = () => chrome.runtime.sendMessage({ cmd: 'export' }, refresh);
document.getElementById('clear').onclick = () => { if (confirm('Delete all recorded events?')) chrome.runtime.sendMessage({ cmd: 'clear' }, refresh); };
