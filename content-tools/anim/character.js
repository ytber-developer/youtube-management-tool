// Nhân vật chính (nhân vật gốc của kênh) — chạy trong trang Chrome, vẽ lên canvas 2D.
// Đầu tròn to nét đen dày, lọn tóc xoăn, má hồng, áo phông màu theo kênh có biểu tượng (sao/tim),
// tay chân nét đen, bàn tay tròn, giày bầu dục. Gắn vào window.Char.
(function () {
  const D = Math.PI / 180;
  let INK = '#151515', EXTRA = 0, OUTLINE_PASS = false;
  const lerp = (a, b, k) => a + (b - a) * k;

  // Góc xương (độ). 0 = chĩa thẳng xuống, dương = quay theo chiều kim đồng hồ khi nhìn (về phía sau lưng).
  // Nhân vật mặc định nhìn sang PHẢI; tay/chân "front" là bên gần người xem.
  const POSES = {
    stand:   { lean: 0, head: 0, fArmU: 12, fArmL: 6, bArmU: -12, bArmL: -6, fLegU: 6, fLegL: 0, bLegU: -6, bLegL: 0 },
    wave:    { lean: -3, head: -6, fArmU: 120, fArmL: 160, bArmU: -14, bArmL: -8, fLegU: 6, fLegL: 0, bLegU: -6, bLegL: 0 },
    point:   { lean: 2, head: -4, fArmU: 95, fArmL: 92, bArmU: -14, bArmL: -8, fLegU: 8, fLegL: 0, bLegU: -8, bLegL: 0 },
    think:   { lean: -2, head: -10, fArmU: 25, fArmL: 165, bArmU: -12, bArmL: -6, fLegU: 4, fLegL: 0, bLegU: -4, bLegL: 0 },
    shocked: { lean: -8, head: -12, fArmU: 115, fArmL: 140, bArmU: -115, bArmL: -140, fLegU: 14, fLegL: 4, bLegU: -14, bLegL: -4 },
    cheer:   { lean: 0, head: -8, fArmU: 125, fArmL: 155, bArmU: -125, bArmL: -155, fLegU: 10, fLegL: 0, bLegU: -10, bLegL: 0 },
    walkA:   { lean: 4, head: 0, fArmU: -28, fArmL: -10, bArmU: 28, bArmL: 30, fLegU: 28, fLegL: 0, bLegU: -26, bLegL: -30 },
    walkB:   { lean: 4, head: 0, fArmU: 28, fArmL: 30, bArmU: -28, bArmL: -10, fLegU: -26, fLegL: -30, bLegU: 28, bLegL: 0 },
    runA:    { lean: 14, head: 4, fArmU: -55, fArmL: 60, bArmU: 60, bArmL: 100, fLegU: 50, fLegL: -10, bLegU: -40, bLegL: -80 },
    runB:    { lean: 14, head: 4, fArmU: 60, fArmL: 100, bArmU: -55, bArmL: 60, fLegU: -40, fLegL: -80, bLegU: 50, bLegL: -10 },
    sit:     { lean: -4, head: 0, fArmU: 30, fArmL: 70, bArmU: 20, bArmL: 60, fLegU: 90, fLegL: 0, bLegU: 85, bLegL: 0 },
    float:   { lean: 0, head: 4, fArmU: 75, fArmL: 60, bArmU: -75, bArmL: -60, fLegU: 20, fLegL: -10, bLegU: -15, bLegL: 15 },
    flail:   { lean: 0, head: -10, fArmU: 120, fArmL: 150, bArmU: -120, bArmL: -150, fLegU: 35, fLegL: 30, bLegU: -35, bLegL: -30 },
    hold:    { lean: 0, head: 0, fArmU: 20, fArmL: 10, bArmU: -20, bArmL: -10, fLegU: 6, fLegL: 0, bLegU: -6, bLegL: 0 },
    tired:   { lean: 12, head: 18, fArmU: 4, fArmL: 0, bArmU: -4, bArmL: 0, fLegU: 10, fLegL: 6, bLegU: -8, bLegL: 4 },
    lie:     { lean: 0, head: 0, fArmU: 10, fArmL: 0, bArmU: -10, bArmL: 0, fLegU: 4, fLegL: 0, bLegU: -4, bLegL: 0 },
  };

  const mix = (a, b, k) => Object.fromEntries(Object.keys(a).map(n => [n, lerp(a[n], b[n] ?? a[n], k)]));

  function face(ctx, kind, hx, hy, dir) {
    const ex = hx + 10 * dir;
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round';
    // mắt
    if (kind === 'sleep') {
      ctx.lineWidth = 4;
      for (const dx of [-14, 14]) { ctx.beginPath(); ctx.arc(ex + dx, hy - 6, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    } else {
      const ry = kind === 'shock' ? 11 : 9;
      for (const dx of [-14, 14]) { ctx.beginPath(); ctx.ellipse(ex + dx, hy - 8, 6, ry, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff';
      for (const dx of [-14, 14]) { ctx.beginPath(); ctx.arc(ex + dx + 2 * dir, hy - 11, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = INK;
    }
    // lông mày
    ctx.lineWidth = 4;
    const brow = { worry: [6, -6], shock: [-4, -4], think: [-2, 6], sick: [6, -6], angry: [-6, 6] }[kind] || [0, 0];
    for (const [i, dx] of [[0, -14], [1, 14]]) {
      ctx.beginPath(); ctx.moveTo(ex + dx - 8, hy - 26 + brow[i]); ctx.lineTo(ex + dx + 8, hy - 26 - brow[i]); ctx.stroke();
    }
    // má hồng
    ctx.fillStyle = 'rgba(255,120,140,0.45)';
    for (const dx of [-26, 26]) { ctx.beginPath(); ctx.ellipse(ex + dx, hy + 8, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    // miệng
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 4.5;
    const mx = ex, my = hy + 16;
    ctx.beginPath();
    switch (kind) {
      case 'shock': ctx.ellipse(mx, my + 2, 7, 10, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'grin': ctx.moveTo(mx - 14, my - 2); ctx.quadraticCurveTo(mx, my + 18, mx + 14, my - 2); ctx.closePath(); ctx.fill(); break;
      case 'worry': case 'sick': ctx.moveTo(mx - 11, my + 5); ctx.quadraticCurveTo(mx, my - 4, mx + 11, my + 5); ctx.stroke(); break;
      case 'think': ctx.moveTo(mx - 8, my + 2); ctx.lineTo(mx + 8, my); ctx.stroke(); break;
      case 'sleep': ctx.ellipse(mx, my + 2, 4, 5, 0, 0, Math.PI * 2); ctx.stroke(); break;
      case 'hold': ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my); ctx.stroke(); // nín thở: má phồng
        ctx.fillStyle = 'rgba(255,120,140,0.6)';
        for (const dx of [-22, 22]) { ctx.beginPath(); ctx.arc(ex + dx, hy + 8, 11, 0, Math.PI * 2); ctx.fill(); }
        break;
      default: ctx.moveTo(mx - 11, my - 2); ctx.quadraticCurveTo(mx, my + 10, mx + 11, my - 2); ctx.stroke();
    }
  }

  function emblem(ctx, kind, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#fff'; ctx.beginPath();
    if (kind === 'heart') {
      ctx.moveTo(0, 6); ctx.bezierCurveTo(-14, -4, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -4, 0, 6);
    } else {
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /**
   * Vẽ nhân vật. o = { x, y (hông), scale, rot (độ), dir (1 phải, -1 trái), pose{...}, face, shirt, emblem, stretch, alpha }
   */
  // Phông tối: vẽ trước một lượt viền trắng dày phía sau, rồi vẽ bình thường
  function draw(ctx, o) {
    if (o.outline) { INK = '#ffffff'; EXTRA = 8; OUTLINE_PASS = true; drawOnce(ctx, o); INK = '#151515'; EXTRA = 0; OUTLINE_PASS = false; }
    drawOnce(ctx, o);
  }

  function drawOnce(ctx, o) {
    const p = o.pose, s = o.scale || 1, dir = o.dir || 1, L = o.stretch || 1;
    if ((o.alpha ?? 1) <= 0) return;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.translate(o.x, o.y); ctx.rotate((o.rot || 0) * D); ctx.scale(s * dir, s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    const seg = (x0, y0, ang, len, w) => {
      const a = ang * D, l = len * L; const x1 = x0 + Math.sin(a) * l, y1 = y0 + Math.cos(a) * l;
      ctx.lineWidth = w + EXTRA; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); return [x1, y1];
    };
    const lean = p.lean * D;
    const up = (d) => [Math.sin(lean) * -d * -1, -Math.cos(lean) * d];
    const top = up(78 * L); // vai
    const shX = top[0], shY = top[1];
    // chân sau, tay sau (sau thân)
    let e = seg(-10, 0, p.bLegU, 52, 9); e = seg(e[0], e[1], p.bLegL, 50, 9); shoe(ctx, e[0], e[1]);
    e = seg(shX - 30, shY + 10, p.bArmU, 44, 8); e = seg(e[0], e[1], p.bArmL, 42, 8); hand(ctx, e[0], e[1]);
    // áo
    ctx.save(); ctx.translate(0, 0); ctx.rotate(lean);
    ctx.fillStyle = OUTLINE_PASS ? INK : (o.shirt || '#ffb347'); ctx.lineWidth = 7 + EXTRA;
    ctx.beginPath();
    ctx.moveTo(-26, -78 * L); ctx.lineTo(26, -78 * L); ctx.quadraticCurveTo(34, -78 * L, 34, -68 * L);
    ctx.lineTo(36, -4); ctx.quadraticCurveTo(36, 6, 26, 6); ctx.lineTo(-26, 6); ctx.quadraticCurveTo(-36, 6, -36, -4);
    ctx.lineTo(-34, -68 * L); ctx.quadraticCurveTo(-34, -78 * L, -26, -78 * L); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (!OUTLINE_PASS) emblem(ctx, o.emblem || 'star', 6, -44 * L, 1.1);
    ctx.restore();
    // chân trước, tay trước
    e = seg(10, 0, p.fLegU, 52, 9); e = seg(e[0], e[1], p.fLegL, 50, 9); shoe(ctx, e[0], e[1]);
    // đầu
    const ha = (180 + p.lean + p.head) * D, hx = shX + Math.sin(ha) * 58, hy = shY + Math.cos(ha) * 58;
    ctx.fillStyle = '#fff'; ctx.lineWidth = 7 + EXTRA;
    ctx.beginPath(); ctx.arc(hx, hy, 58, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // lọn tóc xoăn trên đỉnh
    ctx.lineWidth = 6 + EXTRA; ctx.beginPath();
    ctx.moveTo(hx - 6, hy - 56); ctx.bezierCurveTo(hx - 10, hy - 84, hx + 22, hy - 88, hx + 18, hy - 70);
    ctx.bezierCurveTo(hx + 14, hy - 60, hx + 2, hy - 66, hx + 8, hy - 74); ctx.stroke();
    if (!OUTLINE_PASS) face(ctx, o.face || 'smile', hx, hy, 1);
    e = seg(shX + 30, shY + 10, p.fArmU, 44, 8); e = seg(e[0], e[1], p.fArmL, 42, 8); hand(ctx, e[0], e[1]);
    ctx.restore();
  }

  function hand(ctx, x, y) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 8 + EXTRA / 2, 0, Math.PI * 2); ctx.fill(); }
  function shoe(ctx, x, y) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x + 8, y + 2, 15 + EXTRA / 2, 8 + EXTRA / 2, 0, 0, Math.PI * 2); ctx.fill(); }

  window.Char = { POSES, mix, draw };
})();
