// ---- 判定：体の形から「何ができる体か」を決める。工房（いじってる最中にパッと点く）と草原（登れるか・乗せられるか）で同じ計算 ----
// 爪     ＝ 先が細くて、前後どっちかに反ってる（脚＝先が地面の近くにある骨。全部の脚がそうなってたら）
// 支える脚 ＝ 脚の太さ（背の高さに対して）²の合計が、基準（ツノトカゲのお手本の脚）の 0.98 倍。プルプルの生えたての突起は 1.3 倍くらい太くすると点く
window.BoneJudge = (() => {
  const CLAW_NEED = 0.36, CARRY_X = 0.98;
  const rAt = (prof, t, d) => { if (!prof || !prof.length) return d; const a = prof.slice().sort((x, y) => x.t - y.t); if (t <= a[0].t) return a[0].r; for (let i = 1; i < a.length; i++) if (t <= a[i].t) { const u = (t - a[i - 1].t) / ((a[i].t - a[i - 1].t) || 1); return a[i - 1].r + (a[i].r - a[i - 1].r) * u; } return a[a.length - 1].r; };
  const rr = (b, t) => (rAt(b.wp, t, 0.04) + rAt(b.wn, t, 0.04) + rAt(b.dp, t, 0.04) + rAt(b.dn, t, 0.04)) / 4;
  function frame(bones, rest) { let lo = 1e9, hi = -1e9; const root = bones.find(b => b.parent == null), RP = root && ((rest && rest[root.id]) || root.pts), cy = RP ? RP.reduce((a, p) => a + p[1], 0) / RP.length : 0;
    for (const b of bones) { const Q = (rest && rest[b.id]) || b.pts || []; if (b.parent != null && Q.length && Q.every(p => p[1] > cy)) continue; /* 上に生えた突起（羽・角）は背の高さに入れへん */ const P = (rest && rest[b.id]) || b.pts || [], n = Math.max(1, P.length - 1); P.forEach((p, i) => { const r = rr(b, i / n); lo = Math.min(lo, p[1] - r); hi = Math.max(hi, p[1] + r); }); } return { lo, top: Math.max(0.05, hi - lo) }; } /* 肉付け込みの上下 */
  function legsOf(bones, rest) { const F = frame(bones, rest); return bones.filter(b => { const p = (rest && rest[b.id]) || b.pts; return b.parent != null && p && p.length >= 2 && p[p.length - 1][1] - F.lo <= F.top * 0.2; }); }
  function claw(b) { const rMid = Math.max(1e-3, (rr(b, 0.4) + rr(b, 0.55) + rr(b, 0.7)) / 3), rTip = (rr(b, 0.93) + rr(b, 0.98)) / 2, sharp = Math.max(0, Math.min(1, (1 - rTip / rMid - 0.35) / 0.55));
    let hk = 0; for (const t of [0.8, 0.88, 0.95]) { const a = rAt(b.dp, t, 0.04), c = rAt(b.dn, t, 0.04); hk += Math.abs(a - c) / Math.max(1e-3, a + c); } const hook = Math.max(0, Math.min(1, hk / 3 * 3));
    return { sharp, hook, grip: sharp * (0.6 + 0.4 * hook) }; }
  function clawJudge(bones, rest) { const L = legsOf(bones, rest); if (!L.length) return { ok: false, p: 0, legs: 0 }; const cs = L.map(claw), g = Math.min(...cs.map(c => c.grip)); return { ok: g >= CLAW_NEED, p: Math.min(1, g / CLAW_NEED), legs: L.length, sharp: Math.min(...cs.map(c => c.sharp)), hook: Math.min(...cs.map(c => c.hook)) }; }
  function carryRaw(bones, rest) { const F = frame(bones, rest), L = legsOf(bones, rest); let sum = 0; for (const b of L) { const rel = (rr(b, 0.2) + rr(b, 0.4) + rr(b, 0.6)) / 3 / F.top; sum += rel * rel; } return { sum, n: L.length }; }
  let base = null; const baseline = () => base || (base = (() => { try { return carryRaw(window.BoneTemplates.data('tokage').bones).sum || 0.01; } catch (_) { return 0.01; } })());
  // sizeM：背の高さ（m）。0.7m を基準に、大きいほど強い
  function carryJudge(bones, rest, sizeM) { const r = carryRaw(bones, rest), ratio = r.sum / (baseline() * CARRY_X) * Math.pow((sizeM || 0.7) / 0.7, 1.5); return { ok: ratio >= 1, p: Math.min(1, ratio), ratio, legs: r.n }; }
  // ---- 固いもの：中の「関節の元」が、判定を満たした所だけ表に出てくる ----
  //   爪     ＝ 突起の先だけ、白っぽい不透明な固い爪になる（透明な体の先に、固い爪がちょこんと付く）
  //   支える脚 ＝ 脚の中に太い芯が通って、透けて見える（外は柔らかいまま）
  function hardParts(B, inner, M) { const J = { legsOf, claw, carryJudge, CLAW_NEED, rr };
    const legs = J.legsOf(B.D.bones, B.rest), carry = J.carryJudge(B.D.bones, B.rest, 0.7).ok, items = [], up = new THREE.Vector3(0, 1, 0);
    const clawM = (M && M.claw) || new THREE.MeshStandardMaterial({ color: 0xd9dee6, roughness: 0.22, metalness: 0.85 }), boneM = (M && M.bone) || new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 0.8 }); /* 関節の元＝金属 */
    const cone = new THREE.ConeGeometry(1, 1, 8, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
    for (const b of legs) { const n = b.pts.length; if (J.claw(b).grip >= J.CLAW_NEED) { const m = new THREE.Mesh(cone, clawM); m.renderOrder = 3; inner.add(m); items.push({ b, kind: 'claw', m, r: J.rr(b, 0.6) * 1.08 }); /* 表面から少しだけ出る */ }
      if (carry) for (let i = 0; i < n - 1; i++) { const m = new THREE.Mesh(cyl, boneM); m.renderOrder = 1; inner.add(m); items.push({ b, kind: 'bone', i, m, r: J.rr(b, (i + 0.5) / (n - 1)) * 0.42 }); } }
    const at = (P, u) => { let L = 0; const seg = []; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); seg.push(d); L += d; } let want = u * L; for (let i = 1; i < P.length; i++) { if (want <= seg[i - 1] || i === P.length - 1) { const k = Math.min(1, want / (seg[i - 1] || 1)); return P[i - 1].map((v, j) => v + (P[i][j] - v) * k); } want -= seg[i - 1]; } return P[P.length - 1]; };
    const place = (m, a, b2, r) => { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b2), d = Bv.clone().sub(A), L = d.length() || 1e-4; m.position.copy(A).add(Bv).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(up, d.normalize()); m.scale.set(r, L, r); };
    function update(P) { for (const it of items) { const pts = P[it.b.id] || it.b.pts; if (!pts || pts.length < 2) continue; if (it.kind === 'claw') place(it.m, at(pts, 0.58), pts[pts.length - 1], it.r); else place(it.m, pts[it.i], pts[it.i + 1], it.r); } }
    return { update, dispose() { cone.dispose(); cyl.dispose(); clawM.dispose(); boneM.dispose(); } }; }
  // 羽 ＝ 脚じゃない突起が、平たくて（横幅が厚みの2.2倍以上）、大きい（面積の合計が背の高さ²の0.5倍以上）
  function wingJudge(bones, rest) { const F = frame(bones, rest), L = new Set(legsOf(bones, rest)); let area = 0, flat = 0, n = 0;
    for (const b of bones) { if (b.parent == null || L.has(b)) continue; const P = (rest && rest[b.id]) || b.pts; if (!P || P.length < 2) continue; let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); if (len < 0.05) continue;
      let w = 0, d = 0; for (const t of [0.2, 0.4, 0.6, 0.8]) { w += rAt(b.wp, t, 0.04) + rAt(b.wn, t, 0.04); d += rAt(b.dp, t, 0.04) + rAt(b.dn, t, 0.04); } w /= 4; d /= 4; area += w * len; flat += w / Math.max(1e-3, d); n++; }
    if (!n) return { ok: false, p: 0 }; const a = area / (F.top * F.top) / 0.5, f = flat / n / 2.2; return { ok: a >= 1 && f >= 1, p: Math.min(1, Math.min(a, 1) * 0.5 + Math.min(f, 1) * 0.5), area: a, flat: f }; }
  return { legsOf, claw, clawJudge, carryJudge, wingJudge, CLAW_NEED, rr, hardParts };
})();
