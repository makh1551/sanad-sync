// يعمل داخل منصة مدرستي: إذا فُتح تقرير من «نُظُم» يظهر زر «أرسل لسند»
(function () {
  const txt = e => (e ? e.innerText.trim().replace(/\s+/g, ' ') : '');
  function kindOf(root) {
    if (root.querySelector('.nzp-class-head')) return 'weekly_plan';
    if ([...root.querySelectorAll('th')].some(x => /حالة الدخول/.test(x.innerText))) return 'logins';
    return '';
  }
  function school() { const m = document.title.split('|')[1]; return m ? m.trim() : ''; }
  function plan(root) {
    const classes = [], seen = new Set(); let cur = null, week = '';
    root.querySelectorAll('.nzp-class-head, table').forEach(el => {
      if (el.classList.contains('nzp-class-head')) {
        const s = txt(el), m = s.match(/الفصل:\s*(.+?)\s*للأسبوع:\s*(.+)$/);
        cur = m ? m[1] : s.replace(/^.*الفصل:\s*/, ''); if (m) week = m[2]; return;
      }
      if (!cur || seen.has(cur) || el.querySelector('table') || !el.querySelector('.nzp-subject')) return;
      const days = [];
      [...el.querySelectorAll('tr')].slice(1).forEach(tr => {
        const c = [...tr.children]; if (c.length < 2) return;
        days.push({ day: txt(c[0]), cells: c.slice(1).map((td, i) => ({ p: i + 1, s: txt(td.querySelector('.nzp-subject')), t: txt(td.querySelector('.nzp-teacher')) })).filter(x => x.s) });
      });
      if (days.length) { classes.push({ cls: cur, days }); seen.add(cur); }
    });
    return { week, school: school(), classes };
  }
  function logins(root) {
    const t = [...root.querySelectorAll('table')].filter(x => !x.querySelector('table') && /حالة الدخول/.test(x.innerText)).sort((a, b) => b.rows.length - a.rows.length)[0];
    if (!t) return { rows: [] };
    const H = [...t.querySelectorAll('th')].map(txt), ix = re => H.findIndex(h => re.test(h));
    const ni = ix(/الاسم/), ci = ix(/الفصل/), ri = ix(/الدور/), si = ix(/حالة الدخول/);
    const rows = [...t.querySelectorAll('tbody tr')].map(tr => { const c = tr.children; return { n: txt(c[ni]), c: txt(c[ci]), role: txt(c[ri]), status: txt(c[si]) }; }).filter(r => r.n && r.status);
    return { school: school(), rows }; // رقم الهوية لا يُرسل
  }
  let btn = null;
  function ensure() {
    const root = document.getElementById('nizam-report');
    const k = root ? kindOf(root) : '';
    if (!k) { if (btn) { btn.remove(); btn = null; } return; }
    if (btn) return;
    btn = document.createElement('button');
    btn.textContent = 'أرسل لسند 🤝';
    btn.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:2147483647;background:#15445A;color:#fff;border:0;border-radius:10px;padding:12px 18px;font:700 16px Tahoma,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.3)';
    btn.onclick = () => {
      const r = document.getElementById('nizam-report'); if (!r) return;
      const kind = kindOf(r), payload = kind === 'weekly_plan' ? plan(r) : logins(r);
      btn.textContent = 'جارٍ الإرسال…'; btn.disabled = true;
      chrome.runtime.sendMessage({ type: 'nizam', kind, payload }, res => {
        btn.disabled = false; btn.textContent = (res && res.text) || 'تعذّر الإرسال';
        setTimeout(() => { if (btn) btn.textContent = 'أرسل لسند 🤝'; }, 6000);
      });
    };
    document.body.appendChild(btn);
  }
  setInterval(ensure, 2000);
})();
