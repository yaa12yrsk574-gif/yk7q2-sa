// ---- ペンギン（プレイヤー）の見た目：狩り場と草原で同じものを使う。ここを直せば両方変わる ----
// 足元が原点、+z が前。背の高さ H（m）。草原では 0.8m に縮めて使う
window.PenguinModel = (() => {
  const H = 1.51;
  function make(THREE) { const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }), g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.95, 10), mat(0x3b6ea8)); body.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(0xe9cfae)); head.position.y = 1.36;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), mat(0xd9572b)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.0, 0.24);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), mat(0x7a5a3a)); stick.position.set(0.28, 0.9, 0.15); stick.rotation.x = 0.4;
    g.add(body, head, nose, stick); return g; }
  return { H, make };
})();
