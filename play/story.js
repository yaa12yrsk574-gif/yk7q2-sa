// ---- 序盤：プレイヤーはペンギン（0.8m）。プルプル（0.4m）は自分で動く。岩に登れるのはプルプルだけ → ペンギンが取り残される → 「一緒に行きたい」 ----
// 叶うと乗せられる体（0.7m）になる。乗った時に初めてプルプルを操作できる（それまでは、ついて行くのが主）
// ここは「ペンギン」と「プルプルの頭の中（自分で動く・芝居）」だけ。体の物理は body.js、見た目は skin.js、つなぐのは app.js
window.PlayStory = (() => {
  const SIZE = { small: 0.4, big: 0.7, huge: 1.15 }, PEN_H = 0.8, STEP = 0.22; /* ペンギンが乗り越えられる段差 */
  const turnTo = (a, b, s) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-s, Math.min(s, d)); };
  const rectDist = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

  // ---- ペンギン：見た目は狩り場と同じ（shared/penguin.js）を 0.8m に縮める。よちよち歩く。跳べないので高い段には登れない ----
  let world0 = null;
  function penguin(scene, world) { world0 = world;
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); scene.add(g);
    const model = window.PenguinModel.make(THREE); model.scale.setScalar(PEN_H / window.PenguinModel.H); body.add(model);
    const P = { g, x: 0, z: 0, y: 0, vy: 0, yaw: 0, v: 0, ph: 0, r: 0.2, H: PEN_H, seated: false, raise: 0 };
    function blocked(world, x, z) { return world.boxes.some(b => b.top > P.y + STEP && rectDist(b, x, z) < P.r && rectDist(b, P.x, P.z) >= P.r - 0.001); }
    P.step = (dt, mx, mz, walk, world) => { const mag = Math.min(1, Math.hypot(mx, mz)), top = P.swim ? 2.6 : walk ? 0.9 : 1.7; /* ペンギンは泳ぐ方が速い */
      if (mag > 0.05) P.yaw = turnTo(P.yaw, Math.atan2(mx, mz), 9 * dt);
      P.v += Math.max(-8 * dt, Math.min(5 * dt, mag * top - P.v));
      const nx = P.x + Math.sin(P.yaw) * P.v * dt, nz = P.z + Math.cos(P.yaw) * P.v * dt;
      if (!blocked(world, nx, nz)) { P.x = nx; P.z = nz; } else if (!blocked(world, nx, P.z)) P.x = nx; else if (!blocked(world, P.x, nz)) P.z = nz; else P.v *= 0.3;
      const BE = world.beach; if (BE && P.z > BE.SWIM_MAX) { P.z = BE.SWIM_MAX; P.v *= 0.5; } /* 沖へは行かない */
      const fl = BE ? BE.floorAt(P.z) : 0; P.swim = fl < -0.3;
      if (fl < 0 && P.raise <= 0) { P.y = P.swim ? -0.42 + 0.03 * Math.sin(P.ph * 0.25) : fl; P.vy = 0; P.ph += dt * (P.v * 9 + 0.0001); P.pose(dt); return; } /* 海：浅い所は足が沈む、深い所は泳ぐ */
      const gy = world.groundAt(P.x, P.z, P.y + STEP);
      if (P.raise > 0) { P.y = gy + P.raise; P.vy = 0; } else if (P.y > gy + 0.02) { P.vy -= 16 * dt; P.y = Math.max(gy, P.y + P.vy * dt); if (P.y === gy) P.vy = 0; } else { P.y = gy; P.vy = 0; }
      P.ph += dt * (P.v * 9 + 0.0001); P.pose(dt); }; /* 歩幅が小さいので、跳ねる回数は多め */
    // よちよち：左右に揺れて弾む。立ち止まったら収まる
    // とことこ：横には揺れず、1歩ごとにちょこんと跳ねる（縦揺れ）
    let sway = 0, lean = 0; P.pose = (dt, still) => { const a = still ? 0 : Math.min(1, P.v / 1.2); sway += (a - sway) * Math.min(1, dt * 8); body.rotation.z = 0; lean += ((P.swim && !still ? 1.15 * Math.min(1, P.v / 0.8) + 0.25 : 0) - lean) * Math.min(1, dt * 5); body.rotation.x = lean; body.position.y = P.swim ? 0.25 * Math.sin(lean) : Math.pow(Math.abs(Math.sin(P.ph)), 0.7) * 0.07 * sway; };
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
    const S = {}; const reset = () => Object.assign(S, { crabDone: false, tries: 0, observed: false, back: false, cl: null, fv: 0, lap0: 0, r: null, rt: 0, cd: {}, curT: null, nextG: null, walkT: 0, stillT: 0, mimic: false, mimicked: 0, mt: null, it: null, seq: null, ca: null, said: 0, mid: null, k: 0, tiltT: 0, held: 0, n: 0, leg: null, pushing: 0, under: 0, did: 0, front: null, edge: null, st: 'drift', t: 0, dr: null, w0: null, mt2: null, pat: 0, hold: 0, steps: 0, eyed: false, sprouted: false, clawT: 0, soft: false, clawPose: 0, stage: 1, got: 0, q: '', wingSprout: 0, rt: 0, got3: 0, cr: null, ct: 0, carryOK: false, afterGrow: null, crouch: false, wait: 0, far: 0, tilt: 0, emo: null, emoT: 0, wished: false, look: 0, land: null, rock: null, tries: 0, cool: 0, moving: false });
    reset();
    // 記号や絵は出さない。気持ちは全部 動きで出す（プレイヤーが読み取る）。say は「ぷるっ」と体で反応するだけ
    let sq = null; const say = (k) => { if (sq) sq(k === 'big' ? 2.4 : 1.4); };
    const go = (B, x, z, speed, stopAt) => { const h = B.h, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz); if (d < (stopAt || 0.15)) return { mx: 0, mz: 0, walk: true, d }; const m = Math.min(1, 0.3 + d / 0.5) * speed; /* 着く直前までちゃんと歩く（ゆるめすぎると、いつまでも着かへん） */ return { mx: dx / d * m, mz: dz / d * m, walk: speed < 0.95, d }; };
    const face = (B, x, z, dt, sp) => { B.h.yaw = turnTo(B.h.yaw, Math.atan2(x - B.h.x, z - B.h.z), (sp || 2.5) * dt); };
    const idle = { mx: 0, mz: 0, walk: true };
    const backTo = (B, x, z, sp, dt, fx, fz) => { const h = B.h, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz); if (d > 0.02) { const k = Math.min(d, sp * dt) / d; h.x += dx * k; h.z += dz * k; } h.yaw = turnTo(h.yaw, Math.atan2(fx - h.x, fz - h.z), 8 * dt); h.v = 0; h.st = 'ground'; return d; }; /* 前を向いたまま、さっと下がる（体の物理は使わない） */
    const BE = world.beach, LAND = [-2.6, BE.SHORE - 0.7]; /* 打ち上がる所：スタート（海向き）の右前 */ let glow = () => {};
    // 跳び乗る岩：この子の「跳ぶ」で届く中で、ペンギンが越えられない一番高い岩（できれば 0.6m）
    function pickRock(B) { const cr = world.crabRock; if (cr) { flower.g.position.set(cr.x - 0.6, cr.top, cr.z - 0.3); flower.x = flower.g.position.x; flower.y = cr.top; flower.z = flower.g.position.z; return cr; } const reach = B.M.jump ? B.M.jump.J.h * 0.9 : 1.1;
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
    const G = (B, slot) => window.PlayBody.gesture(B, slot), pick = a => a[(Math.random() * a.length) | 0];
    const ACT = { flower: ['g_sniff', 'g_tilt'], stone: ['g_poke', 'g_peek'], puddle: ['g_peek', 'g_shake'], bfly: ['g_hop', 'g_look'], fruit: ['g_sniff', 'g_poke'] };
    // ---- ふだん：好奇心のまま勝手に動く。気になるものに寄り道、ペンギンのマネ、ぐるぐる、うとうと。離れすぎたら、はっと戻る ----
    function roam(B, pen, dt, ctx, rock, dPen) { const h = B.h, moving = pen.v > 0.25; S.st = 'roam'; if (!S.r) S.r = 'near'; S.rt = (S.rt || 0) + dt; S.mimic = false;
      if (moving) { S.walkT = (S.walkT || 0) + dt; S.stillT = 0; } else { if (S.walkT > 2.5 && S.r === 'near' && Math.random() < 0.65) { S.r = 'circle'; S.rt = 0; S.ca = null; } S.walkT = 0; S.stillT = (S.stillT || 0) + dt; }
      // 崖：ペンギンが岩の近くまで来たら、上の花に気づく（序盤だけ）
      if (ctx.phase === 'small' && !S.wished && !S.crabDone && rectDist(rock, pen.x, pen.z) < 4 && pen.y < 0.1 && S.r !== 'act' && world.crab.st === 'climb') { G(B, null); S.st = 'crabSee'; S.t = 0; S.tries = 0; say(); return idle; }
      const toPen = (sp, stop) => { const a = pen.yaw - Math.PI * 0.7, tx = pen.x + Math.sin(a) * (0.75 + B.radius), tz = pen.z + Math.cos(a) * (0.75 + B.radius); return go(B, tx, tz, sp, stop || 0.25); };
      switch (S.r) {
        case 'near': {
          if (h.gest && dPen < 3) return idle;
          if (dPen > 2.2) { G(B, null); if (moving && !S.mimicked && Math.random() < 0.5) { S.r = 'mimic'; S.rt = 0; S.mimicked = 1; return idle; } return toPen(dPen > 4 ? 1 : 0.6); }
          if (!moving) S.mimicked = 0;
          if (S.stillT > 7) { S.r = 'doze'; S.rt = 0; return idle; }
          S.curT = (S.curT == null ? 3 : S.curT) - dt;
          if (S.curT <= 0) { S.curT = 3 + Math.random() * 3; const now = performance.now() / 1000, c = world.interests.filter(it => (S.cd[it.__id || (it.__id = 'i' + Math.random())] || 0) < now && (it.kind !== 'fruit' || it.f.st === 'ground') && Math.hypot(it.x - h.x, it.z - h.z) < 4.5 && Math.hypot(it.x - pen.x, it.z - pen.z) < 6 && rectDist(rock, it.x, it.z) > 0.3);
            if (c.length) { S.it = pick(c); S.cd[S.it.__id] = now + 25; S.r = 'go'; S.rt = 0; return idle; } }
          S.nextG = (S.nextG == null ? 2 : S.nextG) - dt; if (S.nextG <= 0) { S.nextG = 2.5 + Math.random() * 3; G(B, pick(['g_look', 'g_tilt', 'g_shake', 'g_sniff', 'g_look'])); }
          if (dPen > 0.6) face(B, pen.x, pen.z, dt, 1.2); return idle; }
        case 'mimic': { // ペンギンの横に並んで、同じ速さで、同じリズムでとことこ（跳ねるのは app 側でペンギンの足に合わせる）
          S.mimic = true; const a = pen.yaw + Math.PI / 2, ox = Math.sin(a) * (0.55 + B.radius), oz = Math.cos(a) * (0.55 + B.radius), tx = pen.x - ox + Math.sin(pen.yaw) * 0.1, tz = pen.z - oz + Math.cos(pen.yaw) * 0.1, dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz);
          if (!moving || S.rt > 7) { S.r = 'near'; S.rt = 0; if (!moving) { h.yaw = pen.yaw; G(B, 'g_hop'); } return idle; }
          const sp = Math.min(1, (pen.v / 1.7) + d * 0.8); return d > 0.05 ? { mx: (dx / d) * sp, mz: (dz / d) * sp, walk: pen.v < 1.2, d } : { mx: Math.sin(pen.yaw) * pen.v / 1.7, mz: Math.cos(pen.yaw) * pen.v / 1.7, walk: true }; }
        case 'go': { // 気になるものへ（ちょうちょは追いかける）
          const it = S.it, reach = it.kind === 'bfly' ? 0.55 : it.kind === 'puddle' ? 0.75 : B.radius + 0.1, r = go(B, it.x, it.z, it.kind === 'bfly' ? 1 : 0.7, reach);
          if (dPen > 6.5 || S.rt > 8) { S.r = 'back'; S.rt = 0; S.said = 0; return idle; } if (r.d > reach) return r;
          S.r = 'act'; S.rt = 0; S.seq = ACT[it.kind].slice(); return idle; }
        case 'act': { face(B, S.it.x, S.it.z, dt, 4);
          if (!h.gest) { if (S.seq.length) G(B, S.seq.shift()); else { S.r = dPen > 3 ? 'back' : 'near'; S.rt = 0; S.said = 0; } } return idle; }
        case 'back': { // 夢中になってた！ はっ → 急いで戻る → ぐるぐる
          if (!S.said) { S.said = 1; say(); } if (S.rt < 0.35) { face(B, pen.x, pen.z, dt, 6); return idle; }
          const r = go(B, pen.x, pen.z, 1, 1.1); if (r.d > 1.1 && S.rt < 8) return r; S.r = 'circle'; S.rt = 0; S.ca = null; return idle; }
        case 'circle': { // ペンギンのまわりをぐるぐる（1周半）→ ぴょんぴょん
          const R = 0.7 + B.radius; if (S.ca == null) { S.ca = Math.atan2(h.x - pen.x, h.z - pen.z); S.cs = S.ca; } S.ca += dt * 3.2;
          if (S.ca - S.cs > Math.PI * 3 || S.rt > 5) { S.r = 'near'; S.rt = 0; face(B, pen.x, pen.z, dt, 9); G(B, 'g_hop'); return idle; }
          const tx = pen.x + Math.sin(S.ca + 0.5) * R, tz = pen.z + Math.cos(S.ca + 0.5) * R; return go(B, tx, tz, 1, 0.02); }
        case 'doze': { // ペンギンがじっとしてたら、横にくっついて、うとうと
          if (moving || dPen > 2.5) { G(B, null); S.r = 'near'; S.rt = 0; say(); S.stillT = 0; return idle; }
          const a = pen.yaw + Math.PI / 2, tx = pen.x + Math.sin(a) * (B.radius + 0.22), tz = pen.z + Math.cos(a) * (B.radius + 0.22), r = go(B, tx, tz, 0.35, 0.06);
          if (r.d > 0.06 && S.rt < 4) return r; h.yaw = turnTo(h.yaw, pen.yaw, 2 * dt); if (!h.gest) G(B, 'g_doze'); return idle; }
      } return idle; }
    // 泳ぐ：体ごと水に浮かんで進む（体の物理はお休み）
    function swimTo(B, x, z, dt) { const h = B.h, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(0.95, d * 2); h.yaw = turnTo(h.yaw, Math.atan2(dx, dz), 3 * dt); h.x += Math.sin(h.yaw) * sp * dt; h.z += Math.cos(h.yaw) * sp * dt;
      const fl = BE.floorAt(h.z); h.y = fl < -0.05 ? Math.max(fl, -0.14) + 0.03 * Math.sin(S.t * 2.4) : 0; h.st = 'ground'; h.v = 0; h.gest = null; }
    // 乗せてみる：ペンギンが背中に乗る → 沈む → 立とうとする。脚が足りたら立てる（＝ここから操作できる）、足りへんかったら潰れる
    function carryTick(B, pen, dt, ctx) { const L = ctx.lift || (() => {}); if (!S.cr) { S.cr = window.PlayCarry.measure(B); S.ct = 0; S.st = 'carryTry'; S.crouch = false; }
      S.ct += dt; const k = S.ct, ok = S.cr.ratio >= 1;
      if (k < 0.5) L(-0.2 - 0.18 * (k / 0.5), 0.25, 0); /* 乗られて、むにっと沈む */
      else if (ok) { if (k < 2.0) { const u = (k - 0.5) / 1.5, e = 1 - Math.pow(1 - u, 2); L(-0.38 * (1 - e), 0.9 * (1 - u), 0); } else { L(null, 0, 0); S.cr = null; S.carryOK = true; S.st = 'ride'; say('big'); ctx.carryDone && ctx.carryDone(true); } } /* 震えながら、ぐぐっと立つ */
      else { if (k < 1.7) { const u = (k - 0.5) / 1.2; L(-0.38 + 0.22 * Math.sin(Math.min(1, u * 1.3) * Math.PI / 2), 1, 0); } else if (k < 2.6) { if (!S.did) { S.did = 1; say('big'); } L(-0.45, 0, 0); } /* がんばる → ベチャッ */
        else { L(null, 0, 0); S.did = 0; S.cr = null; S.stage = 2; S.st = 'wantTool'; S.t = 0; S.back = false; ctx.carryDone && ctx.carryDone(false); } }
      return null; }
    function tick(B, pen, dt, ctx) { S.t += dt; S.cool = Math.max(0, S.cool - dt); if (S.emoT > 0) { S.emoT -= dt; if (S.emoT <= 0) S.emo = null; } sq = ctx.squash; glow = ctx.glow || (() => {}); S.tilt += ((S.tiltT || 0) - S.tilt) * Math.min(1, dt * 5); S.tiltT = 0; /* のぞき込む(−)・見上げる(＋)：その状態が毎フレーム決める */
      const h = B.h, dPen = Math.hypot(pen.x - h.x, pen.z - h.z), rock = S.rock || (S.rock = pickRock(B)), onTop = h.y > rock.top - 0.05 && rectDist(rock, h.x, h.z) < 0.01;
      if (ctx.carry) return carryTick(B, pen, dt, ctx);
      if (ctx.riding) { S.st = 'ride'; return null; }
      if (S.st === 'ride') S.st = 'follow';
      switch (S.st) {
        // ---- 出会い（浜）：沖から光る塊が流れてくる → 打ち上がる → 近づくと固まる → 逃げかけるけど波にビビって戻る → 待つと寄ってきて足をつつく → ついてくる ----
        case 'drift': { // 沖からぷかぷか（中身はプルプル。関節の元だけうっすら光る）。クラゲか石か分からへん
          if (!S.dr) S.dr = { x: LAND[0] - 1.2, z: BE.SHORE + 30 }; const tz = BE.SHORE + 1.0;
          if (S.dr.z > tz) { S.dr.z = Math.max(tz, S.dr.z - (0.9 + Math.min(1.3, (S.dr.z - tz) * 0.07)) * dt); S.dr.x += (LAND[0] - S.dr.x) * Math.min(1, dt * 0.12); }
          h.x = S.dr.x + Math.sin(S.t * 0.6) * 0.25; h.z = S.dr.z; h.y = -0.08 + 0.05 * Math.sin(S.t * 1.7); /* 上だけ水から出てる */ h.yaw = Math.PI + Math.sin(S.t * 0.4) * 0.8; h.st = 'ground'; h.v = 0; h.gest = null; glow(0.5 + 0.5 * Math.sin(S.t * 2.2));
          if (S.dr.z <= tz && S.t > 3) { S.st = 'wash'; S.t = 0; BE.surge(1); S.w0 = [h.x, h.z]; } return null; }
        case 'wash': { // 波に押されて、砂の上にべちゃっ。そのまま動かへん
          const u = Math.min(1, S.t / 1.2), e = 1 - Math.pow(1 - u, 2); h.x = S.w0[0] + (LAND[0] - S.w0[0]) * e; h.z = S.w0[1] + (LAND[1] - S.w0[1]) * e; h.y = -0.08 * (1 - e) + 0.22 * Math.sin(u * Math.PI); h.yaw += Math.sin(S.t * 3) * 0.02; glow(0.6 * (1 - u) + 0.3);
          if (u >= 1) { h.y = 0; S.st = 'lie'; S.t = 0; say('big'); } return null; }
        case 'lie': { glow(Math.max(0.15, 0.3 - S.t * 0.05)); // じっとしてる。ペンギンが近づくと、ぷるっと震えて固まる
          if (dPen < 3.2) { S.st = 'freeze'; S.t = 0; say(); } else if (S.t > 14) { S.t = 6; say(); } /* なかなか来えへん：自分でぷるっ（生きてるのが分かる） */ return idle; }
        case 'freeze': { glow(0.15); face(B, pen.x, pen.z, dt, 0.5); // 様子見（ゆっくりこっちを向くだけ）
          if (dPen < 1.7) { const ax = h.x - pen.x, l = Math.abs(ax) || 1; S.mt = [h.x + ax / l * 0.6, BE.SHORE - 0.35]; S.st = 'flee'; S.t = 0; } /* 波打ち際まで（足元が濡れるくらい） */ return idle; }
        case 'flee': { const r = go(B, S.mt[0], S.mt[1], 1, 0.1); // 海の方へ逃げる
          if (r.d > 0.1 && S.t < 1.5) return r; BE.surge(1.4); S.st = 'scared'; S.t = 0; say('big'); return idle; }
        case 'scared': { // ザバッ！ 波にビビって、あわてて砂の方へ戻る（逃げ場がない）
          if (S.t < 0.4) { face(B, h.x, h.z + 5, dt, 6); return idle; }
          if (!S.mt2) { const sx = Math.sign(h.x - pen.x) || 1; S.mt2 = [h.x + sx * 1.4, BE.SHORE - 2.0]; }
          const r = go(B, S.mt2[0], S.mt2[1], 1, 0.12); if (r.d > 0.12 && S.t < 3) return r; S.mt2 = null; S.st = 'wait'; S.t = 0; S.pat = 0; S.hold = 0; S.mt = null; G(B, 'g_shake'); return idle; }
        case 'wait': { // ペンギンが止まって待つと、一歩ずつ寄ってくる。追い回すと、離れる
          const toward = pen.v > 0.25 && (Math.sin(pen.yaw) * (h.x - pen.x) + Math.cos(pen.yaw) * (h.z - pen.z)) / Math.max(dPen, 1e-3) > 0.5;
          if (toward && dPen < 2.8) { S.st = 'shy'; S.t = 0; S.pat = 0; S.mt = null; return idle; }
          if (dPen > 6) { S.pat = 0; S.mt = null; return go(B, pen.x, pen.z, 0.6, 4.5); } /* 遠くへ行ったら、距離をあけてついていく */
          if (pen.v < 0.12) S.pat += dt; else { S.pat = Math.max(0, S.pat - dt * 3); S.mt = null; }
          if (dPen < B.radius + pen.r + 0.38) { S.st = 'poke'; S.t = 0; S.did = 0; S.mt = null; return idle; }
          if (S.hold > 0) { S.hold -= dt; face(B, pen.x, pen.z, dt, 2); return idle; }
          if (S.pat > 1.6 && !S.mt) { const l = Math.max(dPen, 1e-3), st = Math.min(0.55 + 0.15 * (S.steps || 0), Math.max(0.15, dPen - (B.radius + pen.r + 0.2))); /* だんだん大胆に */ S.mt = [h.x + (pen.x - h.x) / l * st, h.z + (pen.z - h.z) / l * st]; S.steps = (S.steps || 0) + 1; }
          if (S.mt) { const r = go(B, S.mt[0], S.mt[1], 0.55, 0.12); if (r.d > 0.12 && S.t < 99) return r; S.mt = null; S.hold = Math.max(0.25, 0.6 - S.steps * 0.1); if (S.steps === 2) G(B, 'g_tilt'); return idle; } /* そろっと一歩 → 止まって見る */
          face(B, pen.x, pen.z, dt, 1.5); return idle; }
        case 'shy': { // さっと下がる（前を向いたまま）
          if (!S.mt) { const ax = h.x - pen.x, az = h.z - pen.z, l = Math.hypot(ax, az) || 1; S.mt = [h.x + ax / l * 0.9, Math.min(BE.SHORE - 0.8, h.z + az / l * 0.9)]; }
          if (backTo(B, S.mt[0], S.mt[1], 1.6, dt, pen.x, pen.z) > 0.03 && S.t < 1.2) return null;
          S.mt = null; S.st = 'wait'; S.t = 0; S.pat = 0; S.hold = 0.6; return idle; }
        case 'poke': { face(B, pen.x, pen.z, dt, 4); // 足をつつく → はっと下がる → 首かしげ
          if (!S.did) { S.did = 1; G(B, 'g_poke'); return idle; }
          if (S.did === 1) { if (h.gest && S.t < 2.5) return idle; S.did = 2; say(); const ax = h.x - pen.x, az = h.z - pen.z, l = Math.hypot(ax, az) || 1; S.mt = [h.x + ax / l * 0.45, h.z + az / l * 0.45]; S.t = 0; return idle; }
          if (S.did === 2) { if (backTo(B, S.mt[0], S.mt[1], 1.8, dt, pen.x, pen.z) > 0.03 && S.t < 0.6) return null; S.did = 3; G(B, 'g_tilt'); S.t = 0; return idle; }
          if (h.gest && S.t < 2.5) return idle; S.st = 'tag'; S.t = 0; S.did = 0; S.mt = null; S.eyed = false;
          { const cz = Math.min(BE.SHORE - 0.5, h.z + 1.3); BE.crab.go(h.x - 3.5, h.x + 3.5, cz); } /* 小ガニが目の前を横切る（伏線） */ return idle; }
        case 'tag': { // 歩き出したら、距離をあけてついてくる（まだ人見知り）
          const c = BE.crab; if (!S.eyed && c.st === 'walk' && Math.hypot(c.x - h.x, c.z - h.z) < 3.5) { S.st = 'crabEye'; S.t = 0; return idle; }
          if (pen.z < BE.SAND0 - 0.5 || (S.eyed && S.t > 25)) { S.st = 'roam'; S.r = 'near'; S.t = 0; S.curT = 2.5; BE.crab.auto = true; return idle; } /* 草原へ → ふだんの好奇心モード */
          if (dPen > 2.3) { const bx = pen.x - Math.sin(pen.yaw) * 1.5, bz = pen.z - Math.cos(pen.yaw) * 1.5; return go(B, bx, bz, dPen > 4 ? 1 : 0.6, 0.3); }
          face(B, pen.x, pen.z, dt, 1.2); return idle; }
        case 'crabEye': { const c = BE.crab; S.tiltT = -0.15; // 小ガニを目で追う → ちょっとついて行きかける → はっ
          if (c.st === 'walk') face(B, c.x, c.z, dt, 3);
          if (S.t > 1.4 && S.t < 3.2 && c.st === 'walk') return go(B, c.x, c.z, 0.35, 0.5);
          if (S.t > 3.4 || c.st !== 'walk') { S.eyed = true; S.st = 'tag'; S.t = 0; say(); G(B, 'g_hop'); } return idle; }
        // ---- 1つ目の願い：カニ。見とれる → 真似してずり落ちる×2 → カニを見に行く → 工房に行きたがる → 爪を作ったらもう一回 ----
        case 'crabSee': { const c = world.crab; face(B, c.x, c.z, dt, 3); S.tiltT = 0.3 + Math.min(0.25, c.y * 0.2); /* 見上げて、登っていくのを目で追う */
          if (S.t > 3.2 || c.st === 'top') { S.st = 'climbTry'; S.t = 0; say('big'); } return idle; }
        case 'climbTry': { // 壁の前まで行って、飛びつく
          if (!S.cl) { const wx = rock.x - 0.35, wz = rock.z1 + B.radius + 0.06, r = go(B, wx, wz, 0.8, 0.06); if (r.d > 0.06 && S.t < 5) return r;
            if (S.soft && !S.clawPose) { S.clawPose = 1; G(B, 'g_claw'); } if (S.clawPose === 1) { if (h.gest && S.t < 9) { face(B, rock.x, rock.z, dt, 3); return idle; } S.clawPose = 2; } /* 壁の前で、マネした爪を作ってみせる */
            h.yaw = Math.PI; S.cl = window.PlayClimb.start(B, rock.top); S.fall = 0; }
          const c = window.PlayClimb.step(S.cl, dt); h.y = c.y; h.yaw = Math.PI; h.st = 'ground'; h.v = 0; if (B.M.walk) { h.gm = B.M.walk; h.ph = (h.ph + dt * 24 * (c.ratio >= 1 ? 1 : 0.6 + c.ratio)) % B.M.walk.len; } S.tiltT = 1.45; /* 腹を壁に向けて、歩きの動きで掻く */
          if (c.st === 'top') { h.z = rock.z1 - B.radius - 0.25; h.y = rock.top; h.gm = null; S.cl = null; S.crabDone = true; S.st = 'crabTop'; S.t = 0; say('big'); return null; }
          if (c.st === 'fail') { S.cl = null; S.tries++; S.st = 'climbFall'; S.t = 0; S.fv = 0; if (S.soft) { ctx.squash && ctx.squash(3.2); say('big'); S.soft = false; S.clawPose = 0; } } return null; } /* 力を入れた瞬間、先がぐにゃっと丸に戻る */
        case 'climbFall': { // ずり落ちて、べちゃ
          if (h.y > 0) { S.fv -= 16 * dt; h.y = Math.max(0, h.y + S.fv * dt); S.tiltT = 1.2; if (h.y === 0) say('big'); return null; }
          h.z = rock.z1 + B.radius + 0.12; if (S.t < 1.3) { face(B, rock.x, rock.z, dt, 2); S.tiltT = 0.35; return idle; } /* 見上げる */
          if (S.tries < 2) { S.st = 'climbTry'; S.t = 0; } else if (!S.observed) { S.st = 'observe'; S.t = 0; } else { S.st = 'wantTool'; S.t = 0; S.back = false; } return idle; }
        case 'observe': { // 自分からカニを見に行って、じーっと見る（ゆっくり・骨が透ける・爪先が光る）
          const c = world.crab, ox = c.x + 0.9, oz = rock.z1 + 1.1, r = go(B, ox, oz, 0.6, 0.08); if (r.d > 0.08 && S.t < 4) return r;
          face(B, c.x, c.z, dt, 3); S.tiltT = 0.25 + Math.min(0.3, c.y * 0.25); if (!S.lap0) S.lap0 = c.laps + 1;
          if (S.t > 2.5 && !S.sprouted) { S.sprouted = true; ctx.sprout && ctx.sprout(); say('big'); S.clawT = 0.8; } /* にゅっ：マネしたくて、体の横から突起が生える */
          if (S.sprouted && !h.gest) { S.clawT -= dt; if (S.clawT <= 0) { G(B, 'g_claw'); S.clawT = 1.2 + Math.random(); } } /* カニの爪に合わせて、先をくいっと曲げてマネする */
          if ((c.laps >= S.lap0 && S.t > 9) || S.t > 18) { S.observed = true; S.lap0 = 0; S.st = 'climbTry'; S.tries = 2; S.t = 0; S.soft = true; G(B, 'g_hop'); } return idle; } /* よし、マネできた！ → すぐ自分で試しに行く（形は一瞬なら作れるけど、保てない） */
        case 'wantTool': { // 工房に行きたい：ペンギンのそばで、ぴょんぴょん。工房から戻ったら、もう一回
          if (S.back) { S.back = false; S.tries = 0; S.st = S.stage === 2 ? 'invite' : 'climbTry'; S.t = 0; S.crouch = false; return idle; }
          if (dPen > 2) return go(B, pen.x, pen.z, 0.8, 1.2);
          face(B, pen.x, pen.z, dt, 3); if (!h.gest && S.t > 2.5) { S.t = 0; G(B, pick(['g_hop', 'g_hop', 'g_tilt'])); } return idle; }
        case 'crabTop': { // 登れた！ 上でぴょんぴょん → 下を見たら、ペンギンが取り残されてる（→ 2つ目の願い）
          if (S.t > 0.3 && !S.did) { S.did = 1; G(B, 'g_hop'); } if (S.t > 2 && !h.gest) { S.did = 0; S.st = 'top'; S.t = 0; S.wait = 0; S.far = 0; } return idle; }
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
        case 'wish': face(B, pen.x, pen.z, dt); S.tiltT = 0.5; if (S.t > 3 && ((S.t % 3.5) < dt)) say(); /* 見上げたまま待つ。たまに、ぷるっ */
          if (S.t > 4.5) { S.st = 'turtleCall'; S.t = 0; BE.turtles.start(); } return idle;
        // ---- 2つ目の願いの叶え方：浜で親子のカメ（子を背中に乗せて歩く）→ 海の浅瀬に光のかけら → 自分から海に入って集める → 大きくなる → 工房で脚 → 乗せて立てる ----
        case 'turtleCall': { const T = BE.turtles; face(B, T.x, T.z, dt, 2.5); S.tiltT = 0.15; // はっ：浜の方に何かいる
          if (S.t > 0.5 && !S.did) { S.did = 1; say('big'); } if (S.t > 1.6) { S.st = 'guide'; S.t = 0; S.did = 0; } return idle; }
        case 'guide': { const T = BE.turtles, dT = Math.hypot(T.x - h.x, T.z - h.z); // ペンギンを連れて浜へ。先を行って、振り返って待つ
          if (dT < 3.2 && dPen < 6) { S.st = 'turtleWatch'; S.t = 0; T.walk(); return idle; }
          if (dPen > 7) return go(B, pen.x, pen.z, 1, 2); /* 来えへん：迎えに戻る */
          if (dPen > 3.2) { face(B, pen.x, pen.z, dt, 3); S.hold = (S.hold || 0) + dt; if (S.hold > 2.2 && !h.gest) { S.hold = 0; G(B, 'g_hop'); } return idle; }
          S.hold = 0; const ax = h.x - T.x, az = h.z - T.z, l = Math.hypot(ax, az) || 1; return go(B, T.x + ax / l * 2.4, T.z + az / l * 2.4, 0.85, 0.2); }
        case 'turtleWatch': { const T = BE.turtles; S.tiltT = 0.08; // じーっと見る：子を背中に乗せて、ゆっくり、踏ん張って歩く
          if (T.z > BE.SHORE + 0.3) { S.st = 'seaEdge'; S.t = 0; S.did = 0; BE.showFrags(); return idle; }
          const ax = h.x - T.x, az = h.z - T.z, l = Math.hypot(ax, az) || 1, tx = T.x + ax / l * 1.9, tz = Math.min(BE.SHORE - 0.5, T.z + az / l * 1.9), r = go(B, tx, tz, 0.5, 0.25); if (r.d > 0.25) return r;
          face(B, T.x, T.z, dt, 2.5); return idle; }
        case 'seaEdge': { const wz = BE.SHORE - 0.7; // 波打ち際：入りたい、けど波がこわい（浜で会った時と同じ）→ ペンギンを見て → 自分から入る
          if (!S.did) { if (!S.mt) S.mt = [Math.max(-3, Math.min(3, h.x)), wz]; const r = go(B, S.mt[0], S.mt[1], 0.6, 0.12); if (r.d > 0.12 && S.t < 4) return r; S.did = 1; S.t = 0; S.mt = null; }
          if (S.did === 1) { face(B, h.x, h.z + 5, dt, 3); S.tiltT = -0.2; if (S.t > 1.3) { BE.surge(1.2); S.did = 2; S.t = 0; } return idle; }
          if (S.did === 2) { if (S.t > 0.3 && S.t < 1.1) return go(B, h.x, wz - 1.2, 1, 0.05); if (S.t > 0.3 && !S.said2) { S.said2 = 1; say('big'); } if (S.t > 1.2) { S.did = 3; S.t = 0; S.said2 = 0; } return idle; }
          if (S.did === 3) { face(B, pen.x, pen.z, dt, 2); if (S.t > 1.3 && !h.gest) { G(B, 'g_hop'); S.did = 4; S.t = 0; } return idle; } /* ペンギンを見て、よしっ */
          if (h.gest && S.t < 2) return idle; S.st = 'gather'; S.t = 0; S.did = 0; return idle; }
        case 'gather': { // 浅瀬を泳いで、光のかけらを集める（集めるたびに、ぷくっと大きくなる）
          const fs = BE.frags.filter(f => f.st === 'float'); if (!fs.length) { S.st = 'swimBack'; S.t = 0; return null; }
          let f = fs[0], bd = 1e9; for (const q of fs) { const d = Math.hypot(q.m.position.x - h.x, q.m.position.z - h.z); if (d < bd) { bd = d; f = q; } }
          swimTo(B, f.m.position.x, f.m.position.z, dt);
          if (bd < 0.3 + B.radius * 0.5) { BE.take(f, () => [h.x, h.y + B.Hm * 0.5, h.z]); S.got++; ctx.grow && ctx.grow(S.got / BE.frags.length); say('big'); }
          return null; }
        case 'swimBack': { const tx = Math.max(-6, Math.min(8, pen.x)), tz = BE.SHORE - 1.2; swimTo(B, tx, tz, dt); // 浜へ戻る
          if (h.z < BE.SHORE - 1.0) { h.y = 0; S.st = 'grow'; S.t = 0; ctx.growDone && ctx.growDone(); return idle; } return null; }
        // ---- 3つ目の願い：鳥（1匹なら飛べる → 乗せると滑空だけ）----
        case 'flySolo': { const Q = ctx.quest; // 工房から戻ったら、まず1匹で飛んでみせる
          if (!S.fs) S.fs = { x0: h.x, z0: h.z, a: Math.atan2(h.x - pen.x, h.z - pen.z) };
          if (S.t < 0.8) { h.y = 0; ctx.lift && ctx.lift(-0.2, 0.1, 0); return idle; }
          if (!S.fsUp) { S.fsUp = 1; ctx.lift && ctx.lift(null, 0, 0); say('big'); }
          if (!h.gest) G(B, 'g_flap');
          if (S.t < 2.4) { const u = (S.t - 0.8) / 1.6; h.y = 2.0 * (1 - Math.pow(1 - u, 2)); h.st = 'ground'; return null; }
          if (S.t < 7.4) { S.fs.a += dt * 1.15; const r = 2.4, tx = pen.x + Math.sin(S.fs.a) * r, tz = pen.z + Math.cos(S.fs.a) * r; h.yaw = Math.atan2(tx - h.x, tz - h.z) || h.yaw; h.x = tx; h.z = tz; h.y = 2.0 + 0.35 * Math.sin(S.t * 2.3); return null; } /* ペンギンのまわりを、うれしそうにぐるぐる */
          if (S.t < 8.6) { h.y = Math.max(0, h.y - dt * 2.2); return null; }
          h.y = 0; S.fs = null; S.fsUp = 0; S.st = 'invite'; S.t = 0; S.crouch = false; S.q = 'glide'; ctx.squash && ctx.squash(2.4); G(B, 'g_hop'); return idle; }
        // ---- 3段階目：沖の深い所のかけらを集めに行く → 大きくなって、やっと乗せて飛べる ----
        case 'deepGo': { const Q = ctx.quest, fs = Q.deep.filter(f => f.st === 'float'); if (!fs.length) { S.st = 'deepBack'; S.t = 0; return null; }
          let f = fs[0], bd = 1e9; for (const q of fs) { const d = Math.hypot(q.m.position.x - h.x, q.m.position.z - h.z); if (d < bd) { bd = d; f = q; } }
          swimTo(B, f.m.position.x, f.m.position.z, dt); if (bd < 0.35 + B.radius * 0.5) { Q.take(f, () => [h.x, h.y + B.Hm * 0.5, h.z]); S.got3 = (S.got3 || 0) + 1; ctx.grow3 && ctx.grow3(S.got3 / Q.deep.length); say('big'); } return null; }
        case 'deepBack': { const tx = Math.max(-6, Math.min(8, pen.x)), tz = BE.SHORE - 1.4; swimTo(B, tx, tz, dt); if (h.z < BE.SHORE - 1.2) { h.y = 0; S.st = 'grow'; S.t = 0; ctx.growDone3 && ctx.growDone3(); return idle; } return null; }
        case 'invite': { // 大きくなった！ ペンギンの横に来て、しゃがんで背中を向ける（乗って！）
          const a = pen.yaw + Math.PI / 2, tx = pen.x + Math.sin(a) * (B.radius + 0.5), tz = pen.z + Math.cos(a) * (B.radius + 0.5), r = go(B, tx, tz, dPen > 3 ? 1 : 0.5, 0.15);
          if (r.d > 0.15 && S.t < 6) { if (S.crouch) { S.crouch = false; ctx.lift(null, 0, 0); } return r; }
          h.yaw = turnTo(h.yaw, pen.yaw, 2 * dt); if (!S.crouch) { S.crouch = true; ctx.lift(-0.2, 0.05, 0); } if (S.t > 6 && dPen > 1.5) S.t = 0; return idle; }
        case 'grow': face(B, pen.x, pen.z, dt); return idle;
        case 'follow': case 'roam': default: return roam(B, pen, dt, ctx, rock, dPen);
      } }

    // ---- 乗ってる間に起きること（鳥を見上げる・海に呼ばれる）。true を返したら、その間は操作できない ----
    function rideTick(B, pen, dt, ctx) { const h = B.h, Q = ctx.quest; S.rt = (S.rt || 0) + dt; const tiltTo = v => { S.tilt += (v - S.tilt) * Math.min(1, dt * 4); };
      if (!S.q && S.carryOK && S.stage === 2 && Math.hypot(h.x - Q.cliff.x, h.z - Q.cliff.z) < 9) { S.q = 'birdWatch'; S.rt = 0; Q.bird.takeoff(); }
      if (S.q === 'birdWatch') { const b = Q.bird; h.yaw = turnTo(h.yaw, Math.atan2(b.x - h.x, b.z - h.z), 3 * dt); tiltTo(0.55); h.v = 0; /* 見上げる（鳥が飛び立って、大きく旋回する） */
        if (S.rt > 2.6 && !S.wingSprout) { S.wingSprout = 1; ctx.sproutWings && ctx.sproutWings(); say('big'); } /* マネしたくて、背中から羽の芽がにゅっ */
        if (S.rt > 3.2 && !h.gest && S.rt < 8) G(B, 'g_flap'); if (S.rt > 8.5) { S.q = 'want3'; S.stage = 3; tiltTo(0); } return true; }
      if (S.q === 'want3') { tiltTo(0); if (S.back) { S.back = false; if (ctx.wingOK && ctx.wingOK()) { S.q = 'solo'; ctx.dismount && ctx.dismount(); S.st = 'flySolo'; S.t = 0; } } return false; }
      if (S.q === 'glideDone' && h.z > BE.SAND0 && h.st === 'ground') { S.q = 'seaCall'; S.rt = 0; }
      if (S.q === 'seaCall') { const G2 = Q.glowP; h.yaw = turnTo(h.yaw, Math.atan2(G2.x - h.x, G2.z - h.z), 2.5 * dt); tiltTo(0.15); h.v = 0; Q.glowK = 1 + Math.min(1, S.rt / 2) * 0.8; /* 沖の底が光る。呼ばれてる */
        if (S.rt > 3.2) { S.q = 'deep'; tiltTo(0); ctx.dismount && ctx.dismount(); BE.SWIM_MAX = BE.SHORE + 15; Q.showDeep(); S.st = 'deepGo'; S.t = 0; S.got3 = 0; say('big'); } return true; }
      tiltTo(0); return false; }
    return { S, tick, reset, rideTick };
  }

  // 岩の上の花（プルプルが見つけて登りたくなるもの）
  function flower(scene, x, y, z) { const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.22, 5), new THREE.MeshStandardMaterial({ color: 0x4f8a3a })); st.position.y = 0.11; g.add(st);
    const pm = new THREE.MeshStandardMaterial({ color: 0xffb0d0, emissive: 0x6a2040, roughness: 0.6, flatShading: true }); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), pm); const a = i / 5 * Math.PI * 2; p.scale.set(1, 0.4, 0.6); p.position.set(Math.cos(a) * 0.05, 0.23, Math.sin(a) * 0.05); g.add(p); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffe36a, emissive: 0x806010 })); c.position.y = 0.24; g.add(c); g.position.set(x, y, z); scene.add(g); return { g, x, y, z }; }

  return { SIZE, PEN_H, penguin, bubble, brain, flower };
})();
