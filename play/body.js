// ---- 骨の体を動かす：工房の作品（骨＋動き）を読み、コマを進め、重心と接地で跳ぶ・歩く ----
// 見た目は持たない（skin.js が pose を受け取って描く）。長さの単位：作品の中＝工房の単位、外（世界）＝m（工房×大きさ）
window.PlayBody = (() => {
  let S = null; const core = window.BoneCore.create(THREE, () => S, v => { S = v; }), { poseAt, boneGeom } = core;
  const clone = o => JSON.parse(JSON.stringify(o)), TPL = window.BoneTemplates, FR = 24;
  const SLOTS = ['idle', 'walk', 'run', 'jump', 'flap', 'attack'], TAP_MAX = 1.9; /* 普段のジャンプの高さの上限（m）。これより上は腕（勝負ジャンプ）が要る */
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
    const size = work.__size > 0 ? work.__size : window.BodyMotion.sizeOf(d), /* __size：草原の序盤みたいに、大きさを外から決める時（m に合わせる） */ root = (D.bones.find(b => b.parent == null) || D.bones[0]).id, ids = [root], rest = Object.fromEntries(D.bones.map(b => [b.id, b.pts])), cR = com(rest, ids);
    const M = {}; for (const s of SLOTS) { let A = animOf(d, s); if (!A && kind) { try { A = TPL.animFor(kind, s, rest0, d.bones); } catch (_) { A = null; } } if (!A || !A.keys || !A.keys.length) continue;
      const m = { A, len: A.len, P: [], c: [] }; for (let f = 0; f <= A.len; f++) { S = D; S.anim = A; const P = shift(poseAt(f), D.__o); m.P.push(P); m.c.push(com(P, ids)); }
      const pose = f => m.P[Math.max(0, Math.min(A.len, Math.round(f)))];
      if (s === 'jump') { m.J = window.JumpPhys.analyze(A, pose, ids, cR[1], T); if (!m.J) continue; }
      if (s === 'flap') { m.Fx = window.JumpPhys.flapAnalyze(A, pose, D.bones.map(b => b.id), cR[1], ids); if (!m.Fx) continue;
        const th = m.P.map((P, f) => m.Fx.tips.reduce((a, id) => { const p = P[id]; return a + (p ? p[p.length - 1][1] - m.c[f][1] : 0); }, 0)); let best = -1e9; m.down = 1; for (let f = 0; f < A.len; f++) { const v = th[f] - th[f + 1]; if (v > best) { best = v; m.down = f + 1; } } }
      if (s === 'attack') { const gd = A.guides || [], fi = re => { const x = gd.find(q => re.test(q.label || '')); return x ? x.f : null; }; m.open = fi(/溜め|かまえ|構え/) || Math.round(A.len * 0.3); m.hit = fi(/打つ|突き|当て|斬/) || Math.round(A.len * 0.5); if (m.hit <= m.open) m.hit = Math.min(A.len, m.open + 2); }
      M[s] = m; }
    let headId = null, hz = -1e9; for (const b of D.bones) { const q = b.pts[b.pts.length - 1]; if (q[2] > hz) { hz = q[2]; headId = b.id; } }
    let x0 = 1e9, x1 = -1e9; for (const id in rest) for (const q of rest[id]) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
    const B = { work, D, size, T, M, rest, cR, ids, radius: Math.max(0.12, (x1 - x0) * size * 0.5),
      h: { x: 0, z: 0, y: 0, v: 0, vy: 0, yaw: 0, st: 'ground', f: 0, ph: 0, airT: 0, tair: 0, rail: false, c: 0, vmax: 0, flapped: false, from: null, peak: 0, gm: null },
      last: null, events: [] };
    B.step = (dt, inp, world) => step(B, dt, inp, world); B.view = () => view(B);
    B.headAt = v => { const pts = v.P[headId] || rest[headId], q = pts[pts.length - 1], dx = (q[0] - v.ref[0]) * s0, dy = (q[1] - v.ref[1]) * s0, dz = (q[2] - v.ref[2]) * s0, sy = Math.sin(v.yaw), cy = Math.cos(v.yaw); return [v.x + dx * cy + dz * sy, v.y + dy, v.z - dx * sy + dz * cy]; };
    const s0 = size; return B; }
  const turnTo = (a, b, s) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-s, Math.min(s, d)); };
  const air = st => st === 'jair' || st === 'air' || st === 'flap';
  // inp：mx, mz（世界の向き、長さ≤1）、walk、press/up/held（Space・レールのタップ）、rail{active,v}
  function step(B, dt, inp, world) { const h = B.h, P = B.T, M = B.M, J = M.jump && M.jump.J, Fl = M.flap, g = P.gravity || 16;
    const pw = window.BodyMotion.perf(B.size, 1, 'walk'), pr = window.BodyMotion.perf(B.size, 1, 'run'), p = inp.walk ? pw : pr, mag = Math.min(1, Math.hypot(inp.mx, inp.mz)), ty = Math.atan2(inp.mx, inp.mz);
    const busy = h.st === 'swing' || h.st === 'grab';
    if (busy) { if (mag > 0.05) h.yaw = turnTo(h.yaw, ty, p.turn * 0.5 * dt); h.v += Math.max(-p.brake * dt, Math.min(p.accel * dt, mag * p.top * 0.4 - h.v)); }
    else if (h.st === 'ground') { if (mag > 0.05) h.yaw = turnTo(h.yaw, ty, p.turn * dt); h.v += Math.max(-p.brake * dt, Math.min(p.accel * dt, mag * p.top - h.v)); }
    else if (h.st === 'charge' || h.st === 'takeoff') { if (mag > 0.05) h.yaw = turnTo(h.yaw, ty, p.turn * 0.5 * dt); h.v *= Math.max(0, 1 - dt * 1.2); }
    else if (mag > 0.05) { h.yaw = turnTo(h.yaw, ty, (P.airTurn || 1.3) * dt); h.v += (mag * pr.top * 0.7 - h.v) * Math.min(1, dt * 1.2); }
    // 踏み切り：2段階。普段＝作った動きの素の高さ（上限 TAP_MAX）。勝負＝その素の高さに、弾く速さと溜めを掛ける（最大で高さ約1.7倍）
    const kcap = Math.min(1, Math.sqrt(TAP_MAX / Math.max(0.01, J ? J.h : 1)));
    const lift = (mode, sp, c) => { const m = M.jump, a = m.c[0], b = J.comTk, dx = (b[0] - a[0]) * B.size, dz = (b[2] - a[2]) * B.size, sy = Math.sin(h.yaw), cy = Math.cos(h.yaw);
      const f = mode === 'tap' ? 1 : Math.min(1.3, 0.75 + 0.45 * sp) * (0.92 + 0.08 * c), k = kcap * f;
      h.x += dx * cy + dz * sy; h.z += -dx * sy + dz * cy; h.vy = J.vy * k; h.v = Math.max(h.v, (J.vh[1] || 0) * k); h.y += 0.001; h.st = 'jair'; h.airT = 0; h.from = 'jump'; h.rail = false; h.auto = null; h.tair = 2 * h.vy / g; h.peak = h.y; h.y0 = h.y;
      B.last = { mode, c, sp, f, h: h.vy * h.vy / (2 * g), base: J.h * kcap * kcap, capped: kcap < 1 }; B.events.push('lift'); };
    // 普段：作ったコマをそのまま再生して跳ぶ（しゃがみ→踏み切り）
    const autoJump = () => { h.st = 'charge'; h.auto = 'tap'; h.f = 0; h.c = 0; h.rail = false; };
    // レール：触った所から下へ0.25以上（か一番下近く）までなぞったら勝負。そうならずに離したら普段のジャンプ
    const A2 = inp.act || {}, R = A2.move === 'jump' ? { active: A2.active, v: A2.p } : (inp.rail || null); if (A2.move === 'jump' && A2.tap) inp.railTap = true;
    if (R && J && h.st === 'ground' && R.active && !h.pend) h.pend = { v0: R.v };
    if (R && J && h.st === 'ground' && inp.railTap && !R.active && !h.pend) autoJump(); /* 一瞬で離した時も跳ぶ */
    if (h.pend) { if (!R.active) { h.pend = null; if (h.st === 'ground') autoJump(); } else if (R.v - h.pend.v0 > 0.25 || R.v > 0.8) { h.pend = null; if (h.st === 'ground') { h.st = 'charge'; h.rail = true; h.vmax = 0; h.c = 0; h.auto = null; } } }
    if (R && J && h.rail) { const v = R.v;
      if (h.st === 'charge') { h.vmax = Math.max(h.vmax, v); h.f = Math.min(1, v / 0.9) * J.hold; if (v >= 0.86) h.c = Math.min(1, h.c + dt / 0.6);
        if (h.vmax >= 0.82 && v < h.vmax - 0.05) { h.st = 'takeoff'; h.t0 = 0; h.v0 = h.vmax; } else if (!R.active) { h.st = 'ground'; h.rail = false; h.c = 0; } }
      else if (h.st === 'takeoff') { h.t0 += dt; const u = Math.max(0, Math.min(1, (h.v0 - v) / Math.max(0.3, h.v0 - 0.1))); h.f = J.hold + u * (J.tk - J.hold);
        if (u >= 1 || (!R.active && u > 0.5)) lift('ps', Math.max(0.3, Math.min(1.7, ((J.tk - J.hold) * u / FR) / Math.max(0.03, h.t0))), h.c); else if (!R.active) { h.st = 'ground'; h.rail = false; h.c = 0; } } }
    const keyPress = inp.press && !inp.railTap, startFlap = () => { h.st = 'flap'; h.f = 0; h.flapped = false; };
    if (!h.rail) {
      // キー：短く押す＝普段のジャンプ。しゃがみ切っても押し続けた（0.12秒）＝勝負（弾きは並の速さ）
      if (h.st === 'ground' && keyPress && !h.pend) { if (J) { h.st = 'charge'; h.f = 0; h.c = 0; h.auto = 'key'; h.hold = 0; } else { h.vy = P.jumpV || 6.4; h.y += 0.001; h.st = 'air'; h.from = 'hop'; h.peak = h.y; h.y0 = h.y; } }
      if (h.st === 'charge' && h.auto) { h.f = Math.min(J.hold, h.f + dt * FR); if (h.auto === 'key') { if (h.f >= J.hold && inp.held) { h.hold += dt; if (h.hold > 0.12) h.c = Math.min(1, h.c + dt / 0.6); } if (!inp.held || inp.up) h.rel = true; }
        if (h.f >= J.hold && (h.auto === 'tap' || h.rel)) { h.st = 'takeoff'; h.ps = h.auto === 'key' && h.hold > 0.12; h.rel = false; } }
      else if (h.st === 'takeoff') { h.f = Math.min(J.tk, h.f + dt * FR); if (h.f >= J.tk) lift(h.ps ? 'ps' : 'tap', 1, h.c); } }
    // ---- 振る・掴む：パッドの線をなぞった分だけ、攻撃の動きのコマが進む（キーは J＝振る、K 長押し＝掴む）----
    const AT = M.attack;
    if (AT && h.st === 'ground') { if (A2.down && (A2.move === 'swing' || A2.move === 'grab')) { h.st = A2.move; h.akey = false; h.ap = 0; h.apv = 0; h.af = 0; h.hitDone = false; h.grip = 0; h.hist = []; h.at = 0; }
      else if (inp.keySwing) { h.st = 'swing'; h.akey = true; h.ap = 0; h.apv = 0; h.af = 0; h.hitDone = false; h.hist = []; h.at = 0; } else if (inp.keyGrab) { h.st = 'grab'; h.akey = true; h.ap = 0; h.kp = 0; h.af = 0; h.grip = 0; } }
    if (h.st === 'swing') { const p = h.akey ? Math.min(1, h.ap + dt * 1.6 * FR / AT.len) : A2.p, fp = h.af; h.at = (h.at || 0) + dt; (h.hist = h.hist || []).push([h.at, p]); while (h.hist.length > 2 && h.at - h.hist[1][0] > 0.12) h.hist.shift(); const o = h.hist[0]; h.apv = h.at - o[0] > 1e-3 ? (p - o[1]) / (h.at - o[0]) : 0; h.ap = p; h.af = p * AT.len; /* 速さ＝直近0.12秒の進み */
      if (!h.hitDone && fp < AT.hit && h.af >= AT.hit) { h.hitDone = true; const sp = Math.max(0, h.apv * AT.len / FR); B.events.push({ strike: sp }); B.last = { mode: 'swing', sp }; }
      if (h.akey ? p >= 1 : !A2.active) { h.st = 'ground'; h.f = 0; } }
    else if (h.st === 'grab') { let p, pm; if (h.akey) { h.kp = inp.keyGrab ? Math.min(1, h.kp + dt * 2.2) : -1; p = h.kp < 0.5 ? h.kp * 2 : Math.max(0, 1 - (h.kp - 0.5) * 2 * 0.62); pm = Math.min(1, Math.max(h.kp * 2, 0.0001)); } else { p = A2.p; pm = A2.pmax; }
      const q = pm > 0.15 ? Math.max(0, Math.min(1, (pm - p) / pm)) : 0; h.grip = q; h.af = q > 0.02 ? AT.open + q * (AT.hit - AT.open) : Math.min(1, p) * AT.open; /* 行き＝開く、戻り＝閉じる。戻した深さ＝力 */
      if (h.akey ? h.kp < 0 : !A2.active) { h.st = 'ground'; h.f = 0; h.grip = 0; } }
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
    else if ((h.st === 'ground' || busy) && h.y > gy + 0.03) { h.st = 'air'; h.vy = 0; h.from = 'fall'; h.peak = h.y; h.y0 = h.y; }
    else if (h.st === 'ground' || busy) h.y = gy;
    if (h.st === 'ground') { const m = (h.v > pw.top * 1.15 && M.run) ? M.run : (h.v > 0.08 ? (M.walk || M.run) : M.idle), ref = m === M.run ? pr.top : pw.top; if (m) h.ph = (h.ph + dt * FR * (m === M.idle ? 1 : Math.max(0.5, Math.min(1.6, h.v / Math.max(0.1, ref))))) % m.len; h.gm = m; } }
  // 今の形と置き方：slot・コマ・pose（作品の中の座標）・ref（pose のどこを置き場所に合わせるか）・置き場所（m）・向き
  function view(B) { const h = B.h, M = B.M, s = B.size; let m = null, f = 0, ref = [B.cR[0], 0, B.cR[2]], y = h.y;
    if (h.st === 'charge' || h.st === 'takeoff') { m = M.jump; f = h.f; const c = m.c[0]; ref = [c[0], 0, c[2]]; }
    else if (h.st === 'jair' || (h.st === 'air' && h.from === 'jump')) { m = M.jump; f = h.st === 'jair' ? h.f : m.len; ref = m.c[Math.round(f)]; y = h.y + m.J.comTk[1] * s; }
    else if (h.st === 'flap' || (h.st === 'air' && h.from === 'flap')) { m = M.flap; f = h.st === 'flap' ? h.f : 0; ref = m.c[0]; y = h.y + B.cR[1] * s; }
    else if (h.st === 'air') { ref = B.cR; y = h.y + B.cR[1] * s; }
    else if (h.st === 'swing' || h.st === 'grab') { m = M.attack; f = h.af; const c = m.c[0]; ref = [c[0], 0, c[2]]; }
    else if (h.gm) { m = h.gm; f = Math.floor(h.ph) % m.len; const c = m.c[f]; ref = [c[0], 0, c[2]]; }
    const fi = m ? Math.max(0, Math.min(m.len, Math.round(f))) : 0;
    return { P: m ? m.P[fi] : B.rest, key: (m ? Object.keys(M).find(k => M[k] === m) : 'rest') + ':' + fi, ref, x: h.x, y, z: h.z, yaw: h.yaw, size: s, st: h.st, vy: h.vy }; }
  return { make, boneGeom: b => { return boneGeom(b); }, withState: (D, fn) => { const k = S; S = D; try { return fn(core); } finally { S = k; } } };
})();
