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
if (typeof module !== 'undefined') module.exports = drawCard;
