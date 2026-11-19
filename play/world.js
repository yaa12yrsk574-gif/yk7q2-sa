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
    // ある場所の地面の高さ（その高さ y より下にある一番高い面）
    function groundAt(x, z, y) { let g = 0; for (const b of boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.top <= y && b.top > g) g = b.top; return g; }
    return { boxes, groundAt }; }
  return { create };
})();
