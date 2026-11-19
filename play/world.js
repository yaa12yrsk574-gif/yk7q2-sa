// ---- 草原：地面と段差。体がぶつかる箱（boxes）と、その場所の地面の高さ（groundAt）を出す ----
window.PlayWorld = (() => {
  function create(scene) {
    scene.background = new THREE.Color(0xcfe3e8); scene.fog = new THREE.Fog(0xcfe3e8, 30, 120);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa070, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(12, 20, 8); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0xa9c98a, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new THREE.GridHelper(160, 80, 0x98b87a, 0x98b87a); grid.position.y = 0.003; grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);
    // 草の点々（速さが分かるように）
    { const n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 140; pos[i * 3 + 1] = 0.04; pos[i * 3 + 2] = (Math.random() - 0.5) * 140; } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x6f9a55, size: 0.12 }))); }
    const boxes = [], rockMat = new THREE.MeshStandardMaterial({ color: 0xb59a78, roughness: 0.95, flatShading: true }), topMat = new THREE.MeshStandardMaterial({ color: 0x9cc07c, roughness: 1 });
    function box(x, z, w, d, top, label) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, top, d), rockMat); m.position.set(x, top / 2, z); scene.add(m);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(w, d), topMat); t.rotation.x = -Math.PI / 2; t.position.set(x, top + 0.004, z); scene.add(t);
      const b = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top, label, x, z }; boxes.push(b); return b; }
    // 前に段々：0.6 → 1.2 → 1.75（崖と同じ）→ 2.5。横に低い岩がいくつか
    box(0, -7, 4, 3, 0.6, '0.6m'); box(0, -11, 4, 3, 1.2, '1.2m'); box(0, -15, 4, 3, 1.75, '1.75m'); box(0, -19.5, 5, 4, 2.5, '2.5m');
    box(-7, -4, 2.2, 2.2, 0.35); box(-9, -9, 2.6, 2.6, 0.9); box(7, -5, 3, 2, 0.5); box(9, -10, 2.4, 2.4, 1.4);
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
    function tick(dt) { for (const c of vineG.children) if (c.userData.fall) { c.rotation.x += dt * 2.5; c.position.y -= dt * 1.5; c.scale.multiplyScalar(1 - dt * 0.8); if (c.position.y < -1) { c.visible = false; c.userData.fall = 0; } }
      if (vineG.userData.shake > 0) { vineG.userData.shake -= dt; vineG.position.x = Math.sin(vineG.userData.shake * 60) * 0.04 * vineG.userData.shake; }
      for (const f of fruits) if (f.st === 'gone') { f.t -= dt; if (f.t <= 0) { if (f.splat) { scene.remove(f.splat); f.splat = null; } f.st = 'ground'; f.m.visible = true; f.m.position.set(f.home[0], 0.17, f.home[1]); } } }
    // ある場所の地面の高さ（その高さ y より下にある一番高い面）
    function groundAt(x, z, y) { let g = 0; for (const b of boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.top <= y && b.top > g) g = b.top; return g; }
    return { boxes, groundAt, strike, fruitNear, crush, drop, tick, fruits }; }
  return { create };
})();
