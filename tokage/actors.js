// ---- 出てくるもの：トカゲ（相棒・群れ・ドッスン）、ペンギン、カエル／ヒキガエル、鳥／ムササビ、キラキラ ----
window.TkActors = (() => {
  const TPL = window.BoneTemplates, FR = 24, clone = o => JSON.parse(JSON.stringify(o));
  const turnTo = (a, b, s) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-s, Math.min(s, d)); };
  const lerp = (a, b, t) => a + (b - a) * t;
  // ---- 皮：工房と同じローポリ。色だけ選べる（工房の「ふつう」と同じ作り） ----
  function skinOf(B, baseHex) { const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, flatShading: true, side: THREE.DoubleSide, emissive: 0x000000 }), meshes = new Map(), base = new THREE.Color(baseHex);
    const geomOf = (b, P) => window.PlayBody.withState(B.D, core => core.boneGeom(P && P[b.id] && P[b.id].length === b.pts.length ? Object.assign({}, b, { pts: P[b.id] }) : b));
    function painted(G, bone) { const n = G.I.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let t = 0; t < n / 3; t++) { const hx = bone.paint && bone.paint[t], c = typeof hx === 'string' && /^#[0-9a-f]{6}$/i.test(hx) ? new THREE.Color(hx) : base; for (let q = 0; q < 3; q++) { const s = G.I[t * 3 + q] * 3, d = (t * 3 + q) * 3; pos[d] = G.V[s]; pos[d + 1] = G.V[s + 1]; pos[d + 2] = G.V[s + 2]; col[d] = c.r; col[d + 1] = c.g; col[d + 2] = c.b; } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo; }
    const writeFlat = (geo, G) => { const v = geo.attributes.position.array; for (let j = 0; j < G.I.length; j++) { const s = G.I[j] * 3, d = j * 3; v[d] = G.V[s]; v[d + 1] = G.V[s + 1]; v[d + 2] = G.V[s + 2]; } geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); };
    let lastKey = null; const glowMats = new Map();
    function setPose(P, key) { if (key && key === lastKey) return; lastKey = key; for (const b of B.D.bones) { const G = geomOf(b, P); if (!G) continue; let m = meshes.get(b.id);
        if (m && m.geometry.attributes.position.count === G.I.length) writeFlat(m.geometry, G); else { if (m) { inner.remove(m); m.geometry.dispose(); } m = new THREE.Mesh(painted(G, b), mat); meshes.set(b.id, m); inner.add(m); } } }
    // 一部の骨だけ光らせる（観察で「ここや！」）
    function glow(ids, a) { for (const [id, m] of meshes) { const on = ids && ids.includes(id); if (on) { let gm = glowMats.get(id); if (!gm) { gm = mat.clone(); glowMats.set(id, gm); } gm.emissive.setRGB(1.0 * a, 0.75 * a, 0.25 * a); m.material = gm; } else m.material = mat; } }
    return { g, inner, setPose, glow, dispose() { for (const m of meshes.values()) m.geometry.dispose(); mat.dispose(); for (const gm of glowMats.values()) gm.dispose(); } }; }

  // ---- トカゲ：骨の作品 → PlayBody（アニメのコマ）＋皮。動き（位置・状態）はここで持つ ----
  // size：m の倍率（お手本のトカゲは背中まで0.5m、ツノの先まで0.8m）
  function lizard(scene, work, size, color) {
    const W = Object.assign({}, work, { __size: size }); let B = window.PlayBody.make(W), skin = skinOf(B, color); scene.add(skin.g);
    const L = { B, skin, work, size, color, x: 0, z: 0, y: 0, yaw: 0, v: 0, vy: 0, st: 'ground', ph: 0, gest: null, act: null, pose: null, flip: 0, flipV: 0, sq: 0, sqV: 0, tilt: 0, roll: 0, look: null, glowIds: null, glowA: 0, wing: null, crouch: 0, visible: true };
    const cache = new Map();
    const shift = P => { const o = B.D.__o, out = {}; for (const id in P) out[id] = P[id].map(p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]); return out; };
    // お手本の形（tokPose の値）→ この子の座標
    L.custom = (o, wing) => { const k = JSON.stringify(o) + '|' + (wing == null ? '' : wing.toFixed(2)); if (cache.has(k)) return { P: cache.get(k), key: 'c' + k }; let P = shift(TPL.poseOf('tokage', o)); if (wing != null) P = Object.assign(P, L.wingPose(wing)); if (cache.size > 400) cache.clear(); cache.set(k, P); return { P, key: 'c' + k }; };
    // 羽（骨9・10）：根元を軸に、上（0）↔下（1）に振る
    L.wingPose = a => { const out = {}, o = B.D.__o; for (const id of [9, 10]) { const b = B.D.bones.find(x => x.id === id); if (!b) continue; const p0 = b.pts[0], sx = Math.sign(b.pts[b.pts.length - 1][0] - p0[0]) || 1, ang = (0.85 - a * 1.5) * sx;
        out[id] = b.pts.map(p => { const dx = p[0] - p0[0], dy = p[1] - p0[1], c = Math.cos(ang), s = Math.sin(ang); return [p0[0] + dx * c - dy * s, p0[1] + dx * s + dy * c, p[2]]; }); } return out; };
    L.hasWings = () => B.D.bones.some(b => b.id === 9);
    L.rebuild = (w) => { if (w) L.work = w; scene.remove(skin.g); skin.dispose(); B = window.PlayBody.make(Object.assign({}, L.work, { __size: size })); skin = skinOf(B, color); scene.add(skin.g); L.B = B; L.skin = skin; cache.clear(); };
    L.headPos = () => { const s = size; return new THREE.Vector3(L.x + Math.sin(L.yaw) * 0.75 * s, L.y + 0.75 * s, L.z + Math.cos(L.yaw) * 0.75 * s); };
    L.backY = () => L.y + 0.5 * size;
    L.gesture = slot => { if (B.M[slot]) { L.gest = { slot, t: 0 }; return true; } return false; };
    L.squash = k => { L.sqV -= k; };
    // 毎フレーム：今の状態からコマを選んで、皮に渡す
    L.draw = (dt) => { const M = B.M; let P = null, key = null;
      if (L.pose) { P = L.pose.P; key = L.pose.key; }
      else if (L.gest && M[L.gest.slot]) { const g = M[L.gest.slot]; L.gest.t += dt; let f = L.gest.t * FR; if (f >= g.len) { if (g.A.loop && L.gest.loop) f %= g.len; else { L.gest = null; f = 0; } } if (L.gest) { const fi = Math.min(g.len, Math.floor(f)); P = g.P[fi]; key = L.gest.slot + fi; } }
      if (!P) { const m = L.v > 2.2 && M.run ? M.run : L.v > 0.08 ? (M.walk || M.run) : M.idle; if (m) { const rate = m === M.idle ? 1 : Math.max(0.6, Math.min(1.8, L.v / (m === M.run ? 3 : 1.1))); L.ph = (L.ph + dt * FR * rate) % m.len; const fi = Math.floor(L.ph) % m.len; P = m.P[fi]; key = (m === M.run ? 'r' : m === M.walk ? 'w' : 'i') + fi; } else { P = B.rest; key = 'rest'; } }
      if (L.wing != null && L.hasWings()) { P = Object.assign({}, P, L.wingPose(L.wing)); key += '|w' + L.wing.toFixed(2); }
      skin.setPose(P, key);
      // ぷにっと（着地・びっくり）：ばね
      L.sqV += (-L.sq * 120 - L.sqV * 12) * dt; L.sq += L.sqV * dt; L.flip += L.flipV * dt;
      const g = skin.g; g.visible = L.visible; g.position.set(L.x, L.y + Math.max(0, Math.sin(L.flip)) * 0.25 * size, L.z); g.rotation.order = 'YXZ'; g.rotation.y = L.yaw; g.rotation.x = -L.tilt; g.rotation.z = L.flip + L.roll;
      const s = 1 + L.sq * 0.25; g.scale.set(size * (1 + Math.max(0, -L.sq) * 0.15), size * Math.max(0.5, s), size * (1 + Math.max(0, -L.sq) * 0.15)); skin.inner.position.set(-B.cR[0], 0, -B.cR[2]);
      skin.glow(L.glowIds, L.glowA); };
    // 歩く：目標へ（障害物と段差を見る）
    L.walkTo = (tx, tz, sp, dt, world, stopR) => { const dx = tx - L.x, dz = tz - L.z, d = Math.hypot(dx, dz); if (d < (stopR || 0.2)) { L.v = Math.max(0, L.v - dt * 8); return true; } L.yaw = turnTo(L.yaw, Math.atan2(dx, dz), dt * 7); L.v += Math.max(-dt * 8, Math.min(dt * 6, sp - L.v)); L.move(dt, world); return false; };
    L.move = (dt, world, free) => { const nx = L.x + Math.sin(L.yaw) * L.v * dt, nz = L.z + Math.cos(L.yaw) * L.v * dt, r = 0.3 * size;
      if (free || !world.blocked(nx, nz, L.y, r)) { L.x = nx; L.z = nz; } else if (!world.blocked(nx, L.z, L.y, r)) L.x = nx; else if (!world.blocked(L.x, nz, L.y, r)) L.z = nz; else L.v *= 0.4;
      if (!free) world.clamp(L, r); };
    // 縦：重力と着地
    L.fall = (dt, world, g) => { const gy = world.groundAt(L.x, L.z, L.y); if (L.st === 'air') { L.vy -= (g || 14) * dt; L.y += L.vy * dt; if (L.vy <= 0 && L.y <= gy) { const hard = -L.vy; L.y = gy; L.vy = 0; L.st = 'ground'; return { land: hard }; } } else { if (L.y > gy + 0.05) { L.st = 'air'; L.vy = 0; } else L.y = gy; } return null; };
    L.dispose = () => { scene.remove(skin.g); skin.dispose(); };
    return L; }

  // ---- 相棒の作品：お手本のトカゲの脚を細くしたもの（太い脚にするのはプレイヤー）。物語の印 story:'tk' ----
  // かわいい体つき：胴・首・頭・しっぽをむっちり（脚はそのまま）。群れもドッスンも相棒もこれが土台
  function chubby(d, legK) { const K = { 1: 1.75, 2: 1.6, 3: 1.0, 4: 1.45 }; for (const b of d.bones) { const k = [5, 6, 7, 8].includes(b.id) ? (legK || 1) : (K[b.id] || 1); for (const n of ['wp', 'wn', 'dp', 'dn']) b[n] = b[n].map(q => ({ t: q.t, r: +(q.r * k).toFixed(4) })); } return d; }
  function heroWork() { const d = chubby(TPL.data('tokage'), 0.55);
    d.story = 'tk'; return { id: 'tk_hero', name: 'トカゲ（相棒）', created: Date.now(), updated: Date.now(), data: d }; }
  // 羽の芽：背中の肩のあたりから、小さな平たい突起がにゅっ（広くするのはプレイヤー）
  function sproutWings(d) { if (d.bones.some(b => b.id === 9)) return d; const body = d.bones.find(b => b.parent == null), q = body.pts[2];
    for (const [id, sx, tw] of [[9, 1, 10], [10, -1, 9]]) { const pts = [[0.07 * sx, 0.55, 0.18], [0.2 * sx, 0.6, 0.14], [0.33 * sx, 0.62, 0.1]], w = [{ t: 0, r: 0.035 }, { t: 1, r: 0.025 }], dd = [{ t: 0, r: 0.022 }, { t: 1, r: 0.016 }];
      d.bones.push({ id, parent: body.id, at: 2, pts, wp: clone(w), wn: clone(w), dp: clone(dd), dn: clone(dd), off: {}, sides: 8, twin: tw, atOff: [pts[0][0] - q[0], pts[0][1] - q[1], pts[0][2] - q[2]] }); }
    return d; }

  // ---- ペンギン（プレイヤー）：狩り場と同じ見た目を 0.8m に ----
  function penguin(scene) { const g = new THREE.Group(), body = new THREE.Group(); g.add(body); scene.add(g); const H = 0.8, model = window.PenguinModel.make(THREE); model.scale.setScalar(H / window.PenguinModel.H); body.add(model);
    const P = { g, body, x: 0, z: 0, y: 0, yaw: 0, v: 0, vy: 0, ph: 0, r: 0.22, H, seated: false, stepT: 0 };
    P.step = (dt, mx, mz, walk, world) => { const mag = Math.min(1, Math.hypot(mx, mz)), top = walk ? 1.0 : 2.1; if (mag > 0.05) P.yaw = turnTo(P.yaw, Math.atan2(mx, mz), 9 * dt); P.v += Math.max(-9 * dt, Math.min(6 * dt, mag * top - P.v));
      const nx = P.x + Math.sin(P.yaw) * P.v * dt, nz = P.z + Math.cos(P.yaw) * P.v * dt; if (!world.blocked(nx, nz, P.y, P.r)) { P.x = nx; P.z = nz; } else if (!world.blocked(nx, P.z, P.y, P.r)) P.x = nx; else if (!world.blocked(P.x, nz, P.y, P.r)) P.z = nz; else P.v *= 0.3; world.clamp(P, P.r);
      const gy = world.groundAt(P.x, P.z, P.y); if (P.y > gy + 0.02) { P.vy -= 14 * dt; P.y = Math.max(gy, P.y + P.vy * dt); if (P.y === gy) P.vy = 0; } else { P.y = gy; P.vy = 0; }
      if (P.y < world.SEA_Y + 0.1) { P.y = world.SEA_Y + 0.05; }
      P.ph += dt * (P.v * 9 + 0.0001); if (P.v > 0.4) { P.stepT -= dt; if (P.stepT <= 0) { P.stepT = 0.28; window.TkSound.step(); } } };
    P.pose = (dt) => { const a = P.seated ? 0 : Math.min(1, P.v / 1.2); body.position.y = Math.pow(Math.abs(Math.sin(P.ph)), 0.7) * 0.07 * a; body.rotation.z = Math.sin(P.ph) * 0.08 * a; };
    P.place = () => { g.position.set(P.x, P.y, P.z); g.rotation.y = P.yaw; };
    return P; }

  // ---- カエル／ヒキガエル：同じ形（シルエットそっくり）。カエルは脚を縮めて一気に跳ぶ、ヒキガエルはのそのそ歩くだけ ----
  function frogModel(col, belly, bumpy) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, flatShading: true }), mb = new THREE.MeshStandardMaterial({ color: belly, roughness: 0.9, flatShading: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, bumpy ? 6 : 9, bumpy ? 5 : 7), m); body.scale.set(1, 0.62, 1.15); body.position.y = 0.11; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), m); head.scale.set(1.15, 0.7, 1); head.position.set(0, 0.15, 0.15); g.add(head);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0x222222 })); e.position.set(0.06 * s, 0.22, 0.18); g.add(e); }
    const legs = []; for (const s of [-1, 1]) { const th = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.16, 6), m); th.position.set(0.13 * s, 0.07, -0.08); th.rotation.z = 1.1 * s; g.add(th); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.15, 6), mb); sh.position.set(0.2 * s, 0.04, -0.03); sh.rotation.x = 1.3; g.add(sh); legs.push(th, sh);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.1, 5), m); fl.position.set(0.09 * s, 0.05, 0.13); g.add(fl); }
    return { g, legs, body, mat: m }; }
  function frog(scene, x, z, kind, pond) { const F = kind === 'frog' ? frogModel(0x6f9a44, 0xd8d6a0, false) : frogModel(0x7c7a48, 0xbdb48c, true); scene.add(F.g);
    const o = { kind, F, x, z, y: 0, yaw: Math.random() * 6, st: 'idle', t: Math.random() * 3, vy: 0, vx: 0, vz: 0, crouch: 0, glow: 0, home: [x, z], pond, slow: 1 };
    o.tick = (dt, world) => { const T = dt * o.slow; o.t -= T;
      if (kind === 'frog') {
        if (o.st === 'idle' && o.t <= 0) { o.st = 'crouch'; o.t = 0.55; }
        else if (o.st === 'crouch') { o.crouch = Math.min(1, o.crouch + T * 3.2); if (o.t <= 0) { o.st = 'hold'; o.t = 0.35; } }
        else if (o.st === 'hold') { if (o.t <= 0) { o.st = 'air'; const a = o.nextYaw(), sp = 1.6; o.yaw = a; o.vx = Math.sin(a) * sp; o.vz = Math.cos(a) * sp; o.vy = 3.4; o.crouch = -0.6; if (o.near) window.TkSound.hop(); } }
        else if (o.st === 'air') { o.vy -= 9.8 * T; o.x += o.vx * T; o.z += o.vz * T; o.y += o.vy * T; o.crouch = Math.min(0, o.crouch + T * 2); const gy = Math.hypot(o.x - pond.x, o.z - pond.z) < pond.r ? -0.02 : 0; if (o.y <= gy && o.vy < 0) { o.y = gy; o.st = 'idle'; o.t = 1.2 + Math.random() * 2.2; o.crouch = 0; if (o.near && gy < 0) window.TkSound.splash(); } } }
      else { // ヒキガエル：のそのそ歩いて、たまに止まる。跳ばない
        if (o.st === 'idle' && o.t <= 0) { o.st = 'walk'; o.t = 1.5 + Math.random() * 2; o.yaw = o.nextYaw(); }
        else if (o.st === 'walk') { const sp = 0.25; o.x += Math.sin(o.yaw) * sp * T; o.z += Math.cos(o.yaw) * sp * T; o.crouch = Math.sin(o.t * 10) * 0.08; if (o.t <= 0) { o.st = 'idle'; o.t = 1.5 + Math.random() * 2; o.crouch = 0; if (o.near && Math.random() < 0.5) window.TkSound.croak(); } } }
      const g = F.g; g.position.set(o.x, o.y, o.z); g.rotation.y = o.yaw; const c = o.crouch; g.scale.set(1 + Math.max(0, c) * 0.15, 1 - Math.max(0, c) * 0.35 + Math.max(0, -c) * 0.25, 1 + Math.max(0, -c) * 0.3);
      F.mat.emissive.setRGB(o.glow, o.glow * 0.7, o.glow * 0.2); F.legs.forEach(l => { l.material = F.mat; }); };
    // 池のまわりをうろうろ（家から遠くへは行かない）
    o.nextYaw = () => { const dx = o.home[0] - o.x, dz = o.home[1] - o.z; return Math.hypot(dx, dz) > 2 ? Math.atan2(dx, dz) + (Math.random() - 0.5) : Math.random() * Math.PI * 2; };
    return o; }

  // ---- 鳥／ムササビ：遠目には同じ「広げた形」。鳥は羽ばたいて上がる、ムササビは膜を広げて滑り降りるだけ ----
  function birdModel(col) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), m); body.scale.set(0.8, 0.8, 1.5); g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 5), m); head.position.set(0, 0.05, 0.2); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 5), new THREE.MeshStandardMaterial({ color: 0xe0a030 })); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.04, 0.3); g.add(beak);
    const wings = []; for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(0.06 * s, 0.03, 0.02); const w = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), m); w.rotation.x = -Math.PI / 2; w.position.x = 0.21 * s; piv.add(w); g.add(piv); wings.push(piv); }
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), m); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0, -0.24); g.add(tail); return { g, wings, mat: m }; }
  function squirrelModel(col) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), m); body.scale.set(0.9, 0.7, 1.4); g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 5), m); head.position.set(0, 0.04, 0.19); g.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), m); ear.position.set(0.04 * s, 0.11, 0.17); g.add(ear); }
    const mem = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), m); mem.rotation.x = -Math.PI / 2; g.add(mem); const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.28, 5), m); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0, -0.3); g.add(tail);
    return { g, mem, mat: m, wings: [] }; }
  // 鳥：林の木から木へ、羽ばたいて移る（上へも上がれる）。sky＝空を飛んでいく1羽（場面用）
  function bird(scene, perches, world) { const F = birdModel(0x6b5a8e); scene.add(F.g); const o = { kind: 'bird', F, perches, i: 0, st: 'perch', t: 1 + Math.random() * 2, x: 0, y: 0, z: 0, yaw: 0, flap: 0, glow: 0, slow: 1, from: null, to: null, u: 0 };
    const at = p => [p.x + 1.45 * p.s, p.y + p.h + 0.35 * p.s, p.z]; [o.x, o.y, o.z] = at(perches[0]);
    o.tick = (dt) => { const T = dt * o.slow; o.t -= T;
      if (o.st === 'perch') { o.flap = Math.max(0, o.flap - T * 4); if (o.t <= 0) { let j = Math.floor(Math.random() * perches.length); if (j === o.i) j = (j + 1) % perches.length; o.from = [o.x, o.y, o.z]; o.to = at(perches[j]); o.i = j; o.st = 'fly'; o.u = 0; o.dur = Math.hypot(o.to[0] - o.from[0], o.to[2] - o.from[2]) / 2.6 + 0.6; o.yaw = Math.atan2(o.to[0] - o.from[0], o.to[2] - o.from[2]); } }
      else if (o.st === 'fly') { o.u = Math.min(1, o.u + T / o.dur); const e = o.u; o.x = lerp(o.from[0], o.to[0], e); o.z = lerp(o.from[2], o.to[2], e); o.y = lerp(o.from[1], o.to[1], e) + Math.sin(e * Math.PI) * 1.4; o.flap += T * 9; if (o.near && Math.floor(o.flap / Math.PI) !== Math.floor((o.flap - T * 9) / Math.PI) && Math.sin(o.flap) < 0) window.TkSound.flap(); if (o.u >= 1) { o.st = 'perch'; o.t = 1.4 + Math.random() * 2.2; if (o.near) window.TkSound.chirp(); } }
      const g = F.g; g.position.set(o.x, o.y, o.z); g.rotation.y = o.yaw; const a = o.st === 'fly' ? Math.sin(o.flap) * 0.9 : 1.2; const down = o.st === 'fly' && Math.cos(o.flap) < 0; F.wings[0].rotation.z = -a; F.wings[1].rotation.z = a; if (o.st === 'perch') { F.wings[0].rotation.z = -1.3; F.wings[1].rotation.z = 1.3; }
      F.mat.emissive.setRGB(o.glow * (down ? 1 : 0.25), o.glow * 0.7 * (down ? 1 : 0.25), o.glow * 0.2 * (down ? 1 : 0.25)); };
    return o; }
  // ムササビ：高い木Aのてっぺんから、低い所へ滑り降りる → 木を登る → また滑る（自分で上へは上がれない）
  function squirrel(scene, A, Bt) { const F = squirrelModel(0x8a6a4a); scene.add(F.g); const o = { kind: 'squirrel', F, st: 'climb', t: 0, x: A.x + 0.35, y: A.y + 0.5, z: A.z, yaw: 0, glow: 0, slow: 1, from: A, to: Bt, u: 0 };
    o.tick = (dt) => { const T = dt * o.slow;
      if (o.st === 'climb') { o.y += T * 0.9; o.x = o.from.x + 0.35; o.z = o.from.z; F.g.rotation.set(-Math.PI / 2, 0, 0); F.mem.scale.set(0.3, 1, 1); if (o.y >= o.from.top - 0.2) { o.st = 'sit'; o.t = 1.2; } }
      else if (o.st === 'sit') { o.t -= T; F.g.rotation.set(0, o.yaw, 0); if (o.t <= 0) { o.st = 'glide'; o.u = 0; o.p0 = [o.x, o.y, o.z]; o.p1 = [o.to.x + 0.4, o.to.y + 0.8, o.to.z]; o.yaw = Math.atan2(o.p1[0] - o.p0[0], o.p1[2] - o.p0[2]); o.dur = Math.hypot(o.p1[0] - o.p0[0], o.p1[2] - o.p0[2]) / 3.2; if (o.near) window.TkSound.whoosh(); } }
      else if (o.st === 'glide') { o.u = Math.min(1, o.u + T / o.dur); const e = o.u; o.x = lerp(o.p0[0], o.p1[0], e); o.z = lerp(o.p0[2], o.p1[2], e); o.y = lerp(o.p0[1], o.p1[1], e * e * 0.6 + e * 0.4); F.g.rotation.set(0.15, o.yaw, Math.sin(e * 9) * 0.05); F.mem.scale.set(1, 1, 1); if (o.u >= 1) { const t = o.from; o.from = o.to; o.to = t; o.st = 'climb'; } }
      F.g.position.set(o.x, o.y, o.z); F.mat.emissive.setRGB(o.glow * 0.5, o.glow * 0.35, o.glow * 0.1); };
    return o; }

  // ---- キラキラ（目が輝く・できた！）と土ぼこり ----
  function fx(scene) { const parts = [], sg = new THREE.OctahedronGeometry(0.05, 0), dg = new THREE.SphereGeometry(0.12, 5, 4);
    const sm = () => new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 1, depthWrite: false }), dm = () => new THREE.MeshBasicMaterial({ color: 0xcdb89a, transparent: true, opacity: 0.8, depthWrite: false });
    function sparkle(p, n, spread) { for (let i = 0; i < (n || 6); i++) { const m = new THREE.Mesh(sg, sm()); m.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * (spread || 0.4), Math.random() * 0.3, (Math.random() - 0.5) * (spread || 0.4))); scene.add(m); parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6), life: 0.8 + Math.random() * 0.5, t: 0, kind: 's' }); } }
    function dust(p, n, r) { for (let i = 0; i < (n || 8); i++) { const a = Math.random() * Math.PI * 2, m = new THREE.Mesh(dg, dm()); m.position.set(p.x + Math.cos(a) * (r || 0.3), p.y + 0.05, p.z + Math.sin(a) * (r || 0.3)); scene.add(m); parts.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.5, 0.4 + Math.random() * 0.5, Math.sin(a) * 1.5), life: 0.7 + Math.random() * 0.4, t: 0, kind: 'd' }); } }
    function tick(dt) { for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += dt; q.m.position.addScaledVector(q.v, dt); if (q.kind === 's') { q.v.y -= dt * 0.8; q.m.rotation.y += dt * 6; } else { q.v.multiplyScalar(1 - dt * 3); q.m.scale.setScalar(1 + q.t * 2); } q.m.material.opacity = Math.max(0, 1 - q.t / q.life); if (q.t >= q.life) { scene.remove(q.m); q.m.material.dispose(); parts.splice(i, 1); } } }
    return { sparkle, dust, tick }; }
  return { lizard, heroWork, chubby, sproutWings, penguin, frog, bird, squirrel, fx, turnTo, lerp };
})();
