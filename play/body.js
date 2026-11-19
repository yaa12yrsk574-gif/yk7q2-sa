// ---- 骨の体を動かす：工房の作品（骨＋動き）を読み、コマを進め、重心と接地で跳ぶ・歩く ----
// 見た目は持たない（skin.js が pose を受け取って描く）。長さの単位：作品の中＝工房の単位、外（世界）＝m（工房×大きさ）
window.PlayBody = (() => {
  let S = null; const core = window.BoneCore.create(THREE, () => S, v => { S = v; }), { poseAt, boneGeom } = core;
  const clone = o => JSON.parse(JSON.stringify(o)), TPL = window.BoneTemplates, FR = 24;
  const SLOTS = ['idle', 'walk', 'run', 'jump', 'flap'];
  // 足元を地面、真ん中を原点に（狩り場と同じ置き方）
  function prep(d) { const D = clone(d); D.bones = D.bones.filter(b => b.pts && b.pts.length >= 2); let minY = 1e9, sx = 0, sz = 0, n = 0;
    for (const b of D.bones) for (const p of b.pts) { minY = Math.min(minY, p[1]); sx += p[0]; sz += p[2]; n++; }
    const ox = n ? sx / n : 0, oz = n ? sz / n : 0; for (const b of D.bones) { b.pts = b.pts.map(p => [p[0] - ox, p[1] - minY + 0.02, p[2] - oz]); if (!b.off) b.off = {}; if (!b.wp) b.wp = [{ t: 0, r: 0.04 }]; if (!b.wn) b.wn = b.wp; if (!b.dp) b.dp = b.wp; if (!b.dn) b.dn = b.dp; }
    S = D; let my = Infinity; for (const b of D.bones) { const G = boneGeom(b); if (G) for (let i = 1; i < G.V.length; i += 3) my = Math.min(my, G.V[i]); } if (!isFinite(my)) my = 0.02;
    for (const b of D.bones) b.pts = b.pts.map(p => [p[0], p[1] - my, p[2]]); D.__o = [ox, minY - 0.02 + my, oz]; return D; }
  const shift = (P, o) => { const out = {}; for (const id in P) out[id] = P[id].map(p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]); return out; };
  function animOf(d, slot) { if (!d || !d.acts) return null; const i = d.acts.findIndex(a => a.slot === slot); if (i < 0) return null; const A = i === d.actI ? d.anim : d.acts[i].anim; return A && A.keys && A.keys.length >= 2 ? A : null; }
  const com = (P, ids) => window.JumpPhys.com(P, ids);
  // 作品 → 体（ポーズ・重心・ジャンプと羽ばたきの物理は、工房と同じ shared/jump.js）
  function make(work) { const d = work.data || work, D = prep(d), kind = TPL.detect(d), rest0 = d.rest || Object.fromEntries(d.bones.map(b => [b.id, b.pts])), T = window.BodyMotion.load();
    const size = window.BodyMotion.sizeOf(d), root = (D.bones.find(b => b.parent == null) || D.bones[0]).id, ids = [root], rest = Object.fromEntries(D.bones.map(b => [b.id, b.pts])), cR = com(rest, ids);
    const M = {}; for (const s of SLOTS) { let A = animOf(d, s); if (!A && kind) { try { A = TPL.animFor(kind, s, rest0, d.bones); } catch (_) { A = null; } } if (!A || !A.keys || !A.keys.length) continue;
      const m = { A, len: A.len, P: [], c: [] }; for (let f = 0; f <= A.len; f++) { S = D; S.anim = A; const P = shift(poseAt(f), D.__o); m.P.push(P); m.c.push(com(P, ids)); }
      const pose = f => m.P[Math.max(0, Math.min(A.len, Math.round(f)))];
      if (s === 'jump') { m.J = window.JumpPhys.analyze(A, pose, ids, cR[1], T); if (!m.J) continue; }
      if (s === 'flap') { m.Fx = window.JumpPhys.flapAnalyze(A, pose, D.bones.map(b => b.id), cR[1], ids); if (!m.Fx) continue;
        const th = m.P.map((P, f) => m.Fx.tips.reduce((a, id) => { const p = P[id]; return a + (p ? p[p.length - 1][1] - m.c[f][1] : 0); }, 0)); let best = -1e9; m.down = 1; for (let f = 0; f < A.len; f++) { const v = th[f] - th[f + 1]; if (v > best) { best = v; m.down = f + 1; } } }
      M[s] = m; }
    let x0 = 1e9, x1 = -1e9; for (const id in rest) for (const q of rest[id]) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
    const B = { work, D, size, T, M, rest, cR, ids, radius: Math.max(0.12, (x1 - x0) * size * 0.5),
      h: { x: 0, z: 0, y: 0, v: 0, vy: 0, yaw: 0, st: 'ground', f: 0, ph: 0, airT: 0, tair: 0, rail: false, c: 0, vmax: 0, flapped: false, from: null, peak: 0, gm: null },
      last: null, events: [] };
    B.step = (dt, inp, world) => step(B, dt, inp, world); B.view = () => view(B); return B; }
  const turnTo = (a, b, s) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-s, Math.min(s, d)); };
  const air = st => st === 'jair' || st === 'air' || st === 'flap';
  // inp：mx, mz（世界の向き、長さ≤1）、walk、press/up/held（Space・レールのタップ）、rail{active,v}
  function step(B, dt, inp, world) { const h = B.h, P = B.T, M = B.M, J = M.jump && M.jump.J, Fl = M.flap, g = P.gravity || 16;
    const pw = window.BodyMotion.perf(B.size, 1, 'walk'), pr = window.BodyMotion.perf(B.size, 1, 'run'), p = inp.walk ? pw : pr, mag = Math.min(1, Math.hypot(inp.mx, inp.mz)), ty = Math.atan2(inp.mx, inp.mz);
    if (h.st === 'ground') { if (mag > 0.05) h.yaw = turnTo(h.yaw, ty, p.turn * dt); h.v += Math.max(-p.brake * dt, Math.min(p.accel * dt, mag * p.top - h.v)); }
    else if (h.st === 'charge' || h.st === 'takeoff') { if (mag > 0.05) h.yaw = turnTo(h.yaw, ty, p.turn * 0.5 * dt); h.v *= Math.max(0, 1 - dt * 1.2); }
    else if (mag > 0.05) { h.yaw = turnTo(h.yaw, ty, (P.airTurn || 1.3) * dt); h.v += (mag * pr.top * 0.7 - h.v) * Math.min(1, dt * 1.2); }
    // 踏み切り：作ったコマの重心の動き × 指でこすった速さ（弾き）× しゃがみで溜めた分（上限が上がる）
    const lift = (sp, c) => { const m = M.jump, a = m.c[0], b = J.comTk, dx = (b[0] - a[0]) * B.size, dz = (b[2] - a[2]) * B.size, sy = Math.sin(h.yaw), cy = Math.cos(h.yaw), r2 = Math.min(J.rSpeed * sp, J.rCap * (0.85 + 0.3 * c)), k = J.r > 1e-4 ? r2 / J.r : 1;
      h.x += dx * cy + dz * sy; h.z += -dx * sy + dz * cy; h.vy = J.vy * k; h.v = Math.max(h.v, (J.vh[1] || 0) * k); h.y += 0.001; h.st = 'jair'; h.airT = 0; h.from = 'jump'; h.rail = false; h.tair = 2 * h.vy / g; h.peak = h.y; h.y0 = h.y;
      B.last = { c, sp, h: h.vy * h.vy / (2 * g), lim: J.rSpeed * sp > J.rCap * (0.85 + 0.3 * c) }; B.events.push('lift'); };
    const R = inp.rail;
    if (R && J && (h.st === 'ground' || h.rail)) { const v = R.v;
      if (h.st === 'ground' && R.active && v > 0.06) { h.st = 'charge'; h.rail = true; h.vmax = 0; h.c = 0; }
      if (h.rail && h.st === 'charge') { h.vmax = Math.max(h.vmax, v); h.f = Math.min(1, v / 0.9) * J.hold; if (v >= 0.86) h.c = Math.min(1, h.c + dt / 0.6);
        if (h.vmax >= 0.82 && v < h.vmax - 0.05) { h.st = 'takeoff'; h.t0 = 0; h.v0 = h.vmax; } else if (!R.active) { h.st = 'ground'; h.rail = false; h.c = 0; } }
      else if (h.rail && h.st === 'takeoff') { h.t0 += dt; const u = Math.max(0, Math.min(1, (h.v0 - v) / Math.max(0.3, h.v0 - 0.1))); h.f = J.hold + u * (J.tk - J.hold);
        if (u >= 1 || (!R.active && u > 0.5)) lift(Math.max(0.3, Math.min(1.7, ((J.tk - J.hold) * u / FR) / Math.max(0.03, h.t0))), h.c); else if (!R.active) { h.st = 'ground'; h.rail = false; h.c = 0; } } }
    const keyPress = inp.press && !inp.railTap, startFlap = () => { h.st = 'flap'; h.f = 0; h.flapped = false; };
    if (!h.rail) {
      if (h.st === 'ground' && keyPress) { if (J) { h.st = 'charge'; h.f = 0; h.c = 0; } else { h.vy = P.jumpV || 6.4; h.y += 0.001; h.st = 'air'; h.from = 'hop'; h.peak = h.y; h.y0 = h.y; } }
      if (h.st === 'charge') { h.f = Math.min(J.hold, h.f + dt * FR); if (h.f >= J.hold) h.c = Math.min(1, h.c + dt / 0.6); if (inp.up || !inp.held) { h.st = 'takeoff'; h.f = Math.max(h.f, J.hold); } }
      else if (h.st === 'takeoff') { h.f = Math.min(J.tk, h.f + dt * FR); if (h.f >= J.tk) lift(1, h.c); } }
    if (h.st === 'jair') { h.airT += dt; h.f = J.tk + Math.min(1, h.airT / Math.max(0.05, h.tair)) * (M.jump.len - J.tk); if (inp.press && Fl) startFlap(); else if (h.airT >= h.tair) h.st = 'air'; }
    else if (h.st === 'air') { if (inp.press && Fl) startFlap(); }
    else if (h.st === 'flap') { const prev = h.f; h.f = Math.min(Fl.len, h.f + dt * FR); if (!h.flapped && prev < Fl.down && h.f >= Fl.down) { h.vy = Math.max(h.vy, 0) * 0.35 + (P.flapV || 4.6) * Fl.Fx.r; h.flapped = true; B.events.push('flap'); }
      if (inp.press && h.flapped) { h.f = 0; h.flapped = false; } else if (h.f >= Fl.len) { h.st = 'air'; h.from = 'flap'; } }
    // 動く：段にはぶつかる、上に乗れる
    const nx = h.x + Math.sin(h.yaw) * h.v * dt, nz = h.z + Math.cos(h.yaw) * h.v * dt, r = B.radius;
    const wall = (x, z) => world.boxes.some(b => h.y < b.top - 0.05 && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && !(h.x > b.x0 - r && h.x < b.x1 + r && h.z > b.z0 - r && h.z < b.z1 + r));
    if (!wall(nx, nz)) { h.x = nx; h.z = nz; } else if (!wall(nx, h.z)) h.x = nx; else if (!wall(h.x, nz)) h.z = nz; else h.v *= 0.5;
    const gy = world.groundAt(h.x, h.z, h.y + 0.06);
    if (air(h.st)) { h.vy -= g * dt; h.y += h.vy * dt; h.peak = Math.max(h.peak, h.y); if (h.vy <= 0 && h.y <= gy) { const fall = h.peak - gy; h.y = gy; h.vy = 0; h.st = 'ground'; h.f = 0; B.events.push({ land: fall, rise: h.peak - (h.y0 || 0) }); } }
    else if (h.st === 'ground' && h.y > gy + 0.03) { h.st = 'air'; h.vy = 0; h.from = 'fall'; h.peak = h.y; h.y0 = h.y; }
    else if (h.st === 'ground') h.y = gy;
    if (h.st === 'ground') { const m = (h.v > pw.top * 1.15 && M.run) ? M.run : (h.v > 0.08 ? (M.walk || M.run) : M.idle), ref = m === M.run ? pr.top : pw.top; if (m) h.ph = (h.ph + dt * FR * (m === M.idle ? 1 : Math.max(0.5, Math.min(1.6, h.v / Math.max(0.1, ref))))) % m.len; h.gm = m; } }
  // 今の形と置き方：slot・コマ・pose（作品の中の座標）・ref（pose のどこを置き場所に合わせるか）・置き場所（m）・向き
  function view(B) { const h = B.h, M = B.M, s = B.size; let m = null, f = 0, ref = [B.cR[0], 0, B.cR[2]], y = h.y;
    if (h.st === 'charge' || h.st === 'takeoff') { m = M.jump; f = h.f; const c = m.c[0]; ref = [c[0], 0, c[2]]; }
    else if (h.st === 'jair' || (h.st === 'air' && h.from === 'jump')) { m = M.jump; f = h.st === 'jair' ? h.f : m.len; ref = m.c[Math.round(f)]; y = h.y + m.J.comTk[1] * s; }
    else if (h.st === 'flap' || (h.st === 'air' && h.from === 'flap')) { m = M.flap; f = h.st === 'flap' ? h.f : 0; ref = m.c[0]; y = h.y + B.cR[1] * s; }
    else if (h.st === 'air') { ref = B.cR; y = h.y + B.cR[1] * s; }
    else if (h.gm) { m = h.gm; f = Math.floor(h.ph) % m.len; const c = m.c[f]; ref = [c[0], 0, c[2]]; }
    const fi = m ? Math.max(0, Math.min(m.len, Math.round(f))) : 0;
    return { P: m ? m.P[fi] : B.rest, key: (m ? Object.keys(M).find(k => M[k] === m) : 'rest') + ':' + fi, ref, x: h.x, y, z: h.z, yaw: h.yaw, size: s, st: h.st, vy: h.vy }; }
  return { make, boneGeom: b => { return boneGeom(b); }, withState: (D, fn) => { const k = S; S = D; try { return fn(core); } finally { S = k; } } };
})();
