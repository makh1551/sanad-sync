importScripts('card.js');
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
  const { device } = await chrome.storage.local.get('device');
  const headers = { 'content-type': 'application/json' };
  if (device) headers['x-device'] = device; else headers['x-pin'] = pin || '';
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  if (r.status === 401) throw new Error(device ? 'أُلغي ربط هذه الأداة. اربطها من لوحة إدارة سند' : 'رمز الدخول غير صحيح');
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

// تُنفَّذ داخل صفحة «استعراض الطلاب»: تمر على الصفحات وتقرأ الاسم والصف والفصل وجوال ولي الأمر (بدون الهوية)
async function scrapeList() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rowsOf = () => [...document.querySelectorAll('table tbody tr')];
  for (let i = 0; i < 40 && !rowsOf().length; i++) await sleep(1000);
  const H = [...document.querySelectorAll('table thead th')].map(x => x.innerText.trim()), ix = re => H.findIndex(h => re.test(h));
  const ni = ix(/الاسم|الطالب/), pi = ix(/الجوال/), gi = ix(/الصف/), ci = ix(/الفصل/);
  if (ni < 0) return { rows: [], error: 'تغيّر شكل صفحة استعراض الطلاب' };
  const out = [], seen = new Set();
  for (let page = 0; page < 15; page++) {
    const rs = rowsOf(); let added = 0;
    for (const tr of rs) {
      const c = [...tr.children].map(td => td.innerText.trim().replace(/\s+/g, ' '));
      const key = c[ni] + '|' + (c[gi] || '') + '|' + (c[ci] || '');
      if (!c[ni] || seen.has(key)) continue; seen.add(key); added++;
      out.push({ n: c[ni], g: gi >= 0 ? c[gi] : '', c: ci >= 0 ? c[ci] : '', ph: pi >= 0 ? c[pi].replace(/\D/g, '') : '' });
    }
    const next = [...document.querySelectorAll('button,a')].find(b => /الصفحة التالية/.test(b.innerText) && !b.disabled && !b.classList.contains('disabled') && b.getAttribute('aria-disabled') !== 'true');
    if (!next || !added) break;
    const first = rs[0] ? rs[0].innerText : '';
    next.click();
    for (let i = 0; i < 20; i++) { await sleep(500); const f = rowsOf()[0]; if (f && f.innerText !== first) break; }
  }
  return { rows: out };
}

async function syncDirectory(pin) {
  const tab = await chrome.tabs.create({ url: 'https://s.tahdir.net/_students/list', active: false });
  let d;
  try { await waitLoad(tab.id); const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeList }); d = (r && r.result) || { rows: [] }; }
  finally { try { await chrome.tabs.remove(tab.id); } catch (e) {} }
  if (d.error) return 'دليل الطلاب: ' + d.error;
  if (!d.rows.length) return 'دليل الطلاب: لم تظهر القائمة.';
  const res = await post('/api/sync', pin, { kind: 'students_list', date: today(), rows: d.rows.slice(0, 1500) });
  return 'دليل الطلاب: ' + (res.count || d.rows.length) + ' طالباً ✅';
}

// تُنفَّذ داخل صفحة جدول ذي صفحات: تقرأ العناوين وكل الصفوف مع المرور على «الصفحة التالية»
async function scrapePaged() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rowsOf = () => [...document.querySelectorAll('table tbody tr')];
  for (let i = 0; i < 30 && !rowsOf().length; i++) await sleep(1000);
  const headers = [...document.querySelectorAll('table thead th')].map(x => x.innerText.trim());
  const out = [], seen = new Set();
  for (let page = 0; page < 20; page++) {
    const rs = rowsOf(); let added = 0;
    for (const tr of rs) { const c = [...tr.children].map(td => td.innerText.trim().replace(/\s+/g, ' ').replace(/\d{9,}/g, '')); const k = c.join('|'); if (seen.has(k)) continue; seen.add(k); added++; out.push(c); }
    const next = [...document.querySelectorAll('button,a')].find(x => /الصفحة التالية/.test(x.innerText) && !x.disabled && !x.classList.contains('disabled'));
    if (!next || !added) break;
    const first = rs[0] ? rs[0].innerText : ''; next.click();
    for (let i = 0; i < 20; i++) { await sleep(500); const f = rowsOf()[0]; if (f && f.innerText !== first) break; }
  }
  return { headers, rows: out };
}

async function syncBehavior(pin) {
  const tab = await chrome.tabs.create({ url: 'https://s.tahdir.net/_students/bis', active: false });
  let d;
  try { await waitLoad(tab.id); const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapePaged }); d = (r && r.result) || { headers: [], rows: [] }; }
  finally { try { await chrome.tabs.remove(tab.id); } catch (e) {} }
  if (!d.headers.length) return 'السلوك: لم تظهر صفحة المخالفات.';
  const res = await post('/api/sync', pin, { kind: 'behavior', date: today(), headers: d.headers, rows: d.rows.slice(0, 3000) });
  return 'السلوك: ' + (res.count != null ? res.count : d.rows.length) + ' مخالفة ✅';
}

async function syncTeachers(pin) {
  const d = await grab('https://s.tahdir.net/_teachers/reports/daily');
  if (!d.rows.length) return 'المعلمون: التقرير فارغ أو لم يظهر.';
  if (d.date && d.date !== today()) return 'المعلمون: التقرير المعروض ليس لتاريخ اليوم.';
  const res = await post('/api/sync', pin, { kind: 'teachers_daily', date: today(), headers: d.headers, rows: d.rows.slice(0, 300) });
  return 'المعلمون: ' + (res.absent != null ? res.absent + ' حالة غياب أو تأخر' : d.rows.length + ' صفاً') + ' ✅';
}

async function runIn(url, func) {
  const tab = await chrome.tabs.create({ url, active: false });
  try { await waitLoad(tab.id); const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func }); return (r && r.result) || {}; }
  finally { try { await chrome.tabs.remove(tab.id); } catch (e) {} }
}

// تُنفَّذ داخل صفحتي «إجراءات الغياب» و«إجراءات التأخر»: تختار كل فصل وتضغط «عرض الطلاب» فقط وتقرأ الاسم والإجمالي.
// لا تضغط أي زر إرسال أو تحويل أو طباعة.
async function scrapeAlerts() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const findSel = () => [...document.querySelectorAll('select')].find(s => s.options.length > 5 && [...s.options].some(o => / - /.test(o.text)));
  const btn = () => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'عرض الطلاب');
  let sel = null;
  for (let i = 0; i < 30 && !(sel = findSel()); i++) await sleep(1000);
  if (!sel || !btn()) return { rows: [], error: 'لم تظهر الصفحة أو تغيّر شكلها' };
  const snap = () => [...document.querySelectorAll('table tbody tr')].map(r => r.innerText).join('|');
  const out = []; let classes = 0;
  for (let i = 1; i < sel.options.length; i++) {
    const label = sel.options[i].text.trim(), before = snap();
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);
    const b = btn(); if (!b) break; b.click();
    await sleep(1500);
    for (let j = 0; j < 9 && snap() === before; j++) await sleep(500);
    await sleep(400);
    const t = document.querySelector('table'); if (!t) continue;
    const H = [...t.querySelectorAll('thead th')].map(x => x.innerText.trim());
    const ni = Math.max(0, H.findIndex(h => /الطالب/.test(h))), ti = H.findIndex(h => /اجمالي|إجمالي/.test(h));
    if (ti < 0) return { rows: [], error: 'تغيّر شكل الجدول' };
    classes++;
    for (const tr of t.querySelectorAll('tbody tr')) {
      const c = [...tr.children].map(td => td.innerText.trim().replace(/\s+/g, ' '));
      const n = (c[ni] || '').replace(/\d{9,}/g, '').trim(), tot = parseInt(c[ti]) || 0;
      if (n && tot > 0) out.push({ n, label, t: tot });
    }
  }
  return { rows: out, classes };
}

function clsOf(label) {
  const kk = /خالد/.test(label), p = label.replace('خالد', '').split(' - ');
  let g = (p[0] || '').trim(); g = GR[g] || g; const c0 = (p[1] || '').trim();
  return { k: kk ? 'kingkhalid' : 'salami', c: (g + ' ' + (SEC[c0] || c0)).trim() };
}

async function syncAlerts(pin, type) {
  const label = type === 'late' ? 'إنذارات التأخر' : 'إنذارات الغياب';
  const d = await runIn('https://s.tahdir.net/_students/' + (type === 'late' ? 'alerts2' : 'alerts'), scrapeAlerts);
  if (d.error) return label + ': ' + d.error;
  if (!d.classes) return label + ': لم تُقرأ الفصول.';
  const rows = (d.rows || []).map(r => Object.assign({ n: r.n, t: r.t }, clsOf(r.label)));
  const res = await post('/api/sync', pin, { kind: 'alerts', type, date: today(), classes: d.classes, rows: rows.slice(0, 2000) });
  return label + ': ' + (res.count || 0) + ' طالباً بلغ حد الإنذار (' + d.classes + ' فصلاً) ✅';
}

// تُنفَّذ داخل صفحتي «جدول المناوبة» و«جدول الإشراف»: قراءة فقط، لا تضغط «حذف» ولا تغيّر القوائم
async function scrapeShifts() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const find = () => [...document.querySelectorAll('table')].find(t => [...t.querySelectorAll('th')].some(h => /المعلمين/.test(h.innerText)));
  let t = null;
  for (let i = 0; i < 30 && !(t = find()); i++) await sleep(1000);
  if (!t) return { days: [], error: 'لم يظهر الجدول' };
  await sleep(1500);
  const days = [...t.querySelectorAll('tbody tr')].map(tr => {
    const td = tr.children; if (td.length < 2) return null;
    return { d: td[0].innerText.trim(), names: td[1].innerText.split('حذف').map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean) };
  }).filter(x => x && x.d);
  return { days };
}

async function syncDuty(pin, type) {
  const label = type === 'super' ? 'جدول الإشراف' : 'جدول المناوبة';
  const d = await runIn('https://s.tahdir.net/_teachers/' + (type === 'super' ? 'shifts2' : 'shifts'), scrapeShifts);
  if (d.error) return label + ': ' + d.error;
  if (!(d.days || []).length) return label + ': فارغ.';
  const res = await post('/api/sync', pin, { kind: 'duty', type, date: today(), days: d.days.slice(0, 7) });
  return label + ': ' + (res.count || 0) + ' تكليفاً ✅';
}

async function syncTeachersFull(pin) {
  const d = await grab('https://s.tahdir.net/_teachers/reports/fullreport');
  if (!d.rows.length) return 'تقرير المعلمين التراكمي: لم يظهر.';
  const res = await post('/api/sync', pin, { kind: 'teachers_full', date: today(), headers: d.headers, rows: d.rows.slice(0, 200) });
  return 'تقرير المعلمين التراكمي: ' + (res.count || d.rows.length) + ' ✅';
}

// تُنفَّذ داخل صفحة مدرستي: تضغط أزرار لوحة «نُظُم» وتنتظر التقرير ثم تقرؤه
async function nizamRun(kind) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const btn = re => [...document.querySelectorAll('button')].find(b => re.test(b.innerText.replace(/\s+/g, ' ').trim()) && b.getClientRects().length);
  const waitFor = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(700); } return null; };
  if (/\/auth/i.test(location.pathname)) return { error: 'سجّل الدخول في منصة مدرستي في هذا المتصفح' };
  const api = window.__sanadNizam; if (!api) return { error: 'أعد تحميل الأداة' };
  const first = await waitFor(() => btn(kind === 'logins' ? /^متابعة الدخول اليومي$/ : /^الخطة الاسبوعية$/), 30000);
  if (!first) return { error: 'لم تظهر لوحة نُظُم في الصفحة' };
  first.click();
  const root = () => document.getElementById('nizam-report');
  if (kind === 'logins') {
    await waitFor(() => root() || btn(/متابعة بدون فصول/), 15000);
    const skip = btn(/متابعة بدون فصول/); if (skip) skip.click();
    const pull = await waitFor(() => btn(/سحب السجل من المنصة الآن/), 20000);
    if (!pull) return { error: 'لم يفتح تقرير الدخول اليومي' };
    pull.click(); await sleep(5000);
    let last = -1, stable = 0;
    for (let i = 0; i < 80 && stable < 4; i++) { const n = api.logins(root()).rows.length; if (n > 1 && n === last) stable++; else stable = 0; last = n; await sleep(1000); }
    return { payload: api.logins(root()) };
  }
  const go = await waitFor(() => btn(/^استخراج الخطة$/), 12000);
  if (!go) return { error: 'لم تفتح نافذة الخطة الأسبوعية' };
  // اختيار أسبوع اليوم، أو الأسبوع القادم في نهاية الأسبوع
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => /\d{4}-\d{2}-\d{2}/.test(o.text)));
  if (sel) {
    const opt = [...sel.options].find(o => { const m = o.text.match(/(\d{4}-\d{2}-\d{2})\D+(\d{4}-\d{2}-\d{2})/); return m && m[2] >= today; });
    if (opt && sel.value !== opt.value) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1200); }
  }
  (btn(/^استخراج الخطة$/) || go).click();
  await waitFor(() => root() && root().querySelector('.nzp-class-head'), 150000);
  if (!root()) return { error: 'لم تُستخرج الخطة' };
  let last = -1, stable = 0;
  for (let i = 0; i < 40 && stable < 3; i++) { const n = root().querySelectorAll('.nzp-class-head').length; if (n > 0 && n === last) stable++; else stable = 0; last = n; await sleep(1000); }
  return { payload: api.plan(root()) };
}

async function syncMadrasati(pin, kind) {
  const label = kind === 'logins' ? 'دخول مدرستي' : 'الخطة الأسبوعية';
  const { madrasatiUrl } = await chrome.storage.local.get('madrasatiUrl');
  if (!madrasatiUrl) return label + ': افتح صفحة المدرسة في منصة مدرستي مرة واحدة لتتعرف عليها الأداة.';
  const tab = await chrome.tabs.create({ url: madrasatiUrl, active: false });
  try {
    await waitLoad(tab.id);
    await new Promise(r => setTimeout(r, 3000));
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: nizamRun, args: [kind] });
    const res = (r && r.result) || { error: 'لا رد من الصفحة' };
    if (res.error) return label + ': ' + res.error;
    const p = res.payload || {};
    if (kind === 'logins' && !(p.rows || []).length) return label + ': السجل فارغ.';
    if (kind === 'weekly_plan' && !(p.classes || []).length) return label + ': لم أجد خطة.';
    const out = await post('/api/sync', pin, Object.assign({ kind, date: today() }, p));
    return label + ': ' + (out.count || 0) + (kind === 'logins' ? ' مستخدماً' : ' فصلاً') + ' ✅';
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

async function syncAll(manual) {
  const { pin, device } = await chrome.storage.local.get(['pin', 'device']);
  if (!pin && !device) { await save(['الأداة غير مرتبطة. اربطها من لوحة إدارة سند.'], manual); return; }
  const lock = await chrome.storage.local.get('busy');
  if (lock.busy && Date.now() - lock.busy < 240000) return;
  await chrome.storage.local.set({ busy: Date.now() });
  const out = [];
  try {
    // المهام السريعة أولاً: حضور الطلاب والمعلمين والسلوك
    for (const f of [syncStudents, syncTeachers, syncBehavior]) { try { out.push(await f(pin)); } catch (e) { out.push('خطأ: ' + (e.message || e)); } }
    // المهام الطويلة تُنفَّذ واحدة واحدة في الخلفية، كل مهمة في تشغيل مستقل حتى لا يوقفها المتصفح
    const st = await chrome.storage.local.get(['dirDay', 'extraDay', 'madLogins', 'madPlan', 'ttDay', 'queue']);
    const q = [];
    if (manual || st.dirDay !== today()) q.push('dir');
    if (manual || st.extraDay !== today()) q.push('alerts_abs', 'alerts_late', 'duty_shift', 'duty_super', 'tch_full');
    if (manual || !st.madLogins || Date.now() - st.madLogins > 3 * 3600e3) q.push('logins');
    if (manual || st.madPlan !== today()) q.push('weekly_plan');
    if (manual || st.ttDay !== today()) q.push('tt_img');
    // قائمة قديمة عالقة لا تمنع البدء: اليدوي يبدأ قائمة جديدة، والتلقائي يكمل العالقة
    const pend = st.queue || [];
    const run = manual ? q : (pend.length ? pend : q);
    if (run.length) {
      await chrome.storage.local.set(manual || !pend.length ? { queue: run, xOk: true } : { queue: run });
      chrome.alarms.create('sanadq', { delayInMinutes: 0.5 });
      out.push('… يتبع: ' + run.length + ' مهمة في الخلفية');
    }
  } finally {
    await chrome.storage.local.set({ busy: 0 });
    await save(out, manual);
  }
}

const JOBS = {
  dir: syncDirectory,
  alerts_abs: p => syncAlerts(p, 'absence'), alerts_late: p => syncAlerts(p, 'late'),
  duty_shift: p => syncDuty(p, 'shift'), duty_super: p => syncDuty(p, 'super'),
  tch_full: syncTeachersFull,
  logins: p => syncMadrasati(p, 'logins'), weekly_plan: p => syncMadrasati(p, 'weekly_plan'),
  tt_img: syncTTImages
};
const EXTRA = ['alerts_abs', 'alerts_late', 'duty_shift', 'duty_super', 'tch_full'];

// تنفّذ مهمة واحدة من قائمة الانتظار ثم تجدول التالية
async function runQueue() {
  const s = await chrome.storage.local.get(['queue', 'pin', 'last', 'xOk']);
  const q = s.queue || []; if (!q.length) return;
  const job = q.shift(); await chrome.storage.local.set({ queue: q });
  let line; try { line = await JOBS[job](s.pin); } catch (e) { line = 'خطأ: ' + (e.message || e); }
  const ok = /✅/.test(line), set = {};
  if (ok && job === 'dir') set.dirDay = today();
  if (ok && job === 'logins') set.madLogins = Date.now();
  if (ok && job === 'weekly_plan') set.madPlan = today();
  if (ok && job === 'tt_img') set.ttDay = today();
  let xOk = s.xOk !== false; if (EXTRA.includes(job) && !ok) xOk = false; set.xOk = xOk;
  if (job === 'tch_full' && xOk) set.extraDay = today();
  await chrome.storage.local.set(set);
  const last = s.last || { lines: [] };
  const lines = (last.lines || []).filter(l => !/^… يتبع/.test(l)).concat([line]);
  if (q.length) lines.push('… يتبع: ' + q.length + ' مهمة في الخلفية');
  await save(lines, last.manual);
  if (q.length) chrome.alarms.create('sanadq', { delayInMinutes: 0.5 });
}

// بطاقة «المدرسة الآن»: تجلب الأرقام المجمعة من سند، ترسمها صورة، وترفعها ليرسلها سند عند الطلب
async function syncCard() {
  const { pin, device } = await chrome.storage.local.get(['pin', 'device']);
  if (!pin && !device) return;
  const d = await post('/api/sync', pin, { kind: 'card_data' });
  const c = new OffscreenCanvas(1080, 1080);
  drawCard(c.getContext('2d'), d);
  await post('/api/sync', pin, { kind: 'card', jpg: await toJpg(c) });
}

async function toJpg(c) {
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  const u = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(bin);
}

// صور الجداول الأسبوعية: صورة لكل معلم، مرة في اليوم
async function syncTTImages(pin) {
  const d = await post('/api/sync', pin, { kind: 'tt_data' });
  const T = d.teachers || []; if (!T.length) return 'صور الجداول: لم يصل جدول من سند.';
  let ok = 0;
  for (const t of T) {
    try {
      const c = new OffscreenCanvas(1280, 820);
      drawTT(c.getContext('2d'), t, d.periods || []);
      const r = await post('/api/sync', pin, { kind: 'tt_img', key: t.key, jpg: await toJpg(c) });
      if (r && r.ok) ok++;
    } catch (e) {}
  }
  return ok ? 'صور الجداول: ' + ok + ' من ' + T.length + ' ✅' : 'صور الجداول: تعذّر الرفع.';
}

function save(lines, manual) {
  const t = riyadh().toISOString().slice(0, 16).replace('T', ' ');
  // تنبيه على أيقونة الأداة إذا انتهت جلسة أحد الموقعين أو أُلغي الربط
  const bad = lines.some(l => /سجّل الدخول|مسجّل الدخول|لم تظهر لوحة|غير مرتبطة|أُلغي ربط/.test(l));
  try { chrome.action.setBadgeBackgroundColor({ color: '#d9534f' }); chrome.action.setBadgeText({ text: bad ? '!' : '' }); } catch (e) {}
  return chrome.storage.local.set({ last: { at: t, lines, manual: !!manual } });
}

// بعد تشغيل update.bat تتغير الملفات على القرص: إن اختلف رقم الإصدار أعادت الأداة تحميل نفسها
async function selfCheck() {
  try {
    const disk = await (await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })).json();
    if (disk.version && disk.version !== chrome.runtime.getManifest().version) { chrome.runtime.reload(); return; }
  } catch (e) {}
  try {
    const s = await chrome.storage.local.get('verAt');
    if (s.verAt && Date.now() - s.verAt < 3 * 3600e3) return;
    const r = await fetch('https://raw.githubusercontent.com/makh1551/sanad-sync/main/manifest.json', { cache: 'no-store' });
    if (r.ok) { const m = await r.json(); await chrome.storage.local.set({ verAt: Date.now(), newVer: m.version || '' }); }
  } catch (e) {}
}

const setAlarms = () => { chrome.alarms.create('sanad', { periodInMinutes: 30 }); chrome.alarms.create('sanadcard', { periodInMinutes: 5 }); };
chrome.runtime.onInstalled.addListener(setAlarms);
chrome.runtime.onStartup.addListener(setAlarms);
chrome.alarms.onAlarm.addListener(async a => {
  if (a.name === 'sanadq') { await runQueue(); return; }
  if (a.name !== 'sanad' && a.name !== 'sanadcard') return;
  await selfCheck();
  const { auto } = await chrome.storage.local.get('auto');
  if (auto === false) return;
  const n = riyadh(), day = n.getUTCDay(), h = n.getUTCHours();
  if (a.name === 'sanadcard') { if (day <= 4 && h >= 6 && h < 14) { try { await syncCard(); } catch (e) {} } return; }
  if (day > 4 || h < 7 || h >= 13) return; // الأحد–الخميس، 7 ص – 1 م بتوقيت الرياض
  syncAll(false);
});
chrome.runtime.onMessage.addListener((m, s, reply) => { if (m === 'check') { selfCheck().then(() => reply(true)); return true; } });
chrome.runtime.onMessage.addListener((m, s, reply) => { if (m === 'sync') { syncAll(true).then(() => syncCard().catch(() => {})).then(() => reply(true)); return true; } });
chrome.runtime.onMessage.addListener((m, s, reply) => {
  if (!m || m.type !== 'nizam') return;
  (async () => {
    try {
      const { pin, device } = await chrome.storage.local.get(['pin', 'device']);
      if (!pin && !device) return reply({ text: 'اربط الأداة من لوحة إدارة سند أولاً' });
      const p = m.payload || {};
      if (m.kind === 'weekly_plan' && !(p.classes || []).length) return reply({ text: 'لم أجد خطة في الصفحة' });
      if (m.kind === 'logins' && !(p.rows || []).length) return reply({ text: 'لم أجد سجل دخول في الصفحة' });
      const r = await post('/api/sync', pin, Object.assign({ kind: m.kind, date: today() }, p));
      reply({ text: 'وصل سند ✅ (' + (r.count || 0) + (m.kind === 'weekly_plan' ? ' فصلاً' : ' مستخدماً') + ')' });
    } catch (e) { reply({ text: 'خطأ: ' + (e.message || e) }); }
  })();
  return true;
});

