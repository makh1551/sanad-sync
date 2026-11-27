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
  if (lock.busy && Date.now() - lock.busy < 420000) return;
  await chrome.storage.local.set({ busy: Date.now() });
  const out = [];
  try {
    for (const f of [syncStudents, syncTeachers, syncBehavior]) { try { out.push(await f(pin)); } catch (e) { out.push('خطأ: ' + (e.message || e)); } }
    // دليل الطلاب وجوالات أولياء الأمور: مرة يومياً، ويدوياً دائماً
    const dd = await chrome.storage.local.get('dirDay');
    if (manual || dd.dirDay !== today()) { try { const line = await syncDirectory(pin); out.push(line); if (/✅/.test(line)) await chrome.storage.local.set({ dirDay: today() }); } catch (e) { out.push('خطأ: ' + (e.message || e)); } }
    // مدرستي: يدوياً دائماً، وتلقائياً مرة كل 3 ساعات للدخول ومرة يومياً للخطة
    const st = await chrome.storage.local.get(['madLogins', 'madPlan']);
    const jobs = [];
    if (manual || !st.madLogins || Date.now() - st.madLogins > 3 * 3600e3) jobs.push('logins');
    if (manual || st.madPlan !== today()) jobs.push('weekly_plan');
    for (const k of jobs) {
      try { const line = await syncMadrasati(pin, k); out.push(line); if (/✅/.test(line)) await chrome.storage.local.set(k === 'logins' ? { madLogins: Date.now() } : { madPlan: today() }); }
      catch (e) { out.push('خطأ: ' + (e.message || e)); }
    }
  } finally {
    await chrome.storage.local.set({ busy: 0 });
    await save(out, manual);
  }
}
function save(lines, manual) {
  const t = riyadh().toISOString().slice(0, 16).replace('T', ' ');
  // تنبيه على أيقونة الأداة إذا انتهت جلسة أحد الموقعين أو أُلغي الربط
  const bad = lines.some(l => /سجّل الدخول|مسجّل الدخول|لم تظهر لوحة|غير مرتبطة|أُلغي ربط/.test(l));
  try { chrome.action.setBadgeBackgroundColor({ color: '#d9534f' }); chrome.action.setBadgeText({ text: bad ? '!' : '' }); } catch (e) {}
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

