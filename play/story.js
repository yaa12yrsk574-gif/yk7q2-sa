// ---- 序盤：プレイヤーはペンギン（0.8m）。プルプル（0.4m）は自分で動く。岩に登れるのはプルプルだけ → ペンギンが取り残される → 「一緒に行きたい」 ----
// 叶うと乗せられる体（0.7m）になる。乗った時に初めてプルプルを操作できる（それまでは、ついて行くのが主）
// ここは「ペンギン」と「プルプルの頭の中（自分で動く・芝居）」だけ。体の物理は body.js、見た目は skin.js、つなぐのは app.js
window.PlayStory = (() => {
  const SIZE = { small: 0.4, big: 0.7 }, PEN_H = 0.8, STEP = 0.22; /* ペンギンが乗り越えられる段差 */
  const turnTo = (a, b, s) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-s, Math.min(s, d)); };
  const rectDist = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

  // ---- ペンギン：見た目は狩り場と同じ（shared/penguin.js）を 0.8m に縮める。よちよち歩く。跳べないので高い段には登れない ----
  let world0 = null;
  function penguin(scene, world) { world0 = world;
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); scene.add(g);
    const model = window.PenguinModel.make(THREE); model.scale.setScalar(PEN_H / window.PenguinModel.H); body.add(model);
    const P = { g, x: 0, z: 0, y: 0, vy: 0, yaw: 0, v: 0, ph: 0, r: 0.2, H: PEN_H, seated: false, raise: 0 };
    function blocked(world, x, z) { return world.boxes.some(b => b.top > P.y + STEP && rectDist(b, x, z) < P.r && rectDist(b, P.x, P.z) >= P.r - 0.001); }
    P.step = (dt, mx, mz, walk, world) => { const mag = Math.min(1, Math.hypot(mx, mz)), top = walk ? 0.9 : 1.7;
      if (mag > 0.05) P.yaw = turnTo(P.yaw, Math.atan2(mx, mz), 9 * dt);
      P.v += Math.max(-8 * dt, Math.min(5 * dt, mag * top - P.v));
      const nx = P.x + Math.sin(P.yaw) * P.v * dt, nz = P.z + Math.cos(P.yaw) * P.v * dt;
      if (!blocked(world, nx, nz)) { P.x = nx; P.z = nz; } else if (!blocked(world, nx, P.z)) P.x = nx; else if (!blocked(world, P.x, nz)) P.z = nz; else P.v *= 0.3;
      const gy = world.groundAt(P.x, P.z, P.y + STEP);
      if (P.raise > 0) { P.y = gy + P.raise; P.vy = 0; } else if (P.y > gy + 0.02) { P.vy -= 16 * dt; P.y = Math.max(gy, P.y + P.vy * dt); if (P.y === gy) P.vy = 0; } else { P.y = gy; P.vy = 0; }
      P.ph += dt * (P.v * 7 + 0.0001); P.pose(dt); };
    // よちよち：左右に揺れて弾む。立ち止まったら収まる
    let sway = 0; P.pose = (dt, still) => { const a = still ? 0 : Math.min(1, P.v / 1.2); sway += (a - sway) * Math.min(1, dt * 8); body.rotation.z = Math.sin(P.ph) * 0.1 * sway; body.position.y = Math.abs(Math.sin(P.ph)) * 0.03 * sway; };
    P.nudge = (dx, dz, world) => { const nx = P.x + dx, nz = P.z + dz; if (!blocked(world, nx, nz)) { P.x = nx; P.z = nz; } }; /* プルプルに押される */
    P.bump = () => { if (P.y <= world0.groundAt(P.x, P.z, P.y + STEP) + 0.01) { P.y += 0.04; P.vy = 1.1; } }; /* 下から持ち上げられて、ちょっと浮く */
    P.place = () => { g.position.set(P.x, P.y, P.z); g.rotation.y = P.yaw; };
    return P;
  }

  // ---- 吹き出し：記号（！…？♪）か、絵（願い）。プルプルは言葉をしゃべらない ----
  function bubble() { const e = document.createElement('div'); e.id = 'bub'; document.body.appendChild(e); let kind = null, t = 0;
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 150;
    // 願いの絵：岩の上に、ペンギンとプルプルが並んでる
    function drawWish() { const c = cv.getContext('2d'); c.clearRect(0, 0, 240, 150); c.lineCap = 'round'; c.lineJoin = 'round';
      c.fillStyle = '#c9b08c'; c.strokeStyle = '#5c4a36'; c.lineWidth = 4; c.beginPath(); c.moveTo(40, 145); c.lineTo(52, 92); c.lineTo(188, 88); c.lineTo(202, 145); c.closePath(); c.fill(); c.stroke();
      /* ペンギン（狩り場と同じ：青い胴・肌色の頭・オレンジの鼻・杖） */ c.strokeStyle = '#7a5a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(172, 90); c.lineTo(176, 40); c.stroke();
      c.fillStyle = '#3b6ea8'; c.beginPath(); c.moveTo(140, 90); c.lineTo(143, 46); c.lineTo(161, 46); c.lineTo(164, 90); c.closePath(); c.fill(); c.fillStyle = '#e9cfae'; c.beginPath(); c.arc(152, 34, 12, 0, 7); c.fill(); c.fillStyle = '#d9572b'; c.beginPath(); c.moveTo(158, 58); c.lineTo(171, 61); c.lineTo(158, 64); c.fill();
      c.fillStyle = 'rgba(127,220,214,.75)'; c.strokeStyle = '#3b9c97'; c.lineWidth = 3; c.beginPath(); c.ellipse(100, 74, 26, 16, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#2d7e7a'; for (const [x, y] of [[88, 76], [100, 72], [112, 76]]) { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); }
      c.fillStyle = '#e8577a'; c.font = 'bold 26px sans-serif'; c.fillText('♡', 113, 36); }
    return { el: e, show(k) { if (k === kind) return; kind = k; t = 0; if (k === 'wish') { drawWish(); e.innerHTML = ''; e.appendChild(cv); e.className = 'wish'; } else if (k) { e.textContent = k; e.className = 'emo'; } else { e.className = ''; e.textContent = ''; } },
      get kind() { return kind; }, tick(dt) { t += dt; }, place(x, y, vis) { e.style.display = kind && vis ? 'block' : 'none'; e.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%,-100%)' + (kind && kind !== 'wish' ? ' scale(' + (1 + 0.25 * Math.max(0, 1 - t * 4)) + ')' : ''); } }; }

  // ---- プルプルの頭の中：自分で動いて、芝居をする。乗ってる間はお休み（操作はプレイヤー）----
  // 返すのは「この1フレームの入力」（body.step にそのまま渡す）。岩には自分の「跳ぶ」で跳び乗る（壁は登れない。登るのは爪を作ってから）
  // 落ち着き：動くのは用がある時だけ。それ以外はその場でじっと見てる
  function brain(world, opts) {
    const flower = opts.flower;
    const S = {}; const reset = () => Object.assign(S, { mid: null, k: 0, tiltT: 0, held: 0, n: 0, leg: null, pushing: 0, under: 0, did: 0, front: null, edge: null, st: 'intro', t: 0, wait: 0, far: 0, tilt: 0, emo: null, emoT: 0, wished: false, look: 0, land: null, rock: null, tries: 0, cool: 0, moving: false });
    reset();
    // 記号や絵は出さない。気持ちは全部 動きで出す（プレイヤーが読み取る）。say は「ぷるっ」と体で反応するだけ
    let sq = null; const say = (k) => { if (sq) sq(k === 'big' ? 2.4 : 1.4); };
    const go = (B, x, z, speed, stopAt) => { const h = B.h, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz); if (d < (stopAt || 0.15)) return { mx: 0, mz: 0, walk: true, d }; const m = Math.min(1, 0.3 + d / 0.5) * speed; /* 着く直前までちゃんと歩く（ゆるめすぎると、いつまでも着かへん） */ return { mx: dx / d * m, mz: dz / d * m, walk: speed < 0.95, d }; };
    const face = (B, x, z, dt, sp) => { B.h.yaw = turnTo(B.h.yaw, Math.atan2(x - B.h.x, z - B.h.z), (sp || 2.5) * dt); };
    const idle = { mx: 0, mz: 0, walk: true };
    // 跳び乗る岩：この子の「跳ぶ」で届く中で、ペンギンが越えられない一番高い岩（できれば 0.6m）
    function pickRock(B) { const reach = B.M.jump ? B.M.jump.J.h * 0.9 : 1.1;
      const ok = world.boxes.filter(b => !b.vine && b.top > STEP + 0.08 && b.top < reach && Math.hypot(b.x, b.z - 3) < 16);
      const r = ok.find(b => b.label === '0.6m') || ok.sort((a, b) => b.top - a.top)[0] || world.boxes.find(b => b.label === '0.6m');
      flower.g.position.set(r.x + Math.min(0.9, (r.x1 - r.x0) / 2 - 0.3), r.top, r.z - 0.4); flower.x = flower.g.position.x; flower.y = r.top; flower.z = flower.g.position.z; return r; }
    // 着地点：ペンギンの横、岩から離れた地面（岩の上に目標を置くと、ふちで止まってまう）
    function landSpot(B, pen, rock) { const ax = pen.x - rock.x, az = pen.z - rock.z, al = Math.hypot(ax, az) || 1, ux = ax / al, uz = az / al;
      const side = (B.h.x - pen.x) * uz - (B.h.z - pen.z) * ux >= 0 ? 1 : -1;
      let x = pen.x + uz * side * 0.9 + ux * 0.3, z = pen.z - ux * side * 0.9 + uz * 0.3; for (let k = 0; k < 10 && rectDist(rock, x, z) < B.radius + 0.35; k++) { x += ux * 0.25; z += uz * 0.25; } return [x, z]; }
    // ふち：岩の上で、ペンギンに一番近いところ（少し内側）
    function edgeSpot(B, pen, rock) { const m = B.radius * 0.6; return [Math.max(rock.x0 + m, Math.min(rock.x1 - m, pen.x)), Math.max(rock.z0 + m, Math.min(rock.z1 - m, pen.z))]; }
    // 岩の前：ペンギンと岩の間、壁のすぐ手前
    function baseSpot(B, pen, rock) { const cx = Math.max(rock.x0, Math.min(rock.x1, pen.x)), cz = Math.max(rock.z0, Math.min(rock.z1, pen.z)), dx = pen.x - cx, dz = pen.z - cz, d = Math.hypot(dx, dz) || 1, o = B.radius + 0.15; return [cx + dx / d * o, cz + dz / d * o]; }
    // ペンギンから見て岩と反対側（ペンギンが岩にくっついてても、行ったり来たりできるように）
    function awaySpot(pen, rock, d) { const cx = Math.max(rock.x0, Math.min(rock.x1, pen.x)), cz = Math.max(rock.z0, Math.min(rock.z1, pen.z)); let ux = pen.x - cx, uz = pen.z - cz; const l = Math.hypot(ux, uz); if (l < 0.01) { ux = pen.x - rock.x; uz = pen.z - rock.z; } const m = Math.hypot(ux, uz) || 1; return [pen.x + ux / m * d, pen.z + uz / m * d]; }
    function tick(B, pen, dt, ctx) { S.t += dt; S.cool = Math.max(0, S.cool - dt); if (S.emoT > 0) { S.emoT -= dt; if (S.emoT <= 0) S.emo = null; } sq = ctx.squash; S.tilt += ((S.tiltT || 0) - S.tilt) * Math.min(1, dt * 5); S.tiltT = 0; /* のぞき込む(−)・見上げる(＋)：その状態が毎フレーム決める */
      const h = B.h, dPen = Math.hypot(pen.x - h.x, pen.z - h.z), rock = S.rock || (S.rock = pickRock(B)), onTop = h.y > rock.top - 0.05 && rectDist(rock, h.x, h.z) < 0.01;
      if (ctx.riding) { S.st = 'ride'; return null; }
      if (S.st === 'ride') S.st = 'follow';
      switch (S.st) {
        case 'intro': if (S.t > 0.4) face(B, pen.x, pen.z, dt); if (S.t > 2.2) { S.st = 'spot'; S.t = 0; say(); } return idle; /* 花に気づいて、ぷるっ */
        case 'spot': face(B, flower.x, flower.z, dt, 3); S.tiltT = 0.25; /* 見上げて固まる */ if (S.t > 1.4) { S.st = 'go'; S.t = 0; } return idle;
        case 'go': { // 岩の手前まで歩いて、向き直って、ぴょん
          if (h.st !== 'ground') return { mx: Math.sin(h.yaw) * 0.6, mz: Math.cos(h.yaw) * 0.6, walk: true };
          if (onTop) { S.st = 'top'; S.t = 0; S.wait = 0; S.far = 0; say(); return idle; }
          const cx = Math.max(rock.x0, Math.min(rock.x1, flower.x)), cz = Math.max(rock.z0, Math.min(rock.z1, h.z > rock.z1 ? rock.z1 : h.z < rock.z0 ? rock.z0 : flower.z)), d = rectDist(rock, h.x, h.z);
          if (d > B.radius + 0.15) return go(B, cx, cz, d > B.radius + 1 ? 1 : 0.6, 0.05); /* 岩のすぐ手前まで寄ってから跳ぶ（空中で前へ進むのは0.5mくらい） */
          face(B, cx, cz, dt, 6); const ang = Math.atan2(cx - h.x, cz - h.z), off = Math.abs(Math.atan2(Math.sin(ang - h.yaw), Math.cos(ang - h.yaw)));
          if (off < 0.25 && S.cool <= 0) { S.tries++; S.cool = 1.6; return { mx: Math.sin(h.yaw) * 0.5, mz: Math.cos(h.yaw) * 0.5, walk: true, press: true }; }
          return idle; }
        case 'top': { // 花の横に座って、じっと見てる。ペンギンが下まで来て登れずにいたら気づく
          const near = rectDist(rock, pen.x, pen.z) < 1.5 && pen.y < rock.top - 0.1;
          if (near) S.wait += dt; else { S.wait = Math.max(0, S.wait - dt); S.far += dt; }
          if (S.wait > 1.2) { S.st = 'notice'; S.t = 0; S.edge = edgeSpot(B, pen, rock); return idle; }
          if (S.far > 10) { S.far = 0; S.look = 2.2; say(); } /* なかなか来えへん：振り返って、ぷるっ */
          if (S.look > 0) { S.look -= dt; face(B, pen.x, pen.z, dt); return idle; }
          const sx = flower.x - 0.35, sz = flower.z + 0.1; const r = go(B, sx, sz, 0.4, 0.12); if (r.d < 0.12) face(B, flower.x, flower.z, dt, 1.5); return r; }
        // ---- 緩急：気持ちが前に出る所は速く、迷う・頑張る・気づく所は遅く、切り替わる所で止まる ----
        case 'notice': { // 気づく（遅い）：ふと下を見る → ゆっくりふちへ寄って、身を乗り出す → 止まる
          if (S.t < 0.9) { face(B, pen.x, pen.z, dt, 1.4); return idle; }
          const r = go(B, S.edge[0], S.edge[1], 0.35, 0.06); if (r.d > 0.06 && S.t < 4) return r;
          face(B, pen.x, pen.z, dt, 2); S.tiltT = -0.45; if (!S.held) S.held = S.t; if (S.t - S.held > 1.5) { S.st = 'down'; S.t = 0; S.held = 0; S.land = landSpot(B, pen, rock); say(); } return idle; }
        case 'down': { // 飛び降りる（速い）：決めたら一気に
          if (h.y < 0.05 && h.st === 'ground' && !onTop) { S.st = 'shuttle'; S.t = 0; S.n = 0; S.leg = 'rock'; S.mid = null; return idle; }
          if (S.t > 4 && onTop) { const ex = h.x - rock.x, ez = h.z - rock.z, hw = (rock.x1 - rock.x0) / 2, hd = (rock.z1 - rock.z0) / 2; const out = Math.abs(ex) / hw > Math.abs(ez) / hd ? [rock.x + Math.sign(ex || 1) * (hw + 1), h.z] : [h.x, rock.z + Math.sign(ez || 1) * (hd + 1)]; return go(B, out[0], out[1], 1, 0.05); }
          return go(B, S.land[0], S.land[1], 1, 0.05); }
        case 'shuttle': {
          if (S.n === 0) { // 往復1回目（速い）：「あそこ！あそこ！」
            if (S.leg === 'rock') { const b = baseSpot(B, pen, rock), r = go(B, b[0], b[1], 1, 0.1); if (r.d > 0.1 && S.t < 3) return r; face(B, rock.x, rock.z, dt, 6); S.tiltT = 0.4; if (!S.held) S.held = S.t; if (S.t - S.held > 0.55) { S.leg = 'pen'; S.held = 0; S.t = 0; } return idle; }
            const a = awaySpot(pen, rock, 0.9), r = go(B, a[0], a[1], 1, 0.1); if (r.d > 0.1 && S.t < 3) return r; face(B, pen.x, pen.z, dt, 6); if (!S.held) { S.held = S.t; say(); } if (S.t - S.held > 0.5) { S.held = 0; S.t = 0; S.n = 1; S.leg = 'rock'; S.mid = null; } return idle; }
          // 往復2回目（途中で止まる）：岩へ向かいかけて、半分で止まって振り返る。来ないのを見て、待つ
          if (!S.mid) { const b = baseSpot(B, pen, rock); S.mid = [(h.x + b[0]) / 2, (h.z + b[1]) / 2]; }
          const r = go(B, S.mid[0], S.mid[1], 0.8, 0.08); if (r.d > 0.08 && S.t < 3) return r;
          if (!S.held) S.held = S.t; const w = S.t - S.held; if (w > 0.35) face(B, pen.x, pen.z, dt, 1.8); /* 一瞬おいて、ゆっくり振り返る */
          if (w > 2.0) { S.st = 'nudge'; S.t = 0; S.held = 0; S.k = 0; } return idle; }
        case 'nudge': { // 押す（遅い・重い）：うしろに回って、ぐっ、ぐっ、ぐっと区切って押す
          const ax = rock.x - pen.x, az = rock.z - pen.z, al = Math.hypot(ax, az) || 1, ux = ax / al, uz = az / al, bx = pen.x - ux * (B.radius + 0.12), bz = pen.z - uz * (B.radius + 0.12);
          if (!S.pushing) { const r = go(B, bx, bz, 0.45, 0.08); if (r.d > 0.08 && S.t < 5) return r; S.pushing = S.t; }
          face(B, rock.x, rock.z, dt, 6); const k = S.t - S.pushing, per = 0.85, c = Math.floor(k / per), f = k - c * per, L = ctx.lift || (() => {});
          B.h.x = pen.x - ux * (B.radius + 0.06); B.h.z = pen.z - uz * (B.radius + 0.06);
          if (c < 3) { if (f < 0.3) L(-0.25 * (f / 0.3), 0.2, 0); /* 縮んで溜めて */ else if (f < 0.5) { L(0.3, 0.5, 0); ctx.push && ctx.push(ux * 0.55 * dt, uz * 0.55 * dt); } /* ぐっ（ペンギンが少し動く） */ else L(0, 0, 0); return idle; }
          L(null, 0, 0); S.pushing = 0; S.st = 'lift'; S.t = 0; S.n = 0; return idle; }
        case 'lift': { // 持ち上げる（遅い→速い）：そろっともぐって、ゆっくり溜めて、震えながら伸びる。潰れる瞬間だけ一気に
          if (!S.under) { const r = go(B, pen.x, pen.z, 0.35, 0.08); if (r.d > 0.08 && S.t < 3) return r; S.under = S.t; }
          const k = S.t - S.under, H = S.n === 0 ? 0.14 : 0.08, A = 0.7, P = S.n === 0 ? 1.4 : 1.0; /* 2回目は疲れて、短く低い */ B.h.x = pen.x; B.h.z = pen.z;
          const L = ctx.lift || (() => {});
          if (k < A) L(-0.4 * Math.sin((k / A) * Math.PI / 2), 0.1, 0); /* 溜め：ゆっくり沈む */
          else if (k < A + P) { const u = (k - A) / P, e = 1 - Math.pow(1 - u, 2); L(-0.4 + 0.85 * e, 0.3 + 0.7 * u, H * e * (1 + 0.15 * Math.sin(k * 38))); } /* 踏ん張り */
          else if (!S.did) { S.did = 1; L(null, 0, 0); say('big'); } /* 潰れ：一気にベチャッ */
          if (k > A + P + 0.7) { S.n++; S.under = 0; S.did = 0; S.t = 0; if (S.n >= 2) { S.st = 'look'; S.t = 0; S.front = awaySpot(pen, rock, 0.85); } else { const a = pen.yaw + Math.PI / 2; B.h.x += Math.sin(a) * 0.35; B.h.z += Math.cos(a) * 0.35; } }
          return idle; }
        case 'look': { // 見上げる（遅い）：のそっと出てきて、ゆっくり見上げる
          const r = go(B, S.front[0], S.front[1], 0.3, 0.08); if (r.d > 0.08 && S.t < 4) return r;
          face(B, pen.x, pen.z, dt, 1.5); if (!S.held) S.held = S.t; S.tiltT = Math.min(0.5, (S.t - S.held) * 0.4); if (S.t - S.held > 1.4) { S.st = 'wish'; S.t = 0; S.held = 0; S.wished = true; } return idle; }
        case 'wish': face(B, pen.x, pen.z, dt); S.tiltT = 0.5; if (S.t > 3 && ((S.t % 3.5) < dt)) say(); return idle; /* 見上げたまま待つ。たまに、ぷるっ */
        case 'grow': face(B, pen.x, pen.z, dt); return idle;
        case 'follow': default: { // ペンギンが2m離れるまでは、その場で見てる。離れたら右うしろへ歩いてくる（遠い時だけ急ぐ）
          if (!S.moving && dPen > 2.0) S.moving = true;
          if (S.moving) { const a = pen.yaw - Math.PI * 0.7, tx = pen.x + Math.sin(a) * (0.8 + B.radius), tz = pen.z + Math.cos(a) * (0.8 + B.radius); const r = go(B, tx, tz, dPen > 4 ? 1 : 0.55, 0.3); if (r.d < 0.3) S.moving = false; return r; }
          if (dPen > 0.6) face(B, pen.x, pen.z, dt, 1.2); return idle; }
      } }
    return { S, tick, reset };
  }

  // 岩の上の花（プルプルが見つけて登りたくなるもの）
  function flower(scene, x, y, z) { const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.22, 5), new THREE.MeshStandardMaterial({ color: 0x4f8a3a })); st.position.y = 0.11; g.add(st);
    const pm = new THREE.MeshStandardMaterial({ color: 0xffb0d0, emissive: 0x6a2040, roughness: 0.6, flatShading: true }); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), pm); const a = i / 5 * Math.PI * 2; p.scale.set(1, 0.4, 0.6); p.position.set(Math.cos(a) * 0.05, 0.23, Math.sin(a) * 0.05); g.add(p); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffe36a, emissive: 0x806010 })); c.position.y = 0.24; g.add(c); g.position.set(x, y, z); scene.add(g); return { g, x, y, z }; }

  return { SIZE, PEN_H, penguin, bubble, brain, flower };
})();
