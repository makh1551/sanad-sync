const $ = id => document.getElementById(id);
function show(l) { $('log').textContent = l ? 'آخر مزامنة: ' + l.at + (l.manual ? '' : ' (تلقائية)') + '\n' + l.lines.join('\n') : 'لم تجرِ مزامنة بعد.'; }
chrome.storage.local.get(['pin', 'auto', 'last'], d => { $('pin').value = d.pin || ''; $('auto').checked = d.auto !== false; show(d.last); });
$('pin').addEventListener('change', () => chrome.storage.local.set({ pin: $('pin').value.trim() }));
$('auto').addEventListener('change', () => chrome.storage.local.set({ auto: $('auto').checked }));
$('go').addEventListener('click', async () => {
  await chrome.storage.local.set({ pin: $('pin').value.trim() });
  $('go').disabled = true; $('log').textContent = 'جارٍ فتح التحضير الذكي وجلب البيانات… قد يستغرق دقيقة.';
  chrome.runtime.sendMessage('sync', () => { chrome.storage.local.get('last', d => { show(d.last); $('go').disabled = false; }); });
});
chrome.storage.onChanged.addListener(c => { if (c.last) show(c.last.newValue); });
