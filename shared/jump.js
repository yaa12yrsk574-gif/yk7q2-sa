// ---- ジャンプの物理（工房と狩り場で共通） ----
// 地面に付いてる間（〜踏み切り）はアニメーターの作り込み。溜めの深さ・押す長さ・押す速さ・押す向き。
// 踏み切った瞬間から、体の位置はゲームが計算（放物線）。空中のコマはポーズだけ使う（体の上下は無視）。
// 体の大きさで割った物差しで測るので、デカい子も小さい子も、同じ出来なら同じくらいの高さまで跳ぶ。脚の数は関係ない。
(function () {
  const FPS = 24;
  // 物差し（お手本のジャンプ＝1.0倍。速さはお手本基準、押せる距離の√で上限）
  const REF = { v: 9.7, d: 0.40, cap: 1.25 }; /* ツノトカゲのお手本＝1.0（重心は胴＝根っこの骨） */
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
  // ---- 羽ばたき：1回の振り下ろしで体が浮く量＝羽の広さ×羽の先が下に押した距離。振り上げは広げたままやと抵抗（たたむと得）。
  // 羽＝体に対して先っぽが一番大きく上下する骨2本。体の大きさ（立ってる時の重心の高さ）で割って、どの子でも同じ物差し
  const FREF = { net: 3.0, cap: 1.8 }; /* ツバサトカゲのお手本＝1.0 */
  function flapAnalyze(A, pose, ids, H, cids) {
    if (!A || !A.len) return null; const F = []; for (let f = 0; f <= A.len; f++) F.push(pose(f)); const h0 = Math.max(0.05, H || 0.3), C = F.map(P => com(P, cids || ids)); /* ids＝羽の候補（全部の骨）、cids＝重心（胴） */
    const tips = ids.map(id => { const ys = F.map((P, f) => { const p = P[id]; return p ? p[p.length - 1][1] - C[f][1] : 0; }); return { id, ys, r: Math.max(...ys) - Math.min(...ys) }; }).sort((a, c) => c.r - a.r).slice(0, 2).filter(t => t.r > 1e-3);
    if (!tips.length) return null;
    const th = F.map((_, f) => tips.reduce((s, t) => s + t.ys[f], 0) / tips.length);
    const area = F.map((P, f) => { const w = tips.reduce((s, t) => { const p = P[t.id], q = p[p.length - 1]; return s + Math.hypot(q[0] - C[f][0], (q[2] - C[f][2]) * 0.3); }, 0) / tips.length / h0; return w * w; }); /* 羽の広がり（横に張ってるほど広い） */
    let down = 0, drag = 0; for (let f = 0; f < A.len; f++) { const d = (th[f] - th[f + 1]) / h0, a = (area[f] + area[f + 1]) / 2; if (d > 0) down += d * a; else drag += -d * a * 0.15; }
    const net = Math.max(0, down - drag), r = Math.min(FREF.cap, net / FREF.net); return { down, drag, net, r, limited: net / FREF.net > FREF.cap, tips: tips.map(t => t.id), H: h0, len: A.len }; }
  // 羽ばたき n 回で体が上がっていく線（工房の座標）。前へは見やすさのための一定速
  function flapPath(Fx, T, n, size) { const s = size || 1, g = T.gravity || 16, up = (T.flapV || 5) * Fx.r, per = Math.max(0.2, Fx.len / FPS), dt = 1 / FPS, out = []; let y = 0, vy = 0, t = 0;
    for (let k = 0; k < n; k++) { vy = Math.max(vy, 0) * 0.35 + up; for (let i = 0; i < per / dt; i++) { out.push([t * 0.8 / s, y / s]); y += vy * dt; vy -= g * dt; t += dt; } }
    for (let i = 0; i < 40 && y > -0.01; i++) { out.push([t * 0.8 / s, y / s]); y += vy * dt; vy -= g * dt; t += dt; } return { pts: out, rise: up * up / (2 * g) }; }
  window.JumpPhys = { FPS, REF, FREF, com, analyze, arcAt, placeAt, airFrames, flapAnalyze, flapPath };
})();
