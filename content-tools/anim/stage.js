// Đạo diễn cảnh: phông nền, đạo cụ, hành động của nhân vật, chữ, camera, phụ đề. Chạy trong trang Chrome.
// window.Stage.init(cfg) rồi window.Stage.frame(t). cfg do content-tools/lib/animate.js truyền vào.
(function () {
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const easeIn = (k) => k * k * k;
  const D = Math.PI / 180;
  let C, ctx, W, H, U; // U = đơn vị theo chiều cao (H/720)

  // ── Phông nền ────────────────────────────────────────────────────────────────
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = Array.from({ length: 220 }, () => ({ x: rnd(), y: rnd(), r: rnd() * 1.8 + 0.3, p: rnd() * 6 }));
  const DARK = new Set(['space', 'night']);

  function background(name, t) {
    if (name === 'space' || name === 'night') {
      const g = ctx.createRadialGradient(W * 0.7, H * 0.5, 50 * U, W * 0.6, H * 0.5, 900 * U);
      if (name === 'space') { g.addColorStop(0, '#2a1660'); g.addColorStop(0.5, '#120a33'); g.addColorStop(1, '#05040f'); }
      else { g.addColorStop(0, '#1d3557'); g.addColorStop(1, '#0b1426'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        ctx.globalAlpha = 0.45 + 0.55 * Math.sin(t * 2 + s.p) ** 2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * U, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (name === 'night') { ctx.fillStyle = '#f4f1c9'; ctx.beginPath(); ctx.arc(W * 0.85, H * 0.18, 40 * U, 0, Math.PI * 2); ctx.fill(); ground('#14213d'); }
      return;
    }
    const sky = { paper: ['#f7f3ea', '#efe6d4'], room: ['#fbf3e4', '#f1e2c8'], park: ['#bfe7ff', '#e8f7ff'], lab: ['#eef6f6', '#dfeeee'], sky: ['#9fd8ff', '#e3f4ff'], body: ['#fde8e4', '#f8d4cc'] }[name] || ['#f7f3ea', '#efe6d4'];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (name === 'paper' || name === 'body') { // đốm màu nhẹ
      ctx.globalAlpha = 0.18;
      [[0.15, 0.2, 160, '#2ec4b6'], [0.85, 0.3, 200, '#ffb347'], [0.7, 0.85, 180, '#ff8fa3']].forEach(([x, y, r, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * W, y * H, r * U, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    if (name === 'room') { // cửa sổ + sàn
      ctx.fillStyle = '#cfe8ff'; ctx.strokeStyle = '#151515'; ctx.lineWidth = 6 * U;
      ctx.beginPath(); ctx.roundRect(W * 0.62, H * 0.12, W * 0.22, H * 0.3, 12 * U); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W * 0.73, H * 0.12); ctx.lineTo(W * 0.73, H * 0.42); ctx.moveTo(W * 0.62, H * 0.27); ctx.lineTo(W * 0.84, H * 0.27); ctx.stroke();
      ground('#e3c9a0');
    }
    if (name === 'park') { ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(W * 0.86, H * 0.16, 46 * U, 0, Math.PI * 2); ctx.fill(); ground('#8fd18a'); }
    if (name === 'lab') { ctx.strokeStyle = 'rgba(0,80,80,0.08)'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 60 * U) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 60 * U) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ground('#cfe3e3'); }
    if (name === 'sky') ground('#9bd38f');
    if (name === 'paper' || name === 'body') { ctx.strokeStyle = 'rgba(21,21,21,0.25)'; ctx.lineWidth = 4 * U; ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.83); ctx.lineTo(W * 0.92, H * 0.83); ctx.stroke(); }
  }
  function ground(color) { ctx.fillStyle = color; ctx.fillRect(0, H * 0.82, W, H * 0.18); ctx.strokeStyle = '#151515'; ctx.lineWidth = 5 * U; ctx.beginPath(); ctx.moveTo(0, H * 0.82); ctx.lineTo(W, H * 0.82); ctx.stroke(); }

  // ── Đạo cụ ───────────────────────────────────────────────────────────────────
  const AT = { right: [0.70, 0.48], left: [0.25, 0.45], center: [0.5, 0.45], top: [0.62, 0.2], 'far-right': [0.84, 0.5], above: [0.30, 0.18], 'top-left': [0.18, 0.22], 'bottom-right': [0.78, 0.7] };
  const SIZE = { s: 0.14, m: 0.26, l: 0.38, xl: 0.52 };

  function blackHole(t, x, y, r) {
    ctx.save(); ctx.translate(x, y); const s = r / 120; ctx.scale(s, s);
    const glow = ctx.createRadialGradient(0, 0, 60, 0, 0, 260);
    glow.addColorStop(0, 'rgba(255,170,70,0.55)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 260, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.scale(1, 0.32);
    for (let i = 0; i < 26; i++) { const rr = 95 + i * 6, a0 = t * (2.2 - i * 0.05) + i * 0.7; ctx.strokeStyle = `hsla(${30 + i},100%,${70 - i * 1.2}%,${0.75 - i * 0.022})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + Math.PI * 1.7); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,150,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function propPos(p, k, t, i) {
    const base = AT[p.at] || AT.right;
    let x = base[0] * W, y = base[1] * H, sc = 1, rot = 0, a = 1;
    const size = (SIZE[p.size] || SIZE.m) * H;
    const ph = i * 1.7;
    switch (p.anim) {
      case 'spin': rot = t * 40; break;
      case 'pulse': sc = 1 + 0.08 * Math.sin(t * 6 + ph); break;
      case 'bob': y += Math.sin(t * 2.5 + ph) * 12 * U; break;
      case 'orbit': x += Math.cos(t * 1.2 + ph) * 160 * U; y += Math.sin(t * 1.2 + ph) * 60 * U; break;
      case 'fall': y = lerp(-0.2 * H, y, ease(clamp(k * 2.5))); break;
      case 'grow': sc = lerp(0.2, 1.2, ease(k)); break;
      case 'shrink': sc = lerp(1.2, 0.15, ease(k)); break;
      case 'shake': x += Math.sin(t * 40) * 6 * U; break;
      case 'approach': x = lerp(1.15 * W, x, ease(clamp(k * 1.8))); break;
      case 'fade-in': a = ease(clamp(k * 2)); break;
      default: y += Math.sin(t * 1.6 + ph) * 5 * U; // nhúc nhích nhẹ
    }
    return { x, y, size: size * sc, rot, a };
  }

  function drawProp(p, k, t, i, imgs) {
    const q = propPos(p, k, t, i);
    if (p.icon === 'black-hole') { ctx.globalAlpha = q.a; blackHole(t, q.x, q.y, q.size / 2); ctx.globalAlpha = 1; return q; }
    const img = imgs[p.icon]; if (!img) return q;
    ctx.save(); ctx.globalAlpha = q.a; ctx.translate(q.x, q.y); ctx.rotate(q.rot * D);
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 18 * U; ctx.shadowOffsetY = 10 * U;
    ctx.drawImage(img, -q.size / 2, -q.size / 2, q.size, q.size);
    ctx.restore();
    return q;
  }

  // ── Nhân vật: hành động → tư thế theo thời gian ──────────────────────────────
  const P = () => window.Char.POSES;
  const mix = (a, b, k) => window.Char.mix(a, b, k);

  function actor(an, k, t, dur, target) {
    const base = { x: 0.3 * W, y: 0.72 * H, rot: 0, scale: U * (an.big ? 1.25 : 1), dir: 1, face: an.face, stretch: 1, alpha: 1, pose: P().stand, fx: null };
    const bob = Math.sin(t * 2.2) * 3 * U;
    const cyc = (a, b, hz) => mix(P()[a], P()[b], 0.5 + 0.5 * Math.sin(t * hz * Math.PI * 2));
    const tx = target ? target.x : 0.7 * W, ty = target ? target.y : 0.48 * H;
    switch (an.action) {
      case 'wave': { const w = 0.5 + 0.5 * Math.sin(t * 9); base.pose = mix(P().stand, P().wave, ease(clamp(k * 4)) * (0.75 + 0.25 * w)); base.face ||= 'grin'; base.y += bob; break; }
      case 'point': base.pose = mix(P().stand, P().point, ease(clamp(k * 4))); base.y += bob; break;
      case 'think': base.pose = mix(P().stand, P().think, ease(clamp(k * 3))); base.face ||= 'think'; base.fx = 'thought'; break;
      case 'shocked': base.pose = mix(P().stand, P().shocked, ease(clamp(k * 6))); base.face ||= 'shock'; base.x += Math.sin(t * 50) * 3 * U * (1 - clamp(k * 2)); base.y -= Math.max(0, Math.sin(clamp(k * 3) * Math.PI)) * 30 * U; base.fx = 'pop'; break;
      case 'cheer': base.pose = P().cheer; base.face ||= 'grin'; base.y -= Math.abs(Math.sin(t * 5)) * 26 * U; break;
      case 'walk': base.pose = cyc('walkA', 'walkB', 1.6); base.x = lerp(-0.08 * W, 0.3 * W, ease(clamp(k * 1.6))); base.y += Math.abs(Math.sin(t * 10)) * -4 * U; break;
      case 'run': case 'exercise': base.pose = cyc('runA', 'runB', 2.6); base.y -= Math.abs(Math.sin(t * 16.3)) * 10 * U; base.face ||= an.action === 'run' ? 'worry' : 'smile'; base.fx = an.action === 'run' ? 'speed' : null; break;
      case 'float': base.pose = P().float; base.y = 0.6 * H + Math.sin(t * 1.5) * 14 * U; base.rot = Math.sin(t * 0.8) * 10; break;
      case 'fall-toward': { const m = easeIn(k); base.pose = mix(P().float, P().flail, clamp((k - 0.4) * 2)); base.x = lerp(0.25 * W, tx - 0.17 * W, m); base.y = lerp(0.6 * H, ty + 0.05 * H, m); base.rot = lerp(0, -60, m); base.face ||= k > 0.4 ? 'worry' : 'smile'; base.fx = k > 0.35 ? 'speed' : null; break; }
      case 'stretch': base.pose = mix(P().flail, P().float, ease(clamp(k * 2))); base.x = tx - 0.2 * W; base.y = ty + 0.06 * H; base.rot = -90; base.stretch = 1 + 1.3 * ease(k); base.face ||= 'shock'; base.clipRight = tx; break;
      case 'swallowed': base.pose = P().float; base.x = lerp(tx - 0.2 * W, tx, ease(clamp(k * 1.5))); base.y = ty + 0.06 * H; base.rot = -90; base.stretch = 2.3 + k; base.alpha = 1 - clamp((k - 0.35) * 2.5); base.face ||= 'shock'; base.clipRight = tx; break;
      case 'hold-breath': base.pose = P().hold; base.face = 'hold'; base.scale *= 1 + 0.03 * Math.sin(t * 3); base.fx = 'timer'; break;
      case 'breathe': base.pose = P().stand; base.scale *= 1 + 0.035 * Math.sin(t * 2.4); base.face ||= 'smile'; base.fx = 'breath'; break;
      case 'tired': base.pose = P().tired; base.face ||= 'sick'; base.rot = Math.sin(t * 1.2) * 4; break;
      case 'sleep': base.pose = P().lie; base.face = 'sleep'; base.rot = -90; base.x = 0.32 * W; base.y = 0.74 * H; base.fx = 'zzz'; break;
      case 'yawn': base.pose = mix(P().stand, P().cheer, 0.6 * Math.sin(clamp(k * 1.4) * Math.PI)); base.face = Math.sin(clamp(k * 1.4) * Math.PI) > 0.4 ? 'shock' : 'sleep'; break;
      case 'sit': base.pose = P().sit; base.y = 0.8 * H; break;
      case 'jump': base.pose = mix(P().stand, P().cheer, Math.abs(Math.sin(t * 4))); base.y -= Math.abs(Math.sin(t * 4)) * 60 * U; base.face ||= 'grin'; break;
      case 'shiver': base.pose = P().hold; base.x += Math.sin(t * 60) * 4 * U; base.face ||= 'worry'; break;
      case 'eat': case 'drink': base.pose = mix(P().stand, P().think, 0.5 + 0.5 * Math.sin(t * 3)); base.face = Math.sin(t * 3) > 0.3 ? 'grin' : 'smile'; base.fx = 'hand-prop'; break;
      case 'look-up': base.pose = P().stand; base.pose = { ...base.pose, head: -28 }; base.face ||= 'think'; break;
      case 'grow': base.pose = P().cheer; base.scale *= lerp(0.6, 1.4, ease(k)); break;
      case 'shrink': base.pose = P().shocked; base.scale *= lerp(1.2, 0.35, ease(k)); base.face ||= 'shock'; break;
      case 'spin': base.pose = P().flail; base.rot = t * 220; base.y = 0.6 * H; base.face ||= 'shock'; break;
      case 'sick': base.pose = P().tired; base.face = 'sick'; base.fx = 'sick'; break;
      case 'present': base.pose = mix(P().stand, P().point, 0.8 + 0.2 * Math.sin(t * 1.5)); base.x = 0.22 * W; break;
      case 'hidden': base.alpha = 0; break;
      default: { // 'talk': cử chỉ khi nói, đổi nhịp theo cảnh
        const g = ['stand', 'point', 'think', 'wave'][Math.floor(t / 2.4 + (an.seed || 0)) % 4];
        base.pose = mix(P().stand, P()[g], 0.35 + 0.15 * Math.sin(t * 2)); base.y += bob;
      }
    }
    if (an.at === 'center') base.x = 0.5 * W;
    if (an.at === 'right') { base.x = 0.7 * W; base.dir = -1; }
    return base;
  }

  function effects(fx, a, t, k, propHand) {
    if (!fx) return;
    ctx.save(); ctx.lineCap = 'round';
    const hx = a.x, hy = a.y - 230 * a.scale / U * U;
    if (fx === 'speed') { ctx.strokeStyle = DARKBG ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,21,0.3)'; ctx.lineWidth = 4 * U; for (let j = 0; j < 6; j++) { const yy = a.y - 200 * U + j * 34 * U, len = 80 * U + 60 * U * Math.sin(t * 9 + j); ctx.beginPath(); ctx.moveTo(a.x - 90 * U - len, yy); ctx.lineTo(a.x - 90 * U, yy); ctx.stroke(); } }
    if (fx === 'zzz') { ctx.fillStyle = DARKBG ? '#fff' : '#151515'; for (let j = 0; j < 3; j++) { const p = (t * 0.6 + j / 3) % 1; ctx.globalAlpha = 1 - p; ctx.font = `800 ${(26 + j * 10) * U}px "Avenir Next", Arial`; ctx.fillText('Z', a.x + 120 * U + p * 60 * U, a.y - 150 * U - p * 140 * U); } }
    if (fx === 'thought') { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#151515'; ctx.lineWidth = 5 * U; [[60, 290, 10], [90, 330, 16]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(a.x + dx * U, a.y - dy * U, r * U, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }); ctx.beginPath(); ctx.ellipse(a.x + 170 * U, a.y - 400 * U, 90 * U, 60 * U, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (propHand) ctx.drawImage(propHand, a.x + 130 * U, a.y - 440 * U, 80 * U, 80 * U); }
    if (fx === 'pop') { ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 6 * U; const r = 150 * U * clamp(k * 4); ctx.globalAlpha = 1 - clamp(k * 3); for (let j = 0; j < 8; j++) { const ang = j * Math.PI / 4; ctx.beginPath(); ctx.moveTo(a.x + Math.cos(ang) * r * 0.6, a.y - 200 * U + Math.sin(ang) * r * 0.6); ctx.lineTo(a.x + Math.cos(ang) * r, a.y - 200 * U + Math.sin(ang) * r); ctx.stroke(); } }
    if (fx === 'timer') { const s = Math.floor(t % 60); ctx.fillStyle = DARKBG ? '#fff' : '#151515'; ctx.font = `800 ${40 * U}px "Avenir Next", Arial`; ctx.fillText(`0:${String(s).padStart(2, '0')}`, a.x + 110 * U, a.y - 300 * U); }
    if (fx === 'breath') { ctx.strokeStyle = 'rgba(46,196,182,0.6)'; ctx.lineWidth = 5 * U; const p = (t * 0.5) % 1; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.arc(a.x + 60 * U + p * 80 * U, a.y - 250 * U, 18 * U + p * 20 * U, 0, Math.PI * 2); ctx.stroke(); }
    if (fx === 'sick') { ctx.fillStyle = 'rgba(120,200,90,0.35)'; ctx.beginPath(); ctx.arc(a.x + 10 * U, a.y - 250 * U * (a.scale / U), 60 * U, 0, Math.PI * 2); ctx.fill(); }
    if (fx === 'hand-prop' && propHand) { const lift = 0.5 + 0.5 * Math.sin(t * 3); ctx.drawImage(propHand, a.x + 50 * U, a.y - (120 + 120 * lift) * U, 90 * U, 90 * U); }
    ctx.restore();
  }

  // ── Chữ ─────────────────────────────────────────────────────────────────────
  function bigText(text, k, color, pos) {
    if (!text) return;
    const ap = clamp(k * 5), out = clamp((1 - k) * 6);
    ctx.save(); ctx.globalAlpha = Math.min(ap, out);
    const size = (text.length > 14 ? 58 : text.length > 8 ? 72 : 92) * U;
    ctx.font = `900 ${size}px "Avenir Next", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = pos === 'right' ? 'center' : 'left'; ctx.textBaseline = 'top';
    const x = pos === 'right' ? 0.7 * W : 0.06 * W, y = 0.07 * H + (1 - ease(ap)) * 20 * U;
    ctx.lineWidth = 10 * U; ctx.strokeStyle = DARKBG ? 'rgba(0,0,0,0.55)' : '#ffffff'; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
    ctx.restore();
  }

  function caption(lines) {
    if (!lines || !lines.length) return;
    ctx.save();
    ctx.font = `700 ${34 * U}px "Avenir Next", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lh = 46 * U, w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 48 * U, h = lines.length * lh + 16 * U;
    const x = (W - w) / 2, y = H - 40 * U - h;
    ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14 * U); ctx.fill();
    ctx.fillStyle = '#fff'; lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 8 * U + lh * (i + 0.5)));
    ctx.restore();
  }

  // ── Khung hình ──────────────────────────────────────────────────────────────
  let CFG, IMGS = {}, DARKBG = false;
  window.Stage = {
    async init(cfg) {
      CFG = cfg; C = document.getElementById('c'); ctx = C.getContext('2d'); W = C.width; H = C.height; U = H / 720;
      await Promise.all(Object.entries(cfg.images || {}).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMGS[k] = im; res(); }; im.onerror = res; im.src = src; })));
    },
    frame(t) {
      const S = CFG.scenes;
      let i = S.findIndex(s => t < s.end); if (i < 0) i = S.length - 1;
      const sc = S[i], an = sc.anim || {}, dur = Math.max(0.1, sc.end - sc.start), k = clamp((t - sc.start) / dur);
      const bg = an.bg || CFG.defaultBg; DARKBG = DARK.has(bg);
      // camera
      ctx.save();
      const cam = an.camera || 'drift';
      let z = 1, cx = 0, cy = 0;
      if (cam === 'zoom-in') z = lerp(1, 1.12, ease(k)); else if (cam === 'zoom-out') z = lerp(1.12, 1, ease(k)); else if (cam === 'drift') z = 1 + 0.025 * k;
      if (cam === 'shake') { cx = Math.sin(t * 47) * 6 * U; cy = Math.cos(t * 39) * 6 * U; }
      ctx.translate(W / 2 + cx, H / 2 + cy); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);

      background(bg, t);
      const props = an.props || [];
      const first = props[0] ? propPos(props[0], k, t, 0) : null;
      const a = actor(an, k, t, dur, first);
      // mở miệng theo lời đọc (trừ biểu cảm cố định)
      const talking = CFG.sentences.some(s => t >= s.start && t <= s.end);
      if (talking && !['shock', 'sleep', 'hold', 'sick'].includes(a.face)) a.face = Math.floor(t * 8) % 2 ? 'grin' : (a.face || 'smile');
      const behind = ['fall-toward', 'stretch', 'swallowed'].includes(an.action);
      const charOpts = { ...a, shirt: CFG.shirt, emblem: CFG.emblem, outline: DARKBG };
      const drawActor = () => {
        if (a.clipRight) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, a.clipRight, H); ctx.clip(); }
        window.Char.draw(ctx, charOpts);
        if (a.clipRight) ctx.restore();
      };
      if (behind) drawActor();
      props.forEach((p, j) => { if (p.at !== 'hand' && p.at !== 'bubble') drawProp(p, k, t, j, IMGS); });
      if (!behind) drawActor();
      const handProp = props.find(p => p.at === 'hand' || p.at === 'bubble');
      effects(a.fx, a, t, k, handProp && IMGS[handProp.icon]);
      ctx.restore(); // camera

      bigText(an.text, k, an.textColor || CFG.accent, an.textPos);
      if (sc.outro) {
        ctx.save(); ctx.globalAlpha = ease(clamp(k * 2)); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.font = `900 ${76 * U}px "Avenir Next", Arial`; const [p1, p2] = CFG.brand; const w1 = ctx.measureText(p1 + ' ').width, w2 = ctx.measureText(p2).width, x0 = (W - w1 - w2) / 2;
        ctx.lineWidth = 10 * U; ctx.strokeStyle = DARKBG ? 'rgba(0,0,0,.5)' : '#fff'; ctx.strokeText(p1 + ' ', x0, 0.22 * H); ctx.strokeText(p2, x0 + w1, 0.22 * H);
        ctx.fillStyle = DARKBG ? '#fff' : '#151515'; ctx.fillText(p1 + ' ', x0, 0.22 * H); ctx.fillStyle = CFG.accent; ctx.fillText(p2, x0 + w1, 0.22 * H);
        ctx.restore();
      }
      const cue = CFG.cues.find(c => t >= c.start && t < c.end);
      caption(cue && cue.lines);
      ctx.save(); ctx.font = `800 ${16 * U}px "Avenir Next", Arial`; ctx.fillStyle = DARKBG ? '#d6d1ff' : '#5a5a5a'; ctx.fillText(CFG.brand.join(' '), 24 * U, H - 14 * U); ctx.restore();
    },
  };
})();
