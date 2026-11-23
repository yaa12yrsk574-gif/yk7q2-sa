// ---- 序盤：プレイヤーはペンギン（0.8m）。プルプル（0.4m）は自分で動く。岩に登れるのはプルプルだけ → ペンギンが取り残される → 「一緒に行きたい」 ----
// 叶うと乗せられる体（0.7m）になる。乗った時に初めてプルプルを操作できる（それまでは、ついて行くのが主）
// ここは「ペンギン」と「プルプルの頭の中（自分で動く・芝居）」だけ。体の物理は body.js、見た目は skin.js、つなぐのは app.js
window.PlayStory = (() => {
  const SIZE = { small: 0.4, big: 0.7 }, PEN_H = 0.8, STEP = 0.22; /* ペンギンが乗り越えられる段差 */
  const turnTo = (a, b, s) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-s, Math.min(s, d)); };
  const rectDist = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

  // ---- ペンギン：ローポリで手作り。よちよち歩く。高い段には登れない ----
  function penguin(scene) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); scene.add(g);
    const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true }), black = M(0x2c3440), white = M(0xf4f1ea), orange = M(0xf0a03a), dark = M(0x111111);
    const ell = (mat, rx, ry, rz, x, y, z, seg) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg || 10, 8), mat); m.scale.set(rx, ry, rz); m.position.set(x, y, z); body.add(m); return m; };
    ell(black, 0.25, 0.33, 0.23, 0, 0.36, 0); ell(white, 0.2, 0.27, 0.12, 0, 0.33, 0.13); /* 胴とおなか */
    ell(black, 0.18, 0.17, 0.17, 0, 0.66, 0.01); ell(white, 0.12, 0.1, 0.07, 0, 0.64, 0.11); /* 頭と顔 */
    for (const sx of [-1, 1]) { ell(dark, 0.025, 0.03, 0.02, sx * 0.065, 0.69, 0.155, 6); }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.64, 0.21); body.add(beak);
    const fl = [-1, 1].map(sx => { const p = new THREE.Group(); p.position.set(sx * 0.24, 0.5, 0); const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), black); m.scale.set(0.04, 0.18, 0.09); m.position.y = -0.16; p.add(m); body.add(p); return p; });
    const ft = [-1, 1].map(sx => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.15), orange); m.position.set(sx * 0.09, 0.015, 0.04); g.add(m); return m; });
    // 杖（前の構想のなごり。夜に先っぽが灯る予定）
    const staff = new THREE.Group(); { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.62, 5), M(0x8a6a4a)); s.position.y = 0.31; staff.add(s); const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), M(0xffe08a)); tip.position.y = 0.64; staff.add(tip); } staff.position.set(0.3, 0.06, 0.06); body.add(staff);
    const P = { g, x: 0, z: 0, y: 0, vy: 0, yaw: 0, v: 0, ph: 0, r: 0.27, H: PEN_H, seated: false };
    function blocked(world, x, z) { return world.boxes.some(b => b.top > P.y + STEP && rectDist(b, x, z) < P.r && rectDist(b, P.x, P.z) >= P.r - 0.001); }
    P.step = (dt, mx, mz, walk, world) => { const mag = Math.min(1, Math.hypot(mx, mz)), top = walk ? 0.9 : 1.7;
      if (mag > 0.05) P.yaw = turnTo(P.yaw, Math.atan2(mx, mz), 9 * dt);
      P.v += Math.max(-8 * dt, Math.min(5 * dt, mag * top - P.v));
      const nx = P.x + Math.sin(P.yaw) * P.v * dt, nz = P.z + Math.cos(P.yaw) * P.v * dt;
      if (!blocked(world, nx, nz)) { P.x = nx; P.z = nz; } else if (!blocked(world, nx, P.z)) P.x = nx; else if (!blocked(world, P.x, nz)) P.z = nz; else P.v *= 0.3;
      const gy = world.groundAt(P.x, P.z, P.y + STEP);
      if (P.y > gy + 0.02) { P.vy -= 16 * dt; P.y = Math.max(gy, P.y + P.vy * dt); if (P.y === gy) P.vy = 0; } else { P.y = gy; P.vy = 0; }
      P.ph += dt * (P.v * 7 + 0.0001); P.pose(dt); };
    // よちよち：左右に揺れて、足を交互に出す。立ち止まったら揺れが収まる
    let sway = 0; P.pose = (dt, still) => { const a = still ? 0 : Math.min(1, P.v / 1.2); sway += (a - sway) * Math.min(1, dt * 8);
      body.rotation.z = Math.sin(P.ph) * 0.13 * sway; body.position.y = Math.abs(Math.sin(P.ph)) * 0.025 * sway;
      ft[0].position.z = 0.04 + Math.sin(P.ph) * 0.07 * sway; ft[1].position.z = 0.04 - Math.sin(P.ph) * 0.07 * sway;
      fl[0].rotation.z = -0.25 - 0.2 * sway * Math.abs(Math.sin(P.ph)); fl[1].rotation.z = 0.25 + 0.2 * sway * Math.abs(Math.sin(P.ph));
      for (const f of ft) f.visible = !P.seated; };
    P.place = () => { g.position.set(P.x, P.y, P.z); g.rotation.y = P.yaw; };
    return P;
  }

  // ---- 吹き出し：記号（！…？♪）か、絵（願い）。プルプルは言葉をしゃべらない ----
  function bubble() { const e = document.createElement('div'); e.id = 'bub'; document.body.appendChild(e); let kind = null, t = 0;
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 150;
    // 願いの絵：岩の上に、ペンギンとプルプルが並んでる
    function drawWish() { const c = cv.getContext('2d'); c.clearRect(0, 0, 240, 150); c.lineCap = 'round'; c.lineJoin = 'round';
      c.fillStyle = '#c9b08c'; c.strokeStyle = '#5c4a36'; c.lineWidth = 4; c.beginPath(); c.moveTo(40, 145); c.lineTo(52, 92); c.lineTo(188, 88); c.lineTo(202, 145); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2c3440'; c.beginPath(); c.ellipse(150, 58, 20, 30, 0, 0, 7); c.fill(); c.fillStyle = '#f4f1ea'; c.beginPath(); c.ellipse(153, 64, 12, 20, 0, 0, 7); c.fill(); c.fillStyle = '#f0a03a'; c.beginPath(); c.moveTo(166, 40); c.lineTo(178, 44); c.lineTo(166, 48); c.fill();
      c.fillStyle = 'rgba(127,220,214,.75)'; c.strokeStyle = '#3b9c97'; c.lineWidth = 3; c.beginPath(); c.ellipse(100, 74, 26, 16, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#2d7e7a'; for (const [x, y] of [[88, 76], [100, 72], [112, 76]]) { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); }
      c.fillStyle = '#e8577a'; c.font = 'bold 26px sans-serif'; c.fillText('♡', 113, 36); }
    return { el: e, show(k) { if (k === kind) return; kind = k; t = 0; if (k === 'wish') { drawWish(); e.innerHTML = ''; e.appendChild(cv); e.className = 'wish'; } else if (k) { e.textContent = k; e.className = 'emo'; } else { e.className = ''; e.textContent = ''; } },
      get kind() { return kind; }, tick(dt) { t += dt; }, place(x, y, vis) { e.style.display = kind && vis ? 'block' : 'none'; e.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%,-100%)' + (kind && kind !== 'wish' ? ' scale(' + (1 + 0.25 * Math.max(0, 1 - t * 4)) + ')' : ''); } }; }

  // ---- プルプルの頭の中：自分で動いて、芝居をする。乗ってる間はお休み（操作はプレイヤー）----
  // 返すのは「この1フレームの入力」（body.step にそのまま渡す）。登る間だけは自分で体を動かす（climb）
  function brain(world, opts) {
    const rock = world.boxes.find(b => b.label === '0.6m'), flower = opts.flower;
    const S = { st: 'intro', t: 0, wait: 0, far: 0, climb: null, tilt: 0, emo: null, emoT: 0, wished: false, hop: 0, onTop: false };
    const say = (k, dur) => { S.emo = k; S.emoT = dur || 1.4; };
    const go = (B, x, z, fast, stopAt) => { const h = B.h, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz); if (d < (stopAt || 0.15)) return { mx: 0, mz: 0, walk: true, d }; const m = Math.min(1, d / 1.2) * (fast ? 1 : 0.55); return { mx: dx / d * m, mz: dz / d * m, walk: !fast, d }; };
    const face = (B, x, z, dt) => { B.h.yaw = turnTo(B.h.yaw, Math.atan2(x - B.h.x, z - B.h.z), 5 * dt); };
    const idle = { mx: 0, mz: 0, walk: true };
    // 岩の壁にくっついて、ひょいひょい登る（0.4m の体だけ）
    function startClimb(B) { const h = B.h, cx = Math.max(rock.x0, Math.min(rock.x1, h.x)), cz = Math.max(rock.z0, Math.min(rock.z1, h.z)); h.yaw = Math.atan2(cx - h.x, cz - h.z); S.climb = { y0: h.y }; h.v = 0; h.st = 'ground'; S.st = 'climb'; }
    function climbStep(B, dt) { const h = B.h, M = B.M; h.y += dt * 0.55; h.gm = M.walk || M.run || M.idle; if (h.gm) h.ph = (h.ph + dt * 24 * 1.4) % h.gm.len; S.tilt += (1.15 - S.tilt) * Math.min(1, dt * 8);
      if (h.y >= rock.top) { h.y = rock.top; const d = B.radius + 0.25; h.x += Math.sin(h.yaw) * d; h.z += Math.cos(h.yaw) * d; S.climb = null; S.st = 'top'; S.t = 0; S.far = 0; S.wait = 0; say('♪', 1.2); } }
    function tick(B, pen, dt, ctx) { S.t += dt; if (S.emoT > 0) { S.emoT -= dt; if (S.emoT <= 0) S.emo = null; } if (S.st !== 'climb') S.tilt += (0 - S.tilt) * Math.min(1, dt * 6);
      const h = B.h, dPen = Math.hypot(pen.x - h.x, pen.z - h.z);
      if (ctx.riding) { S.st = 'ride'; return null; }
      if (S.st === 'ride') S.st = 'follow';
      switch (S.st) {
        case 'intro': face(B, pen.x, pen.z, dt); if (S.t > 1.6) { S.st = 'spot'; S.t = 0; say('！', 1.2); } return idle;
        case 'spot': face(B, flower.x, flower.z, dt); if (S.t > 1.1) { S.st = 'go'; S.t = 0; } return idle;
        case 'go': { const r = go(B, rock.x, rock.z, true); if (rectDist(rock, h.x, h.z) < B.radius + 0.14 && h.y < rock.top - 0.05) { startClimb(B); return null; } return r; }
        case 'climb': climbStep(B, dt); return null;
        case 'top': { // 花のまわりで跳ねて喜ぶ。ペンギンが下まで来て、登れずにいたら気づく
          const near = rectDist(rock, pen.x, pen.z) < 1.4 && pen.y < rock.top - 0.1;
          if (near) S.wait += dt; else { S.wait = Math.max(0, S.wait - dt); S.far += dt; }
          if (S.wait > 1.2) { S.st = 'notice'; S.t = 0; say('…', 1.6); return idle; }
          if (S.far > 9) { S.far = 3; say('？', 1.6); S.look = 1.6; } /* なかなか来えへん：振り返って待つ */
          if (S.look > 0) { S.look -= dt; face(B, pen.x, pen.z, dt); return idle; }
          S.hop += dt; const a = S.hop * 0.9, tx = flower.x + Math.sin(a) * 0.45, tz = flower.z + Math.cos(a) * 0.3; const r = go(B, tx, tz, false, 0.05); return r; }
        case 'notice': face(B, pen.x, pen.z, dt); if (S.t > 1.8) { S.st = 'down'; S.t = 0; say('！', 1); } return idle;
        case 'down': { // 岩のふちから飛び降りて、ペンギンの横へ（ペンギンの真上をめざすと、ふちの手前で止まってまう）
          if (!S.land) { const a = Math.atan2(pen.x - rock.x, pen.z - rock.z) + Math.PI / 2, side = Math.sin(a) * (h.x - pen.x) + Math.cos(a) * (h.z - pen.z) >= 0 ? 1 : -1; S.land = [pen.x + Math.sin(a) * 1.0 * side, pen.z + Math.cos(a) * 1.0 * side]; }
          const r = go(B, S.land[0], S.land[1], true, 0.05); if (h.y < 0.05 && h.st === 'ground') { S.st = 'come'; S.t = 0; S.land = null; } return r; }
        case 'come': { const r = go(B, pen.x, pen.z, false, 0.95); if (r.d < 1.0) { S.st = 'wish'; S.t = 0; S.wished = true; ctx.onWish && ctx.onWish(); } return r; }
        case 'wish': face(B, pen.x, pen.z, dt); if (S.t > 0.4 && S.t < 2.2 && ((S.t * 3) | 0) % 2 === 0 && ctx.squash) ctx.squash(0.25 * dt * 60); return idle; /* 見上げて、もじもじ */
        case 'grow': face(B, pen.x, pen.z, dt); return idle;
        case 'follow': default: { // ペンギンの右うしろをついて歩く。離れたら急ぐ
          const a = pen.yaw - Math.PI * 0.7, tx = pen.x + Math.sin(a) * (0.9 + B.radius), tz = pen.z + Math.cos(a) * (0.9 + B.radius); const r = go(B, tx, tz, dPen > 3, 0.25); if (r.d < 0.25) face(B, pen.x + Math.sin(pen.yaw) * 3, pen.z + Math.cos(pen.yaw) * 3, dt); return r; }
      } }
    return { S, tick, rock, reset() { Object.assign(S, { land: null, st: 'intro', t: 0, wait: 0, far: 0, climb: null, tilt: 0, emo: null, emoT: 0, wished: false, hop: 0, look: 0 }); } };
  }

  // 岩の上の花（プルプルが見つけて登りたくなるもの）
  function flower(scene, x, y, z) { const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.22, 5), new THREE.MeshStandardMaterial({ color: 0x4f8a3a })); st.position.y = 0.11; g.add(st);
    const pm = new THREE.MeshStandardMaterial({ color: 0xffb0d0, emissive: 0x6a2040, roughness: 0.6, flatShading: true }); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), pm); const a = i / 5 * Math.PI * 2; p.scale.set(1, 0.4, 0.6); p.position.set(Math.cos(a) * 0.05, 0.23, Math.sin(a) * 0.05); g.add(p); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffe36a, emissive: 0x806010 })); c.position.y = 0.24; g.add(c); g.position.set(x, y, z); scene.add(g); return { g, x, y, z }; }

  return { SIZE, PEN_H, penguin, bubble, brain, flower };
})();
