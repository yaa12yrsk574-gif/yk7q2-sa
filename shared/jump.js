// ---- ジャンプの物理（工房と狩り場で共通） ----
// 地面に付いてる間（〜踏み切り）はアニメーターの作り込み。溜めの深さ・押す長さ・押す速さ・押す向き。
// 踏み切った瞬間から、体の位置はゲームが計算（放物線）。空中のコマはポーズだけ使う（体の上下は無視）。
// 体の大きさで割った物差しで測るので、デカい子も小さい子も、同じ出来なら同じくらいの高さまで跳ぶ。脚の数は関係ない。
(function () {
  const FPS = 24;
  // 物差し（お手本のジャンプ＝1.0倍。速さはお手本基準、押せる距離の√で上限）
  const REF = { v: 10.6, d: 0.44, cap: 1.25 };
  function com(P, ids) { let x = 0, y = 0, z = 0, n = 0; for (const id of ids) { const p = P[id]; if (!p) continue; for (const q of p) { x += q[0]; y += q[1]; z += q[2]; n++; } } return n ? [x / n, y / n, z / n] : [0, 0, 0]; }
  function marks(A) { const g = A.guides || [], gt = g.find(x => x.label === '踏み切り'), gh = g.find(x => x.label === '溜め'); return { tk: A.tk != null ? A.tk : gt ? gt.f : null, hold: gh ? gh.f : null }; }
  // A＝ジャンプの動き、pose(f)＝fコマ目の形 {骨id: pts}、ids＝骨id、H＝立ってる時の重心の高さ、T＝BodyMotion の数値（jumpV・gravity）
  function analyze(A, pose, ids, H, T) {
    if (!A || !A.len) return null; const N = A.len, C = {}, cy = f => C[f] || (C[f] = com(pose(f), ids));
    let { tk, hold } = marks(A);
    if (tk == null) { let best = -1e9; tk = 1; for (let f = 0; f < N; f++) { const v = cy(f + 1)[1] - cy(f)[1]; if (v > best) { best = v; tk = f + 1; } } } /* 古い動き：重心が一番速く上がるコマ */
    tk = Math.max(1, Math.min(N, Math.round(tk)));
    if (hold == null || hold >= tk) { let lo = 1e9; hold = 0; for (let f = 0; f < tk; f++) if (cy(f)[1] < lo) { lo = cy(f)[1]; hold = f; } }
    const a = cy(hold), b = cy(tk), p = cy(tk - 1), h0 = Math.max(0.05, H || 0.3);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); /* 押した距離（溜めの底から踏み切りまで） */
    const vv = [(b[0] - p[0]) * FPS, (b[1] - p[1]) * FPS, (b[2] - p[2]) * FPS], vA = Math.hypot(vv[0], vv[1], vv[2]); /* 踏み切りの速さ */
    const rSpeed = (vA / h0) / REF.v, rCap = REF.cap * Math.sqrt(Math.max(0, d / h0) / REF.d), r = Math.max(0, Math.min(rSpeed, rCap));
    let dir = vA > 1e-6 ? vv.map(x => x / vA) : [0, 1, 0]; if (dir[1] < 0.1) { const hz = Math.hypot(dir[0], dir[2]) || 1, k = Math.sqrt(1 - 0.01) / hz; dir = [dir[0] * k, 0.1, dir[2] * k]; } /* 下向きに押しても、少しは浮く */
    const v = (T.jumpV || 6.4) * r, g = T.gravity || 16, vy = v * dir[1], vh = [v * dir[0], v * dir[2]];
    return { tk, hold, d, vA, r, rSpeed, rCap, limited: rSpeed > rCap, vy, vh, h: vy * vy / (2 * g), tair: 2 * vy / g, g, comTk: b, H: h0 }; }
  // 空中のコマ f の重心の位置（工房の座標。size＝ゲームでの大きさ。ゲームでは大きさ倍されるので、工房では割って見せる）
  function arcAt(J, A, f, size) { const s = size || 1, u = Math.max(0, Math.min(1, (f - J.tk) / Math.max(1, A.len - J.tk))), t = u * J.tair;
    return [J.comTk[0] + J.vh[0] * t / s, J.comTk[1] + (J.vy * t - J.g * t * t / 2) / s, J.comTk[2] + J.vh[1] * t / s]; }
  // 形 P の重心を c に合わせる（空中のポーズは体の上下を無視して、放物線の上に置く）
  function placeAt(P, ids, c) { const m = com(P, ids), dx = c[0] - m[0], dy = c[1] - m[1], dz = c[2] - m[2], Q = {}; for (const id in P) Q[id] = P[id].map(q => [q[0] + dx, q[1] + dy, q[2] + dz]); return Q; }
  // 空中のコマ数（滞空時間ぶん）
  const airFrames = J => Math.max(3, Math.round(J.tair * FPS));
  window.JumpPhys = { FPS, REF, com, analyze, arcAt, placeAt, airFrames };
})();
