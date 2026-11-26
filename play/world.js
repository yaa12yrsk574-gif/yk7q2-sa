// ---- 草原：地面と段差。体がぶつかる箱（boxes）と、その場所の地面の高さ（groundAt）を出す ----
window.PlayWorld = (() => {
  function create(scene) {
    scene.background = new THREE.Color(0xcfe3e8); scene.fog = new THREE.Fog(0xcfe3e8, 30, 120);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa070, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(12, 20, 8); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0xa9c98a, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new THREE.GridHelper(160, 80, 0x98b87a, 0x98b87a); grid.position.set(0, 0.003, 4.5 - 80); /* 草原だけ（浜と海にはマス目なし） */ grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);
    // 草の点々（速さが分かるように）
    { const n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 140; pos[i * 3 + 1] = 0.04; pos[i * 3 + 2] = (Math.random() - 0.5) * 140; if (pos[i * 3 + 2] > 4.2) pos[i * 3 + 1] = -5; /* 浜には草なし */ } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x6f9a55, size: 0.12 }))); }
    const boxes = [], rockMat = new THREE.MeshStandardMaterial({ color: 0xb59a78, roughness: 0.95, flatShading: true }), topMat = new THREE.MeshStandardMaterial({ color: 0x9cc07c, roughness: 1 });
    function box(x, z, w, d, top, label) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, top, d), rockMat); m.position.set(x, top / 2, z); scene.add(m);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(w, d), topMat); t.rotation.x = -Math.PI / 2; t.position.set(x, top + 0.004, z); scene.add(t);
      const b = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top, label, x, z }; boxes.push(b); return b; }
    // 前に段々：0.6 → 1.2 → 1.75（崖と同じ）→ 2.5。横に低い岩がいくつか
    box(0, -7, 4, 3, 0.6, '0.6m'); box(0, -11, 4, 3, 1.2, '1.2m'); box(0, -15, 4, 3, 1.75, '1.75m'); box(0, -19.5, 5, 4, 2.5, '2.5m');
    const crabRock = box(-4.2, -3.2, 2.4, 2, 1.2, 'カニの岩'); /* 跳んでも届かへん。カニは前の面（スタート側）を登る */ box(-7.6, -4, 2.2, 2.2, 0.35); box(-9, -9, 2.6, 2.6, 0.9); box(7, -5, 3, 2, 0.5); box(9, -10, 2.4, 2.4, 1.4);
    const beach = window.PlayBeach.create(scene, boxes); /* 浜（スタート地点の後ろ）と海 */
    // ---- ツタの壁：背の高い岩2つのすき間をツタがふさいでる。速く振って当てたら切れる（遅いとペチッ）----
    box(-13.25, -14, 5.5, 2, 3); box(-4.75, -14, 5.5, 2, 3);
    const vineG = new THREE.Group(), vineMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.9, flatShading: true }); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3, 5), vineMat); c.position.set(-10.3 + i * 0.32 + Math.random() * 0.1, 1.5, -14 + (Math.random() - 0.5) * 0.3); c.rotation.z = (Math.random() - 0.5) * 0.12; vineG.add(c); } scene.add(vineG);
    const vine = { x0: -10.5, x1: -7.5, z0: -14.3, z1: -13.7, top: 3, x: -9, z: -14, vine: true, g: vineG, cut: false }; boxes.push(vine);
    function strike(p, sp, reach) { if (vine.cut) return null; const dx = Math.max(vine.x0 - p[0], 0, p[0] - vine.x1), dz = Math.max(vine.z0 - p[2], 0, p[2] - vine.z1); if (Math.hypot(dx, dz) > reach || p[1] > vine.top + 0.3) return null;
      if (sp >= 1.5) { vine.cut = true; boxes.splice(boxes.indexOf(vine), 1); vineG.children.forEach((c, i) => { c.userData.fall = 0.6 + Math.random() * 0.8; }); return 'cut'; } vineG.userData.shake = 0.4; return 'weak'; }
    // ---- 実：地面に落ちてる。掴めば運べる。力を入れすぎると潰れる（しばらくしたら元の場所にまた生える）----
    const fruitMat = new THREE.MeshStandardMaterial({ color: 0xf08a2a, roughness: 0.5 }), splatMat = new THREE.MeshBasicMaterial({ color: 0xe0761c, transparent: true, opacity: 0.85 }), fruits = [];
    for (const [x, z] of [[3, 0], [4.2, -1.2], [-3.5, 1], [-9, -17], [-8.2, -18], [-10, -18.5]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), fruitMat); m.position.set(x, 0.17, z); scene.add(m); fruits.push({ m, home: [x, z], st: 'ground', t: 0 }); }
    { const tr = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.5, 7), new THREE.MeshStandardMaterial({ color: 0x5f9a48, flatShading: true })); tr.position.set(-9, 2.4, -19.5); scene.add(tr); const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a4a })); tk.position.set(-9, 0.5, -19.5); scene.add(tk); }
    const fruitNear = (p, r, ry) => { let best = null, bd = r; for (const f of fruits) if (f.st === 'ground') { const q = f.m.position, d = Math.hypot(q.x - p[0], q.z - p[2]); if (d < bd && Math.abs(q.y - p[1]) < (ry || r)) { bd = d; best = f; } } return best; }; /* 横の近さ＋高さの差 */
    function crush(f) { f.st = 'gone'; f.t = 6; f.m.visible = false; const sp = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), splatMat); sp.rotation.x = -Math.PI / 2; sp.position.set(f.m.position.x, groundAt(f.m.position.x, f.m.position.z, f.m.position.y + 0.3) + 0.01, f.m.position.z); scene.add(sp); f.splat = sp; }
    function drop(f) { f.st = 'ground'; const p = f.m.position; p.y = groundAt(p.x, p.z, p.y) + 0.17; }
    function tick(dt) { tickInterests(dt); crab.tick(dt); beach.tick(dt); for (const c of vineG.children) if (c.userData.fall) { c.rotation.x += dt * 2.5; c.position.y -= dt * 1.5; c.scale.multiplyScalar(1 - dt * 0.8); if (c.position.y < -1) { c.visible = false; c.userData.fall = 0; } }
      if (vineG.userData.shake > 0) { vineG.userData.shake -= dt; vineG.position.x = Math.sin(vineG.userData.shake * 60) * 0.04 * vineG.userData.shake; }
      for (const f of fruits) if (f.st === 'gone') { f.t -= dt; if (f.t <= 0) { if (f.splat) { scene.remove(f.splat); f.splat = null; } f.st = 'ground'; f.m.visible = true; f.m.position.set(f.home[0], 0.17, f.home[1]); } } }
    // ---- ぶら下がれるツタ：木の枝から1本垂れてる。ハサミで掴むとぶら下がって揺れる。奥の 1.4m の岩へ飛び移れる ----
    const swing = { pivot: [9, 3.5, -6.3], L: 2.35, dir: [0, 0, -1] }; /* dir＝揺れる向き（岩の方） */
    { const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, flatShading: true }), leaf = new THREE.MeshStandardMaterial({ color: 0x5f9a48, flatShading: true });
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.2, 7), wood); tk.position.set(11.6, 2.1, -6.3); scene.add(tk);
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 2.8, 6), wood); br.rotation.z = Math.PI / 2 + 0.08; br.position.set(10.25, 3.55, -6.3); scene.add(br);
      const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), leaf); cr.position.set(12.4, 5.1, -6.6); cr.scale.set(1.0, 0.75, 0.9); /* 葉っぱはツタの真上からずらす（揺れてる時に隠さない） */ scene.add(cr); }
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.9, flatShading: true }), rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1, 6), ropeMat); scene.add(rope);
    const tipM = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), ropeMat); scene.add(tipM); /* 先っぽの葉っぱの玉（掴む目印） */
    swing.rest = () => [swing.pivot[0], swing.pivot[1] - swing.L, swing.pivot[2]];
    swing.setEnd = (p) => { const a = new THREE.Vector3(...swing.pivot), b = new THREE.Vector3(...p), d = b.clone().sub(a), l = d.length(); rope.scale.set(1, l, 1); rope.position.copy(a).add(b).multiplyScalar(0.5); rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); tipM.position.copy(b); };
    swing.setEnd(swing.rest());
    // ツタ（支点→先っぽ）に一番近い点と、その距離
    swing.near = (q) => { const P0 = swing.pivot, P1 = swing.rest(), v = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]], w = [q[0] - P0[0], q[1] - P0[1], q[2] - P0[2]], L2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2], t = Math.max(0.25, Math.min(1, (w[0] * v[0] + w[1] * v[1] + w[2] * v[2]) / L2)), c = [P0[0] + v[0] * t, P0[1] + v[1] * t, P0[2] + v[2] * t]; return { p: c, d: Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]), L: swing.L * t }; };
    // ---- 気になるもの：プルプルが好奇心で寄っていく（花・光る石・水たまり・ちょうちょ。落ちてる実も）----
    const interests = [], iMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true });
    for (const [x, z, c] of [[-2.6, 1.2, 0xffd34a], [2.4, 0.4, 0xff8fb8], [-2.4, -1.2, 0xb9a2ff], [3.6, -2.6, 0xffffff], [-1.2, -4.6, 0xff8fb8]]) { const g = new THREE.Group(), st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.2, 4), iMat(0x4f8a3a)); st.position.y = 0.1; g.add(st);
      for (let i = 0; i < 5; i++) { const pe = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 3), iMat(c)); const a = i / 5 * Math.PI * 2; pe.scale.set(1, 0.4, 0.6); pe.position.set(Math.cos(a) * 0.04, 0.2, Math.sin(a) * 0.04); g.add(pe); } g.position.set(x, 0, z); scene.add(g); interests.push({ kind: 'flower', x, z, g }); }
    for (const [x, z] of [[1.4, -1.2], [-2, -6]]) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({ color: 0x9fe6ff, emissive: 0x2a6a8a, roughness: 0.2, flatShading: true })); m.position.set(x, 0.06, z); scene.add(m); interests.push({ kind: 'stone', x, z, g: m }); }
    { const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshStandardMaterial({ color: 0x7fb6d6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(4.2, 0.01, 1.8); m.scale.set(1.3, 1, 1); scene.add(m); interests.push({ kind: 'puddle', x: 4.2, z: 1.8, g: m }); }
    const bfly = []; for (const [x, z, c] of [[-1, -1.5, 0xffe066], [2.5, -4.5, 0xff9ad5]]) { const g = new THREE.Group(), wm = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }), w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.06), wm), w2 = w1.clone(); w1.position.x = 0.035; w2.position.x = -0.035; g.add(w1, w2); g.position.set(x, 0.5, z); scene.add(g);
      const it = { kind: 'bfly', x, z, g, w1, w2, home: [x, z], t: Math.random() * 10 }; bfly.push(it); interests.push(it); }
    for (const it of beach.interests) interests.push(it);
    for (const f of fruits) interests.push({ kind: 'fruit', get x() { return f.m.position.x; }, get z() { return f.m.position.z; }, f });
    function tickInterests(dt) { for (const b of bfly) { b.t += dt; b.x = b.home[0] + Math.sin(b.t * 0.37) * 2.2 + Math.sin(b.t * 1.3) * 0.3; b.z = b.home[1] + Math.sin(b.t * 0.23 + 1) * 1.8; b.g.position.set(b.x, 0.45 + 0.2 * Math.sin(b.t * 2.1), b.z); b.g.rotation.y = b.t * 0.5; const fl = Math.sin(b.t * 22) * 0.9; b.w1.rotation.y = fl; b.w2.rotation.y = -fl; }
      for (const it of interests) if (it.kind === 'flower') it.g.rotation.z = Math.sin(performance.now() / 900 + it.x) * 0.05; }
    // ---- カニ：岩の前の面をひょいひょい登る。観察の時はゆっくり＋骨が透けて、爪先の軌跡と壁に触れた瞬間が光る ----
    const crab = (() => { const g = new THREE.Group(), body = new THREE.Group(); g.add(body); scene.add(g);
      const shell = new THREE.MeshStandardMaterial({ color: 0xe0643a, roughness: 0.6, flatShading: true, transparent: true, opacity: 1 }), boneM = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0 });
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), shell); b.scale.set(0.13, 0.05, 0.1); body.add(b);
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshStandardMaterial({ color: 0x222222 })); e.position.set(sx * 0.03, 0.05, 0.09); body.add(e); }
      const legs = [], WALL_Y = -0.055; /* 体の下（＝壁の面）までの距離 */
      for (let i = 0; i < 8; i++) { const side = i < 4 ? -1 : 1, k = i % 4, root = new THREE.Vector3(side * 0.1, 0, 0.05 - k * 0.04), ph = (k % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0);
        const seg = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 1, 4), shell); body.add(m); return m; });
        const bl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), boneM); bl.renderOrder = 10; body.add(bl);
        const trailG = new THREE.BufferGeometry(), trailP = new Float32Array(30 * 3); trailG.setAttribute('position', new THREE.BufferAttribute(trailP, 3)); trailG.setDrawRange(0, 0);
        const trail = new THREE.Line(trailG, new THREE.LineBasicMaterial({ color: 0x9ff3ff, depthTest: false, transparent: true, opacity: 0.85 })); trail.renderOrder = 11; trail.frustumCulled = false; scene.add(trail);
        legs.push({ side, root, ph, seg, bl, trail, trailP, n: 0, down: false }); }
      const claws = [-1, 1].map(sx => { const c = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), shell); c.scale.set(0.035, 0.02, 0.05); c.position.set(sx * 0.07, 0.01, 0.15); body.add(c); return c; });
      const flashes = [], flashGeo = new THREE.SphereGeometry(0.03, 8, 6);
      const W = crabRock, X = W.x + 0.35, ZF = W.z1, C = { g, x: X, y: 0, z: ZF + 1.4, t: 0, st: 'walk', slow: 1, xray: 0, laps: 0 };
      function setSeg(m, a, c) { const d = c.clone().sub(a), l = d.length(); m.scale.set(1, l, 1); m.position.copy(a).add(c).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); }
      C.tick = (dt) => { const k = dt * C.slow; C.t += k;
        // 道のり：地面を壁へ → 壁を登る → 上を奥へ → 消える → 少し待って、また手前から
        const v = 0.35; if (C.st === 'walk') { C.z -= v * k; C.y = 0; if (C.z <= ZF + 0.06) { C.st = 'climb'; C.z = ZF + 0.06; } }
        else if (C.st === 'climb') { C.y += v * 0.8 * k; if (C.y >= W.top) { C.st = 'top'; C.y = W.top; } }
        else if (C.st === 'top') { C.z -= v * k; if (C.z < W.z0 + 0.3) { C.st = 'gone'; C.wait = 3; C.laps++; } }
        else if (C.st === 'gone') { C.wait -= k; if (C.wait <= 0) { C.st = 'walk'; C.z = ZF + 1.4; C.y = 0; } }
        g.visible = C.st !== 'gone'; g.position.set(C.x, C.y, C.z);
        const climbing = C.st === 'climb'; body.rotation.set(climbing ? -Math.PI / 2 : 0, 0, 0); body.position.set(0, climbing ? 0 : 0.06, climbing ? 0.06 : 0); /* 登る時は腹を壁に向ける */
        const cyc = C.t * 9; for (const L of legs) { const u = cyc + L.ph, lift = Math.max(0, Math.sin(u)), sw = Math.cos(u) * 0.035, a = L.root, mid = new THREE.Vector3(a.x + L.side * 0.06, 0.04 + lift * 0.03, a.z + sw * 0.5), tip = new THREE.Vector3(a.x + L.side * 0.1, WALL_Y + lift * 0.035, a.z + sw);
          setSeg(L.seg[0], a, mid); setSeg(L.seg[1], mid, tip); { const p = L.bl.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, mid.x, mid.y, mid.z); p.setXYZ(2, tip.x, tip.y, tip.z); p.needsUpdate = true; }
          const wt = body.localToWorld(tip.clone()), down = lift < 0.05;
          if (C.xray > 0.01 && g.visible) { if (L.n >= 30) { L.trailP.copyWithin(0, 3); L.n = 29; } L.trailP.set([wt.x, wt.y, wt.z], L.n * 3); L.n++; L.trail.geometry.setDrawRange(0, L.n); L.trail.geometry.attributes.position.needsUpdate = true; } else { L.n = 0; L.trail.geometry.setDrawRange(0, 0); }
          if (down && !L.down && climbing && C.xray > 0.01) { const f = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 1, depthTest: false })); f.renderOrder = 12; f.position.copy(wt); scene.add(f); flashes.push({ m: f, t: 0 }); } L.down = down; }
        claws.forEach((c, i) => { c.rotation.y = Math.sin(C.t * 3 + i) * 0.3; });
        for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; f.m.scale.setScalar(1 + f.t * 6); f.m.material.opacity = Math.max(0, 1 - f.t / 0.35); if (f.t > 0.35) { scene.remove(f.m); f.m.material.dispose(); flashes.splice(i, 1); } }
        shell.opacity = 1 - 0.65 * C.xray; boneM.opacity = C.xray; };
      C.observe = on => { C.slow = on ? 0.35 : 1; C.xray += ((on ? 1 : 0) - C.xray) * 0.15; };
      return C; })();
    // ある場所の地面の高さ（その高さ y より下にある一番高い面）
    function groundAt(x, z, y) { let g = 0; for (const b of boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.top <= y && b.top > g) g = b.top; return g; }
    return { beach, boxes, groundAt, strike, fruitNear, crush, drop, tick, fruits, swing, interests, crab, crabRock }; }
  return { create };
})();
