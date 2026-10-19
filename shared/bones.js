// Shared geometry and animation calculations for workshop and hunting.
// State access stays per consumer; no cross-frame mutable state is shared.
window.BoneCore = Object.freeze({create(THREE, getState, setState, opts) {
const OPT = opts || {};
const state = {get current(){return getState();},set current(value){setState(value);}};
const TPL = window.BoneTemplates;
const clone = o => JSON.parse(JSON.stringify(o));
const V3 = a => new THREE.Vector3(a[0],a[1],a[2]), r4 = v => Math.round(v*1e4)/1e4;
const boneById = id => state.current.bones.find(b => b.id === id);
const ptsOf = (b, mir) => b.pts.map(p => new THREE.Vector3(mir ? -p[0] : p[0], p[1], p[2]));
const ringsOf = b => { if (!b.rings) { let L = 0; for (let i = 1; i < b.pts.length; i++) L += V3(b.pts[i]).distanceTo(V3(b.pts[i - 1])); b.rings = Math.max(4, Math.min(28, Math.round(L / 0.035) + 2)); } return b.rings; };
// 断面の頂点の角度。av=1（v13〜の骨）は頂点を真横・真上・真下に置く＝描いた輪郭の一番外に頂点が乗る。古い骨は今まで通り半目ずらし
const angOf = (k, n, av) => k / n * Math.PI * 2 + (av ? 0 : Math.PI / n);
const mirK = (b, k, n) => b && b.av ? ((Math.round(n / 2) - k) % n + n) % n : ((Math.round(n / 2) - 1 - k) % n + n) % n; /* 左右反転した時の頂点番号 */
const flipZK = (b, k, n) => b && b.av ? ((n - k) % n + n) % n : ((n - 1 - k) % n + n) % n; /* 前後反転 */
// 輪の位置（骨に沿った t）。描いたシルエットの角（k付きの点）には必ず輪を置く＝ギザギザがそのまま乗る
function ringTs(b) { const R = ringsOf(b), base = []; for (let r = 0; r < R; r++) base.push(r / (R - 1));
  const ks = []; for (const key of ['wp', 'wn', 'dp', 'dn']) for (const p of b[key] || []) if (p.k && p.t > 0.002 && p.t < 0.998) ks.push(p.t);
  if (!ks.length) return base; ks.sort((a, c) => a - c); const kk = []; for (const t of ks) if (!kk.length || t - kk[kk.length - 1] > 0.004) kk.push(t);
  const gap = 0.45 / (R - 1), out = kk.concat(base.filter(t => t === 0 || t === 1 || kk.every(q => Math.abs(q - t) > gap))); out.sort((a, c) => a - c);
  const u = []; for (const t of out) if (!u.length || t - u[u.length - 1] > 0.002) u.push(t); u[0] = 0; u[u.length - 1] = 1; return u.length > 96 ? base : u; }
const bezStore = B => ({ a: B.a.map(v => [v.x, v.y, v.z].map(r4)), hi: B.hi.map(v => [v.x, v.y, v.z].map(r4)), ho: B.ho.map(v => [v.x, v.y, v.z].map(r4)) });
const kidsOf = id => state.current.bones.filter(c => c.parent === id);
function smoothPath(P, n) {
  const raw = []; for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 16; k++) { const t = k / 16, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      raw.push(new THREE.Vector3(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z))); } }
  raw.push(P[P.length - 1].clone()); const acc = [0]; for (let i = 1; i < raw.length; i++) acc.push(acc[i - 1] + raw[i].distanceTo(raw[i - 1]));
  const L = acc[acc.length - 1] || 1e-6, out = []; let j = 0;
  for (let k = 0; k < n; k++) { const s = L * k / (n - 1); while (j < raw.length - 2 && acc[j + 1] < s) j++; const t = (s - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j]); out.push(raw[j].clone().lerp(raw[j + 1], Math.max(0, Math.min(1, t)))); }
  return { pts: out, len: L }; }
function profAt(pr, t) { if (!pr || !pr.length) return 0.04; if (t <= pr[0].t) return pr[0].r; if (t >= pr[pr.length - 1].t) return pr[pr.length - 1].r;
  for (let i = 0; i < pr.length - 1; i++) if (t <= pr[i + 1].t) { const u = (t - pr[i].t) / Math.max(1e-9, pr[i + 1].t - pr[i].t), s = pr[i].k && pr[i + 1].k ? u : u * u * (3 - 2 * u); return pr[i].r + (pr[i + 1].r - pr[i].r) * s; } return pr[pr.length - 1].r; } /* 描いた点どうし（k）はまっすぐ＝角が立つ */
function frames(path) { const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
  if (OPT.transport) return framesTransport(path, Z, X);
  return path.map((p, i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], T = b.clone().sub(a).normalize();
    let Wd = new THREE.Vector3().crossVectors(T, Z); if (Wd.lengthSq() < 0.04) Wd = new THREE.Vector3().crossVectors(T, X); Wd.normalize(); if (Wd.x < -1e-6 || (Math.abs(Wd.x) < 1e-6 && Wd.y < 0)) Wd.negate();
    const Dd = new THREE.Vector3().crossVectors(Wd, T).normalize(); if (Dd.z < 0) Dd.negate(); return { T, Wd, Dd }; }); }
// ねじれない断面の向き：最初の輪だけ今までの決め方、あとは前の輪の向きを、骨の曲がった分だけ回して引き継ぐ（途中で90°や180°跳ばない）
function framesTransport(path, Z, X) { const out = []; let W = null;
  for (let i = 0; i < path.length; i++) { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], T = b.clone().sub(a).normalize();
    if (!W) { W = new THREE.Vector3().crossVectors(T, Z); if (W.lengthSq() < 0.04) W = new THREE.Vector3().crossVectors(T, X); W.normalize(); if (W.x < -1e-6 || (Math.abs(W.x) < 1e-6 && W.y < 0)) W.negate(); }
    else { const Tp = out[i - 1].T, q = new THREE.Quaternion().setFromUnitVectors(Tp, T); W = W.clone().applyQuaternion(q); W.addScaledVector(T, -W.dot(T)).normalize(); }
    out.push({ T, Wd: W.clone(), Dd: null }); }
  const D0 = new THREE.Vector3().crossVectors(out[0].Wd, out[0].T).normalize(), flip = D0.z < 0 ? -1 : 1;
  for (const f of out) f.Dd = new THREE.Vector3().crossVectors(f.Wd, f.T).normalize().multiplyScalar(flip);
  return out; }
function boneGeom(b) { // 元の側の形（鏡はこれを左右反転して作る）
  const P = ptsOf(b, false); if (P.length < 2) return null;
  const ts = ringTs(b), uni = ts.length === ringsOf(b) && ts.every((t, r) => Math.abs(t - r / (ts.length - 1)) < 1e-9), rings = ts.length;
  let path; if (uni) path = smoothPath(P, rings).pts; else { const D = smoothPath(P, 241).pts; path = ts.map(t => { const x = t * 240, i = Math.min(239, Math.floor(x)); return D[i].clone().lerp(D[i + 1], x - i); }); }
  const F = frames(path), n = b.sides || 8, V = [], I = [];
  for (let r = 0; r < rings; r++) { const t = ts[r], f = F[r];
    for (let k = 0; k < n; k++) { const a = angOf(k, n, b.av), c = Math.cos(a), s = Math.sin(a), rw = profAt(c >= 0 ? b.wp : b.wn, t), rd = profAt(s >= 0 ? b.dp : b.dn, t), o = b.off[r + '_' + k] || [0, 0, 0];
      const p = path[r].clone().addScaledVector(f.Wd, c * rw + o[0]).addScaledVector(f.Dd, s * rd + o[1]).addScaledVector(f.T, o[2]); V.push(p.x, p.y, p.z); } }
  const cap = (r, dir) => { const t = r === 0 ? 0 : 1, f = F[r], m = Math.min(profAt(b.wp, t), profAt(b.dp, t)), c = path[r].clone().addScaledVector(f.T, dir * m * 0.6); V.push(c.x, c.y, c.z); return V.length / 3 - 1; };
  for (let r = 0; r < rings - 1; r++) for (let k = 0; k < n; k++) { const a = r * n + k, bb = r * n + (k + 1) % n, c = (r + 1) * n + k, d = (r + 1) * n + (k + 1) % n; I.push(a, c, bb, bb, c, d); }
  const c0 = cap(0, -1), c1 = cap(rings - 1, 1); for (let k = 0; k < n; k++) { I.push(c0, k, (k + 1) % n); I.push(c1, (rings - 1) * n + (k + 1) % n, (rings - 1) * n + k); }
  return Object.defineProperty({ V, I, path, F, n, rings }, 'ts', { value: ts }); /* ts は計算比較の外（JSONに出さない） */
}
function topoBones() { const out = [], seen = new Set(), visit = b => { if (seen.has(b.id)) return; seen.add(b.id); const p = b.parent != null && boneById(b.parent); if (p) visit(p); out.push(b); }; state.current.bones.forEach(visit); return out; }
function blendPose(A, B, u) { // 骨の向きを回転で補間（長さは保つ）。子の根元は親の関節にくっつける
  const out = {};
  for (const b of topoBones()) { const a = A[b.id] || (state.current.rest && state.current.rest[b.id]) || b.pts, c = B[b.id] || a; if (a.length !== c.length) { out[b.id] = clone(a); continue; }
    let root = V3(a[0]).lerp(V3(c[0]), u); const par = b.parent != null && out[b.parent]; if (par && b.at != null && par[b.at]) { const PA = A[b.parent], PB = B[b.parent]; let o = new THREE.Vector3(); if (PA && PA[b.at] && PB && PB[b.at]) o = V3(a[0]).sub(V3(PA[b.at])).lerp(V3(c[0]).sub(V3(PB[b.at])), u); root = V3(par[b.at]).add(o); } /* 親の関節からのずれも保つ */
    const pts = [root]; for (let i = 1; i < a.length; i++) { const da = V3(a[i]).sub(V3(a[i - 1])), dc = V3(c[i]).sub(V3(c[i - 1])), la = da.length(), lc = dc.length();
      const q = new THREE.Quaternion().setFromUnitVectors(da.clone().normalize(), dc.clone().normalize()), qu = new THREE.Quaternion().slerp(q, u), dir = da.clone().normalize().applyQuaternion(qu);
      pts.push(pts[i - 1].clone().addScaledVector(dir, la + (lc - la) * u)); }
    out[b.id] = pts.map(p => [p.x, p.y, p.z].map(r4)); }
  return out; }
function segInfo(f) { const K = state.current.anim.keys; let a = null, b = null; for (const k of K) { if (k.f <= f) a = k; else { b = k; break; } } if (!b && a && state.current.anim.loop && K.length && a.f < state.current.anim.len) b = { f: state.current.anim.len, pose: K[0].pose, virt: true }; return { a, b }; }
function keyAt(f) { return state.current.anim.keys.find(k => k.f === f); }
function segOf(a) { if (!state.current.anim.seg) state.current.anim.seg = {}; let s = state.current.anim.seg[a.f]; if (!s) s = state.current.anim.seg[a.f] = { n: -1, bias: 0, sp: null, paths: {}, fix: {} }; if (!s.paths) s.paths = {}; if (!s.fix) s.fix = {}; return s; }
function nOf(a, b) { const s = segOf(a), L = b.f - a.f; return Math.max(0, Math.min(s.n < 0 ? Math.round(L / 2) - 1 : s.n, L - 1)); }
function drawFrames(a, b) { const n = nOf(a, b), out = []; for (let j = 1; j <= n; j++) out.push(a.f + Math.round(j * (b.f - a.f) / (n + 1))); return out; }
function drawIdx(a, b, f) { let j = 0; drawFrames(a, b).forEach((x, i) => { if (x <= f) j = i + 1; }); return j; }
function spacingOf(a, b) { const s = segOf(a), n = nOf(a, b); if (Array.isArray(s.sp) && s.sp.length === n) return s.sp;
  const p = Math.pow(2, -(s.bias || 0) * 1.4), o = []; for (let j = 1; j <= n; j++) o.push(r4(Math.pow(j / (n + 1), p))); return o; } // 寄せ：−＝先ツメ、＋＝後ツメ
function bezNorm(p) { if (Array.isArray(p)) { const P = p.map(V3), n = P.length, a = [], hi = [], ho = []; for (let i = 0; i < n; i++) { const T = P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).multiplyScalar(1 / 6); a.push(P[i]); ho.push(P[i].clone().add(T)); hi.push(P[i].clone().sub(T)); } return { a, hi, ho }; }
  return { a: p.a.map(V3), hi: p.hi.map(V3), ho: p.ho.map(V3) }; }
function bezBake(p, pA, pB) { const B = bezNorm(p), n = B.a.length, dA = pA.clone().sub(B.a[0]), dB = pB.clone().sub(B.a[n - 1]), sh = (v, i) => v.clone().addScaledVector(dA, 1 - i / (n - 1)).addScaledVector(dB, i / (n - 1)); return { a: B.a.map(sh), hi: B.hi.map(sh), ho: B.ho.map(sh) }; }
function cubicAt(B, i, t) { const s = 1 - t; return new THREE.Vector3().addScaledVector(B.a[i], s * s * s).addScaledVector(B.ho[i], 3 * s * s * t).addScaledVector(B.hi[i + 1], 3 * s * t * t).addScaledVector(B.a[i + 1], t * t * t); }
function bezSample(B, m) { const out = []; for (let i = 0; i < B.a.length - 1; i++) for (let k = i ? 1 : 0; k <= m; k++) out.push(cubicAt(B, i, k / m)); return out; }
function evalPath(p, u, pA, pB) { const S2 = bezSample(bezBake(p, pA, pB), 20), acc = [0]; for (let i = 1; i < S2.length; i++) acc.push(acc[i - 1] + S2[i].distanceTo(S2[i - 1]));
  const s = Math.max(0, Math.min(1, u)) * acc[acc.length - 1]; let j = 0; while (j < acc.length - 2 && acc[j + 1] < s) j++; return S2[j].clone().lerp(S2[j + 1], (s - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j])); }
function txTree(P, id, fn) { if (P[id]) P[id] = P[id].map(p => { const v = fn(V3(p)); return [v.x, v.y, v.z].map(r4); }); for (const c of kidsOf(id)) txTree(P, c.id, fn); }
function applyPath(P, key, ctrl, u, a, b) { const [id, i] = key.split('_').map(Number), bone = boneById(id); if (!bone || !P[id] || !a.pose[id] || !b.pose[id] || !P[id][i]) return;
  const T = evalPath(ctrl, u, V3(a.pose[id][i]), V3(b.pose[id][i]));
  if (i === 0) { const D = T.sub(V3(P[id][0])); txTree(P, id, v => v.add(D)); return; }
  const old = P[id].map(V3), L = []; for (let k = 1; k <= i; k++) L.push(old[k].distanceTo(old[k - 1])); const nw = old.map(v => v.clone()), root = old[0];
  for (let it = 0; it < 12; it++) { nw[i] = T.clone(); for (let k = i - 1; k >= 0; k--) nw[k] = nw[k + 1].clone().add(nw[k].clone().sub(nw[k + 1]).setLength(L[k])); // FABRIK
    nw[0] = root.clone(); for (let k = 1; k <= i; k++) nw[k] = nw[k - 1].clone().add(nw[k].clone().sub(nw[k - 1]).setLength(L[k - 1])); }
  const qs = [null]; for (let k = 1; k <= i; k++) qs.push(new THREE.Quaternion().setFromUnitVectors(old[k].clone().sub(old[k - 1]).normalize(), nw[k].clone().sub(nw[k - 1]).normalize()));
  for (let k = i + 1; k < old.length; k++) nw[k] = nw[i].clone().add(old[k].clone().sub(old[i]).applyQuaternion(qs[i]));
  P[id] = nw.map(v => [v.x, v.y, v.z].map(r4));
  for (const c of kidsOf(id)) { const k = c.at; if (k == null || k < 1) continue; const q = qs[Math.min(k, i)], o = old[k], n = nw[k]; txTree(P, c.id, v => n.clone().add(v.sub(o).applyQuaternion(q))); } }
function poseU(a, b, u, skipKey) { const P = blendPose(a.pose, b.pose, u), s = segOf(a); for (const k in s.paths) if (k !== skipKey) applyPath(P, k, s.paths[k], u, a, b); return P; }
function poseKeys(f) { const { a, b } = segInfo(f); if (!a) return state.current.anim.keys[0].pose; if (!b) return a.pose; const j = drawIdx(a, b, f); if (j === 0) return a.pose;
  const s = segOf(a); if (s.fix[j]) return s.fix[j]; return poseU(a, b, spacingOf(a, b)[j - 1]); }
// ---- パフォーム（記録）：録った骨は記録の動き。なめらか（sm）とコマ打ち（step）はここで効く ----
const restOf = id => { const R = state.current.rest, b = boneById(id); return (R && R[id]) || (b && b.pts); };
const wrapF = (A, g) => A.loop ? ((g % A.len) + A.len) % A.len : Math.max(0, Math.min(A.len, g));
function perfIds(A) { const pf = A && A.perf; if (!pf || !pf.fr) return null; if (pf._ids && pf._n === Object.keys(pf.fr).length) return pf._ids; const ids = new Set(); for (const f in pf.fr) for (const id in pf.fr[f]) ids.add(+id);
  Object.defineProperty(pf, '_ids', { value: ids, writable: true, configurable: true }); Object.defineProperty(pf, '_n', { value: Object.keys(pf.fr).length, writable: true, configurable: true }); return ids; }
const qOf = (a, b) => new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
// 親が動いた骨の、記録してない子を付いていかせる（親の骨の向きの変わり方で回す）
function reattach(out, old, id, skip) { for (const c of kidsOf(id)) { if (skip.has(c.id) || c.at == null) continue; const po = old[id], pn = out[id], k = c.at; if (!po || !pn || !po[k] || !pn[k]) continue;
    const k0 = k > 0 ? k - 1 : 0, k1 = k > 0 ? k : Math.min(1, po.length - 1), q = k1 > k0 ? qOf(V3(po[k1]).sub(V3(po[k0])), V3(pn[k1]).sub(V3(pn[k0]))) : new THREE.Quaternion(), O = V3(po[k]), N = V3(pn[k]);
    const tx = id2 => { if (!out[id2]) return; out[id2] = out[id2].map(p => { const v = N.clone().add(V3(p).sub(O).applyQuaternion(q)); return [v.x, v.y, v.z].map(r4); }); for (const g of kidsOf(id2)) if (!skip.has(g.id)) tx(g.id); };
    out = Object.assign(out, {}); tx(c.id); } return out; }
function perfPose(f) { const A = state.current.anim, pf = A.perf, ids = perfIds(A); const step = Math.max(1, (pf && pf.step) || 1), g = ids ? Math.floor(f / step) * step : f, P = poseKeys(g); if (!ids || !ids.size) return P;
  const out = Object.assign({}, P), w = Math.round(Math.max(0, Math.min(1, pf.sm || 0)) * 4);
  for (const b of topoBones()) { if (!ids.has(b.id)) continue; const base = pf.fr[g] && pf.fr[g][b.id]; if (!base) continue; const sm = [];
    for (let d = -w; d <= w; d++) { const h = wrapF(A, g + d), fr = pf.fr[h]; if (fr && fr[b.id] && fr[b.id].length === base.length) sm.push({ v: fr[b.id], k: w + 1 - Math.abs(d) }); }
    const kt = sm.reduce((a, o) => a + o.k, 0), avg = base.map((_, i) => { const v = new THREE.Vector3(); for (const o of sm) v.addScaledVector(V3(o.v[i]), o.k / kt); return v; });
    const pts = [avg[0]]; for (let i = 1; i < base.length; i++) { const L = V3(base[i]).distanceTo(V3(base[i - 1])), d = avg[i].clone().sub(pts[i - 1]); pts.push(pts[i - 1].clone().addScaledVector(d.lengthSq() > 1e-12 ? d.normalize() : V3(base[i]).sub(V3(base[i - 1])).normalize(), L)); } /* ならしても骨の長さは変えない */
    const par = b.parent != null && out[b.parent]; if (par && b.at != null && par[b.at]) { const D = V3(par[b.at]).add(b.atOff ? V3(b.atOff) : new THREE.Vector3()).sub(pts[0]); pts.forEach(p => p.add(D)); } /* 親の関節にくっつける */
    const old = out; out[b.id] = pts.map(v => [v.x, v.y, v.z].map(r4)); reattach(out, P, b.id, ids); }
  return out; }
// ---- 脚のリンク：元の骨と同じ動き（〇コマずらし）。反対側にある骨は左右反転で写す ----
const sideOf = id => { const r = restOf(id); if (!r) return 0; const ax = state.current.axis || 0, m = r.reduce((a, p) => a + p[0], 0) / r.length - ax; return Math.abs(m) < 0.02 ? 0 : Math.sign(m); };
function linkPose(P, f) { const A = state.current.anim, L = A && A.links; if (!L || !Object.keys(L).length) return P; let out = null;
  for (const b of topoBones()) { const l = L[b.id]; if (!l) continue; const src = boneById(l.src); if (!src || L[src.id] || src.pts.length !== b.pts.length) continue;
    const off = (l.off || 0) + (l.half ? Math.round(A.len / 2) : 0), g = wrapF(A, f - off), Ps = g === f ? P : perfPose(g), ps = Ps[src.id], rs = restOf(src.id), rf = restOf(b.id); if (!ps || !rs || !rf || ps.length !== rs.length || rf.length !== rs.length) continue;
    const mir = sideOf(src.id) * sideOf(b.id) < 0, cur = out || Object.assign({}, P);
    const par = b.parent != null && cur[b.parent]; let start;
    if (par && b.at != null && par[b.at]) start = V3(par[b.at]).add(b.atOff ? V3(b.atOff) : new THREE.Vector3());
    else { const d = V3(ps[0]).sub(V3(rs[0])); if (mir) d.x = -d.x; start = V3(rf[0]).add(d); }
    const pts = [start]; for (let k = 0; k < rf.length - 1; k++) { let q = qOf(V3(rs[k + 1]).sub(V3(rs[k])), V3(ps[k + 1]).sub(V3(ps[k]))); if (mir) q = new THREE.Quaternion(q.x, -q.y, -q.z, q.w); pts.push(pts[k].clone().add(V3(rf[k + 1]).sub(V3(rf[k])).applyQuaternion(q))); }
    const old = Object.assign({}, cur); cur[b.id] = pts.map(v => [v.x, v.y, v.z].map(r4)); reattach(cur, old, b.id, new Set(Object.keys(L).map(Number))); out = cur; }
  return out || P; }
function poseAt(f) { return linkPose(perfPose(f), f); }
function measureGaitQuality(data, anim, slot) {
  const neutral = {factor:1,stride:0,lift:0,feet:0};
  if(!data||!data.bones||!anim||!anim.keys||anim.keys.length<2||!anim.len)return neutral;
  const rest=data.rest||Object.fromEntries(data.bones.map(b=>[b.id,b.pts]));
  let floor=Infinity;
  for(const b of data.bones){const pts=rest[b.id]||b.pts;if(pts&&pts.length)floor=Math.min(floor,pts[pts.length-1][1]);}
  const feet=data.bones.filter(b=>{const pts=rest[b.id]||b.pts,p=pts&&pts[pts.length-1];return p&&p[1]<floor+0.17&&Math.abs(p[0])>0.06;}).map(b=>b.id);
  if(!feet.length)return neutral;
  function sample(A){
    if(!A||!A.len||!A.keys||A.keys.length<2)return null;
    const before=state.current,prior=data.anim,traces=new Map(feet.map(id=>[id,{z:[],y:[],jumps:0,prev:null}]));
    try{
      state.current=data;state.current.anim=A;
      for(let f=0;f<A.len;f++){
        const P=poseAt(f),root=P[data.bones[0].id]&&P[data.bones[0].id][0]||[0,0,0];
        for(const id of feet){const pts=P[id];if(!pts||!pts.length)continue;const tip=pts[pts.length-1],tr=traces.get(id),pt=[tip[0]-root[0],tip[1]-root[1],tip[2]-root[2]];
          if(tr.prev&&Math.hypot(pt[0]-tr.prev[0],pt[1]-tr.prev[1],pt[2]-tr.prev[2])>0.24)tr.jumps++;
          tr.prev=pt;tr.z.push(pt[2]);tr.y.push(pt[1]);
        }
      }
    }finally{data.anim=prior;state.current=before;}
    let stride=0,lift=0,jumps=0,count=0;
    for(const tr of traces.values()){if(tr.z.length<2)continue;stride+=Math.max(...tr.z)-Math.min(...tr.z);lift+=Math.max(...tr.y)-Math.min(...tr.y);jumps+=tr.jumps;count++;}
    return count?{stride:stride/count,lift:lift/count,jumps,count}:null;
  }
  const val=sample(anim);if(!val)return neutral;
  const kind=TPL.detect(data),base=kind?sample(TPL.animFor(kind,slot,rest,data.bones)):null;
  const ref=base||{stride:0.20,lift:0.08};
  const stretch=Math.max(0.1,Math.min(2,val.stride/Math.max(0.03,ref.stride)));
  const raise=Math.max(0.1,Math.min(2,val.lift/Math.max(0.02,ref.lift)));
  const penalty=val.jumps?Math.max(0.6,1-val.jumps/(val.count*Math.max(1,anim.len))*4):1;
  const factor=Math.max(0.55,Math.min(1.5,(stretch*0.8+raise*0.2)*penalty));
  return {factor,stride:val.stride,lift:val.lift,feet:val.count};
}
function detailPointsFromMesh(mesh,stroke){
  if(!mesh||!stroke||!Array.isArray(stroke.pts))return [];
  const arr=mesh.geometry.attributes.position.array,pts=[];
  for(const s of stroke.pts){
    const i=s.face*9,bc=s.bary;
    if(!Array.isArray(bc)||!Number.isInteger(s.face)||i<0||i+8>=arr.length)continue;
    const A=new THREE.Vector3(arr[i],arr[i+1],arr[i+2]),B=new THREE.Vector3(arr[i+3],arr[i+4],arr[i+5]),C=new THREE.Vector3(arr[i+6],arr[i+7],arr[i+8]);
    const p=A.clone().multiplyScalar(bc[0]).addScaledVector(B,bc[1]).addScaledVector(C,bc[2]);
    const norm=B.clone().sub(A).cross(C.clone().sub(A)).normalize();
    pts.push(p.addScaledVector(norm,.008));
  }
  return pts;
}
return {poseKeys,perfPose,perfIds,sideOf,ringTs,mirK,flipZK,smoothPath,profAt,frames,boneGeom,topoBones,blendPose,segInfo,keyAt,segOf,nOf,drawFrames,drawIdx,spacingOf,bezNorm,bezBake,cubicAt,bezSample,evalPath,txTree,applyPath,poseU,poseAt,measureGaitQuality,detailPointsFromMesh,ptsOf,ringsOf,angOf,bezStore,kidsOf};
}});
