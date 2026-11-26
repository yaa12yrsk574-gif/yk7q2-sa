// ---- 乗せられるか：ペンギンを乗せて、潰れずに立てるか（11/26 の決めごと）----
// 背中の形は関係なし（どんな形でも、乗った所がむにっと凹んで座れる）。効くのは脚と大きさ
// 脚1本の支える力 ＝ 脚の太さ（背の高さに対して）²。全部の脚を足す。体が大きいほど強い
// 基準：ツノトカゲのお手本の脚のままだと足りない（工房で脚を太くすると立てる）
window.PlayCarry = (() => {
  const NEED_X = 1.45; /* お手本の脚の何倍の力が要るか（≒ 脚の太さ 1.2 倍） */
  const rAt = (prof, t, d) => { if (!prof || !prof.length) return d; const a = prof.slice().sort((x, y) => x.t - y.t); if (t <= a[0].t) return a[0].r; for (let i = 1; i < a.length; i++) if (t <= a[i].t) { const u = (t - a[i - 1].t) / ((a[i].t - a[i - 1].t) || 1); return a[i - 1].r + (a[i].r - a[i - 1].r) * u; } return a[a.length - 1].r; };
  function raw(D, rest) { let top = 0.05; for (const b of D.bones) for (const p of (rest[b.id] || b.pts)) top = Math.max(top, p[1]);
    let sum = 0, n = 0; for (const b of D.bones) { const p = rest[b.id] || b.pts; if (!p || p.length < 2 || p[p.length - 1][1] > top * 0.2 || b.parent == null) continue; /* 脚＝先が地面の近くにある骨 */
      const r = t => (rAt(b.wp, t, 0.04) + rAt(b.wn, t, 0.04) + rAt(b.dp, t, 0.04) + rAt(b.dn, t, 0.04)) / 4, rel = (r(0.2) + r(0.4) + r(0.6)) / 3 / top; sum += rel * rel; n++; }
    return { sum, n }; }
  let base = null;
  function baseline() { if (base) return base; try { const d = window.BoneTemplates.data('tokage'), B = window.PlayBody.make({ id: 'tpl', data: d, __size: 1 }); base = raw(B.D, B.rest).sum || 0.01; } catch (e) { base = 0.01; } return base; }
  // ratio ≥ 1 なら立てる。大きさ（m）は 0.7m を基準に効く
  function measure(B) { const r = raw(B.D, B.rest), need = baseline() * NEED_X; return { legs: r.n, ratio: r.sum / need * Math.pow((B.Hm || 0.7) / 0.7, 1.5) }; }
  return { measure, NEED_X };
})();
