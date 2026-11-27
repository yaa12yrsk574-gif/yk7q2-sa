// ---- トカゲ版の島：下の草原（スタート・池）→ ドッスンの崖（1.75m）→ 上の台地（林・高い木）→ 北の海と遠くの島 ----
// 単位は m。+z が南（スタート側）、-z が北（崖・海）
window.TkWorld = (() => {
  const CLIFF_Z = -16, TOP = 1.75, NORTH = -62, SEA_Y = -0.7;
  function create(scene) {
    scene.background = new THREE.Color(0xbfe0ec); scene.fog = new THREE.Fog(0xbfe0ec, 45, 210);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7f9a66, 0.95)); const sun = new THREE.DirectionalLight(0xfff4e0, 0.8); sun.position.set(18, 30, 14); scene.add(sun);
    const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.95, flatShading: true }, o || {}));
    const grassM = M(0xa6c985), cliffM = M(0xb39b7a), topM = M(0x98bf78), sandM = M(0xe8d9ae), seaM = new THREE.MeshStandardMaterial({ color: 0x5aa7c9, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.92 });
    // 海（島のまわり全部）
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), seaM); sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y; scene.add(sea);
    // 下の草原：砂浜の縁つき
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(52, 54, 1.2, 40), sandM); sand.position.set(0, -0.6, 4); sand.scale.z = 0.62; scene.add(sand);
    const meadow = new THREE.Mesh(new THREE.CylinderGeometry(48, 50, 1.2, 40), grassM); meadow.position.set(0, -0.59, 4); meadow.scale.z = 0.6; scene.add(meadow);
    // 台地（崖の上）：前の面が崖
    const boxes = [];
    function box(x0, x1, z0, z1, top, mat, noMesh) { const b = { x0, x1, z0, z1, top }; boxes.push(b); if (!noMesh) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, top + 2, z1 - z0), mat || cliffM); m.position.set((x0 + x1) / 2, top / 2 - 1, (z0 + z1) / 2); scene.add(m);
        const t = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), topM); t.rotation.x = -Math.PI / 2; t.position.set((x0 + x1) / 2, top + 0.004, (z0 + z1) / 2); scene.add(t); } return b; }
    const plateau = box(-40, 40, NORTH, CLIFF_Z, TOP); plateau.cliff = true;
    // 崖の面のでこぼこ（岩）
    { const g = new THREE.DodecahedronGeometry(1, 0); for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(g, cliffM), s = 0.5 + Math.random() * 0.9; m.scale.set(s * 1.4, s, s * 0.6); m.position.set(-39 + i * 1.75 + Math.random() * 0.6, 0.4 + Math.random() * 1.2, CLIFF_Z + 0.1); m.rotation.set(Math.random(), Math.random(), Math.random()); scene.add(m); } }
    // 台地の向こう：海へ落ちる北の端（岩）
    { const g = new THREE.DodecahedronGeometry(1, 0); for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(g, cliffM), s = 0.7 + Math.random(); m.scale.set(s * 1.6, s * 1.5, s); m.position.set(-39 + i * 2, TOP - 1.2 + Math.random() * 0.5, NORTH - 0.4); scene.add(m); } }
    // ---- 低い岩・切り株（トカゲが試す所） ----
    const rocks = [[-8, 6, 1.4, 0.35], [9, 12, 1.2, 0.3], [-14, -6, 1.6, 0.45], [12, -3, 1.1, 0.3]];
    for (const [x, z, r, h] of rocks) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), cliffM); m.scale.y = h / r; m.position.set(x, h * 0.5, z); scene.add(m); boxes.push({ x0: x - r * 0.7, x1: x + r * 0.7, z0: z - r * 0.7, z1: z + r * 0.7, top: h }); }
    const stump = { x: -4, z: -27, top: TOP + 0.5 }; { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.5, 9), M(0x8a6a4a)); m.position.set(stump.x, TOP + 0.25, stump.z); scene.add(m); boxes.push({ x0: stump.x - 0.4, x1: stump.x + 0.4, z0: stump.z - 0.4, z1: stump.z + 0.4, top: stump.top }); }
    // ---- 木 ----
    const wood = M(0x8a6a4a), leaf = M(0x5f9a48), leaf2 = M(0x6faa52), trees = [];
    function tree(x, z, h, s, y0) { const y = y0 || 0, tk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, h, 7), wood); tk.position.set(x, y + h / 2, z); scene.add(tk);
      const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), Math.random() < 0.5 ? leaf : leaf2); cr.position.set(x, y + h + 0.6 * s, z); cr.scale.y = 0.85; scene.add(cr);
      const t = { x, z, y, h, s, top: y + h + 0.2 * s, meshes: [tk, cr] }; trees.push(t); boxes.push({ x0: x - 0.3 * s, x1: x + 0.3 * s, z0: z - 0.3 * s, z1: z + 0.3 * s, top: y + h + 3, tree: true }); return t; }
    for (const [x, z, h, s] of [[-22, 14, 3, 1.2], [-28, 4, 3.4, 1.3], [24, 16, 2.8, 1.1], [30, 0, 3.2, 1.2], [-20, -10, 2.6, 1], [26, -11, 3, 1.1], [-34, 18, 3, 1.2], [34, 14, 2.6, 1]]) tree(x, z, h, s);
    // 実のなる木（崖の上、ドッスンが食べに来る）
    const fruitTree = tree(3, -19.5, 2.4, 1, TOP), fruitM = M(0xf08a2a, { roughness: 0.5 }), fruits = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), fruitM); const a = i * 1.7; m.position.set(3 + Math.cos(a) * 1.0, TOP + 2.6 + Math.sin(i) * 0.3, -19.5 + Math.sin(a) * 1.0); scene.add(m); fruits.push(m); }
    // 林（鳥がいる）と、高い木2本（ムササビがいる）
    const grove = [[-14, -30, 3.2, 1.1], [-18, -35, 3.6, 1.2], [-11, -37, 3.0, 1.0], [-20, -27, 2.8, 1.0], [-16, -41, 3.4, 1.1]].map(([x, z, h, s]) => tree(x, z, h, s, TOP));
    const tallA = tree(15, -32, 5.2, 1.05, TOP), tallB = tree(23, -42, 5.6, 1.1, TOP);
    for (const [x, z, h, s] of [[-30, -24, 3, 1.2], [32, -22, 3.2, 1.2], [-32, -48, 3.4, 1.3], [30, -52, 3, 1.1], [4, -50, 3.6, 1.3], [-6, -44, 2.8, 1]]) tree(x, z, h, s, TOP);
    // ---- 池（カエルとヒキガエル） ----
    const pond = { x: 17, z: 5, r: 4.2 }; { const w = new THREE.Mesh(new THREE.CircleGeometry(pond.r, 28), new THREE.MeshStandardMaterial({ color: 0x5d9fbd, roughness: 0.3, transparent: true, opacity: 0.9 })); w.rotation.x = -Math.PI / 2; w.position.set(pond.x, 0.02, pond.z); scene.add(w);
      const rim = new THREE.Mesh(new THREE.RingGeometry(pond.r, pond.r + 0.5, 28), M(0x8fae6c)); rim.rotation.x = -Math.PI / 2; rim.position.set(pond.x, 0.015, pond.z); scene.add(rim);
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4, p = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), M(0x5d9a48)); p.rotation.x = -Math.PI / 2; p.position.set(pond.x + Math.cos(a) * 2.3, 0.03, pond.z + Math.sin(a) * 2.3); scene.add(p); }
      const reedM = M(0x6f9c4c); for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, r = pond.r + 0.2 + Math.random() * 0.7, h = 0.4 + Math.random() * 0.5, m = new THREE.Mesh(new THREE.ConeGeometry(0.04, h, 4), reedM); m.position.set(pond.x + Math.cos(a) * r, h / 2, pond.z + Math.sin(a) * r); scene.add(m); } }
    // ---- 草・花の点々 ----
    { const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color(); for (let i = 0; i < n; i++) { const up = i % 3 === 0; let x, z, y; if (up) { x = (Math.random() - 0.5) * 78; z = NORTH + 1 + Math.random() * (CLIFF_Z - NORTH - 2); y = TOP + 0.03; } else { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()); x = Math.cos(a) * r * 46; z = 4 + Math.sin(a) * r * 28; if (z < CLIFF_Z + 0.5) z = CLIFF_Z + 0.5 + Math.random() * 3; y = 0.03; }
        pos.set([x, y, z], i * 3); c.setHSL(Math.random() < 0.08 ? Math.random() : 0.25 + Math.random() * 0.08, Math.random() < 0.08 ? 0.7 : 0.35, Math.random() < 0.08 ? 0.75 : 0.42); col.set([c.r, c.g, c.b], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true }))); }
    // ---- 遠く：島・山・岩の柱（エンディングで見える「まだ行けてない所」） ----
    const far = {};
    { const isl = new THREE.Mesh(new THREE.CylinderGeometry(9, 14, 6, 12), M(0x8fb070)); isl.position.set(-6, SEA_Y + 1.5, -130); scene.add(isl); const peak = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 9), M(0x7d8f74)); peak.position.set(-4, SEA_Y + 10, -134); scene.add(peak); far.island = new THREE.Vector3(-5, 6, -130);
      const sandI = new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 0.8, 14), sandM); sandI.position.set(-6, SEA_Y + 0.2, -130); scene.add(sandI);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 16, 7), cliffM); pillar.position.set(42, SEA_Y + 7, -105); scene.add(pillar); const nest = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.35, 5, 10), M(0x9a7a50)); nest.rotation.x = Math.PI / 2; nest.position.set(42, SEA_Y + 15.2, -105); scene.add(nest); far.pillar = new THREE.Vector3(42, 15, -105);
      const isl2 = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 8), M(0x95a7b3, { transparent: true, opacity: 0.85 })); isl2.position.set(-70, SEA_Y + 9, -200); scene.add(isl2); far.mount = new THREE.Vector3(-70, 12, -200);
      // 島に降りられる（エンディング後）
      boxes.push({ x0: -12.5, x1: 0.5, z0: -132, z1: -120, top: SEA_Y + 4.5, island: true }); far.islandTop = SEA_Y + 4.5; }
    // ---- 地面の高さ：その場所で、足元（y＋段差）より下にある一番高い面 ----
    const inMeadow = (x, z) => { const dz = (z - 4) / 0.6; return x * x + dz * dz < 48 * 48; };
    function groundAt(x, z, y) { let g = inMeadow(x, z) ? 0 : SEA_Y - 0.3; if (y == null) y = 99; for (const b of boxes) if (!b.tree && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.top <= y + 0.32) g = Math.max(g, b.top); if (Math.hypot(x - pond.x, z - pond.z) < pond.r - 0.3 && g < 0.1) g = -0.12; return g; }
    // 歩ける範囲（飛んでる時は使わない）
    function clamp(o, r) { const up = o.y > TOP - 0.3; if (up) { o.x = Math.max(-38.5 + r, Math.min(38.5 - r, o.x)); } else { const dz = (o.z - 4) / 0.6, d = Math.hypot(o.x, dz), lim = 45; if (d > lim) { o.x *= lim / d; o.z = 4 + dz * lim / d * 0.6; } } }
    // 木の幹・岩：横からはぶつかる
    function blocked(x, z, y, r) { return boxes.some(b => b.top > y + 0.32 && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r); }
    // カメラと見たいものの間にある木は、消しておく（観察や教える場面で、葉っぱで隠れへんように）
    const _a = new THREE.Vector3(), _b = new THREE.Vector3();
    function hideBetween(camP, lookP) { const ax = camP.x, az = camP.z, bx = lookP.x, bz = lookP.z, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
      for (const t of trees) { const u = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.z - az) * dz) / L2)), px = ax + dx * u, pz = az + dz * u, d = Math.hypot(t.x - px, t.z - pz), hide = d < 1.9 * t.s && u < 0.97 && Math.hypot(t.x - bx, t.z - bz) > 0.8; for (const m of t.meshes) m.visible = !hide; } }
    let t = 0; function tick(dt) { t += dt; sea.position.y = SEA_Y + Math.sin(t * 0.6) * 0.04; }
    return { boxes, groundAt, clamp, blocked, tick, hideBetween, pond, plateau, stump, trees, grove, tallA, tallB, fruitTree, fruits, far, CLIFF_Z, TOP, NORTH, SEA_Y, sea };
  }
  return { create, CLIFF_Z, TOP, NORTH };
})();
