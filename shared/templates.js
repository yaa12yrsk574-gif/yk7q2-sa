window.BoneTemplates = (() => {
  const cl = o => JSON.parse(JSON.stringify(o));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const r4 = v => Math.round(v * 1e4) / 1e4, R4 = p => p.map(r4);
  // 回す：pitch＋で前（+z）が下を向く、yaw＋で前が+x（向かって左）へ
  function rot(v, yaw, pitch) { let [x, y, z] = v; if (pitch) { const c = Math.cos(pitch), s = Math.sin(pitch); [y, z] = [y * c - z * s, z * c + y * s]; } if (yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); [x, z] = [x * c + z * s, z * c - x * s]; } return [x, y, z]; }
  const rotAbout = (p, piv, yaw, pitch) => add(piv, rot(sub(p, piv), yaw, pitch));
  function curl(pts, yaw, pitch) { const P = pts.map(p => p.slice()), n = P.length - 1; for (let i = 1; i <= n; i++) for (let j = i; j <= n; j++) P[j] = rotAbout(P[j], P[i - 1], yaw / n, pitch / n); return P; }
  function ik(H, F, l1, l2, bendRef) { let d = sub(F, H), dl = len(d); const mx = l1 + l2 - 1e-4; if (dl > mx) { d = mul(nrm(d), mx); F = add(H, d); dl = mx; } const u = nrm(d), x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let w = sub(bendRef, mul(u, dot(bendRef, u))); if (len(w) < 1e-6) w = [0, 1, 0]; w = nrm(w); return [H, add(add(H, mul(u, x)), mul(w, h)), F]; }
  // 四元数（向きの変わり方）
  function qFrom(a, b) { a = nrm(a); b = nrm(b); const d = dot(a, b); if (d > 0.999999) return [0, 0, 0, 1]; if (d < -0.999999) { let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a); ax = nrm(ax); return [ax[0], ax[1], ax[2], 0]; } const c = cross(a, b), q = [c[0], c[1], c[2], 1 + d], l = Math.hypot(...q); return q.map(v => v / l); }
  function qRot(q, v) { const [x, y, z, w] = q, u = [x, y, z], t = mul(cross(u, v), 2); return add(add(v, mul(t, w)), cross(u, t)); }
  const ID = [0, 0, 0, 1];
  function topo(bones) { const out = [], done = new Set(), byId = new Map(bones.map(b => [b.id, b])); const visit = b => { if (done.has(b.id)) return; done.add(b.id); const p = b.parent != null && byId.get(b.parent); if (p) visit(p); out.push(b); }; bones.forEach(visit); return out; }
  const cum = pts => { const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + len(sub(pts[i], pts[i - 1]))); const T = s[s.length - 1] || 1; return s.map(v => v / T); };
  // お手本ポーズ P0（お手本の骨 R0 の上）を、今の骨 R（bones の並び・つながり）に写す
  function retarget(R0, P0, R, bones) { const P = {}, Q = {};
    for (const b of topo(bones)) { const r = R[b.id]; if (!r || r.length < 1) continue; const r0 = R0[b.id], p0 = P0[b.id];
      let qs; if (r0 && p0 && r0.length === p0.length && r0.length >= 2) { const q0 = []; for (let k = 0; k < r0.length - 1; k++) q0.push(qFrom(sub(r0[k + 1], r0[k]), sub(p0[k + 1], p0[k]))); const s0 = cum(r0), s = cum(r);
        qs = []; for (let k = 0; k < r.length - 1; k++) { const t = (s[k] + s[k + 1]) / 2; let j = 0; while (j < q0.length - 1 && s0[j + 1] < t) j++; qs.push(q0[j]); } }
      else qs = new Array(Math.max(1, r.length - 1)).fill(null);
      const par = b.parent != null ? bones.find(x => x.id === b.parent) : null; let start;
      if (par && P[par.id]) { const at = Math.max(0, Math.min((b.at != null ? b.at : 0), R[par.id].length - 1)), qp = Q[par.id][Math.min(at, Q[par.id].length - 1)] || ID; start = add(P[par.id][at], qRot(qp, sub(r[0], R[par.id][at]))); }
      else if (r0 && p0) { const sc = (len(sub(r[r.length - 1], r[0])) || 1) / (len(sub(r0[r0.length - 1], r0[0])) || 1); start = add(r[0], mul(sub(p0[0], r0[0]), sc)); }
      else start = r[0].slice();
      const qsF = qs.map((q, k) => q || (par && Q[par.id] ? (Q[par.id][Math.min(b.at || 0, Q[par.id].length - 1)] || ID) : ID));
      const out = [start]; for (let k = 0; k < r.length - 1; k++) out.push(add(out[k], qRot(qsF[k], sub(r[k + 1], r[k])))); P[b.id] = out.map(R4); Q[b.id] = qsF; }
    for (const b of bones) if (!P[b.id] && R[b.id]) P[b.id] = cl(R[b.id]); return P; }
  // ===== ツノトカゲ =====
  function tokageData() { const pr = (a, b) => [{ t: 0, r: a }, { t: 1, r: b }], B = [];
    const addB = (id, parent, at, pts, w, d) => { B.push({ id, parent, at, pts, wp: pr(w[0], w[1]), wn: pr(w[0], w[1]), dp: pr(d[0], d[1]), dn: pr(d[0], d[1]), off: {}, sides: 8 }); };
    addB(1, null, null, [[0, .45, -.45], [0, .5, -.1], [0, .5, .25], [0, .48, .4]], [.12, .1], [.11, .09]);
    addB(2, 1, 3, [[0, .48, .4], [0, .58, .55], [0, .6, .72]], [.07, .06], [.07, .05]);
    addB(3, 2, 2, [[0, .62, .7], [0, .8, .8]], [.03, .008], [.03, .008]);
    addB(4, 1, 0, [[0, .45, -.45], [0, .38, -.75], [0, .3, -1.0]], [.06, .015], [.06, .015]);
    addB(5, 1, 2, [[-.12, .45, .25], [-.16, .25, .28], [-.16, .03, .3]], [.045, .03], [.045, .03]);
    addB(7, 1, 0, [[-.12, .42, -.4], [-.17, .22, -.45], [-.16, .03, -.38]], [.05, .03], [.05, .03]);
    for (const [s, t] of [[5, 6], [7, 8]]) { const b = B.find(x => x.id === s), m = cl(b); m.id = t; m.pts = b.pts.map(p => [-p[0], p[1], p[2]]); m.twin = s; b.twin = t; B.push(m); }
    for (const b of B) { const p = b.parent != null && B.find(x => x.id === b.parent); if (p) { const q = p.pts[b.at], d = [b.pts[0][0] - q[0], b.pts[0][1] - q[1], b.pts[0][2] - q[2]]; if (Math.hypot(...d) > 0.002) b.atOff = d; } }
    return { bones: B, sym: true, v6: 1, axis: 0, tpl: { kind: 'tokage', v: 1 } }; }
  function tokPose(R, o) { o = Object.assign({ dx: 0, dy: 0, dz: 0, sway: 0, arch: 0, neckYaw: 0, neckPitch: 0, hornPitch: 0, tailYaw: 0, tailPitch: 0, legs: {} }, o); const P = {};
    const C = [-0.6, 0, 0.6, 0.8], A = [0, 1, 1, 0]; P[1] = R[1].map((p, i) => [p[0] + o.dx + o.sway * C[i], p[1] + o.dy + o.arch * A[i], p[2] + o.dz]);
    const dS = i => sub(P[1][i], R[1][i]);
    const neck = R[2].map(p => add(p, dS(3))), nb = neck[0]; P[2] = neck.map(p => rotAbout(p, nb, o.neckYaw, o.neckPitch));
    const horn = R[3].map(p => rotAbout(add(p, dS(3)), nb, o.neckYaw, o.neckPitch)); P[3] = horn.map(p => rotAbout(p, horn[0], 0, o.hornPitch));
    P[4] = curl(R[4].map(p => add(p, dS(0))), o.tailYaw, o.tailPitch);
    for (const id of [5, 6, 7, 8]) { const r = R[id], at = id <= 6 ? 2 : 0, H = add(r[0], dS(at)), L = o.legs[id] || [0, 0, 0], F = add(r[2], [L[2] || 0, L[1] || 0, L[0] || 0]);
      const l1 = len(sub(r[1], r[0])), l2 = len(sub(r[2], r[1])), mid = add(r[0], mul(sub(r[2], r[0]), l1 / (l1 + l2))); P[id] = ik(H, F, l1, l2, sub(r[1], mid)); }
    for (const id in P) P[id] = P[id].map(R4); return P; }
  function tokageActs() { const R = {}; for (const b of tokageData().bones) R[b.id] = b.pts; const out = [];
    { const keys = []; for (let f = 0; f < 16; f += 2) { const ph = f / 16 * Math.PI * 2, legs = {}, S = 0.09, Lf = 0.06;
        for (const [id, off] of [[5, 0], [8, 0], [6, Math.PI], [7, Math.PI]]) { const u = ((ph + off) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); legs[id] = [S * Math.cos(u), u > Math.PI ? Lf * Math.sin(u - Math.PI) : 0, 0]; }
        keys.push({ f, pose: tokPose(R, { dy: -0.04 + 0.012 * Math.cos(2 * ph), sway: 0.035 * Math.sin(ph), neckYaw: -0.12 * Math.sin(ph), tailYaw: 0.35 * Math.sin(ph + 1.2), legs }) }); }
      out.push({ slot: 'walk', name: '歩き', anim: { len: 16, loop: true, guides: [{ f: 0, label: '接地' }, { f: 4, label: '通過' }, { f: 8, label: '逆足で接地' }, { f: 12, label: '通過' }], keys, seg: {} } }); }
    { const keys = []; for (let f = 0; f < 12; f += 2) { const ph = f / 12 * Math.PI * 2, legs = {}, S = 0.14, Lf = 0.09; /* 走り：歩きと同じ対角の足運びで、歩幅・うねり・しっぽを大きく */
        for (const [id, off] of [[5, 0], [8, 0], [6, Math.PI], [7, Math.PI]]) { const u = ((ph + off) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); legs[id] = [S * Math.cos(u), u > Math.PI ? Lf * Math.sin(u - Math.PI) : 0, 0]; }
        keys.push({ f, pose: tokPose(R, { dy: -0.07 + 0.018 * Math.cos(2 * ph), sway: 0.06 * Math.sin(ph), neckYaw: -0.18 * Math.sin(ph), neckPitch: -0.12, tailYaw: 0.55 * Math.sin(ph + 1.2), tailPitch: 0.12, legs }) }); }
      out.push({ slot: 'run', name: '走る', anim: { len: 12, loop: true, guides: [{ f: 0, label: '接地' }, { f: 3, label: '通過' }, { f: 6, label: '逆足で接地' }, { f: 9, label: '通過' }], keys, seg: {} } }); }
    { const K = (f, o) => ({ f, pose: tokPose(R, o) });
      out.push({ slot: 'attack', name: '攻撃', anim: { len: 16, loop: false, guides: [{ f: 0, label: 'かまえ' }, { f: 5, label: '溜め' }, { f: 8, label: '打つ！' }, { f: 16, label: '戻り' }],
        keys: [K(0, {}), K(4, { dz: -0.04, dy: -0.02, neckPitch: 0.25, hornPitch: 0.05, tailPitch: 0.1 }), K(8, { dz: 0.07, dy: -0.02, neckPitch: -0.4, hornPitch: -0.12, tailPitch: -0.05 }), K(12, { dz: 0.04, dy: -0.01, neckPitch: -0.15 }), K(16, {})], seg: {} } }); } /* わざと平均以下：溜めが浅い・原画が均等・首もしっぽも同時に動いて同時に止まる（送りなし）。改良＝原理を足すこと */
    { const K = (f, o) => ({ f, pose: tokPose(R, o) });
      out.push({ slot: 'attack_fast', name: '速い技', anim: { len: 10, loop: false,
        guides: [{ f: 0, label: '構え' }, { f: 2, label: '小さく溜め' }, { f: 4, label: '突き！' }, { f: 10, label: '戻り' }],
        keys: [K(0, {}), K(2, { dz: -0.015, neckPitch: 0.16, hornPitch: 0.05 }),
          K(4, { dz: 0.045, neckPitch: -0.28, hornPitch: -0.11 }),
          K(6, { dz: 0.04, neckPitch: -0.12 }), K(10, {})], seg: {} } }); }
    { const K = (f, o) => ({ f, pose: tokPose(R, o) });
      out.push({ slot: 'idle', name: '待機', anim: { len: 24, loop: true, guides: [{ f: 0, label: 'はじめ' }, { f: 12, label: '息を吸う' }], keys: [K(0, {}), K(12, { dy: 0.015, arch: 0.01, neckPitch: -0.06, tailYaw: 0.12 })], seg: {} } }); }
    // ジャンプ・落下・着地・泳ぐ（ゲームはアニメから「一番しゃがんだコマ＝溜め」「一番速く伸びるコマ＝踏み切り」を読む）
    { const K = (f, o) => ({ f, pose: tokPose(R, o) }), tuck = d => ({ 5: [0.06, d, 0], 6: [0.06, d, 0], 7: [-0.06, d, 0], 8: [-0.06, d, 0] });
      out.push({ slot: 'jump', name: 'ジャンプ', anim: { len: 14, loop: false, guides: [{ f: 0, label: '構え' }, { f: 5, label: '溜め' }, { f: 7, label: '踏み切り' }, { f: 14, label: '空中' }],
        keys: [K(0, {}), K(5, { dy: -0.12, arch: -0.02, neckPitch: 0.2, tailPitch: 0.12 }), K(7, { dy: 0.06, neckPitch: -0.25, tailPitch: -0.15 }), K(14, { dy: 0.06, neckPitch: -0.1, tailPitch: -0.05, legs: tuck(0.2) })], seg: {} } });
      out.push({ slot: 'fall', name: '落下', anim: { len: 12, loop: true, guides: [{ f: 0, label: '落ちる' }], keys: [K(0, { dy: 0.04, neckPitch: -0.15, tailPitch: -0.12, legs: tuck(0.12) }), K(6, { dy: 0.05, neckPitch: -0.22, tailPitch: -0.05, tailYaw: 0.2, legs: tuck(0.16) })], seg: {} } });
      out.push({ slot: 'land', name: '着地', anim: { len: 10, loop: false, guides: [{ f: 0, label: '着地' }, { f: 3, label: '沈み' }, { f: 10, label: '戻り' }], keys: [K(0, { dy: 0.03, legs: tuck(0.1) }), K(3, { dy: -0.13, neckPitch: 0.25, tailPitch: 0.15 }), K(10, {})], seg: {} } });
      const keys = []; for (let f = 0; f < 16; f += 2) { const ph = f / 16 * Math.PI * 2, legs = {}; for (const [id, off] of [[5, 0], [8, 0], [6, Math.PI], [7, Math.PI]]) { const u = ph + off; legs[id] = [0.1 * Math.cos(u), 0.12 + 0.05 * Math.sin(u), 0.03]; }
        keys.push({ f, pose: tokPose(R, { dy: -0.02, sway: 0.05 * Math.sin(ph), neckPitch: -0.12, neckYaw: -0.1 * Math.sin(ph), tailYaw: 0.6 * Math.sin(ph + 1.2), legs }) }); }
      out.push({ slot: 'swim', name: '泳ぐ', anim: { len: 16, loop: true, guides: [{ f: 0, label: 'かく' }, { f: 8, label: '逆でかく' }], keys, seg: {} } }); }
    return { R, acts: out }; }
  // ===== ツバサトカゲ（翼2・脚2。飛べる）=====
  function tsubasaData() { const B = [], P = (...a) => a.map(([t, r]) => ({ t, r }));
    const addB = (id, parent, at, pts, w, d) => { B.push({ id, parent, at, pts, wp: w, wn: cl(w), dp: d, dn: cl(d), off: {}, sides: 8 }); };
    addB(1, null, null, [[0, .55, -.3], [0, .6, -.05], [0, .6, .2], [0, .58, .32]], P([0, .1], [1, .075]), P([0, .1], [1, .075]));
    addB(2, 1, 3, [[0, .58, .32], [0, .7, .45], [0, .78, .58]], P([0, .055], [1, .045]), P([0, .05], [1, .04]));
    addB(3, 2, 2, [[0, .78, .58], [0, .76, .8]], P([0, .05], [1, .01]), P([0, .045], [1, .012]));
    addB(4, 1, 0, [[0, .55, -.3], [0, .52, -.62], [0, .48, -.98]], P([0, .05], [1, .008]), P([0, .06], [.8, .04], [1, .09]));
    addB(5, 1, 1, [[-.09, .52, 0], [-.11, .28, .07], [-.1, .03, 0]], P([0, .05], [1, .025]), P([0, .05], [1, .025]));
    addB(7, 1, 2, [[-.08, .63, .15], [-.42, .68, .08], [-.86, .62, -.08]], P([0, .025], [1, .008]), P([0, .12], [.5, .2], [1, .05]));
    for (const [s, t] of [[5, 6], [7, 8]]) { const b = B.find(x => x.id === s), m = cl(b); m.id = t; m.pts = b.pts.map(p => [-p[0], p[1], p[2]]); m.twin = s; b.twin = t; B.push(m); }
    for (const b of B) { const p = b.parent != null && B.find(x => x.id === b.parent); if (p) { const q = p.pts[b.at], d = [b.pts[0][0] - q[0], b.pts[0][1] - q[1], b.pts[0][2] - q[2]]; if (Math.hypot(...d) > 0.002) b.atOff = d; } }
    return { bones: B, sym: true, v6: 1, axis: 0, tpl: { kind: 'tsubasa', v: 1 } }; }
  const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
  // up：翼を上げる（＋）下げる（－）／fold：肘から先を下へ折る／sweep：翼を前（＋）後ろ（－）へ／tuck：脚をたたむ（空中）
  function tsuPose(R, o) { o = Object.assign({ dx: 0, dy: 0, dz: 0, neckPitch: 0, headPitch: 0, tailPitch: 0, tailYaw: 0, up: 0, fold: 0, sweep: 0, tuck: 0, legs: {} }, o); const P = {};
    P[1] = R[1].map(p => [p[0] + o.dx, p[1] + o.dy, p[2] + o.dz]); const dS = sub(P[1][0], R[1][0]);
    const neck = R[2].map(p => add(p, dS)), nb = neck[0]; P[2] = neck.map(p => rotAbout(p, nb, 0, o.neckPitch));
    const head = R[3].map(p => rotAbout(add(p, dS), nb, 0, o.neckPitch)); P[3] = head.map(p => rotAbout(p, head[0], 0, o.headPitch));
    P[4] = curl(R[4].map(p => add(p, dS)), o.tailYaw, o.tailPitch);
    for (const id of [5, 6]) { const r = R[id], H = add(r[0], dS), L = o.legs[id] || [0, 0, 0], F = add(add(r[2], [L[2] || 0, L[1] || 0, L[0] || 0]), add(mul(dS, o.tuck), [0, 0.2 * o.tuck, -0.14 * o.tuck]));
      const l1 = len(sub(r[1], r[0])), l2 = len(sub(r[2], r[1])), mid = add(r[0], mul(sub(r[2], r[0]), l1 / (l1 + l2))); P[id] = ik(H, F, l1, l2, sub(r[1], mid)); }
    for (const id of [7, 8]) { const sg = id === 7 ? -1 : 1, r = R[id], base = add(r[0], dS);
      let pts = r.map(p => { const v = rot(sub(p, r[0]), -sg * o.sweep, 0); return add(base, rotZ(v, sg * o.up)); });
      const el = pts[1]; pts[2] = add(el, rotZ(sub(pts[2], el), -sg * o.fold)); P[id] = pts; }
    for (const id in P) P[id] = P[id].map(R4); return P; }
  function tsubasaActs() { const R = {}; for (const b of tsubasaData().bones) R[b.id] = b.pts; const out = [], K = (f, o) => ({ f, pose: tsuPose(R, o) });
    const WF = { up: -0.25, fold: 0.5, sweep: -1.25 }; /* 地上では翼をたたんで背中に沿わせる */
    out.push({ slot: 'idle', name: '待機', anim: { len: 24, loop: true, guides: [{ f: 0, label: 'はじめ' }, { f: 12, label: '息を吸う' }], keys: [K(0, WF), K(12, Object.assign({ dy: 0.012, neckPitch: -0.06, tailYaw: 0.1 }, WF))], seg: {} } });
    for (const [slot, name, n, S, Lf, ws] of [['walk', '歩き', 16, 0.1, 0.07, WF], ['run', '走る', 12, 0.16, 0.1, { up: -0.1, fold: 0.3, sweep: -0.9 }]]) { const keys = [];
      for (let f = 0; f < n; f += 2) { const ph = f / n * Math.PI * 2, legs = {}; for (const [id, off] of [[5, 0], [6, Math.PI]]) { const u = ((ph + off) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); legs[id] = [S * Math.cos(u), u > Math.PI ? Lf * Math.sin(u - Math.PI) : 0, 0]; }
        keys.push({ f, pose: tsuPose(R, Object.assign({ dy: -0.03 + 0.015 * Math.cos(2 * ph), neckPitch: 0.1 * Math.cos(2 * ph), tailYaw: 0.2 * Math.sin(ph), legs }, ws)) }); }
      out.push({ slot, name, anim: { len: n, loop: true, guides: [{ f: 0, label: '接地' }, { f: n / 4, label: '通過' }, { f: n / 2, label: '逆足で接地' }, { f: n * 3 / 4, label: '通過' }], keys, seg: {} } }); }
    out.push({ slot: 'jump', name: 'ジャンプ', anim: { len: 14, loop: false, guides: [{ f: 0, label: '構え' }, { f: 5, label: '溜め' }, { f: 7, label: '踏み切り' }, { f: 14, label: '空中' }],
      keys: [K(0, WF), K(5, { dy: -0.13, neckPitch: 0.25, up: 0.9, fold: -0.2, sweep: 0 }), K(7, { dy: 0.05, neckPitch: -0.2, up: -0.5, fold: 0.1 }), K(14, { dy: 0.05, up: 0.1, tuck: 1, neckPitch: -0.1 })], seg: {} } });
    out.push({ slot: 'flap', name: '羽ばたき', anim: { len: 12, loop: false, guides: [{ f: 0, label: '振り上げ' }, { f: 6, label: '打ち下ろし' }, { f: 12, label: '戻り' }],
      keys: [K(0, { up: 0.95, fold: 0.35, tuck: 1 }), K(3, { up: 0.7, fold: 0.15, tuck: 1 }), K(6, { up: -0.75, fold: -0.1, tuck: 1, dy: 0.03 }), K(9, { up: -0.4, fold: 0.35, tuck: 1 }), K(12, { up: 0.05, tuck: 1 })], seg: {} } });
    out.push({ slot: 'glide', name: '滑空', anim: { len: 24, loop: true, guides: [{ f: 0, label: '広げる' }], keys: [K(0, { up: 0.05, tuck: 1, neckPitch: -0.1 }), K(12, { up: 0.12, tuck: 1, neckPitch: -0.13, tailPitch: 0.05 })], seg: {} } });
    out.push({ slot: 'fall', name: '落下', anim: { len: 12, loop: true, guides: [{ f: 0, label: '落ちる' }], keys: [K(0, { up: 0.8, fold: 0.4, legs: { 5: [0, 0.08, 0], 6: [0, 0.08, 0] }, neckPitch: -0.15 }), K(6, { up: 0.6, fold: 0.6, legs: { 5: [0, 0.1, 0], 6: [0, 0.1, 0] }, neckPitch: -0.2 })], seg: {} } });
    out.push({ slot: 'land', name: '着地', anim: { len: 10, loop: false, guides: [{ f: 0, label: '着地' }, { f: 3, label: '沈み' }, { f: 10, label: '戻り' }], keys: [K(0, { up: 0.6, legs: { 5: [0, 0.08, 0], 6: [0, 0.08, 0] } }), K(3, { dy: -0.12, up: 0.3, neckPitch: 0.25 }), K(10, WF)], seg: {} } });
    { const keys = []; for (let f = 0; f < 16; f += 2) { const ph = f / 16 * Math.PI * 2, legs = {}; for (const [id, off] of [[5, 0], [6, Math.PI]]) { const u = ph + off; legs[id] = [0.12 * Math.cos(u), 0.1 + 0.05 * Math.sin(u), 0]; }
        keys.push({ f, pose: tsuPose(R, Object.assign({ dy: -0.03, neckPitch: -0.1 + 0.05 * Math.sin(ph), tailYaw: 0.4 * Math.sin(ph + 1.2), legs }, { up: -0.1, fold: 0.4, sweep: -1.1 })) }); }
      out.push({ slot: 'swim', name: '泳ぐ', anim: { len: 16, loop: true, guides: [{ f: 0, label: 'かく' }, { f: 8, label: '逆でかく' }], keys, seg: {} } }); }
    return { R, acts: out }; }
  // ===== 人の素体（アニメ工房用）=====
  function hitoData() { const B = [], P = (...a) => a.map(([t, r]) => ({ t, r }));
    const addB = (id, parent, at, pts, w, d) => { B.push({ id, parent, at, pts, wp: w, wn: cl(w), dp: d, dn: cl(d), off: {}, sides: 8 }); };
    addB(1, null, null, [[0, .95, 0], [0, 1.15, .015], [0, 1.38, 0]], P([0, .14], [.5, .12], [1, .16]), P([0, .1], [.5, .09], [1, .1]));
    addB(2, 1, 2, [[0, 1.38, 0], [0, 1.48, .01], [0, 1.72, .02]], P([0, .05], [.35, .05], [.6, .1], [1, .07]), P([0, .05], [.35, .05], [.6, .11], [1, .08]));
    addB(3, 1, 2, [[-.19, 1.34, 0], [-.21, 1.06, -.01], [-.21, .8, .02], [-.21, .7, .03]], P([0, .05], [.4, .04], [.75, .032], [1, .035]), P([0, .05], [.4, .04], [.75, .03], [1, .02]));
    addB(5, 1, 0, [[-.1, .92, 0], [-.11, .5, .03], [-.11, .09, 0], [-.11, .03, .13]], P([0, .075], [.45, .05], [.85, .04], [1, .035]), P([0, .08], [.45, .055], [.85, .045], [1, .03]));
    for (const [s, t] of [[3, 4], [5, 6]]) { const b = B.find(x => x.id === s), m = cl(b); m.id = t; m.pts = b.pts.map(p => [-p[0], p[1], p[2]]); m.twin = s; b.twin = t; B.push(m); }
    for (const b of B) { const p = b.parent != null && B.find(x => x.id === b.parent); if (p) { const q = p.pts[b.at], d = [b.pts[0][0] - q[0], b.pts[0][1] - q[1], b.pts[0][2] - q[2]]; if (Math.hypot(...d) > 0.002) b.atOff = d; } }
    return { bones: B, sym: true, v6: 1, axis: 0, tpl: { kind: 'hito', v: 1 } }; }
  function hitoActs() { const R = {}; for (const b of hitoData().bones) R[b.id] = b.pts; const P2 = cl(R); P2[1] = R[1].map((p, i) => [p[0], p[1] - .01 + i * .006, p[2]]);
    return { R, acts: [{ slot: 'idle', name: '待機', anim: { len: 24, loop: true, guides: [{ f: 0, label: 'はじめ' }, { f: 12, label: '息を吸う' }], keys: [{ f: 0, pose: cl(R) }, { f: 12, pose: P2 }], seg: {} } }] }; }
  const KINDS = { tokage: { name: 'ツノトカゲ', data: tokageData, acts: tokageActs }, tsubasa: { name: 'ツバサトカゲ', data: tsubasaData, acts: tsubasaActs }, hito: { name: '人の素体', data: hitoData, acts: hitoActs } };
  const cache = {};
  const kindAct = k => cache[k] || (cache[k] = KINDS[k].acts());
  function detect(S) { if (S && S.tpl && KINDS[S.tpl.kind]) return S.tpl.kind; if (!S || !S.bones) return null;
    const sig = { 1: null, 2: 1, 3: 2, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 }; for (const id in sig) { const b = S.bones.find(x => x.id === +id); if (!b || (b.parent == null ? null : b.parent) !== sig[id]) return null; } return 'tokage'; }
  // 今の骨（rest：{id:pts}、bones：つながり）向けのお手本アニメ
  function animFor(kind, slot, rest, bones) { if (!KINDS[kind]) return null; const T = kindAct(kind), a = T.acts.find(x => x.slot === slot); if (!a) return null; const A = cl(a.anim); A.keys = A.keys.map(k => ({ f: k.f, pose: retarget(T.R, k.pose, rest, bones) })); return A; }
  function slots(kind) { return KINDS[kind] ? kindAct(kind).acts.map(a => ({ slot: a.slot, name: a.name })) : []; }
  // アニメのキーを f で読む（骨だけ戻す用：間はまっすぐつなぐ）
  function sample(A, f, id) { const K = A.keys; if (!K.length) return null; let a = K[0], b = null; for (const k of K) { if (k.f <= f) a = k; else { b = k; break; } } if (!b && A.loop) b = { f: A.len, pose: K[0].pose }; const pa = a.pose[id]; if (!b || !pa) return pa ? cl(pa) : null; const pb = b.pose[id]; if (!pb || pb.length !== pa.length) return cl(pa); const t = (f - a.f) / ((b.f - a.f) || 1); return pa.map((p, i) => R4(p.map((v, k) => v + (pb[i][k] - v) * t))); }
  // お手本の骨の上でポーズを作る（野生個体の動き用。工房と同じ骨・同じポーズの作り方）
  const poseOf = (kind, o) => kind === 'tokage' ? tokPose(kindAct('tokage').R, o) : kind === 'tsubasa' ? tsuPose(kindAct('tsubasa').R, o) : null;
  return { KINDS, detect, animFor, slots, sample, retarget, poseOf, data: k => KINDS[k] && KINDS[k].data() };
})();
