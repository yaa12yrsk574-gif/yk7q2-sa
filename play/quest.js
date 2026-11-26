// ---- 3つ目の願い〜エンディングの世界：鳥の崖と鳥・見えてるのに行けない場所（高い巣・海の底で光るもの）・沖のかけら・お別れのボート ----
window.PlayQuest = (() => {
  function create(scene, boxes, BE) { const SHORE = BE.SHORE, R = (a, b) => a + Math.random() * (b - a), Q = { t: 0 };
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, flatShading: true }, o || {}));
    const rockM = mat(0x8c8478);
    // 鳥の崖：草原の右奥。てっぺんに巣と鳥（3つ目の願いはここで見上げる）
    const CL = { x: 10, z: -12, top: 3.6 }; { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, CL.top, 7), rockM); m.position.set(CL.x, CL.top / 2, CL.z); scene.add(m); boxes.push({ x0: CL.x - 1.6, x1: CL.x + 1.6, z0: CL.z - 1.6, z1: CL.z + 1.6, top: CL.top, x: CL.x, z: CL.z, cliff: true });
      const nest = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 5, 10), mat(0x9a7a4e)); nest.rotation.x = Math.PI / 2; nest.position.set(CL.x, CL.top + 0.08, CL.z); scene.add(nest); }
    Q.cliff = CL;
    // 鳥：白くて大きい。巣で休んでる → takeoff() で飛び立って、ゆっくり大きく旋回して、巣に戻る
    const bird = (() => { const g = new THREE.Group(), wm = mat(0xf4f2ec, { side: THREE.DoubleSide }), body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), wm); body.scale.set(0.13, 0.12, 0.3); g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), wm); head.position.set(0, 0.08, 0.3); g.add(head); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), mat(0xe8a23a)); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.07, 0.42); g.add(bk);
      const wings = []; for (const sx of [-1, 1]) { const piv = new THREE.Group(), w = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.3), wm); w.geometry.translate(0.37, 0, 0); w.rotation.y = sx < 0 ? Math.PI : 0; piv.add(w); piv.position.y = 0.04; g.add(piv); wings.push({ piv, sx }); }
      scene.add(g); return { g, wings, st: 'nest', t: 0, x: CL.x, y: CL.top + 0.2, z: CL.z, yaw: 0, fold: 1 }; })();
    Q.bird = bird; bird.takeoff = () => { if (bird.st === 'nest') { bird.st = 'up'; bird.t = 0; } };
    // 見えてるのに行けない場所：海に突き出た高い岩のてっぺんの巣（今の体ではどう頑張っても届かない）
    { const sx = 17, sz = SHORE + 3.5, h = 7.5; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, h, 6), rockM); m.position.set(sx, h / 2 - 0.4, sz); scene.add(m); boxes.push({ x0: sx - 1.2, x1: sx + 1.2, z0: sz - 1.2, z1: sz + 1.2, top: h, x: sx, z: sz });
      const n = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.14, 5, 10), mat(0x9a7a4e)); n.rotation.x = Math.PI / 2; n.position.set(sx, h - 0.3, sz); scene.add(n); for (let i = 0; i < 3; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), mat(0xbfe0ff, { emissive: 0x3a7aa0, emissiveIntensity: 0.6 })); e.position.set(sx + R(-0.15, 0.15), h - 0.25, sz + R(-0.15, 0.15)); scene.add(e); } }
    // 海の底で光るもの（＝プルプルのふるさと）。深い所で、ゆっくり脈打つ
    const GL = { x: 4, z: SHORE + 15 }; const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0.9 })); glow.position.set(GL.x, -1.1, GL.z); scene.add(glow);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0.25, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.set(GL.x, 0.04, GL.z); halo.renderOrder = 7; scene.add(halo);
    Q.glowP = GL; Q.glowK = 1;
    // 沖のかけら（3段階目）：深い所に漂う
    Q.deep = []; const fm = new THREE.MeshStandardMaterial({ color: 0xbff3ff, emissive: 0x3fb8d8, emissiveIntensity: 1.4, roughness: 0.2, flatShading: true });
    for (const [x, z] of [[-3, SHORE + 8.5], [0.5, SHORE + 10], [3.5, SHORE + 8], [6.5, SHORE + 10.5], [2, SHORE + 12.5], [-1.5, SHORE + 12]]) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), fm); m.visible = false; scene.add(m); Q.deep.push({ m, x, z, st: 'off', t: R(0, 6) }); }
    Q.showDeep = () => Q.deep.forEach(f => { if (f.st === 'off') { f.st = 'float'; f.m.visible = true; } });
    // お別れのボート（エンディング）
    const boat = (() => { const g = new THREE.Group(), hull = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 10, 1, true, Math.PI / 2, Math.PI), mat(0xb5603c, { side: THREE.DoubleSide })); hull.rotation.x = Math.PI / 2; hull.rotation.z = Math.PI; hull.position.y = 0.1; hull.scale.set(1, 1, 0.7); g.add(hull);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.25), mat(0xd9c9a8)); seat.position.y = 0.08; g.add(seat); g.visible = false; scene.add(g); return g; })();
    Q.boat = boat;
    Q.reset = () => { bird.st = 'nest'; bird.t = 0; Q.deep.forEach(f => { f.st = 'off'; f.m.visible = false; f.m.scale.setScalar(1); }); boat.visible = false; Q.glowK = 1; };
    Q.tick = dt => { Q.t += dt; const t = Q.t;
      // 鳥
      const b = bird; b.t += dt; let flap = 0;
      if (b.st === 'nest') { b.x = CL.x; b.z = CL.z; b.y = CL.top + 0.2; b.yaw = Math.sin(t * 0.3) * 0.8; b.fold = 1; }
      else if (b.st === 'up') { const u = Math.min(1, b.t / 1.6); b.y = CL.top + 0.2 + u * 2.5; b.fold = 0; flap = 1; if (u >= 1) { b.st = 'circle'; b.t = 0; b.a0 = 0; } }
      else if (b.st === 'circle') { const a = b.t * 0.55, r = 7; b.x = CL.x - 7 + Math.cos(a) * r; b.z = CL.z + Math.sin(a) * r * 0.8; b.y = CL.top + 2.7 + Math.sin(a * 2) * 0.6; b.yaw = Math.atan2(-Math.sin(a), Math.cos(a) * 0.8); flap = Math.sin(b.t * 0.7) > 0.6 ? 1 : 0; if (b.t > 2 * Math.PI / 0.55 * 1.5) { b.st = 'home'; b.t = 0; b.h0 = [b.x, b.y, b.z]; } }
      else if (b.st === 'home') { const u = Math.min(1, b.t / 2.2), e = u * u * (3 - 2 * u); b.x = b.h0[0] + (CL.x - b.h0[0]) * e; b.z = b.h0[2] + (CL.z - b.h0[2]) * e; b.y = b.h0[1] + (CL.top + 0.2 - b.h0[1]) * e; b.yaw = Math.atan2(CL.x - b.h0[0], CL.z - b.h0[2]); flap = u > 0.7 ? 1 : 0; if (u >= 1) { b.st = 'nest'; } }
      b.g.position.set(b.x, b.y, b.z); b.g.rotation.y = b.yaw; const wa = b.fold > 0.5 ? -1.25 : flap ? Math.sin(t * 9) * 0.8 : 0.08; b.wings.forEach(w => { w.piv.rotation.z = w.sx * wa; w.piv.scale.setScalar(b.fold > 0.5 ? 0.45 : 1); });
      // 光るもの
      const k = 0.5 + 0.5 * Math.sin(t * 1.4); glow.scale.setScalar((0.9 + 0.2 * k) * Q.glowK); glow.material.opacity = 0.6 + 0.4 * k; halo.material.opacity = (0.12 + 0.18 * k) * Math.min(2, Q.glowK); halo.scale.setScalar(Q.glowK);
      for (const f of Q.deep) { f.t += dt; if (f.st === 'float') { f.m.position.set(f.x + Math.sin(f.t * 0.6) * 0.2, 0.08 + 0.05 * Math.sin(f.t * 2), f.z + Math.cos(f.t * 0.4) * 0.2); f.m.rotation.y = f.t * 1.4; }
        else if (f.st === 'fly') { f.k += dt * 2.5; const to = f.to(); f.m.position.lerp(new THREE.Vector3(to[0], to[1], to[2]), Math.min(1, dt * 8)); f.m.scale.setScalar(Math.max(0.01, 1 - f.k)); if (f.k >= 1) { f.st = 'gone'; f.m.visible = false; } } } };
    Q.take = (f, to) => { f.st = 'fly'; f.to = to; f.k = 0; };
    return Q; }
  return { create };
})();
