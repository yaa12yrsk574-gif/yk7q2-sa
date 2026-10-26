// 線で割って、バケツで塗る（v1）
// 骨ごとの面を「輪(r)×角(k)」の格子として見て、ユウヤが引いた線で三角を割る。
// 割っても平らな三角の上で切るだけ＝立体のカクカク（ローポリ感）はそのまま、色の境目だけ自分の線になる。
// 保存：bone.pc = { cuts: [[[t, kf], ...], ...], fills: [{ t, kf, c: '#rrggbb' }, ...] }
//   cuts の1本は [[t,kf],...] か { p: [[t,kf],...], g: 'id' }（g＝左右対称で一緒に引いた線の組。消す時は組ごと）
//   t＝骨に沿った位置(0〜1)、kf＝断面の角(0〜1)。輪の数や頂点の並びが変わっても線はそのまま付いてくる。
window.PaintCut = (() => {
  'use strict';
  const EPS = 1e-7, EXT = 0.3, CLOSE = 0.9, GAP = 1.2; // 線の端は少しのばす（すき間埋め）／端と端が近ければ閉じる
  const has = b => !!(b && b.pc && ((b.pc.cuts && b.pc.cuts.length) || (b.pc.fills && b.pc.fills.length)));
  const hexOk = h => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);

  // t（骨に沿った位置）→ 輪の番号（小数）
  function tToR(ts, t) { const R = ts.length; if (t <= 0) return 0; if (t >= 1) return R - 1;
    for (let i = 0; i < R - 1; i++) if (t <= ts[i + 1]) return i + (t - ts[i]) / Math.max(1e-9, ts[i + 1] - ts[i]); return R - 1; }
  function rToT(ts, r) { const R = ts.length; if (r <= 0) return 0; if (r >= R - 1) return 1; const i = Math.floor(r); return ts[i] + (ts[i + 1] - ts[i]) * (r - i); }

  // 線（t,kf の列）→ 格子座標の折れ線（角は巻き戻して連続に）
  const ptsOfCut = c => Array.isArray(c) ? c : (c && Array.isArray(c.p) ? c.p : []);
  function cutToGrid(cut, ts, n) {
    const P = []; let prevK = null;
    for (const q of ptsOfCut(cut)) { const r = tToR(ts, q[0]); let k = q[1] * n;
      if (prevK != null) { while (k - prevK > n / 2) k -= n; while (prevK - k > n / 2) k += n; }
      prevK = k; P.push({ x: r, y: k }); }
    if (P.length < 2) return [];
    const a = P[0], z = P[P.length - 1];
    if (P.length > 2 && Math.hypot(a.x - z.x, a.y - z.y) < CLOSE) { P[P.length - 1] = { x: a.x, y: a.y }; return P; } // 閉じた輪
    let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); const ex = Math.min(EXT, len * 0.15); /* 小さい線はのばしすぎない */
    const ext = (p, q) => { const dx = p.x - q.x, dy = p.y - q.y, L = Math.hypot(dx, dy) || 1; return { x: p.x + dx / L * ex, y: p.y + dy / L * ex }; };
    P[0] = ext(P[0], P[1]); P[P.length - 1] = ext(P[P.length - 1], P[P.length - 2]);
    return P;
  }

  // ---- 2D の小道具 ----
  const area = poly => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.y - b.x * a.y; } return s / 2; };
  function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
  // 線分を三角形で切り取る（Cyrus-Beck）
  function clipSeg(p, q, T, ccw) { let t0 = 0, t1 = 1; const dx = q.x - p.x, dy = q.y - p.y;
    for (let i = 0; i < 3; i++) { const a = T[i], b = T[(i + 1) % 3]; let nx = -(b.y - a.y), ny = b.x - a.x; if (!ccw) { nx = -nx; ny = -ny; } // 内向き法線
      const num = nx * (p.x - a.x) + ny * (p.y - a.y), den = nx * dx + ny * dy;
      if (Math.abs(den) < 1e-12) { if (num < -1e-12) return null; continue; }
      const t = -num / den; if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) return null; }
    if (t1 - t0 < 1e-9) return null; return [{ x: p.x + dx * t0, y: p.y + dy * t0 }, { x: p.x + dx * t1, y: p.y + dy * t1 }]; }
  function segX(a, b, c, d) { const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s.y - r.y * s.x; if (Math.abs(den) < 1e-14) return null;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null; return [Math.max(0, Math.min(1, t)), Math.max(0, Math.min(1, u))]; }
  function paramOn(a, b, p) { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; if (L2 < 1e-18) return null; const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    const ex = a.x + dx * t - p.x, ey = a.y + dy * t - p.y; if (ex * ex + ey * ey > 1e-12 || t < -1e-9 || t > 1 + 1e-9) return null; return Math.max(0, Math.min(1, t)); }

  // 三角形を線のかけらで割る → 面（外周＋穴）の一覧。T は三角形の2D頂点
  function splitTri(T, pieces) {
    const edges = [[T[0], T[1]], [T[1], T[2]], [T[2], T[0]]].concat(pieces);
    const cuts = edges.map(() => [0, 1]);
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) { if (i < 3 && j < 3) continue;
      const x = segX(edges[i][0], edges[i][1], edges[j][0], edges[j][1]); if (x) { cuts[i].push(x[0]); cuts[j].push(x[1]); }
      for (const [e, f] of [[i, j], [j, i]]) for (const p of edges[f]) { const t = paramOn(edges[e][0], edges[e][1], p); if (t != null) cuts[e].push(t); } }
    const V = [], key = new Map(), vid = p => { const kk = Math.round(p.x * 1e6) + ',' + Math.round(p.y * 1e6); let i = key.get(kk); if (i == null) { i = V.length; V.push({ x: p.x, y: p.y }); key.set(kk, i); } return i; };
    const E = new Set(), adj = new Map(), onTri = [];
    const addE = (a, b, tri) => { if (a === b) return; const k2 = a < b ? a + '_' + b : b + '_' + a; if (E.has(k2)) return; E.add(k2); if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); };
    edges.forEach((e, i) => { const ts = [...new Set(cuts[i].map(t => Math.round(t * 1e9) / 1e9))].sort((a, b) => a - b); let prev = null;
      for (const t of ts) { const id = vid({ x: e[0].x + (e[1].x - e[0].x) * t, y: e[0].y + (e[1].y - e[0].y) * t }); if (prev != null) addE(prev, id); prev = id; } });
    // ぶら下がった線（どこにもつながらん端）は面を割らないので消す
    let changed = true; while (changed) { changed = false; for (const [v, s] of adj) if (s.size < 2) { for (const u of s) adj.get(u).delete(v); adj.delete(v); changed = true; } }
    // 面をたどる
    const out = new Map(); for (const [v, s] of adj) out.set(v, [...s].sort((a, b) => Math.atan2(V[a].y - V[v].y, V[a].x - V[v].x) - Math.atan2(V[b].y - V[v].y, V[b].x - V[v].x)));
    const used = new Set(), loops = [];
    for (const [v, ns] of out) for (const u of ns) { if (used.has(v + '>' + u)) continue; const loop = []; let a = v, b = u, guard = 0;
      while (!used.has(a + '>' + b) && guard++ < 10000) { used.add(a + '>' + b); loop.push(a); const list = out.get(b), i = list.indexOf(a); const c = list[(i - 1 + list.length) % list.length]; a = b; b = c; }
      if (loop.length >= 3) loops.push(loop.map(i => V[i])); }
    const pos = [], neg = []; for (const L of loops) { const A = area(L); if (A > 1e-12) pos.push({ poly: L, A }); else if (A < -1e-12) neg.push({ poly: L, A: -A }); }
    // 一番大きい負の輪＝三角形の外側。それ以外の負の輪は、どこかの面の中に浮いてる島の外周＝穴
    const triA = Math.abs(area(T)); const holes = neg.filter(h => Math.abs(h.A - triA) > 1e-9 * Math.max(1, triA));
    const faces = pos.map(f => ({ poly: f.poly, A: f.A, holes: [] }));
    for (const h of holes) { const p = h.poly[0]; let best = null; for (const f of faces) if (f.A > h.A + 1e-12 && inPoly(mid(h.poly), f.poly) && (!best || f.A < best.A)) best = f; if (best) best.holes.push(h.poly); }
    return faces.length ? faces : [{ poly: T.slice(), A: triA, holes: [] }];
  }
  const mid = poly => { // 輪の内側にある点（辺の中点を少し内側へ）
    const a = poly[0], b = poly[1], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s = area(poly) > 0 ? 1 : -1, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; return { x: m.x - dy / L * 1e-4 * s, y: m.y + dx / L * 1e-4 * s }; };
  function inFace(p, f) { if (!inPoly(p, f.poly)) return false; for (const h of f.holes) if (inPoly(p, h)) return false; return true; }
  const bary = (p, A, B, C) => { const v0x = B.x - A.x, v0y = B.y - A.y, v1x = C.x - A.x, v1y = C.y - A.y, v2x = p.x - A.x, v2y = p.y - A.y, d = v0x * v1y - v1x * v0y; const v = (v2x * v1y - v1x * v2y) / d, w = (v0x * v2y - v2x * v0y) / d; return [1 - v - w, v, w]; };

  // 骨の三角の格子座標。t＝三角の番号。返す：三角の3頂点の2D座標と、つなぎ判定用の頂点名
  function triGrid(t, n, rings) { const Nb = (rings - 1) * n * 2;
    if (t < Nb) { const q = t >> 1, h = t & 1, r = Math.floor(q / n), k = q % n;
      const P = h ? [[r, k + 1], [r + 1, k], [r + 1, k + 1]] : [[r, k], [r + 1, k], [r, k + 1]];
      return { body: true, T: P.map(p => ({ x: p[0], y: p[1] })), keys: P.map(p => p[0] + ',' + (p[1] % n)) }; }
    const j = t - Nb, cap = j & 1, k = j >> 1, r = cap ? rings - 1 : 0; // 先っぽのふた（扇形）
    const C = { x: cap ? r + 0.5 : -0.5, y: k + 0.5 };
    const P = cap ? [C, { x: r, y: k + 1 }, { x: r, y: k }] : [C, { x: r, y: k }, { x: r, y: k + 1 }];
    return { body: false, T: P, keys: P.map((p, i) => i === 0 ? 'c' + cap : p.x + ',' + (p.y % n)) }; }

  // 本体：割った形と色を作る
  function build(THREE, G, bone, baseColor) {
    const n = G.n, rings = G.rings, ts = G.ts || Array.from({ length: rings }, (_, r) => r / (rings - 1)), nt = G.I.length / 3, Nb = (rings - 1) * n * 2;
    const pc = bone.pc || {}, base = new THREE.Color(baseColor);
    const src = (pc.cuts || []).map(c => ({ P: cutToGrid(c, ts, n), g: c && c.g })).filter(c => c.P.length > 1), cuts = src.map(c => c.P);
    const segs = []; for (const P of cuts) for (let i = 0; i < P.length - 1; i++) segs.push([P[i], P[i + 1]]);
    // すき間埋め：線の端が別の線の近く（1マスくらい）なら、そこまでつなぐ。横から引いた線と鏡の線が上下でつながる
    // 左右対称で一緒に引いた線どうし（同じ g）は、端と端が真ん中をはさんで3マス以内ならつなぐ（横から見て引いた線は、真上・真下の面まで届かへんため）
    const wrapD = (p, q) => { let dy = q.y - p.y; dy -= Math.round(dy / n) * n; return { d: Math.hypot(q.x - p.x, dy), q: { x: q.x, y: p.y + dy } }; };
    const isClosed = P => Math.hypot(P[0].x - P[P.length - 1].x, P[0].y - P[P.length - 1].y) < 1e-9;
    src.forEach((A, i) => { if (!A.g || isClosed(A.P)) return; src.forEach((B, j) => { if (j <= i || B.g !== A.g || isClosed(B.P)) return;
      const ea = [A.P[0], A.P[A.P.length - 1]], eb = [B.P[0], B.P[B.P.length - 1]];
      const pair = (x, y) => { const w = wrapD(x, y); if (w.d < 3 && w.d > 1e-6) segs.push([x, w.q]); };
      const straight = wrapD(ea[0], eb[0]).d + wrapD(ea[1], eb[1]).d, cross = wrapD(ea[0], eb[1]).d + wrapD(ea[1], eb[0]).d;
      if (straight <= cross) { pair(ea[0], eb[0]); pair(ea[1], eb[1]); } else { pair(ea[0], eb[1]); pair(ea[1], eb[0]); } }); });
    cuts.forEach((P, ci) => { const a = P[0], z = P[P.length - 1]; if (Math.hypot(a.x - z.x, a.y - z.y) < 1e-9) return;
      for (const e of [a, z]) { let best = null, bd = GAP;
        cuts.forEach((Q, qi) => { if (qi === ci) return; for (let i = 0; i < Q.length - 1; i++) for (const sh of [-n, 0, n]) { const p = { x: Q[i].x, y: Q[i].y + sh }, q = { x: Q[i + 1].x, y: Q[i + 1].y + sh }, dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy || 1e-12;
          const u = Math.max(0, Math.min(1, ((e.x - p.x) * dx + (e.y - p.y) * dy) / L2)), c = { x: p.x + dx * u, y: p.y + dy * u }, d = Math.hypot(c.x - e.x, c.y - e.y); if (d < bd) { bd = d; best = c; } } });
        if (best && bd > 1e-6) { const dx = best.x - e.x, dy = best.y - e.y, L = Math.hypot(dx, dy); segs.push([e, { x: best.x + dx / L * 0.05, y: best.y + dy / L * 0.05 }]); } } });
    // 三角ごとに割る
    const tris = [];
    for (let t = 0; t < nt; t++) { const g = triGrid(t, n, rings); let faces;
      if (g.body && segs.length) { const T = g.T, ccw = area(T) > 0, pieces = [], minY = Math.min(T[0].y, T[1].y, T[2].y), maxY = Math.max(T[0].y, T[1].y, T[2].y), minX = Math.min(T[0].x, T[1].x, T[2].x), maxX = Math.max(T[0].x, T[1].x, T[2].x);
        for (const [p, q] of segs) { if (Math.max(p.x, q.x) < minX - 1e-9 || Math.min(p.x, q.x) > maxX + 1e-9) continue;
          for (const sh of [-2 * n, -n, 0, n, 2 * n]) { const a = { x: p.x, y: p.y + sh }, b = { x: q.x, y: q.y + sh }; if (Math.max(a.y, b.y) < minY - 1e-9 || Math.min(a.y, b.y) > maxY + 1e-9) continue;
            const c = clipSeg(a, b, T, ccw); if (c) pieces.push(c); } }
        faces = pieces.length ? splitTri(T, pieces) : [{ poly: T.slice(), A: Math.abs(area(T)), holes: [] }];
      } else faces = [{ poly: g.T.slice(), A: Math.abs(area(g.T)), holes: [] }];
      tris.push({ g, faces }); }
    // 面に番号を振って、三角の辺をまたいでつながってる面どうしを1つの「島」にまとめる
    const nodes = []; for (const tr of tris) for (const f of tr.faces) { f.id = nodes.length; nodes.push(f); }
    const par = nodes.map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
    const onEdge = new Map(); // 辺の名前 → [{s0,s1,id}]
    tris.forEach(tr => { const T = tr.g.T, K = tr.g.keys;
      for (let e = 0; e < 3; e++) { const A = T[e], B = T[(e + 1) % 3], ka = K[e], kb = K[(e + 1) % 3], flip = ka > kb, ek = flip ? kb + '|' + ka : ka + '|' + kb;
        for (const f of tr.faces) { const L = f.poly; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length], s0 = paramOn(A, B, p), s1 = paramOn(A, B, q); if (s0 == null || s1 == null || Math.abs(s1 - s0) < 1e-7) continue;
          const a = flip ? 1 - s0 : s0, b = flip ? 1 - s1 : s1; if (!onEdge.has(ek)) onEdge.set(ek, []); onEdge.get(ek).push({ s0: Math.min(a, b), s1: Math.max(a, b), id: f.id }); } } } });
    for (const list of onEdge.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > 1e-6) uni(a.id, b.id); }
    // バケツ：塗った点の島に色。あとから塗った方が勝つ
    const color = new Map(), lastOf = new Map(), dead = [];
    (pc.fills || []).forEach((fl, i) => { if (!hexOk(fl.c)) { dead.push(i); return; } const id = faceAt(tris, n, rings, ts, fl.t, fl.kf); if (id == null) return; const root = find(id);
      if (lastOf.has(root)) dead.push(lastOf.get(root)); lastOf.set(root, i); color.set(root, fl.c); }); /* 同じ島に後から塗った＝前の塗りはもう見えない */
    // 形を出す
    const P = [], C = [], NRM = [], SRC = [], BW = [];
    const idx = new THREE.BufferGeometry(); idx.setAttribute('position', new THREE.Float32BufferAttribute(G.V, 3)); idx.setIndex(G.I); idx.computeVertexNormals(); const VN = idx.attributes.normal.array; idx.dispose();
    const tmpC = new THREE.Color();
    tris.forEach((tr, t) => { const T = tr.g.T, ccw = area(T) > 0, i0 = G.I[t * 3], i1 = G.I[t * 3 + 1], i2 = G.I[t * 3 + 2];
      for (const f of tr.faces) { const hex = color.get(find(f.id)) || (bone.paint && hexOk(bone.paint[t]) ? bone.paint[t] : null); const col = hex ? tmpC.set(hex) : base;
        let tri;
        if (f.poly.length === 3 && !f.holes.length) tri = [[f.poly[0], f.poly[1], f.poly[2]]];
        else { const outer = f.poly.map(p => new THREE.Vector2(p.x, p.y)), holes = f.holes.map(h => h.map(p => new THREE.Vector2(p.x, p.y)));
          const ix = THREE.ShapeUtils.triangulateShape(outer, holes), all = outer.concat(...holes); /* triangulateShape は向きを直すため配列をその場で反転する＝並びは後で取る */ tri = ix.map(a => a.map(i => ({ x: all[i].x, y: all[i].y }))); }
        for (let tt of tri) { if ((area(tt) > 0) !== ccw) tt = [tt[0], tt[2], tt[1]];
          for (const p of tt) { const w = bary(p, T[0], T[1], T[2]);
            for (let c = 0; c < 3; c++) { P.push(G.V[i0 * 3 + c] * w[0] + G.V[i1 * 3 + c] * w[1] + G.V[i2 * 3 + c] * w[2]); NRM.push(VN[i0 * 3 + c] * w[0] + VN[i1 * 3 + c] * w[1] + VN[i2 * 3 + c] * w[2]); }
            C.push(col.r, col.g, col.b); SRC.push(t); BW.push(w[0], w[1], w[2]); } } } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(NRM, 3));
    g.userData.pcSrc = Int32Array.from(SRC); g.userData.pcBW = Float32Array.from(BW); g.userData.pcDead = dead.sort((a, b) => a - b);
    return g;
  }
  // 塗った点（t,kf）がどの面に入るか
  function faceAt(tris, n, rings, ts, t, kf) { let r = tToR(ts, t), k = ((kf * n) % n + n) % n; r = Math.max(0, Math.min(rings - 1 - 1e-6, r));
    const cr = Math.min(rings - 2, Math.floor(r)), ck = Math.floor(k) % n, fx = r - cr, fy = k - Math.floor(k), h = fx + fy > 1 ? 1 : 0, ti = (cr * n + ck) * 2 + h, tr = tris[ti]; if (!tr) return null;
    const p = { x: r, y: Math.floor(k) + fy }; for (const f of tr.faces) if (inFace(p, f)) return f.id; // 境目ちょうどなら一番近い面
    let best = null, bd = 1e9; for (const f of tr.faces) { const c = f.poly.reduce((a, q) => ({ x: a.x + q.x / f.poly.length, y: a.y + q.y / f.poly.length }), { x: 0, y: 0 }), d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = f.id; } } return best; }
  // 動いた時：元の三角の頂点から位置を作り直す（狩り場）
  function update(g, G) { const src = g.userData.pcSrc, bw = g.userData.pcBW, v = g.attributes.position.array, V = G.V, I = G.I;
    for (let j = 0; j < src.length; j++) { const t = src[j], a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3, w0 = bw[j * 3], w1 = bw[j * 3 + 1], w2 = bw[j * 3 + 2];
      v[j * 3] = V[a] * w0 + V[b] * w1 + V[c] * w2; v[j * 3 + 1] = V[a + 1] * w0 + V[b + 1] * w1 + V[c + 1] * w2; v[j * 3 + 2] = V[a + 2] * w0 + V[b + 2] * w1 + V[c + 2] * w2; }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); }
  // 当たった三角（番号＋重心座標）→ 格子座標 → 保存用の (t, kf)。ふたの上なら null
  function hitToTK(G, face, w) { const n = G.n, rings = G.rings, ts = G.ts; if (face >= (rings - 1) * n * 2) return null; const T = triGrid(face, n, rings).T;
    const r = T[0].x * w[0] + T[1].x * w[1] + T[2].x * w[2], k = T[0].y * w[0] + T[1].y * w[1] + T[2].y * w[2]; return { t: rToT(ts || Array.from({ length: rings }, (_, i) => i / (rings - 1)), r), kf: k / n, r, k }; }
  // 線をカクカクに間引く（格子1マスの0.35くらいのズレは無視）
  function simplify(pts, eps) { if (pts.length < 3) return pts.slice(); const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const rec = (a, b) => { const A = pts[a], B = pts[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy); let mi = -1, md = 0;
      for (let i = a + 1; i < b; i++) { const d = L < 1e-9 ? Math.hypot(pts[i].x - A.x, pts[i].y - A.y) : Math.abs((pts[i].x - A.x) * dy - (pts[i].y - A.y) * dx) / L; if (d > md) { md = d; mi = i; } }
      if (mi >= 0 && md > eps) { keep[mi] = 1; rec(a, mi); rec(mi, b); } };
    rec(0, pts.length - 1); return pts.filter((_, i) => keep[i]); }
  // 格子座標 → 体の表面の点（と面の向き）
  function gridToPos(G, r, k) { const n = G.n, rings = G.rings; r = Math.max(0, Math.min(rings - 1 - 1e-6, r)); k = ((k % n) + n) % n;
    const cr = Math.min(rings - 2, Math.floor(r)), ck = Math.floor(k), fx = r - cr, fy = k - ck, h = fx + fy > 1 ? 1 : 0, t = (cr * n + ck) * 2 + h, T = triGrid(t, n, rings).T, w = bary({ x: r, y: k }, T[0], T[1], T[2]);
    const I = G.I, V = G.V, a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3, p = [0, 1, 2].map(q => V[a + q] * w[0] + V[b + q] * w[1] + V[c + q] * w[2]);
    const e1 = [V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]], e2 = [V[c] - V[a], V[c + 1] - V[a + 1], V[c + 2] - V[a + 2]], nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], L = Math.hypot(...nn) || 1;
    let nv = nn.map(v => v / L); const C = G.path && G.path[Math.round(r)]; if (C && (p[0] - C.x) * nv[0] + (p[1] - C.y) * nv[1] + (p[2] - C.z) * nv[2] < 0) nv = nv.map(v => -v); /* 外向きにそろえる */
    return { p, n: nv }; }
  // 線を表面に沿った細かい点にする（見せる用。面から少し浮かせる）
  function cutPoints(G, cut, lift) { const P = cutToGridRaw(cut, G.ts, G.n), out = [];
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.2));
      for (let j = (i ? 1 : 0); j <= m; j++) { const u = j / m, q = gridToPos(G, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u), s = lift || 0; out.push([q.p[0] + q.n[0] * s, q.p[1] + q.n[1] * s, q.p[2] + q.n[2] * s]); } }
    return out; }
  function cutToGridRaw(cut, ts, n) { const P = []; let prevK = null; for (const q of ptsOfCut(cut)) { const r = tToR(ts, q[0]); let k = q[1] * n; if (prevK != null) { while (k - prevK > n / 2) k -= n; while (prevK - k > n / 2) k += n; } prevK = k; P.push({ x: r, y: k }); } return P; }
  return { has, build, update, hitToTK, simplify, tToR, rToT, gridToPos, cutPoints, ptsOfCut };
})();
