const BASE = 'https://taqweem.wasl.uk';
const SEC = { '1': 'أ', '2': 'ب', '3': 'ج', '4': 'د', '5': 'هـ', '6': 'و' };
const GR = { 'اول': 'الأول', 'أول': 'الأول', 'ثاني': 'الثاني', 'ثالث': 'الثالث', 'رابع': 'الرابع', 'خامس': 'الخامس', 'سادس': 'السادس' };
const riyadh = () => new Date(Date.now() + 3 * 3600e3);
const today = () => riyadh().toISOString().slice(0, 10);

// تُنفَّذ داخل صفحة التحضير الذكي: تنتظر اكتمال الجدول ثم تقرؤه
async function scrape() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let last = -1, stable = 0;
  for (let i = 0; i < 60; i++) {
    const n = document.querySelectorAll('table tbody tr').length;
    if (n > 0 && n === last) stable++; else stable = 0;
    last = n;
    if (stable >= 3) break;
    if (i > 20 && n === 0) break;
    await sleep(1000);
  }
  const t = [...document.querySelectorAll('table')].sort((a, b) => b.querySelectorAll('tbody tr').length - a.querySelectorAll('tbody tr').length)[0];
  const d = document.querySelector('input[type=date]');
  if (!t) return { headers: [], rows: [], date: d ? d.value : '', path: location.pathname };
  const headers = [...t.querySelectorAll('thead th')].map(x => x.innerText.trim());
  const rows = [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.innerText.trim().replace(/\s+/g, ' ').replace(/\d{9,}/g, '')));
  return { headers, rows, date: d ? d.value : '', path: location.pathname };
}

function waitLoad(tabId) {
  return new Promise(res => {
    const done = () => { chrome.tabs.onUpdated.removeListener(l); res(); };
    const l = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
    chrome.tabs.onUpdated.addListener(l);
    setTimeout(done, 20000);
  });
}

async function grab(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitLoad(tab.id);
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrape });
    return r && r.result ? r.result : { headers: [], rows: [] };
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

async function post(path, pin, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-pin': pin }, body: JSON.stringify(body) });
  if (r.status === 401) throw new Error('رمز الدخول غير صحيح');
  if (!r.ok) throw new Error('تعذّر الإرسال إلى سند (' + r.status + ')');
  return r.json();
}

async function syncStudents(pin) {
  const d = await grab('https://s.tahdir.net/_students/reports/daily');
  if (!d.rows.length) return 'الطلاب: لم يظهر التقرير. تأكد أنك مسجّل الدخول في التحضير الذكي.';
  if (d.date && d.date !== today()) return 'الطلاب: التقرير المعروض ليس لتاريخ اليوم (' + d.date + ').';
  const ix = re => d.headers.findIndex(h => re.test(h));
  const ni = ix(/الطالب|اسم/), gi = ix(/الصف/), ci = ix(/الفصل/), si = ix(/الحالة/);
  if (ni < 0 || si < 0) return 'الطلاب: تغيّر شكل التقرير، أبلغ الفريق التقني.';
  const tot = { salami: 0, kingkhalid: 0 }, abs = { salami: [], kingkhalid: [] };
  for (const r of d.rows) {
    const n = r[ni]; if (!n) continue;
    const g0 = gi >= 0 ? r[gi] : '', kk = /خالد/.test(g0), k = kk ? 'kingkhalid' : 'salami';
    let g = g0.replace(/الابتدائي|ابتدائي|الصف|خالد/g, '').trim().split(' ')[0]; g = GR[g] || g;
    const c0 = ci >= 0 ? r[ci] : '', c = SEC[c0] || c0, y = r[si] || '';
    tot[k]++;
    if (/غا[ئي]ب|غياب|ت[أا]خر|ستئذان/.test(y)) abs[k].push({ n, c: (g + ' ' + c).trim(), y });
  }
  for (const k of ['salami', 'kingkhalid']) await post('/api/ghiyab', pin, { school: k, date: today(), total: tot[k], rows: abs[k] });
  return 'الطلاب: ' + (abs.salami.length + abs.kingkhalid.length) + ' حالة من ' + (tot.salami + tot.kingkhalid) + ' طالباً ✅';
}

async function syncTeachers(pin) {
  const d = await grab('https://s.tahdir.net/_teachers/reports/daily');
  if (!d.rows.length) return 'المعلمون: التقرير فارغ أو لم يظهر.';
  if (d.date && d.date !== today()) return 'المعلمون: التقرير المعروض ليس لتاريخ اليوم.';
  const res = await post('/api/sync', pin, { kind: 'teachers_daily', date: today(), headers: d.headers, rows: d.rows.slice(0, 300) });
  return 'المعلمون: ' + (res.absent != null ? res.absent + ' حالة غياب أو تأخر' : d.rows.length + ' صفاً') + ' ✅';
}

async function syncAll(manual) {
  const { pin } = await chrome.storage.local.get('pin');
  if (!pin) { await save(['أدخل رمز الدخول أولاً.']); return; }
  const lock = await chrome.storage.local.get('busy');
  if (lock.busy && Date.now() - lock.busy < 180000) return;
  await chrome.storage.local.set({ busy: Date.now() });
  const out = [];
  try {
    for (const f of [syncStudents, syncTeachers]) { try { out.push(await f(pin)); } catch (e) { out.push('خطأ: ' + (e.message || e)); } }
  } finally {
    await chrome.storage.local.set({ busy: 0 });
    await save(out, manual);
  }
}
function save(lines, manual) {
  const t = riyadh().toISOString().slice(0, 16).replace('T', ' ');
  return chrome.storage.local.set({ last: { at: t, lines, manual: !!manual } });
}

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('sanad', { periodInMinutes: 30 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('sanad', { periodInMinutes: 30 }));
chrome.alarms.onAlarm.addListener(async a => {
  if (a.name !== 'sanad') return;
  const { auto } = await chrome.storage.local.get('auto');
  if (auto === false) return;
  const n = riyadh(), day = n.getUTCDay(), h = n.getUTCHours();
  if (day > 4 || h < 7 || h >= 13) return; // الأحد–الخميس، 7 ص – 1 م بتوقيت الرياض
  syncAll(false);
});
chrome.runtime.onMessage.addListener((m, s, reply) => { if (m === 'sync') { syncAll(true).then(() => reply(true)); return true; } });
