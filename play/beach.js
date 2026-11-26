// ---- 浜：スタート地点の後ろ（+z）。砂浜・海（寄せては返す波）・浜の端の家と道・横切る小ガニ・親子のカメ・光のかけら ----
// 浜〜草原は、ペンギンが自分の足で来たいつもの場所（段差なし・いつでも帰れる）。海は浅瀬まで泳げる
window.PlayBeach = (() => {
  const SHORE = 12, SAND0 = 4.5, SWIM_MAX = SHORE + 7; /* 波打ち際の基準／砂浜の始まり／泳げる沖の限界 */
  // 海の底の深さ（波打ち際から沖へだんだん深くなる）。0 より上は砂の上
  const floorAt = z => z <= SHORE ? 0 : -Math.min(1.2, (z - SHORE) * 0.28);

  function create(scene, boxes) {
    const B = { SHORE, SAND0, SWIM_MAX, floorAt, t: 0, surgeA: 0 };
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1 }, o || {}));
    // 砂浜（波打ち際の手前は湿って濃い）
    { const s = new THREE.Mesh(new THREE.PlaneGeometry(90, SHORE - SAND0 + 0.6), mat(0xead7a8)); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.006, (SAND0 + SHORE + 0.6) / 2); scene.add(s);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(90, 1.6), mat(0xcdb784)); w.rotation.x = -Math.PI / 2; w.position.set(0, 0.008, SHORE - 0.5); scene.add(w);
      /* 草原との境目は少しギザギザ */ for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.9, 7), mat(0xead7a8)); p.rotation.x = -Math.PI / 2; p.position.set(-40 + i * 2 + Math.random(), 0.005, SAND0 + (Math.random() - 0.3) * 0.6); scene.add(p); }
      const sl = Math.atan(0.28), L = 4.3 / Math.cos(sl), sea0 = new THREE.Mesh(new THREE.PlaneGeometry(90, L), mat(0xc2ab78)); sea0.rotation.x = -Math.PI / 2 + sl; sea0.position.set(0, -0.61, SHORE + 2.15); scene.add(sea0); /* 海の底：波打ち際から沖へ下がる */
      const deep = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), mat(0x9c8c66)); deep.rotation.x = -Math.PI / 2; deep.position.set(0, -1.21, SHORE + 4.3 + 60); scene.add(deep); }
    // 海：前のふちが寄せては返す。ふちに白い泡
    const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({ color: 0x5cb6d2, roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.72, depthWrite: false })); water.rotation.x = -Math.PI / 2; water.renderOrder = 3; scene.add(water);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.35), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })); foam.rotation.x = -Math.PI / 2; foam.renderOrder = 4; scene.add(foam);
    B.waterZ = () => SHORE - 0.35 * Math.sin(B.t * 0.9) - B.surgeA * 1.6; /* 今の波のふち */
    B.surge = a => { B.surgeA = Math.max(B.surgeA, a || 1); }; /* 大きい波が来る */
    B.inSea = (z) => z > B.waterZ();
    // 浜の端の家と、そこから草原へ続く道（ペンギンが来たいつもの場所）
    { const hx = -12, hz = 7.6, wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.0), mat(0xf2e6cf, { flatShading: true })); wall.position.set(hx, 0.8, hz); scene.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.1, 4), mat(0xc7643c, { flatShading: true })); roof.rotation.y = Math.PI / 4; roof.position.set(hx, 2.15, hz); roof.scale.set(1, 1, 0.85); scene.add(roof);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), mat(0x7a5a3a)); door.position.set(hx + 1.21, 0.45, hz); door.rotation.y = Math.PI / 2; scene.add(door);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.4), mat(0x9fd3e8)); win.position.set(hx, 1.0, hz - 1.01); win.rotation.y = Math.PI; scene.add(win);
      boxes.push({ x0: hx - 1.2, x1: hx + 1.2, z0: hz - 1.0, z1: hz + 1.0, top: 1.6, x: hx, z: hz, house: true });
      const pm = mat(0xd2b98a); const pts = [[hx + 1.3, hz], [-8.5, 6.6], [-6.5, 4.6], [-5.6, 2.2], [-5.8, -0.5]];
      for (const [px, pz] of pts) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10), pm); c.rotation.x = -Math.PI / 2; c.position.set(px, 0.0095, pz); scene.add(c); } /* つなぎ目を丸く */
      for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az), m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, l), pm); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(bx - ax, bz - az); m.position.set((ax + bx) / 2, 0.009, (az + bz) / 2); scene.add(m); }
      /* 流木と貝がら */ const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), mat(0xb39a7a, { flatShading: true })); wood.rotation.set(0, 0.7, Math.PI / 2); wood.position.set(5.5, 0.08, 10.2); scene.add(wood); }
    const shells = []; for (const [x, z, c] of [[-3.2, 10.4, 0xffd9e0], [6.4, 8.8, 0xfff2d6]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.05, 7), mat(c, { flatShading: true })); m.rotation.x = Math.PI; m.position.set(x, 0.03, z); scene.add(m); shells.push({ kind: 'stone', x, z, g: m }); }
    B.interests = shells;

    // ---- 小ガニ：浜を横向きにちょこちょこ横切る（1つ目の願いの伏線）。go() で目の前を通らせる ----
    const crab = (() => { const g = new THREE.Group(), sh = mat(0xe86a3a, { flatShading: true, roughness: 0.6 }); scene.add(g); g.visible = false;
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), sh); b.scale.set(0.07, 0.03, 0.055); b.position.y = 0.05; g.add(b);
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 5, 4), mat(0x222222)); e.position.set(sx * 0.02, 0.085, 0.045); g.add(e); const c = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), sh); c.scale.set(0.02, 0.013, 0.028); c.position.set(sx * 0.045, 0.05, 0.075); g.add(c); }
      const legs = []; for (let i = 0; i < 6; i++) { const sx = i < 3 ? -1 : 1, k = i % 3, m = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.07, 4), sh); m.position.set(sx * 0.075, 0.03, 0.025 - k * 0.025); m.rotation.z = sx * 1.0; g.add(m); legs.push({ m, sx, k }); }
      const C = { g, x: 0, z: 0, st: 'off', t: 0, dir: 1, x1: 0, wait: 0 };
      C.go = (x0, x1, z) => { C.x = x0; C.x1 = x1; C.z = z; C.dir = Math.sign(x1 - x0) || 1; C.st = 'walk'; g.visible = true; };
      C.tick = dt => { C.t += dt; if (C.st === 'walk') { const step = Math.sin(C.t * 14) > 0 ? 1.1 : 0.25; /* ちょこちょこ止まりながら */ C.x += C.dir * 1.0 * step * dt; if ((C.x1 - C.x) * C.dir <= 0) { C.st = 'off'; g.visible = false; C.wait = 9; } }
        else if (C.st === 'off' && C.auto) { C.wait -= dt; if (C.wait <= 0) { const d = Math.random() < 0.5 ? 1 : -1; C.go(-8 * d, 8 * d, SHORE - 1.2 - Math.random() * 1.5); } }
        g.position.set(C.x, 0, C.z); g.rotation.y = 0; /* 体は前（海）を向いたまま横歩き */ for (const L of legs) L.m.rotation.x = Math.sin(C.t * 22 + L.k * 2 + (L.sx > 0 ? Math.PI : 0)) * 0.5; };
      return C; })();
    B.crab = crab;

    // ---- 光のかけら：浅瀬に漂う、プルプルのふるさとのかけら（＝プルプル成分）----
    const frags = [], fragMat = new THREE.MeshStandardMaterial({ color: 0xbff3ff, emissive: 0x3fb8d8, emissiveIntensity: 1.2, roughness: 0.2, transparent: true, opacity: 0.9, flatShading: true });
    for (const [x, z] of [[-2.2, SHORE + 2.6], [0.6, SHORE + 3.4], [3.4, SHORE + 2.4], [-0.8, SHORE + 5.0], [2.2, SHORE + 5.6], [4.6, SHORE + 4.4]]) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), fragMat); m.visible = false; scene.add(m); frags.push({ m, x, z, st: 'off', t: Math.random() * 6 }); }
    B.frags = frags;
    B.showFrags = () => frags.forEach(f => { if (f.st === 'off') { f.st = 'float'; f.m.visible = true; } });
    B.take = (f, to) => { f.st = 'fly'; f.to = to; f.k = 0; };

    // ---- 親子のカメ：子を背中に乗せて浜を歩く → 海へ入って浅瀬をゆっくり回る。観察の時は甲羅が透けて、踏ん張る脚が光る ----
    function turtleMesh(s) { const g = new THREE.Group(), shell = mat(0x6f8a4a, { flatShading: true, roughness: 0.8, transparent: true, opacity: 1 }), skin = mat(0xb9b07a, { flatShading: true });
      const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell); sh.scale.set(0.3 * s, 0.17 * s, 0.38 * s); sh.position.y = 0.06 * s; g.add(sh);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 7, 5), skin); head.position.set(0, 0.1 * s, 0.42 * s); g.add(head);
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 5, 4), mat(0x222222)); e.position.set(sx * 0.035 * s, 0.13 * s, 0.47 * s); g.add(e); }
      const legs = []; for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const p = new THREE.Group(); p.position.set(sx * 0.24 * s, 0.05 * s, sz * 0.22 * s); const m = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.06 * s, 0.09 * s), skin); m.position.set(sx * 0.04 * s, -0.02 * s, 0); p.add(m); g.add(p); legs.push({ p, m, sx, sz }); }
      return { g, shell, legs, head, s }; }
    const T = (() => { const P = turtleMesh(1.6), K = turtleMesh(0.62); K.shell.color.set(0xa6c46e); P.g.add(K.g); K.g.position.set(0, 0.25, -0.05); scene.add(P.g); P.g.visible = false;
      const flashes = [], fg = new THREE.SphereGeometry(0.05, 8, 6);
      const C = { x: -10, z: 9.3, yaw: Math.PI / 2, st: 'off', t: 0, ph: 0, xray: 0, slow: 1, a: 0, g: P.g };
      C.start = () => { if (C.st !== 'off') return; Object.assign(C, { x: -4.8, z: 10.2, yaw: Math.PI / 2, st: 'idle', t: 0, wi: 0 }); P.g.visible = true; }; /* 浜で休んでる → walk() で歩き出す */
      C.walk = () => { if (C.st === 'idle') C.st = 'walk'; };
      C.reset = () => { C.st = 'off'; P.g.visible = false; };
      // 道のり：浜を東へ → 海の方へ向き直る → 海に入る → 浅瀬をゆっくり回る
      const WP = [[-2.6, 10.5], [-1.2, SHORE - 0.1], [0.8, SHORE + 2.8]];
      C.tick = dt => { if (C.st === 'off') return; const k = dt * (C.st === 'idle' ? 0 : C.slow); C.t += k; P.head.position.z = 0.42 * 1.6 + (C.st === 'idle' ? 0.02 * Math.sin(B.t * 1.5) : 0);
        const swim = C.z > SHORE + 0.3, sp = swim ? 0.6 : 0.42;
        if (C.st === 'walk') { const w = WP[C.wi || 0], dx = w[0] - C.x, dz = w[1] - C.z, d = Math.hypot(dx, dz); const ty = Math.atan2(dx, dz); C.yaw += Math.atan2(Math.sin(ty - C.yaw), Math.cos(ty - C.yaw)) * Math.min(1, k * 2);
          C.x += Math.sin(C.yaw) * sp * k; C.z += Math.cos(C.yaw) * sp * k; if (d < 0.2) { C.wi = (C.wi || 0) + 1; if (C.wi >= WP.length) { C.st = 'circle'; C.a = 0; } } }
        else if (C.st === 'circle') { C.a += k * 0.25; const cx = 1.0, cz = SHORE + 4.2, R = 1.6, tx = cx + Math.sin(C.a) * R - Math.cos(C.a) * 0.01, tz = cz - Math.cos(C.a) * R; C.yaw = Math.atan2(tx - C.x, tz - C.z) || C.yaw; C.x = tx; C.z = tz; }
        const fl = B.floorAt(C.z), y = swim ? Math.max(fl, -0.12) + 0.03 * Math.sin(C.t * 2) : 0;
        P.g.position.set(C.x, y, C.z); P.g.rotation.y = C.yaw;
        // 脚：歩く時は1本ずつ踏ん張る（子を背負ってるのでゆっくり重い）、泳ぐ時はひれでかく
        const cyc = C.t * (swim ? 3 : 4.2); P.legs.forEach((L, i) => { const u = cyc + (i === 0 || i === 3 ? 0 : Math.PI); if (swim) { L.p.rotation.set(0, Math.sin(u) * 0.6 * L.sx, Math.sin(u) * 0.4 * L.sx); } else { const lift = Math.max(0, Math.sin(u)); L.p.rotation.set(Math.cos(u) * 0.35, 0, -L.sx * lift * 0.3); const down = lift < 0.05; if (down && !L.down && C.xray > 0.05) { const f = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, depthTest: false })); f.renderOrder = 12; L.m.getWorldPosition(f.position); f.position.y = 0.03; scene.add(f); flashes.push({ m: f, t: 0 }); } L.down = down; } L.m.material.emissive && L.m.material.emissive.setRGB(C.xray * 0.5 * Math.max(0, -Math.sin(u)), C.xray * 0.45 * Math.max(0, -Math.sin(u)), 0); });
        K.g.position.y = 0.25 + Math.abs(Math.sin(cyc)) * 0.012; K.g.rotation.z = Math.sin(cyc) * 0.05; K.legs.forEach((L, i) => L.p.rotation.x = Math.sin(C.t * 1.3 + i) * 0.15); /* 子は背中でゆらゆら */
        for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; f.m.scale.setScalar(1 + f.t * 6); f.m.material.opacity = Math.max(0, 1 - f.t / 0.4); if (f.t > 0.4) { scene.remove(f.m); f.m.material.dispose(); flashes.splice(i, 1); } }
        P.shell.opacity = 1 - 0.55 * C.xray; P.g.renderOrder = 5; };
      C.observe = on => { C.slow = on ? 0.75 : 1; C.xray += ((on ? 1 : 0) - C.xray) * 0.12; };
      return C; })();
    B.turtles = T;

    B.tick = dt => { B.t += dt; B.surgeA = Math.max(0, B.surgeA - dt * 0.45); const wz = B.waterZ(); water.position.set(0, 0.02, wz + 60); foam.position.set(0, 0.025, wz + 0.1); foam.material.opacity = 0.55 + 0.35 * Math.sin(B.t * 1.8);
      crab.tick(dt); T.tick(dt);
      for (const f of frags) { f.t += dt; if (f.st === 'float') { f.m.position.set(f.x + Math.sin(f.t * 0.7) * 0.15, 0.08 + 0.04 * Math.sin(f.t * 2.2), f.z + Math.cos(f.t * 0.5) * 0.15); f.m.rotation.y = f.t * 1.5; f.m.scale.setScalar(1 + 0.25 * Math.max(0, Math.sin(f.t * 3))); }
        else if (f.st === 'fly') { f.k += dt * 2.5; const to = f.to(); f.m.position.lerp(new THREE.Vector3(to[0], to[1], to[2]), Math.min(1, dt * 8)); f.m.scale.setScalar(Math.max(0.01, 1 - f.k)); if (f.k >= 1) { f.st = 'gone'; f.m.visible = false; } } } };
    B.resetStory = () => { T.reset(); crab.st = 'off'; crab.g.visible = false; crab.auto = false; frags.forEach(f => { f.st = 'off'; f.m.visible = false; f.m.scale.setScalar(1); }); };
    return B; }
  return { create, SHORE, floorAt };
})();
