const $ = id => document.getElementById(id);
function show(l) { $('log').textContent = l ? 'آخر مزامنة: ' + l.at + (l.manual ? '' : ' (تلقائية)') + '\n' + l.lines.join('\n') : 'لم تجرِ مزامنة بعد.'; }
function link(d) {
  if (d.device) $('link').textContent = 'مرتبطة بسند ✅' + (d.deviceName ? ' — ' + d.deviceName : '');
  else if (d.pin) $('link').textContent = 'تعمل برمز الدخول القديم. الأفضل ربطها من لوحة إدارة سند.';
  else { $('link').innerHTML = 'غير مرتبطة. افتح <a href="https://taqweem.wasl.uk/idara" target="_blank">لوحة إدارة سند</a> واضغط «اربط أداة هذا المتصفح».'; }
}
chrome.storage.local.get(['pin', 'device', 'deviceName', 'auto', 'last'], d => { link(d); $('auto').checked = d.auto !== false; show(d.last); });
$('auto').addEventListener('change', () => chrome.storage.local.set({ auto: $('auto').checked }));
$('go').addEventListener('click', () => {
  $('go').disabled = true; $('log').textContent = 'جارٍ فتح المواقع وجلب البيانات… قد يستغرق بضع دقائق، وستُفتح تبويبات وتُغلق تلقائياً.';
  chrome.runtime.sendMessage('sync', () => { chrome.storage.local.get('last', d => { show(d.last); $('go').disabled = false; }); });
});
chrome.storage.onChanged.addListener(c => { if (c.last) show(c.last.newValue); if (c.device) chrome.storage.local.get(['pin', 'device', 'deviceName'], link); });
