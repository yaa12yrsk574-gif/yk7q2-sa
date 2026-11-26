// ---- 判定：体の形から「何ができる体か」を決める。工房（いじってる最中にパッと点く）と草原（登れるか・乗せられるか）で同じ計算 ----
// 爪     ＝ 先が細くて、前後どっちかに反ってる（脚＝先が地面の近くにある骨。全部の脚がそうなってたら）
// 支える脚 ＝ 脚の太さ（背の高さに対して）²の合計が、お手本のツノトカゲの脚の 1.45 倍（≒太さ1.2倍）
window.BoneJudge = (() => {
  const CLAW_NEED = 0.36, CARRY_X = 1.45;
  const rAt = (prof, t, d) => { if (!prof || !prof.length) return d; const a = prof.slice().sort((x, y) => x.t - y.t); if (t <= a[0].t) return a[0].r; for (let i = 1; i < a.length; i++) if (t <= a[i].t) { const u = (t - a[i - 1].t) / ((a[i].t - a[i - 1].t) || 1); return a[i - 1].r + (a[i].r - a[i - 1].r) * u; } return a[a.length - 1].r; };
  const rr = (b, t) => (rAt(b.wp, t, 0.04) + rAt(b.wn, t, 0.04) + rAt(b.dp, t, 0.04) + rAt(b.dn, t, 0.04)) / 4;
  function frame(bones, rest) { let lo = 1e9, hi = -1e9; for (const b of bones) { const P = (rest && rest[b.id]) || b.pts || [], n = Math.max(1, P.length - 1); P.forEach((p, i) => { const r = rr(b, i / n); lo = Math.min(lo, p[1] - r); hi = Math.max(hi, p[1] + r); }); } return { lo, top: Math.max(0.05, hi - lo) }; } /* 肉付け込みの上下 */
  function legsOf(bones, rest) { const F = frame(bones, rest); return bones.filter(b => { const p = (rest && rest[b.id]) || b.pts; return b.parent != null && p && p.length >= 2 && p[p.length - 1][1] - F.lo <= F.top * 0.2; }); }
  function claw(b) { const rMid = Math.max(1e-3, (rr(b, 0.4) + rr(b, 0.55) + rr(b, 0.7)) / 3), rTip = (rr(b, 0.93) + rr(b, 0.98)) / 2, sharp = Math.max(0, Math.min(1, (1 - rTip / rMid - 0.35) / 0.55));
    let hk = 0; for (const t of [0.8, 0.88, 0.95]) { const a = rAt(b.dp, t, 0.04), c = rAt(b.dn, t, 0.04); hk += Math.abs(a - c) / Math.max(1e-3, a + c); } const hook = Math.max(0, Math.min(1, hk / 3 * 3));
    return { sharp, hook, grip: sharp * (0.6 + 0.4 * hook) }; }
  function clawJudge(bones, rest) { const L = legsOf(bones, rest); if (!L.length) return { ok: false, p: 0, legs: 0 }; const cs = L.map(claw), g = Math.min(...cs.map(c => c.grip)); return { ok: g >= CLAW_NEED, p: Math.min(1, g / CLAW_NEED), legs: L.length, sharp: Math.min(...cs.map(c => c.sharp)), hook: Math.min(...cs.map(c => c.hook)) }; }
  function carryRaw(bones, rest) { const F = frame(bones, rest), L = legsOf(bones, rest); let sum = 0; for (const b of L) { const rel = (rr(b, 0.2) + rr(b, 0.4) + rr(b, 0.6)) / 3 / F.top; sum += rel * rel; } return { sum, n: L.length }; }
  let base = null; const baseline = () => base || (base = (() => { try { return carryRaw(window.BoneTemplates.data('tokage').bones).sum || 0.01; } catch (_) { return 0.01; } })());
  // sizeM：背の高さ（m）。0.7m を基準に、大きいほど強い
  function carryJudge(bones, rest, sizeM) { const r = carryRaw(bones, rest), ratio = r.sum / (baseline() * CARRY_X) * Math.pow((sizeM || 0.7) / 0.7, 1.5); return { ok: ratio >= 1, p: Math.min(1, ratio), ratio, legs: r.n }; }
  return { legsOf, claw, clawJudge, carryJudge, CLAW_NEED };
})();
