// ترسم بطاقة «المدرسة الآن» (1080×1080) بأرقام مجمعة دون أسماء
function drawCard(ctx, d, fontFamily) {
  const W = 1080, H = 1080, F = fontFamily || '"Segoe UI", Tahoma, Arial, sans-serif';
  const C = { primary: '#15445A', green: '#07A869', blue: '#3D7EB9', teal: '#0DA9A6', gold: '#C1B48A', bg: '#F3F1EF', text: '#231F20', muted: '#6D6E71', line: '#DEDBD6' };
  const font = (px, bold) => { ctx.font = (bold ? 'bold ' : '') + px + 'px ' + F; };
  const box = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  try { ctx.direction = 'rtl'; } catch (e) {}
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // الترويسة
  ctx.fillStyle = C.primary; ctx.fillRect(0, 0, W, 250);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, C.blue); g.addColorStop(0.5, C.teal); g.addColorStop(1, C.green);
  ctx.fillStyle = g; ctx.fillRect(0, 250, W, 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.gold; font(84, true); ctx.fillText('المدرسة الآن', W - 64, 130);
  ctx.fillStyle = '#FFFFFF'; font(40, false); ctx.fillText((d.day || '') + ' ' + (d.ds || '') + '  ·  ' + (d.hm || ''), W - 64, 200);

  // شريط الحصة
  ctx.fillStyle = '#FFFFFF'; box(48, 300, W - 96, 120, 22); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; box(48, 300, W - 96, 120, 22); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = C.primary; font(44, true);
  ctx.fillText(d.slot || 'لم يصل جدول الحصص', W / 2, 376);

  // المربعات الأربعة
  const stu = d.stu, tch = d.tch;
  const tiles = [
    { v: stu ? stu.ab : '—', l: 'غياب الطلاب', s: stu ? 'من ' + stu.tot + ' طالباً' : 'لم يصل تقرير اليوم', c: C.primary },
    { v: stu ? stu.la : '—', l: 'تأخر الطلاب', s: stu ? 'من ' + stu.tot + ' طالباً' : 'لم يصل تقرير اليوم', c: C.blue },
    { v: tch ? tch.n : '—', l: 'غياب المعلمين وتأخرهم', s: tch ? 'من ' + tch.total + ' معلماً' : 'لم يصل تقرير اليوم', c: C.teal },
    { v: d.maint == null ? '—' : d.maint, l: 'بلاغات الصيانة المفتوحة', s: 'لوحة البلاغات', c: C.green }
  ];
  const tw = (W - 96 - 32) / 2, th = 250;
  tiles.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W - 48 - tw - col * (tw + 32), y = 452 + row * (th + 32);
    ctx.fillStyle = '#FFFFFF'; box(x, y, tw, th, 22); ctx.fill();
    ctx.fillStyle = t.c; box(x + tw - 14, y, 14, th, 7); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = t.c; font(112, true); ctx.fillText(String(t.v), x + tw / 2, y + 120);
    ctx.fillStyle = C.text; font(36, true); ctx.fillText(t.l, x + tw / 2, y + 178);
    ctx.fillStyle = C.muted; font(28, false); ctx.fillText(t.s, x + tw / 2, y + 222);
  });

  // التذييل
  ctx.textAlign = 'center';
  ctx.fillStyle = C.primary; font(32, true); ctx.fillText('مدرسة أبي عبدالرحمن السلمي وابتدائية الملك خالد', W / 2, 1022);
  ctx.fillStyle = C.muted; font(26, false); ctx.fillText('المصدر: التحضير الذكي ولوحة البلاغات  ·  إعداد: الفريق التقني بالمدرسة', W / 2, 1060);
}

// ترسم الجدول الأسبوعي لمعلم واحد (1280×820)
function drawTT(ctx, t, periods, fontFamily) {
  const W = 1280, H = 820, F = fontFamily || '"Segoe UI", Tahoma, Arial, sans-serif';
  const C = { primary: '#15445A', green: '#07A869', blue: '#3D7EB9', teal: '#0DA9A6', gold: '#C1B48A', bg: '#F3F1EF', text: '#231F20', muted: '#6D6E71', line: '#DEDBD6' };
  const font = (px, bold) => { ctx.font = (bold ? 'bold ' : '') + px + 'px ' + F; };
  const fit = (txt, px, bold, max) => { let p = px; font(p, bold); while (p > 16 && ctx.measureText(txt).width > max) { p -= 2; font(p, bold); } };
  try { ctx.direction = 'rtl'; } catch (e) {}
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.primary; ctx.fillRect(0, 0, W, 150);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, C.blue); g.addColorStop(0.5, C.teal); g.addColorStop(1, C.green);
  ctx.fillStyle = g; ctx.fillRect(0, 150, W, 10);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.gold; fit(t.name || '', 54, true, W - 96); ctx.fillText(t.name || '', W - 48, 78);
  ctx.fillStyle = '#FFFFFF'; font(30, false); ctx.fillText('الجدول الأسبوعي  ·  ' + (t.school || ''), W - 48, 126);

  const sc = t.sc || {}, sj = t.sj || {};
  let np = 7; Object.keys(sc).forEach(k => { const p = +k.split('-')[1]; if (p > np) np = p; });
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  const x0 = 32, x1 = W - 32, dayW = 150, top = 184, headH = 64, rowH = 100;
  const colW = (x1 - x0 - dayW) / np;
  const colX = p => x1 - dayW - p * colW; // يسار عمود الحصة p (الحصة 1 على اليمين)
  // رأس الحصص
  ctx.fillStyle = C.primary; ctx.fillRect(x0, top, x1 - x0, headH);
  ctx.textAlign = 'center';
  for (let p = 1; p <= np; p++) {
    const cx = colX(p) + colW / 2, tm = (periods || []).find(q => String(q.p) === String(p));
    ctx.fillStyle = '#FFFFFF'; font(26, true); ctx.fillText('الحصة ' + p, cx, top + (tm ? 30 : 42));
    if (tm) { ctx.fillStyle = C.gold; font(19, false); ctx.fillText(tm.s, cx, top + 54); }
  }
  ctx.fillStyle = C.gold; font(26, true); ctx.fillText('اليوم', x1 - dayW / 2, top + 42);
  // الصفوف
  DAYS.forEach((dn, d) => {
    const y = top + headH + d * rowH;
    ctx.fillStyle = d % 2 ? '#FAF9F7' : '#FFFFFF'; ctx.fillRect(x0, y, x1 - x0, rowH);
    ctx.fillStyle = '#E9EEF0'; ctx.fillRect(x1 - dayW, y, dayW, rowH);
    ctx.fillStyle = C.primary; font(30, true); ctx.textAlign = 'center'; ctx.fillText(dn, x1 - dayW / 2, y + rowH / 2 + 10);
    for (let p = 1; p <= np; p++) {
      const k = d + '-' + p, cls = sc[k], cx = colX(p) + colW / 2;
      if (cls) {
        ctx.fillStyle = '#E6F4EE'; ctx.fillRect(colX(p) + 4, y + 4, colW - 8, rowH - 8);
        ctx.fillStyle = C.primary; fit(cls, 28, true, colW - 16); ctx.fillText(cls, cx, y + 44);
        ctx.fillStyle = C.muted; fit(sj[k] || '', 23, false, colW - 16); ctx.fillText(sj[k] || '', cx, y + 78);
      } else { ctx.fillStyle = C.line; font(24, false); ctx.fillText('—', cx, y + rowH / 2 + 8); }
    }
  });
  // الخطوط
  ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let d = 0; d <= 5; d++) { const y = top + headH + d * rowH; ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  for (let p = 0; p <= np; p++) { const x = colX(p); ctx.moveTo(x, top + headH); ctx.lineTo(x, top + headH + 5 * rowH); }
  ctx.moveTo(x0, top + headH); ctx.lineTo(x0, top + headH + 5 * rowH); ctx.moveTo(x1, top + headH); ctx.lineTo(x1, top + headH + 5 * rowH);
  ctx.stroke();
  const n = Object.keys(sc).length;
  ctx.textAlign = 'center'; ctx.fillStyle = C.muted; font(24, false);
  ctx.fillText('عدد الحصص: ' + n + '  ·  المصدر: التحضير الذكي  ·  إعداد: الفريق التقني بالمدرسة', W / 2, H - 28);
}
if (typeof module !== 'undefined') module.exports = { drawCard, drawTT };
