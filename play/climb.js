// ---- 壁を登る：爪（形）×掻く動き（アニメ）。11/21 の決めごと ----
// 爪1本の掴む力 ＝ 先の細さ × 曲がり（形：シルエットの脚先）
// 上がる量    ＝ その力で下へ掻けた分（動き：今は「歩き」のアニメ。壁に張り付いて歩くと、足が下へ掻く）
// 触れてる爪の力が足りへんと、ずり落ちる。0本になったら落ちる
window.PlayClimb = (() => {
  const FR = 24, NEED = 0.7; /* 0.4m の体を支えるのに要る力（触れてる爪の合計） */
  const rAt = (prof, t, d) => { if (!prof || !prof.length) return d; const a = prof.slice().sort((x, y) => x.t - y.t); if (t <= a[0].t) return a[0].r; for (let i = 1; i < a.length; i++) if (t <= a[i].t) { const u = (t - a[i - 1].t) / ((a[i].t - a[i - 1].t) || 1); return a[i - 1].r + (a[i].r - a[i - 1].r) * u; } return a[a.length - 1].r; };
  // 脚＝先っぽが地面の近くにある骨。それぞれの爪の力と、歩きで下へ掻ける量
  function measure(B) { const D = B.D, rest = B.rest, legs = [];
    for (const b of D.bones) { const p = rest[b.id]; if (!p || p.length < 2 || p[p.length - 1][1] > 0.08 || b.parent == null) continue;
      const r = (t) => (rAt(b.wp, t, 0.04) + rAt(b.wn, t, 0.04) + rAt(b.dp, t, 0.04) + rAt(b.dn, t, 0.04)) / 4;
      const rMid = Math.max(1e-3, (r(0.4) + r(0.55) + r(0.7)) / 3), rTip = (r(0.93) + r(0.98)) / 2;
      const sharp = Math.max(0, Math.min(1, (1 - rTip / rMid - 0.35) / 0.55)); /* 先が細いほど刺さる */
      let hk = 0; for (const t of [0.8, 0.88, 0.95]) { const a = rAt(b.dp, t, 0.04), c = rAt(b.dn, t, 0.04); hk += Math.abs(a - c) / Math.max(1e-3, a + c); } const hook = Math.max(0, Math.min(1, hk / 3 * 3)); /* 前後どっちかに反ってる＝鉤 */
      legs.push({ id: b.id, sharp, hook, grip: sharp * (0.6 + 0.4 * hook) }); }
    const m = B.M.walk; let rise = 0;
    if (m && legs.length) { for (const L of legs) { const tips = m.P.map(P => P[L.id] && P[L.id][P[L.id].length - 1]).filter(Boolean); if (!tips.length) continue; const lo = Math.min(...tips.map(q => q[1]));
        L.contact = tips.map(q => q[1] < lo + 0.02); const zs = tips.filter((q, i) => L.contact[i]).map(q => q[2]); L.stroke = zs.length ? Math.max(...zs) - Math.min(...zs) : 0; }
      rise = legs.reduce((a, L) => a + (L.stroke || 0), 0) / legs.length * (FR / m.len) * B.size; } /* 1秒に下へ掻ける長さ（m） */
    return { legs, rise, len: m ? m.len : 16 }; }
  function start(B, top) { const c = measure(B); return Object.assign(c, { y: 0.22, t: 0, top, st: 'climb', low: 0, maxY: 0.22 } /* ぴょんと壁に飛びついてから */); }
  // 1コマ進める：触れてる爪の力の合計で、上がるかずり落ちるかが決まる
  function step(c, dt) { if (c.st !== 'climb') return c; c.t += dt; const f = Math.floor(c.t * FR) % c.len;
    let G = 0, n = 0; for (const L of c.legs) if (L.contact && L.contact[f]) { G += L.grip; n++; }
    const ratio = n ? G / NEED : 0; c.ratio = ratio; c.n = n;
    const vy = ratio >= 1 ? c.rise * Math.min(1.3, ratio) : c.rise * ratio - (1 - ratio) * 0.9;
    c.y = Math.max(0, c.y + vy * dt); c.maxY = Math.max(c.maxY, c.y);
    c.low = ratio < 0.35 ? c.low + dt : Math.max(0, c.low - dt * 2);
    if (c.y >= c.top) { c.y = c.top; c.st = 'top'; }
    else if (c.t > 1.2 && (c.y <= 0 || c.low > 0.6)) c.st = 'fail'; /* 下まで戻った、か、ずっと掴めてへん */
    return c; }
  return { measure, start, step, NEED };
})();
