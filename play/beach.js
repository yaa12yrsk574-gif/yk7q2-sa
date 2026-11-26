// ---- 浜：スタート地点の後ろ（+z）。砂浜・海（寄せては返す波）・浜の端の家と道・横切る小ガニ・親子のカメ・光のかけら ----
// 浜〜草原は、ペンギンが自分の足で来たいつもの場所（段差なし・いつでも帰れる）。海は浅瀬まで泳げる
window.PlayBeach = (() => {
  const SHORE = 12, SAND0 = 4.5, SWIM_MAX = SHORE + 7; /* 波打ち際の基準／砂浜の始まり／泳げる沖の限界 */
  // 海の底の深さ（波打ち際から沖へだんだん深くなる）。0 より上は砂の上
  const floorAt = z => z <= SHORE ? 0 : -Math.min(1.2, (z - SHORE) * 0.28);

  // ---- 浜のディテール：入り江の岩場・潮だまり（小魚とヤドカリ）・打ち上げの線・家の網とボート・巣穴の小ガニ・カモメ・跳ねる魚・足跡 ----
  function makeExtras(scene, boxes, B, mat) { const R = (a, b) => a + Math.random() * (b - a), X = { t: 0 };
    const rockM = [mat(0x8d8478, { flatShading: true }), mat(0x9a9184, { flatShading: true }), mat(0x7b746a, { flatShading: true })];
    function rock(x, z, s, h, sq) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockM[Math.floor(Math.random() * 3)]); m.scale.set(1, h, sq || 1); m.rotation.set(R(0, 3), R(0, 3), R(0, 3)); m.position.set(x, s * h * 0.45, z); scene.add(m); return m; }
    // 入り江：両端に岩場（浜から海へ突き出す）。西の岩は家の向こう、東の岩場には潮だまり
    const cape = (x0, dir) => { for (let i = 0; i < 16; i++) { const u = i / 15, z = SHORE - 6 + u * 13, x = x0 + dir * (R(-0.8, 1.6) - Math.pow(u, 1.6) * 6.5), /* 沖へ行くほど内側へ回り込む（入り江） */ s = R(0.7, 1.5) * (1.1 - u * 0.4); rock(x, z, s, R(0.7, 1.3), R(0.8, 1.2)); if (z < SHORE + 0.5) boxes.push({ x0: x - s * 0.8, x1: x + s * 0.8, z0: z - s * 0.8, z1: z + s * 0.8, top: s * 1.2, x, z, rock: true }); } };
    cape(-17.5, -1); cape(14.5, 1);
    // 沖の小島：見えてるのに行けない場所（エンディング前の体ではどう頑張っても届かない）
    { const ix = -5, iz = SHORE + 26; for (let i = 0; i < 7; i++) rock(ix + R(-2.5, 2.5), iz + R(-1.5, 1.5), R(1.2, 2.4), R(0.6, 1.1)); const top = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7fa35a, { flatShading: true })); top.scale.set(1.2, 0.55, 1); top.position.set(ix, 1.6, iz); scene.add(top);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 6), mat(0x8a6a48, { flatShading: true })); tr.position.set(ix + 0.6, 3.1, iz); tr.rotation.z = 0.15; scene.add(tr); const lv = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat(0x5f8f45, { flatShading: true })); lv.scale.set(1.3, 0.6, 1.3); lv.position.set(ix + 0.85, 4.3, iz); scene.add(lv); }
    // 潮だまり（東の岩場の手前）：低い岩で囲んだ小さい水たまりに、小魚とヤドカリ
    const TP = { x: 11.2, z: SHORE - 1.3, r: 1.1 }; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; rock(TP.x + Math.cos(a) * (TP.r + 0.25), TP.z + Math.sin(a) * (TP.r + 0.2), R(0.22, 0.4), 0.6); }
    { const p = new THREE.Mesh(new THREE.CircleGeometry(TP.r, 18), new THREE.MeshStandardMaterial({ color: 0x6fc8d4, roughness: 0.2, transparent: true, opacity: 0.8 })); p.rotation.x = -Math.PI / 2; p.position.set(TP.x, 0.03, TP.z); scene.add(p); }
    const fish = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 5), mat(i ? 0xf2a640 : 0xf26a5a, { flatShading: true })); m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); scene.add(g); fish.push({ g, a: R(0, 6), r: R(0.3, 0.8), sp: R(0.4, 0.9) * (i % 2 ? 1 : -1) }); }
    const hermit = (() => { const g = new THREE.Group(), sh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 7), mat(0xe8c9a8, { flatShading: true })); sh.rotation.x = -Math.PI / 2.4; sh.position.set(0, 0.05, -0.02); g.add(sh); const legs = []; for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.05, 4), mat(0xd9603a)); l.position.set((i % 2 ? 1 : -1) * 0.03, 0.02, 0.03 - Math.floor(i / 2) * 0.02); l.rotation.z = (i % 2 ? -1 : 1) * 0.9; g.add(l); legs.push(l); } scene.add(g); return { g, legs, a: 0 }; })();
    // 打ち上げの線：海藻と貝がら
    const weedM = mat(0x4f6b3a, { flatShading: true }); for (let i = 0; i < 46; i++) { const x = R(-14, 12), z = SHORE - 1.5 + Math.sin(x * 0.5) * 0.25 + R(-0.2, 0.2), m = new THREE.Mesh(new THREE.CircleGeometry(R(0.06, 0.16), 5), weedM); m.rotation.set(-Math.PI / 2, 0, R(0, 6)); m.scale.set(1, R(0.3, 0.7), 1); m.position.set(x, 0.012, z); scene.add(m); }
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(R(0.025, 0.045), 0.03, 6), mat([0xfff1e0, 0xf7c9c9, 0xe9d7b5][i % 3], { flatShading: true })); m.rotation.x = Math.PI; m.position.set(R(-13, 11), 0.018, SHORE - R(1.0, 2.6)); scene.add(m); }
    // 家の暮らし：干してある網と、浜に引き上げたボート（エンディングで1人で帰るボート）
    { const pm = mat(0x8a6a48, { flatShading: true }); for (const px of [-9.6, -7.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), pm); p.position.set(px, 0.75, 6.4); scene.add(p); }
      const ng = new THREE.BufferGeometry(), v = []; for (let i = 0; i <= 10; i++) { const x = -9.6 + i * 0.2, sag = 0.18 * Math.sin(i / 10 * Math.PI); v.push(x, 1.42 - sag, 6.4, x, 0.55 - sag * 0.6, 6.42); } for (let j = 0; j <= 6; j++) { const y = 1.42 - j * 0.145; for (let i = 0; i < 10; i++) { const x0 = -9.6 + i * 0.2, s0 = Math.sin(i / 10 * Math.PI), s1 = Math.sin((i + 1) / 10 * Math.PI), d = 0.18 - j * 0.02; v.push(x0, y - d * s0, 6.41, x0 + 0.2, y - d * s1, 6.41); } }
      ng.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); scene.add(new THREE.LineSegments(ng, new THREE.LineBasicMaterial({ color: 0x6b6b5c })));
      boxes.push({ x0: -9.7, x1: -7.5, z0: 6.3, z1: 6.5, top: 1.5, x: -8.6, z: 6.4 }); }
    { const g = new THREE.Group(), hull = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.9, 10, 1, true, Math.PI / 2, Math.PI), mat(0xb5603c, { flatShading: true, side: THREE.DoubleSide })); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.75); hull.position.y = 0.33; g.add(hull);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 1.9), mat(0xe8dcc4)); rim.position.y = 0.33; rim.scale.set(1, 1, 1); g.add(rim); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.22), mat(0xd9c9a8)); seat.position.y = 0.26; g.add(seat);
      const oar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 1.5), mat(0xc9a877)); oar.position.set(0.7, 0.03, 0.1); oar.rotation.y = 0.25; g.add(oar);
      g.position.set(-6.6, -0.02, 9.6); g.rotation.set(0, 0.5, 0.12); scene.add(g); boxes.push({ x0: -7.3, x1: -5.9, z0: 8.8, z1: 10.4, top: 0.5, x: -6.6, z: 9.6 }); }
    // 巣穴の小ガニ：穴から出て、ちょこちょこ歩いて、ペンギンが近づくと穴に逃げ込む
    const cg = (() => { const sh = mat(0xe8703e, { flatShading: true, roughness: 0.6 }); return () => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 4), sh); b.scale.set(0.05, 0.022, 0.04); b.position.y = 0.035; g.add(b); for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(1, 5, 3), sh); c.scale.set(0.015, 0.01, 0.02); c.position.set(sx * 0.035, 0.035, 0.05); g.add(c); const e = new THREE.Mesh(new THREE.SphereGeometry(0.007, 4, 3), mat(0x222222)); e.position.set(sx * 0.015, 0.06, 0.035); g.add(e); } scene.add(g); return g; }; })();
    const holeM = mat(0x8a7350); const burrows = [[-4.5, 8.2], [2.8, 7.4], [7.6, 9.6], [-1.6, 6.6]].map(([x, z]) => { const h = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), holeM); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.02, z); scene.add(h); return { hx: x, hz: z, g: cg(), x, z, st: 'in', t: R(0, 4), tx: x, tz: z }; });
    // カモメ：沖の空をゆっくり回る
    const gulls = []; for (let i = 0; i < 3; i++) { const g = new THREE.Group(), wm = mat(0xf7f7f2, { side: THREE.DoubleSide }), body = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), wm); body.scale.set(0.06, 0.05, 0.16); g.add(body); const wings = []; for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), wm); w.geometry.translate(0.21, 0, 0); w.rotation.y = sx < 0 ? Math.PI : 0; const piv = new THREE.Group(); piv.add(w); g.add(piv); wings.push({ piv, sx }); } scene.add(g); gulls.push({ g, wings, a: R(0, 6), r: R(6, 11), h: R(5, 8), cx: R(-6, 6), cz: SHORE + R(6, 12), sp: R(0.12, 0.2) * (i % 2 ? 1 : -1) }); }
    // 跳ねる魚：沖でときどき、ぴょんと弧を描いて、ぽちゃん
    const jf = { m: new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), mat(0xc9d8e0, { flatShading: true })), ring: new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })), t: -R(4, 9) }; jf.ring.rotation.x = -Math.PI / 2; jf.ring.renderOrder = 6; scene.add(jf.m, jf.ring); jf.m.visible = false;
    // 足跡：砂の上を歩くと残る（ペンギン＝左右の小さい足、プルプル＝丸いぺたっ）。波が来たら消える
    const PN = 160, prints = [], pm1 = new THREE.CircleGeometry(1, 8); for (let i = 0; i < PN; i++) { const m = new THREE.Mesh(pm1, new THREE.MeshBasicMaterial({ color: 0x9c8660, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; scene.add(m); prints.push({ m, a: 0 }); } let pi = 0; const last = {};
    function stamp(x, z, yaw, sx, sz, op) { const p = prints[pi = (pi + 1) % PN]; p.m.position.set(x, 0.06, z); p.m.scale.set(sx, sz, 1); p.m.rotation.z = -yaw; p.a = op; p.m.material.opacity = op; p.m.visible = true; }
    X.track = (who, x, z, k) => { if (who === 'pen') B.penP = [x, z]; if (z < SAND0 + 0.3 || z > B.waterZ() - 0.1) { last[who] = null; return; } const L = last[who]; if (!L) { last[who] = { x, z, n: 0 }; return; } const d = Math.hypot(x - L.x, z - L.z), step = who === 'pen' ? 0.17 : 0.22 * (k || 1); if (d < step) return; const yaw = Math.atan2(x - L.x, z - L.z);
      if (who === 'pen') { L.n++; const sd = (L.n % 2 ? 1 : -1) * 0.07, px = x + Math.cos(yaw) * sd, pz = z - Math.sin(yaw) * sd; stamp(px, pz, yaw, 0.045, 0.07, 0.5); } else stamp(x, z, yaw, 0.11 * (k || 1), 0.13 * (k || 1), 0.32); L.x = x; L.z = z; };
    X.clearPrints = () => { for (const p of prints) { p.a = 0; p.m.visible = false; } };
    X.tick = dt => { X.t += dt; const t = X.t, wz = B.waterZ();
      for (const f of fish) { f.a += f.sp * dt; f.g.position.set(TP.x + Math.cos(f.a) * f.r, 0.025, TP.z + Math.sin(f.a) * f.r * 0.8); f.g.rotation.y = -f.a + (f.sp > 0 ? 0 : Math.PI); }
      hermit.a += dt * 0.12; const ha = Math.sin(hermit.a) * 1.4; hermit.g.position.set(TP.x + 1.6 + Math.cos(ha) * 0.5, 0, TP.z - 0.9 + Math.sin(ha) * 0.3); hermit.g.rotation.y = ha + Math.PI / 2; hermit.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 9 + i) * 0.4);
      const pen = B.penP; for (const c of burrows) { c.t -= dt; const near = pen && Math.hypot(pen[0] - c.x, pen[1] - c.z) < 2.0;
        if (c.st === 'in') { c.g.visible = false; if (c.t <= 0 && !(pen && Math.hypot(pen[0] - c.hx, pen[1] - c.hz) < 3)) { c.st = 'out'; c.x = c.hx; c.z = c.hz; c.t = R(5, 10); c.tx = c.hx + R(-1, 1); c.tz = c.hz + R(-0.6, 0.6); } }
        else { c.g.visible = true; const flee = near || c.t <= 0, tx = flee ? c.hx : c.tx, tz = flee ? c.hz : c.tz, dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz), sp = (flee ? 1.6 : 0.5) * (Math.sin(t * 13 + c.hx) > -0.3 ? 1 : 0.1);
          if (d > 0.03) { c.x += dx / d * Math.min(d, sp * dt); c.z += dz / d * Math.min(d, sp * dt); } else if (flee) { c.st = 'in'; c.t = R(3, 7); } else { c.tx = c.hx + R(-1.2, 1.2); c.tz = c.hz + R(-0.7, 0.7); }
          c.g.position.set(c.x, 0.01, c.z); c.g.rotation.y = Math.atan2(dz, dx) * 0 + (c.hx * 3) % 6; } }
      for (const g of gulls) { g.a += g.sp * dt; g.g.position.set(g.cx + Math.cos(g.a) * g.r, g.h + Math.sin(g.a * 2) * 0.4, g.cz + Math.sin(g.a) * g.r * 0.6); g.g.rotation.y = -g.a + (g.sp > 0 ? Math.PI : 0); const fl = Math.sin(t * 6 + g.cx) * 0.6; g.wings.forEach(w => w.piv.rotation.z = w.sx * fl); }
      jf.t += dt; if (jf.t >= 0) { if (!jf.p) jf.p = { x: R(-8, 8), z: SHORE + R(7, 16), d: R(0, 6) }; const u = jf.t / 0.9; if (u <= 1) { jf.m.visible = true; const dx = Math.sin(jf.p.d), dz = Math.cos(jf.p.d); jf.m.position.set(jf.p.x + dx * u * 1.2, Math.sin(u * Math.PI) * 0.7, jf.p.z + dz * u * 1.2); jf.m.rotation.set(Math.PI / 2 - (u - 0.5) * 2.4, jf.p.d, 0); if (u > 0.92 && !jf.sp) { jf.sp = 1; jf.ring.position.set(jf.p.x + dx * 1.2, 0.04, jf.p.z + dz * 1.2); jf.rt = 0; } } else { jf.m.visible = false; jf.t = -R(5, 11); jf.p = null; jf.sp = 0; } }
      if (jf.rt != null) { jf.rt += dt; jf.ring.scale.setScalar(1 + jf.rt * 4); jf.ring.material.opacity = Math.max(0, 0.8 - jf.rt); if (jf.rt > 1) jf.rt = null; }
      for (const p of prints) if (p.m.visible) { p.a -= dt * (p.m.position.z > wz - 0.2 ? 1.5 : 0.006); p.m.material.opacity = Math.max(0, p.a); if (p.a <= 0) p.m.visible = false; } };
    return X; }

  // ---- 波の線：点のキラキラはやめて、白いか細い線で描く（アニメの海）----
  //   ・海岸と平行な短い弧が、にゅっと伸びて、岸へ流されて、細くなって消える。沖は短くまばら、手前ほど長く密に
  //   ・寄せる波に合わせて、何本かがまとまって岸へ流れてくる（波の列）
  //   ・太陽の方向だけ、細かい横線が多い（光の道）
  //   ・波打ち際は、ギザギザした細い白線が寄せては返す（2本：いま寄せてる線と、引いていく名残り）
  function makeWaveLines(scene, B) { const SHORE = B.SHORE, N = 150, SEG = 6, R = (a, b) => a + Math.random() * (b - a);
    const nv = N * (SEG + 1) * 2, pos = new Float32Array(nv * 3), idx = []; for (let k = 0; k < N; k++) for (let i = 0; i < SEG; i++) { const a = (k * (SEG + 1) + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); mesh.renderOrder = 6; mesh.frustumCulled = false; scene.add(mesh);
    const S = []; for (let k = 0; k < N; k++) S.push({ live: false });
    const SUN = Math.atan2(12, 8); /* 太陽の向き（world の光と同じ） */
    function spawn(x, z, kind) { const st = S.find(q => !q.live); if (!st) return; const dist = Math.max(0, z - SHORE), near = Math.max(0, 1 - dist / 22);
      Object.assign(st, { live: true, x, z, age: 0, life: kind === 'sun' ? R(0.5, 1.1) : R(1.6, 3.2), L: kind === 'sun' ? R(0.15, 0.45) : R(0.35, 0.6) + near * R(0.8, 1.8), W: kind === 'sun' ? 0.018 : 0.02 + near * 0.012, bend: R(0.04, 0.12) * (Math.random() < 0.8 ? 1 : -1), v: kind === 'sun' ? 0.1 : R(0.25, 0.6) * (0.4 + near), tilt: R(-0.12, 0.12) }); }
    const bands = []; let bandT = 1.5, cam = null;
    function camXZ() { const c = B.cam; return c ? [c.position.x, c.position.z] : [0, SHORE - 6]; }
    // 波打ち際の2本の線
    const SX = 180, sp = [new Float32Array((SX + 1) * 2 * 3), new Float32Array((SX + 1) * 2 * 3)], si = []; for (let i = 0; i < SX; i++) { const a = i * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const shore = sp.map((arr, n) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.setIndex(si); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: n ? 0.45 : 0.9, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 6; m.frustumCulled = false; scene.add(m); return { g, arr, m }; });
    let back = SHORE, t = 0;
    function tick(dt, wz) { t += dt; const [cx, cz] = camXZ();
      // 波の列：寄せる波のたびに、沖から岸へ帯が流れてくる。帯の上に線がまとまって生まれる
      bandT -= dt; if (bandT <= 0) { bandT = R(2.2, 3.6); bands.push({ z: SHORE + R(9, 14), v: R(0.9, 1.3), n: 0 }); }
      for (let i = bands.length - 1; i >= 0; i--) { const b = bands[i]; b.z -= b.v * dt; b.n += dt * 9; while (b.n >= 1) { b.n--; spawn(cx + R(-14, 14), b.z + R(-0.3, 0.3), 'band'); } if (b.z < wz + 0.6) bands.splice(i, 1); }
      // まばらな線（沖ほど少ない）と、太陽の方向の光の道
      if (Math.random() < dt * 14) { const r = Math.random(), z = wz + 0.8 + 26 * r * r; spawn(cx + R(-16, 16), z, 'free'); }
      if (Math.random() < dt * 22) { const d = R(3, 28), z = cz + Math.cos(SUN) * d, x = cx + Math.sin(SUN) * d + R(-1.2, 1.2) * (0.4 + d * 0.06); if (z > wz + 0.6) spawn(x, z, 'sun'); }
      const y = 0.035 + 0.012 * Math.sin(B.t * 0.8);
      for (let k = 0; k < N; k++) { const q = S[k], base = k * (SEG + 1) * 2 * 3; if (q.live) { q.age += dt; q.z -= q.v * dt; if (q.age > q.life || q.z < wz + 0.3) q.live = false; }
        for (let i = 0; i <= SEG; i++) { const o = base + i * 6; if (!q.live) { pos[o + 1] = pos[o + 4] = -9; continue; } const a = q.age / q.life, grow = Math.min(1, a / 0.3), fade = a < 0.6 ? 1 : 1 - (a - 0.6) / 0.4, u = i / SEG, s = (u - 0.5) * q.L * (0.35 + 0.65 * grow);
          const x = q.x + s * Math.cos(q.tilt), z = q.z + s * Math.sin(q.tilt) + q.bend * (1 - (2 * u - 1) * (2 * u - 1)) * q.L * 0.3, w = q.W * Math.pow(Math.sin(Math.PI * u), 0.8) * fade * (0.6 + 0.4 * grow);
          pos[o] = x; pos[o + 1] = y; pos[o + 2] = z - w; pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = z + w; } }
      geo.attributes.position.needsUpdate = true;
      // 波打ち際：寄せてる線は波のふちにぴったり、名残りの線は引いた所にゆっくり残って薄れる
      if (wz < back) back = wz; else back = Math.min(wz, back + dt * 0.18); const backZ = back, gap = Math.max(0, Math.min(1, (wz - back) / 0.5)); /* 名残り：一番寄せた所に残って、ゆっくり引いていく */
      shore.forEach((S2, n) => { const arr = S2.arr, z0 = n ? backZ : wz + 0.04, W = n ? 0.012 : 0.022; for (let i = 0; i <= SX; i++) { const x = cx - 45 + i * 0.5, jag = 0.06 * Math.sin(x * 2.3 + t * (n ? 0.4 : 1.1)) + 0.04 * Math.sin(x * 5.7 - t * 0.8) + 0.03 * Math.sin(x * 11.3 + n * 2), w = W * (0.55 + 0.45 * Math.sin(x * 3.1 + t * 0.6 + n)), o = i * 6, z = z0 + jag;
          arr[o] = x; arr[o + 1] = y - 0.003; arr[o + 2] = z - w; arr[o + 3] = x; arr[o + 4] = y - 0.003; arr[o + 5] = z + w; } S2.g.attributes.position.needsUpdate = true; S2.m.material.opacity = n ? 0.5 * gap : 0.9; }); }
    return { tick }; }
  function create(scene, boxes) {
    const B = { SHORE, SAND0, SWIM_MAX, floorAt, t: 0, surgeA: 0 };
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1 }, o || {}));
    // 砂浜（波打ち際の手前は湿って濃い）
    { const SAND = new THREE.Color(0xead7a8), sg = new THREE.PlaneGeometry(90, SHORE - SAND0 + 0.6, 90, 16), sp = sg.attributes.position, sc = []; /* 砂はゆるく波打つ（波打ち際は平ら）。色も少しムラ */
      for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), z = (SAND0 + SHORE + 0.6) / 2 - sp.getY(i), far = Math.max(0, Math.min(1, (SHORE - 1.2 - z) / 3)), h = far * (0.025 * (Math.sin(x * 0.7 + z * 1.3) + 1) + 0.02 * (Math.sin(x * 0.23 - z * 0.5) + 1)); sp.setZ(i, h); const k = 0.95 + 0.05 * Math.sin(x * 1.7 + z * 2.3) * Math.sin(x * 0.4), wet = Math.max(0, Math.min(1, (z - (SHORE - 1.6)) / 1.2)); sc.push(SAND.r * k * (1 - wet * 0.22), SAND.g * k * (1 - wet * 0.25), SAND.b * k * (1 - wet * 0.3)); } /* 波打ち際へだんだん湿って濃く */
      sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); sg.computeVertexNormals();
      const s = new THREE.Mesh(sg, mat(0xffffff, { vertexColors: true })); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.006, (SAND0 + SHORE + 0.6) / 2); scene.add(s);
      
      /* 草原との境目は少しギザギザ */ for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.9, 7), mat(0xead7a8)); p.rotation.x = -Math.PI / 2; p.position.set(-40 + i * 2 + Math.random(), 0.005, SAND0 + (Math.random() - 0.3) * 0.6); scene.add(p); }
      const sl = Math.atan(0.28), L = 4.3 / Math.cos(sl), sea0 = new THREE.Mesh(new THREE.PlaneGeometry(90, L), mat(0xc2ab78)); sea0.rotation.x = -Math.PI / 2 + sl; sea0.position.set(0, -0.61, SHORE + 2.15); scene.add(sea0); /* 海の底：波打ち際から沖へ下がる */
      const deep = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), mat(0x9c8c66)); deep.rotation.x = -Math.PI / 2; deep.position.set(0, -1.21, SHORE + 4.3 + 60); scene.add(deep); }
    // 海：前のふちが寄せては返す。ふちに白い泡
    const wg = new THREE.PlaneGeometry(200, 120, 20, 60), wc = []; { const wp = wg.attributes.position, sh = new THREE.Color(0x9ff0ea), dp = new THREE.Color(0x2f7fa8), c = new THREE.Color(); for (let i = 0; i < wp.count; i++) { const d = 60 - wp.getY(i), u = Math.min(1, d / 14); c.copy(sh).lerp(dp, u); wc.push(c.r, c.g, c.b, 0.16 + 0.7 * Math.pow(Math.min(1, d / 11), 1.3)); } wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 4)); } /* 浅瀬は明るくて透明（中が見える）、沖ほど濃い */
    const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.05, transparent: true, opacity: 1, depthWrite: false })); water.rotation.x = -Math.PI / 2; water.renderOrder = 3; scene.add(water);

    const lines = makeWaveLines(scene, B);
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

    const extras = makeExtras(scene, boxes, B, mat);
    B.tick = dt => { B.t += dt; B.surgeA = Math.max(0, B.surgeA - dt * 0.45); const wz = B.waterZ(); water.position.set(0, 0.02 + 0.012 * Math.sin(B.t * 0.8), wz + 60); extras.tick(dt); lines.tick(dt, wz);
      crab.tick(dt); T.tick(dt);
      for (const f of frags) { f.t += dt; if (f.st === 'float') { f.m.position.set(f.x + Math.sin(f.t * 0.7) * 0.15, 0.08 + 0.04 * Math.sin(f.t * 2.2), f.z + Math.cos(f.t * 0.5) * 0.15); f.m.rotation.y = f.t * 1.5; f.m.scale.setScalar(1 + 0.25 * Math.max(0, Math.sin(f.t * 3))); }
        else if (f.st === 'fly') { f.k += dt * 2.5; const to = f.to(); f.m.position.lerp(new THREE.Vector3(to[0], to[1], to[2]), Math.min(1, dt * 8)); f.m.scale.setScalar(Math.max(0.01, 1 - f.k)); if (f.k >= 1) { f.st = 'gone'; f.m.visible = false; } } } };
    B.track = (who, x, z, k) => extras.track(who, x, z, k); B.resetStory = () => { extras.clearPrints(); T.reset(); crab.st = 'off'; crab.g.visible = false; crab.auto = false; frags.forEach(f => { f.st = 'off'; f.m.visible = false; f.m.scale.setScalar(1); }); };
    return B; }
  return { create, SHORE, floorAt };
})();
