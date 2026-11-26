// ---- 見た目（皮）：体の形（pose）を受け取って描くだけ。ここを差し替えれば、動きはそのままで見た目だけ変わる ----
// 皮の約束：make(B) → { g（置き場所と向きは app が決める）, setPose(view), update(dt, view), dispose() }
window.PlaySkins = (() => {
  const geomOf = (B, b, P) => window.PlayBody.withState(B.D, core => core.boneGeom(P && P[b.id] && P[b.id].length === b.pts.length ? Object.assign({}, b, { pts: P[b.id] }) : b));
  // 1枚の三角形ごとに色（工房の色塗り）
  function painted(G, bone, base) { const n = G.I.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), b0 = new THREE.Color(base);
    for (let t = 0; t < n / 3; t++) { const hx = bone.paint && bone.paint[t], c = typeof hx === 'string' && /^#[0-9a-f]{6}$/i.test(hx) ? new THREE.Color(hx) : b0;
      for (let q = 0; q < 3; q++) { const s = G.I[t * 3 + q] * 3, d = (t * 3 + q) * 3; pos[d] = G.V[s]; pos[d + 1] = G.V[s + 1]; pos[d + 2] = G.V[s + 2]; col[d] = c.r; col[d + 1] = c.g; col[d + 2] = c.b; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
  const writeFlat = (geo, G) => { const v = geo.attributes.position.array; for (let j = 0; j < G.I.length; j++) { const s = G.I[j] * 3, d = j * 3; v[d] = G.V[s]; v[d + 1] = G.V[s + 1]; v[d + 2] = G.V[s + 2]; } geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); };
  // 体の主な色（塗りの一番多い色）。プニプニの色に使う
  function mainColor(B) { const n = {}; for (const b of B.D.bones) for (const c of (b.paint || [])) if (typeof c === 'string') n[c] = (n[c] || 0) + 1; let best = null, k = 0; for (const c in n) if (n[c] > k) { k = n[c]; best = c; } return best; }
  // ふつう：工房と同じローポリ＋色塗り
  function normal(B) { const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }), meshes = new Map(), base = '#d9a46b';
    let lastKey = null;
    function setPose(v) { if (v.key === lastKey) return; lastKey = v.key; for (const b of B.D.bones) { const G = geomOf(B, b, v.P); if (!G) continue; let m = meshes.get(b.id);
        if (m && m.geometry.attributes.position.count === G.I.length) writeFlat(m.geometry, G); else { if (m) { inner.remove(m); m.geometry.dispose(); } m = new THREE.Mesh(painted(G, b, base), mat); m.castShadow = true; meshes.set(b.id, m); inner.add(m); } } }
    return { g, inner, setPose, update() {}, dispose() { for (const m of meshes.values()) m.geometry.dispose(); mat.dispose(); } }; }
  // プニプニ：半透明でつるっと。着地でつぶれて、プルンと戻る（ばね）。跳ぶと縦に伸びる

  function puni(B) { const g = new THREE.Group(), wob = new THREE.Group(), inner = new THREE.Group(); g.add(wob); wob.add(inner);
    const hard = window.BoneJudge && window.BoneJudge.hardParts ? window.BoneJudge.hardParts(B, inner) : { update() {}, dispose() {} }, mc = mainColor(B), col = mc ? new THREE.Color(mc).lerp(new THREE.Color(0x9fe8ff), 0.25) : new THREE.Color(0x7fdcc4), /* 塗ってない子はミント色 */ skin = new THREE.MeshStandardMaterial({ color: col, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.62, emissive: col.clone().multiplyScalar(0.18), depthWrite: false, side: THREE.FrontSide }),
      core = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.7), roughness: 0.5, transparent: true, opacity: 0.35, depthWrite: false }), meshes = new Map();
    let lastKey = null, k = 0, kv = 0;
    function smooth(G) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(G.V.slice(), 3)); geo.setIndex(G.I.slice()); geo.computeVertexNormals(); return geo; }
    function setPose(v) { if (v.key === lastKey) return; lastKey = v.key; for (const b of B.D.bones) { const G = geomOf(B, b, v.P); if (!G) continue; let m = meshes.get(b.id);
        if (m && m.geometry.attributes.position.count === G.V.length / 3) { m.geometry.attributes.position.array.set(G.V); m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
        else { if (m) { inner.remove(m); inner.remove(m.userData.c); m.geometry.dispose(); } m = new THREE.Mesh(smooth(G), skin); const c = new THREE.Mesh(m.geometry, core); c.scale.setScalar(0.72); m.userData.c = c; m.renderOrder = 2; meshes.set(b.id, m); inner.add(c); inner.add(m); } } hard.update(v.P); }
    // ぷにぷに：骨の動きにぴったり貼り付けず、体が遅れてついてくる。着地でつぶれて、止まったらぷるんと揺れ残る
    //   k＝縦の伸び縮み（ばね）、lx/lz＝前後・左右の傾き（ばね。動き出し・止まり・曲がりで遅れて揺れる）
    let lx = 0, lxv = 0, lz = 0, lzv = 0, pv = null, pyaw = null, t = 0, sv = null, trem = 0;
    function update(dt, v, ev) { t += dt; dt = Math.min(dt, 0.05); if (ev && ev.land != null) kv -= Math.min(3.5, 0.8 + ev.land * 1.6); if (ev === 'lift') kv += 2.2;
      const sp = v.st === 'ground' ? Math.hypot(v.x - (pv ? pv[0] : v.x), v.z - (pv ? pv[1] : v.z)) / Math.max(1e-3, dt) : 0, acc = pv ? (sp - pv[2]) / Math.max(1e-3, dt) : 0; pv = [v.x, v.z, sp];
      const yr = pyaw == null ? 0 : Math.atan2(Math.sin(v.yaw - pyaw), Math.cos(v.yaw - pyaw)) / Math.max(1e-3, dt); pyaw = v.yaw;
      if (Math.abs(acc) > 3) kv -= Math.sign(acc) * Math.min(1.2, Math.abs(acc) * 0.05); /* 急に動く・止まる：むにっ */
      const target = sv != null ? sv : v.st === 'jair' || v.st === 'air' ? Math.max(-0.12, Math.min(0.18, v.vy * 0.025)) : v.st === 'charge' ? -0.12 : 0; kv += (-(k - target) * 140 - kv * 7) * dt; k += kv * dt; k = Math.max(-0.45, Math.min(0.45, k));
      const tx = Math.max(-0.35, Math.min(0.35, -acc * 0.025 + sp * 0.04)), tz = Math.max(-0.3, Math.min(0.3, -yr * sp * 0.05)); /* 加速で後ろへ、止まると前へつんのめる。曲がると外へ */
      lxv += (-(lx - tx) * 90 - lxv * 6) * dt; lx += lxv * dt; lzv += (-(lz - tz) * 90 - lzv * 6) * dt; lz += lzv * dt;
      const br = 0.012 * Math.sin(t * 2.4); wob.scale.set(1 - k * 0.5 - br, 1 + k + br, 1 - k * 0.5 - br); wob.rotation.x = lx * 0.6 + Math.sin(t * 41 + 1) * 0.04 * trem; wob.rotation.z = lz * 0.6 + Math.sin(t * 47) * 0.06 * trem; }
    return { g, inner, setPose, update, squash(a) { kv -= a; }, glow(a) { core.emissive = core.emissive || new THREE.Color(0); core.opacity = 0.35 + Math.max(0, a) * 0.4; }, strain(v, tr) { sv = v; trem = v == null ? 0 : tr; if (v == null) kv -= 4; }, dispose() { for (const m of meshes.values()) m.geometry.dispose(); skin.dispose(); core.dispose(); hard.dispose(); } }; }
  // プルプル：「関節の元」（中に浮かぶ芯の玉）＋「透明なプルプル成分」。玉の数＝関節の数（体の大きさとは別）
  function pulu(B) { const g = new THREE.Group(), wob = new THREE.Group(), inner = new THREE.Group(); g.add(wob); wob.add(inner);
    const mc = mainColor(B), col = mc ? new THREE.Color(mc).lerp(new THREE.Color(0xbff3ff), 0.35) : new THREE.Color(0x9fe6e0),
      jelly = THREE.MeshPhysicalMaterial ? new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.1, emissive: col.clone().multiplyScalar(0.12), depthWrite: false })
        : new THREE.MeshStandardMaterial({ color: col, roughness: 0.1, transparent: true, opacity: 0.42, depthWrite: false }),
      nucMat = new THREE.MeshStandardMaterial({ color: col.clone().offsetHSL(0.02, 0.25, -0.28), roughness: 0.35, emissive: col.clone().offsetHSL(0, 0.2, -0.35).multiplyScalar(0.5) }),
      meshes = new Map(), nucs = [], nucGeo = new THREE.SphereGeometry(1, 14, 10);
    // 関節：骨の点（親の終わりと子の始まりは同じ玉）
    const joints = []; { const seen = []; for (const b of B.D.bones) { const r0 = (b.wp && b.wp[0] && b.wp[0].r) || 0.04; b.pts.forEach((p, i) => { const dup = seen.find(q => Math.hypot(q.p[0] - p[0], q.p[1] - p[1], q.p[2] - p[2]) < r0 * 0.6); if (dup) return; const j = { bone: b.id, i, p, r: Math.max(0.014, Math.min(0.05, r0 * 0.42)) }; seen.push(j); joints.push(j); }); } }
    for (const j of joints) { const m = new THREE.Mesh(nucGeo, nucMat); m.scale.setScalar(j.r); nucs.push(m); inner.add(m); }
    let lastKey = null, k = 0, kv = 0, t = 0;
    // プルプル成分は骨の肉付けより一回りふっくら（背の高さの6%ぶん外へ）。中の芯の玉が透けて見える
    let hu = 0.05; for (const b of B.D.bones) for (const p of b.pts) hu = Math.max(hu, p[1]); const fat = hu * 0.06;
    function inflate(geo) { geo.computeVertexNormals(); const p = geo.attributes.position.array, n = geo.attributes.normal.array; for (let i = 0; i < p.length; i++) p[i] += n[i] * fat; geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); return geo; }
    function smooth(G) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(G.V.slice(), 3)); geo.setIndex(G.I.slice()); return inflate(geo); }
    function setPose(v) { if (v.key === lastKey) return; lastKey = v.key; for (const b of B.D.bones) { const G = geomOf(B, b, v.P); if (!G) continue; let m = meshes.get(b.id);
        if (m && m.geometry.attributes.position.count === G.V.length / 3) { m.geometry.attributes.position.array.set(G.V); inflate(m.geometry); }
        else { if (m) { inner.remove(m); m.geometry.dispose(); } m = new THREE.Mesh(smooth(G), jelly); m.renderOrder = 2; meshes.set(b.id, m); inner.add(m); } }
      joints.forEach((j, n) => { const P = v.P && v.P[j.bone], q = P && P[j.i] ? P[j.i] : j.p; nucs[n].position.set(q[0], q[1], q[2]); }); }
    let sv = null, trem = 0; /* 踏ん張り：外から伸び縮み（sv）と震え（trem）を決める。null で元に戻る */
    function update(dt, v, ev) { t += dt; if (ev && ev.land != null) kv -= Math.min(3.5, 0.8 + ev.land * 1.6); if (ev === 'lift') kv += 2.2;
      const target = sv != null ? sv : v.st === 'jair' || v.st === 'air' ? Math.max(-0.12, Math.min(0.18, v.vy * 0.025)) : v.st === 'charge' ? -0.12 : 0;
      wob.rotation.z = Math.sin(t * 47) * 0.06 * trem; wob.rotation.x = Math.sin(t * 39 + 1) * 0.04 * trem; kv += (-(k - target) * 140 - kv * 9) * dt; k += kv * dt; k = Math.max(-0.45, Math.min(0.5, k));
      const br = 0.015 * Math.sin(t * 2.4); wob.scale.set(1 - k * 0.5 - br, 1 + k + br, 1 - k * 0.5 - br); /* 息をするみたいに少しふくらむ */
      nucs.forEach((m, n) => { const s = joints[n].r * (1 + 0.08 * Math.sin(t * 3 + n * 1.7)); m.scale.setScalar(s); }); }
    return { g, inner, setPose, update, squash(a) { kv -= a; }, glow(a) { nucMat.emissiveIntensity = 1 + Math.max(0, a) * 3; }, strain(v, tr) { sv = v; trem = v == null ? 0 : tr; if (v == null) kv -= 4; }, dispose() { for (const m of meshes.values()) m.geometry.dispose(); jelly.dispose(); nucMat.dispose(); nucGeo.dispose(); } }; }
  return { list: [['puni', 'プニプニ'], ['pulu', 'プルプル'], ['normal', 'ふつう']], normal, puni, pulu };
})();
