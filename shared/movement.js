// 体の大きさ × アニメ → 移動性能（工房の10m試走と狩り場で同じ計算を使う）
// 体を s 倍にすると、体重は s^3、筋肉の力（断面）は s^2。
//  ・最高速：歩幅が伸びる（s^strideExp）。ただし大きい体ほど、それを運べるだけの「動き」が要る（max(1,s)^weightExp）。
//    → 大きくしただけ（お手本のまま）だと遅くなり、体に合わせてアニメを作り直すと化ける。
//  ・加速／小回り：力÷体重 ＝ 1/s。小さいほど一歩目が速く、急カーブが効く。
//  ・押す力：s^2。
window.BodyMotion = (() => {
  const KEY = 'yuya_body_motion_tune_v1';
  const DEF = Object.freeze({ strideExp: 0.5, weightExp: 0.7, accel: 9, turn: 7, agiExp: 1.0, camH: 1, camD: 1, jumpV: 6.4, gravity: 16, flapV: 4.6, glideSink: 1.1, glideSpeed: 5, swimSpeed: 2.2, padStroke: 150, airTurn: 1.3, airMax: 11, airAccel: 2.5, airCam: 1.2 }); // air*：飛行中（旋回の速さ・最高速・直線の加速・カメラが背中に追いつく速さ）
  const LIM = Object.freeze({ min: 0.5, max: 2 });
  let tune = null;
  function load() {
    if (tune) return tune;
    tune = Object.assign({}, DEF);
    try { const t = JSON.parse(localStorage.getItem(KEY) || 'null'); if (t && typeof t === 'object' && t.airTurn === 1.8) delete t.airTurn; /* 旧初期値（速すぎて酔う）は新しい初期値へ */ if (t && typeof t === 'object') for (const k in DEF) if (typeof t[k] === 'number' && isFinite(t[k])) tune[k] = t[k]; } catch (_) {}
    return tune;
  }
  function set(k, v) { load(); if (!(k in DEF) || !isFinite(v)) return; tune[k] = v; try { localStorage.setItem(KEY, JSON.stringify(tune)); } catch (_) {} }
  function reset() { tune = Object.assign({}, DEF); try { localStorage.removeItem(KEY); } catch (_) {} return tune; }
  const sizeOf = d => { const s = d && +d.size; return isFinite(s) && s > 0 ? Math.max(LIM.min, Math.min(LIM.max, s)) : 1; };
  // factor：測った足運び（お手本比、0.55〜1.5）。slot：'walk' | 'run'
  function perf(size, factor, slot, T) {
    const t = T || load(), s = Math.max(LIM.min, Math.min(LIM.max, +size || 1)), f = +factor || 1;
    const base = slot === 'walk' ? 1.45 : 3.4;
    const stride = Math.pow(s, t.strideExp), need = Math.pow(Math.max(1, s), t.weightExp);
    const agi = Math.pow(s, -t.agiExp);
    return { size: s, top: base * f * stride / need, need, accel: t.accel * agi, brake: t.accel * agi * 1.6, turn: t.turn * agi, agility: agi, power: s * s, mass: s * s * s };
  }
  // 止まった状態から dist m 走るのにかかる時間（加速込み）
  function runTime(p, dist) {
    const top = Math.max(0.05, p.top), a = Math.max(0.05, p.accel), dAcc = top * top / (2 * a);
    return dist <= dAcc ? Math.sqrt(2 * dist / a) : top / a + (dist - dAcc) / top;
  }
  return { KEY, DEF, LIM, load, set, reset, sizeOf, perf, runTime };
})();
