// ---- 右のパッド：動きを「なぞって引き出す」（阿修羅の魔法陣の作り）。開始の点を押すと線が出て、なぞった分だけその動きのコマが進む ----
// 線は自由に描き直せる（✏）。作品ごとに保存。ここは入力と線の管理だけ。動きの意味は body.js
window.PlayPad = (() => {
  const MOVES = { jump: { name: '跳ぶ', icon: '⤒', col: '#1d86b0' }, swing: { name: '振る', icon: '⚔', col: '#d9572b' }, grab: { name: '掴む', icon: '✊', col: '#3d8a4f' } };
  // はじめの線（パッドの中を 0〜1 で）：跳ぶ＝上から下（下ろす＝しゃがむ、戻す＝伸びる）、振る＝弧、掴む＝まっすぐ（行き＝開く、戻り＝閉じる）
  const DEF = { jump: [[0.5, 0.1], [0.5, 0.9]], swing: [[0.12, 0.45], [0.3, 0.2], [0.55, 0.15], [0.8, 0.28], [0.9, 0.5]], grab: [[0.18, 0.88], [0.72, 0.62]] };
  const KEY = 'yuya_play_strokes', N = 32;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } };
  const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} };
  // 線をなめらかに等間隔へ（なぞった位置→進み具合 0〜1 を出しやすく）
  function resample(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const T = L[L.length - 1] || 1, out = [];
    for (let k = 0; k < N; k++) { const d = T * k / (N - 1); let i = 1; while (i < L.length - 1 && L[i] < d) i++; const a = L[i - 1], b = L[i], u = b > a ? (d - a) / (b - a) : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]); } return out; }
  function create(el) {
    const cv = el.querySelector('canvas'), g = cv.getContext('2d'), st = { moves: [], strokes: {}, workId: null, edit: null, act: { active: false, move: null, p: 0, pmax: 0, tap: false, down: false, up: false }, trail: [], press: 0, airTap: false };
    let all = load(), drag = null, W = 0, H = 0;
    const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); }; addEventListener('resize', size); size();
    const P = q => [q[0] * W, q[1] * H], at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / W, (e.clientY - r.top) / H]; };
    st.use = (workId, moves) => { st.workId = workId; st.moves = moves; const mine = all[workId] || {}; st.strokes = {}; for (const m of moves) st.strokes[m] = resample(mine[m] || DEF[m]); draw(); };
    st.reset = m => { const mine = all[st.workId] || {}; delete mine[m]; all[st.workId] = mine; save(all); st.strokes[m] = resample(DEF[m]); draw(); };
    // 進み具合：今いる所の近く（前後数点）から一番近い点を探す（線が交差しても飛ばんように）
    const progress = (s, q, i0) => { let best = i0, bd = 1e9; for (let i = Math.max(0, i0 - 6); i <= Math.min(N - 1, i0 + 6); i++) { const d = Math.hypot(s[i][0] - q[0], s[i][1] - q[1]); if (d < bd) { bd = d; best = i; } } return best; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} const q = at(e);
      if (st.edit) { drag = { id: e.pointerId, draw: [q] }; return; }
      let pick = null, pd = 0.16; for (const m of st.moves) { const s = st.strokes[m], d = Math.hypot(s[0][0] - q[0], s[0][1] - q[1]); if (d < pd) { pd = d; pick = m; } }
      st.press++; st.airTap = true; if (!pick) { drag = { id: e.pointerId, none: true }; return; }
      drag = { id: e.pointerId, move: pick, i: 0, t0: performance.now(), moved: false }; Object.assign(st.act, { active: true, move: pick, p: 0, pmax: 0, down: true, tap: false }); st.trail = [q]; draw(); });
    cv.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const q = at(e);
      if (drag.draw) { drag.draw.push(q); draw(drag.draw); return; } if (drag.none) return;
      const s = st.strokes[drag.move]; drag.i = progress(s, q, drag.i); const p = drag.i / (N - 1); if (Math.abs(p - st.act.p) > 0.02) drag.moved = true; st.act.p = p; st.act.pmax = Math.max(st.act.pmax, p); st.trail.push(q); if (st.trail.length > 40) st.trail.shift(); draw(); });
    const end = e => { if (!drag || e.pointerId !== drag.id) return;
      if (drag.draw) { if (drag.draw.length > 4) { const m = st.edit, mine = all[st.workId] || {}; mine[m] = resample(drag.draw).map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]); all[st.workId] = mine; save(all); st.strokes[m] = resample(mine[m]); } st.edit = null; el.classList.remove('editing'); drag = null; draw(); return; }
      if (!drag.none) { st.act.active = false; st.act.up = true; if (!drag.moved && performance.now() - drag.t0 < 350) st.act.tap = true; } drag = null; st.trail = []; draw(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    // 描き直し：✏ を押す → 点を選ぶ → 線を描く
    st.startEdit = m => { st.edit = m; el.classList.add('editing'); draw(); };
    function draw(tmp) { g.clearRect(0, 0, W, H); g.lineCap = g.lineJoin = 'round';
      for (const m of st.moves) { const s = st.strokes[m], M = MOVES[m], on = st.act.active && st.act.move === m, ed = st.edit === m;
        if (on || ed || st.edit == null) { g.globalAlpha = on ? 1 : ed ? 0.25 : 0.28; g.strokeStyle = M.col; g.lineWidth = on ? 9 : 5; g.beginPath(); s.forEach((q, i) => { const [x, y] = P(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
          const [ex, ey] = P(s[N - 1]); g.globalAlpha *= 0.9; g.beginPath(); g.arc(ex, ey, 4, 0, 7); g.fillStyle = M.col; g.fill(); }
        if (on) { const k = Math.round(st.act.p * (N - 1)), [px, py] = P(s[k]); g.globalAlpha = 1; g.beginPath(); g.arc(px, py, 12, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = M.col; g.stroke(); }
        g.globalAlpha = 1; const [x0, y0] = P(s[0]); g.beginPath(); g.arc(x0, y0, 17, 0, 7); g.fillStyle = M.col; g.fill(); g.fillStyle = '#fff'; g.font = '900 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(M.icon, x0, y0 + 1); }
      if (tmp && tmp.length > 1) { g.strokeStyle = MOVES[st.edit].col; g.lineWidth = 6; g.globalAlpha = 1; g.beginPath(); tmp.forEach((q, i) => { const [x, y] = P(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); } }
    st.read = () => { const a = Object.assign({}, st.act, { press: st.press > 0, airTap: st.airTap }); st.act.tap = st.act.down = st.act.up = false; st.press = 0; st.airTap = false; return a; };
    st.draw = draw; return st; }
  return { MOVES, create };
})();
