// ---- 操作：左で移動、右のレールでコマ（指でもキーでも）。カメラは右側のドラッグ・ピンチ・ホイール ----
// ここは「入力を読むだけ」。体をどう動かすかは body.js、見た目は skin.js
window.PlayControl = (() => {
  function create(canvas, rail) {
    const keys = new Set(), c = { keys, stick: null, rail: { active: false, v: 0, id: null }, press: 0, up: 0, btnHeld: false, orbit: { dx: 0, dy: 0, zoom: 1 }, touched: false };
    let drag = null, pinch = null; const fingers = new Map();
    const KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '];
    addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (!KEYS.includes(k)) return; e.preventDefault(); if (k === ' ' && !e.repeat) c.press++; keys.add(k); });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === ' ') c.up++; keys.delete(k); });
    addEventListener('blur', () => { keys.clear(); c.stick = null; c.rail.active = false; c.btnHeld = false; });
    // 画面：左半分＝スティック（指）、それ以外＝カメラを回す
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); const x = e.clientX, y = e.clientY;
      if (e.pointerType === 'touch') { c.touched = true; if (x < innerWidth * 0.5 && !c.stick) { c.stick = { id: e.pointerId, x0: x, y0: y, x, y }; return; } fingers.set(e.pointerId, { x, y });
        if (fingers.size === 2) { const [a, b] = [...fingers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; } return; }
      drag = { id: e.pointerId, x, y }; });
    canvas.addEventListener('pointermove', e => { const x = e.clientX, y = e.clientY;
      if (c.stick && e.pointerId === c.stick.id) { c.stick.x = x; c.stick.y = y; return; }
      if (fingers.has(e.pointerId)) { const p = fingers.get(e.pointerId); if (fingers.size === 2 && pinch) { p.x = x; p.y = y; const [a, b] = [...fingers.values()], d = Math.hypot(a.x - b.x, a.y - b.y); c.orbit.zoom *= pinch.d / Math.max(1, d); pinch.d = d; return; }
        c.orbit.dx += x - p.x; c.orbit.dy += y - p.y; p.x = x; p.y = y; return; }
      if (drag && e.pointerId === drag.id) { c.orbit.dx += x - drag.x; c.orbit.dy += y - drag.y; drag.x = x; drag.y = y; } });
    const end = e => { if (c.stick && e.pointerId === c.stick.id) c.stick = null; fingers.delete(e.pointerId); if (fingers.size < 2) pinch = null; if (drag && e.pointerId === drag.id) drag = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); c.orbit.zoom *= Math.exp(e.deltaY * 0.001); }, { passive: false });
    // 右のレール：位置＝コマ（上＝立ち・踏み切り、下＝しゃがみ）。空中で触る＝羽ばたき
    const tr = rail.querySelector('.tr'), at = e => { const r = tr.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); };
    rail.addEventListener('pointerdown', e => { e.preventDefault(); rail.setPointerCapture(e.pointerId); c.rail.id = e.pointerId; c.rail.active = true; c.rail.v = at(e); c.rail.tap = true; c.btnHeld = true; c.press++; });
    rail.addEventListener('pointermove', e => { if (c.rail.active && e.pointerId === c.rail.id) c.rail.v = at(e); });
    const rend = e => { if (e.pointerId === c.rail.id) { c.rail.active = false; c.btnHeld = false; c.up++; } }; rail.addEventListener('pointerup', rend); rail.addEventListener('pointercancel', rend);
    // 毎フレーム読む：カメラから見た前後左右（fx＝右、fz＝前）。押した・離した は1回だけ
    c.read = () => { let fx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), fz = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0), walk = keys.has('shift');
      if (c.stick) { const dx = c.stick.x - c.stick.x0, dy = c.stick.y - c.stick.y0, r = Math.hypot(dx, dy), m = Math.min(1, r / 60); if (r > 6) { fx = dx / r * m; fz = -dy / r * m; walk = walk || m < 0.6; } }
      const n = Math.hypot(fx, fz); if (n > 1) { fx /= n; fz /= n; }
      const r = { fx, fz, walk, press: c.press > 0, up: c.up > 0, held: c.btnHeld || keys.has(' '), rail: c.rail, railTap: !!c.rail.tap, orbit: { dx: c.orbit.dx, dy: c.orbit.dy, zoom: c.orbit.zoom } };
      c.press = c.up = 0; c.rail.tap = false; c.orbit.dx = c.orbit.dy = 0; c.orbit.zoom = 1; return r; };
    return c; }
  return { create };
})();
