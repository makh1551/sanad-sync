const $ = id => document.getElementById(id);
const NAMES = { dir: 'دليل الطلاب', alerts_abs: 'الغياب المتكرر', alerts_late: 'التأخر المتكرر', duty_shift: 'جدول المناوبة', duty_super: 'جدول الإشراف', tch_full: 'تقرير المعلمين التراكمي', logins: 'دخول مدرستي', logins_close: 'إقفال دخول الأسبوع', weekly_plan: 'الخطة الأسبوعية', tt_img: 'صور الجداول' };
const ICON = { wait: '⏳', run: '🔄', ok: '✅', err: '⚠️' }, STATE = { wait: 'في الانتظار', run: 'تعمل الآن…', ok: '', err: '' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const item = (ic, title, sub, extra) => '<div class="it"><div class="ic">' + ic + '</div><div class="tx"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' + (extra || '') + '</div>';
let OKAT = {};
const when = ts => ts ? new Date(ts).toLocaleString('ar-SA-u-nu-latn', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
function show(l) {
  if (!l) { $('at').textContent = ''; $('log').innerHTML = item('⏳', 'لم تجرِ مزامنة بعد', ''); return; }
  $('at').textContent = l.at + (l.manual ? '' : ' (تلقائية)');
  $('log').innerHTML = (l.lines || []).filter(x => !/^… يتبع/.test(x)).map(x => {
    const ok = /✅/.test(x), i = x.indexOf(':'), t = i > 0 ? x.slice(0, i) : x, s = i > 0 ? x.slice(i + 1).replace('✅', '').trim() : '';
    return item(ok ? '✅' : '⚠️', t, s);
  }).join('') || item('⏳', 'لا نتائج', '');
}
function jobs(J) {
  J = J || []; $('bgc').hidden = !J.length; if (!J.length) return;
  const done = J.filter(x => x.s === 'ok' || x.s === 'err').length;
  $('prog').textContent = done + ' من ' + J.length; $('bar').style.width = Math.round(done / J.length * 100) + '%';
  const bad = J.filter(x => x.s === 'err').length;
  $('all').hidden = !bad; $('all').textContent = 'أعد المتعثرات (' + bad + ')';
  $('jobs').innerHTML = J.map(x => {
    let sub = STATE[x.s] || ''; if (x.line) { const i = x.line.indexOf(':'); sub = (i > 0 ? x.line.slice(i + 1) : x.line).replace('✅', '').trim(); }
    if (x.s !== 'ok' && OKAT[x.k]) sub += (sub ? ' — ' : '') + 'آخر نجاح: ' + when(OKAT[x.k]);
    return item(ICON[x.s] || '⏳', NAMES[x.k] || x.k, sub, x.s === 'err' ? '<button class="mini" data-k="' + esc(x.k) + '">أعد</button>' : '');
  }).join('');
}
function link(d) {
  if (d.device) $('link').innerHTML = '<span class="chip g">مرتبطة بسند</span> ' + esc(d.deviceName || '');
  else if (d.pin) $('link').innerHTML = '<span class="chip o">رمز قديم</span> الأفضل ربطها من لوحة إدارة سند.';
  else $('link').innerHTML = '<span class="chip r">غير مرتبطة</span> افتح <a href="https://taqweem.wasl.uk/idara" target="_blank">لوحة إدارة سند</a> واضغط «اربط أداة هذا المتصفح».';
}
chrome.storage.local.get(['pin', 'device', 'deviceName', 'auto', 'last', 'jobs', 'okAt'], d => { OKAT = d.okAt || {}; link(d); $('auto').checked = d.auto !== false; show(d.last); jobs(d.jobs); });
$('jobs').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (!b) return; b.disabled = true; chrome.runtime.sendMessage({ type: 'retry', k: b.dataset.k }); });
$('all').addEventListener('click', () => { $('all').disabled = true; chrome.runtime.sendMessage({ type: 'retry', k: '*' }, () => { $('all').disabled = false; }); });
$('auto').addEventListener('change', () => chrome.storage.local.set({ auto: $('auto').checked }));
$('go').addEventListener('click', () => {
  $('go').disabled = true; $('at').textContent = ''; $('log').innerHTML = item('🔄', 'جارٍ جلب البيانات…', 'ستُفتح تبويبات وتُغلق تلقائياً');
  chrome.runtime.sendMessage('sync', () => { chrome.storage.local.get(['last', 'jobs'], d => { show(d.last); jobs(d.jobs); $('go').disabled = false; }); });
});
chrome.storage.onChanged.addListener(c => { if (c.okAt) OKAT = c.okAt.newValue || {}; if (c.last) show(c.last.newValue); if (c.jobs) jobs(c.jobs.newValue); if (c.device) chrome.storage.local.get(['pin', 'device', 'deviceName'], link); });
// رقم الإصدار، وتنبيه إن وُجد إصدار أحدث في GitHub
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
function ver(nv) {
  const v = chrome.runtime.getManifest().version, nw = nv && cmp(nv, v) > 0;
  $('ver').textContent = 'الإصدار ' + v + (nw ? ' — يوجد إصدار ' + nv + '. شغّل ملف update.bat في مجلد الأداة.' : '');
  $('ver').style.color = nw ? '#b45309' : '#6D6E71'; $('ver').style.fontWeight = nw ? '700' : '400';
}
chrome.storage.local.get('newVer', d => ver(d.newVer));
chrome.runtime.sendMessage('check', () => chrome.storage.local.get('newVer', d => ver(d.newVer)));
