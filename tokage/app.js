// ---- トカゲの夢：出会い → 夢1 崖を跳ぶ → 夢2 飛ぶ → おしまい（その後も遊べる） ----
// 夢1つの型：夢 → 自力で失敗 → 3択（トカゲが実際にやる）→ どの生き物だ！ → 探す → 観察 → 工房で部位 → 掴んで教える → 叶う
(() => {
  const TK = window.TkActors, SND = window.TkSound, TPL = window.BoneTemplates, J = window.BoneJudge, turnTo = TK.turnTo, lerp = TK.lerp;
  const canvas = document.getElementById('v'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
  let W = 0, H = 0; const layout = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }; addEventListener('resize', layout); layout();
  const world = window.TkWorld.create(scene), fx = TK.fx(scene), ctl = window.PlayControl.create(canvas);
  const $ = id => document.getElementById(id), V3 = (x, y, z) => new THREE.Vector3(x, y, z), dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} }, del: k => { try { localStorage.removeItem(k); } catch (_) {} } };
  const msg = (() => { let t = 0; return (s, ms) => { const e = $('msg'); e.textContent = s; e.style.opacity = s ? 1 : 0; clearTimeout(t); if (s) t = setTimeout(() => e.style.opacity = 0, ms || 3200); }; })();
  const PROG_KEY = 'yuya_tk_prog', CARD_KEY = 'yuya_tk_cards';
  // ---- 作品（相棒）：工房と共有。id は tk_hero ----
  const works = () => window.BoneStorage.loadWorks() || [];
  function heroWorkLoad() { return works().find(w => w.id === 'tk_hero') || null; }
  function heroWorkSave(w) { const l = works().filter(x => x.id !== 'tk_hero'); w.updated = Date.now(); l.unshift(w); window.BoneStorage.saveWorks(l); }
  // 相棒の色：工房でも同じ緑に見えるように、三角形ぜんぶに色を塗っておく（塗ってない骨だけ）
  const HERO_HEX = '#7fbf5a';
  function paintHero(w) { try { const B = window.PlayBody.make(Object.assign({}, w, { __size: 1 })); window.PlayBody.withState(B.D, core => { for (const b of B.D.bones) { const raw = w.data.bones.find(x => x.id === b.id); if (!raw || (raw.paint && raw.paint.length)) continue; const G = core.boneGeom(b); if (G) raw.paint = new Array(G.I.length / 3).fill(HERO_HEX); } }); } catch (e) { console.error(e); } return w; }
  function freshHero() { const w = paintHero(TK.heroWork()); heroWorkSave(w); return w; }

  // ================= 出てくるもの =================
  const pen = TK.penguin(scene);
  let heroW = heroWorkLoad(); if (!heroW || !heroW.data || heroW.data.story !== 'tk') heroW = freshHero();
  const hero = TK.lizard(scene, heroW, 1.15, '#7fbf5a'); hero.mode = 'idle'; hero.learned = { jump: false, flap: false };
  // 群れ（そこらへんにいっぱいいる普通のトカゲ）
  const tplW = { id: 'tpl', data: TK.chubby(TPL.data('tokage'), 1.15) }, CROWD_C = ['#b7a27a', '#a8b07a', '#c2a688', '#9fae86', '#b59c84', '#a9a37c', '#bba98a'];
  const CROWD_HOME = [[-6, 8], [9, 11], [-3, 14], [6, 4], [-9, -12.5], [7, -12.8], [-2, -13.0], [11, -11.5]];
  const crowd = CROWD_HOME.map(([x, z], i) => { const L = TK.lizard(scene, tplW, 0.68 + (i % 3) * 0.08, CROWD_C[i % CROWD_C.length]); Object.assign(L, { x, z, yaw: Math.random() * 6, home: [x, z], mode: 'wander', t: Math.random() * 3, tx: x, tz: z }); return L; });
  // ドッスン：脚が太くてデカい。崖をひと跳び
  const dossunW = { id: 'dossun', data: TK.chubby(TPL.data('tokage'), 2.2) };
  const dossun = TK.lizard(scene, dossunW, 2.3, '#7c5a9e'); dossun.visible = false; dossun.x = -30; dossun.z = -12;
  // 池のカエル（跳ぶ）とヒキガエル（歩くだけ）
  const P = world.pond, critters = [];
  for (const [a, k] of [[0.3, 'frog'], [1.9, 'frog'], [3.6, 'frog'], [1.0, 'toad'], [2.7, 'toad'], [4.6, 'toad']]) { const r = P.r + (k === 'frog' ? 0.5 : 2.2); critters.push(TK.frog(scene, P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, k, P)); }
  // 林の鳥（羽ばたいて木から木へ）と、高い木のムササビ（滑るだけ）
  for (let i = 0; i < 3; i++) { const b = TK.bird(scene, world.grove.slice(i).concat(world.grove.slice(0, i)), world); critters.push(b); }
  critters.push(TK.squirrel(scene, world.tallA, world.tallB));
  // チラ見せ：ときどき鳥が1羽、草原の上を飛んでいく（夢2の前から「あいつ」を見せておく）
  const skyBird = TK.bird(scene, [world.grove[0], { x: 6, z: 2, y: 4.5, h: 0, s: 1, top: 5 }, { x: -12, z: 10, y: 5, h: 0, s: 1, top: 5.5 }], world); critters.push(skyBird);

  // ================= 進み具合（チェックポイントだけ保存。読み込み直しても続きから） =================
  let prog = { stage: 'meet', target: null, ended: false }; try { prog = Object.assign(prog, JSON.parse(LS.get(PROG_KEY) || '{}')); } catch (_) {}
  const saveProg = (stage, extra) => { prog = Object.assign(prog, { stage }, extra || {}); LS.set(PROG_KEY, JSON.stringify(prog)); };
  const cards = () => { try { return JSON.parse(LS.get(CARD_KEY) || '[]'); } catch (_) { return []; } };
  const CARD_NAME = { jumpHow: '縮んで跳ぶ', carry: '太い脚', flyHow: '空気を押す', wing: '広い面' };
  function addCard(k) { const c = cards(); if (!c.includes(k)) { c.push(k); LS.set(CARD_KEY, JSON.stringify(c)); } drawChips(true); }
  function drawChips(pop) { const box = $('chips'); box.innerHTML = ''; for (const k of cards()) { const d = document.createElement('div'); d.textContent = '💡 ' + CARD_NAME[k]; if (!pop) d.style.animation = 'none'; box.appendChild(d); } }

  // ================= 入力・ボタン =================
  let riding = false, lockPen = false, jumpHeld = false, jumpPress = 0;
  const jb = $('jumpBtn'); jb.addEventListener('pointerdown', e => { e.preventDefault(); jumpHeld = true; jumpPress++; jb.classList.add('on'); }); const jUp = () => { jumpHeld = false; jb.classList.remove('on'); }; jb.addEventListener('pointerup', jUp); jb.addEventListener('pointercancel', jUp); jb.addEventListener('pointerleave', jUp);
  $('rideBtn').onclick = () => toggleRide(); addEventListener('keydown', e => { if (e.key.toLowerCase() === 'q' && !e.repeat) toggleRide(); });
  $('muteBtn').onclick = () => { $('muteBtn').textContent = SND.toggleMute() ? '🔇' : '🔈'; }; $('muteBtn').textContent = SND.muted ? '🔇' : '🔈';
  $('resetBtn').onclick = () => { if (!confirm('最初からやり直す？（相棒の形と、教えた動きも元に戻る）')) return; LS.del(PROG_KEY); LS.del(CARD_KEY); freshHero(); location.reload(); };
  // 工房：相棒を開く（呼んでる時だけじゃなく、いつでも開ける）
  let toolCall = false; function setToolCall(on) { toolCall = on; $('toolBtn').classList.toggle('call', on); }
  $('toolBtn').onclick = () => { heroWorkSave(hero.work); try { if (parent !== window && parent.__openToolWith) { parent.__openToolWith('tk_hero'); return; } } catch (_) {} msg('工房は、ゲームの入口（index.html）から開いた時に使えます'); };
  function canRide() { return hero.learned.jump && !riding && hero.mode !== 'script' && hero.st === 'ground' && pen.y < hero.y + 0.4 && dist(pen, hero) < 1.8 && !story.busy; }
  function setRide(on) { riding = on; pen.seated = on; document.body.classList.toggle('riding', on); if (on) { hero.mode = 'ride'; pen.v = 0; SND.hop(); } else { hero.mode = 'follow'; const a = hero.yaw + Math.PI / 2; pen.x = hero.x + Math.sin(a) * 0.9; pen.z = hero.z + Math.cos(a) * 0.9; pen.y = world.groundAt(pen.x, pen.z, hero.y + 0.3); pen.yaw = hero.yaw; } }
  function toggleRide() { if (riding) { if (hero.st === 'ground' && !story.busy) setRide(false); } else if (canRide()) setRide(true); }

  // ================= コルーチン（場面の段取り） =================
  let DT = 0; const runs = [];
  function run(gen) { const r = { g: gen, done: false }; runs.push(r); const res = r.g.next(0); if (res.done) r.done = true; return r; }
  function stepRuns(dt) { for (const r of runs.slice()) { if (r.done) continue; try { const res = r.g.next(dt); if (res.done) r.done = true; } catch (e) { r.done = true; console.error(e); showErr(e); } } for (let i = runs.length - 1; i >= 0; i--) if (runs[i].done) runs.splice(i, 1); }
  function* wait(s) { let t = 0; while (t < s) t += yield; }
  function* until(fn) { while (!fn()) yield; }
  function* walk(L, x, z, sp, stopR) { L.mode = L === hero ? 'script' : L.mode; while (!L.walkTo(x, z, sp, DT, world, stopR)) yield; L.v = 0; }
  function* face(L, x, z, s) { let t = 0; const a = Math.atan2(x - L.x, z - L.z); while (t < (s || 0.4)) { L.yaw = turnTo(L.yaw, a, DT * 8); t += yield; } }
  function* tween(s, fn) { let t = 0; while (t < s) { t += yield; fn(Math.min(1, t / s)); } }
  function* hopTo(L, vy, v) { L.st = 'air'; L.vy = vy; L.v = v || 0; L.y += 0.01; SND.jump(vy > 6 ? 1 : 0); while (L.st === 'air') yield; L.v = 0; }
  const story = { busy: false };

  // ================= カメラ =================
  let camYaw = Math.PI, camPitch = 0.38, camDist = 6.5, shot = null, shotK = 0, shake = 0; const camPos = V3(0, 3, 24), camLook = V3(0, 1, 0);
  function camFollow(dt, r) { camYaw -= r.orbit.dx * 0.006; camPitch = Math.max(0.05, Math.min(1.25, camPitch + r.orbit.dy * 0.004)); camDist = Math.max(2.5, Math.min(26, camDist * r.orbit.zoom));
    const tgt = riding ? hero : pen, moving = riding ? hero.v > 0.5 : pen.v > 0.5; if (moving && Math.abs(r.orbit.dx) < 0.5) camYaw = turnTo(camYaw, (riding ? hero.yaw : pen.yaw) + Math.PI, dt * 0.6); /* 進むとゆっくり背中側へ */
    const fy = riding && hero.st === 'air' && hero.learned.flap ? 0.9 : 0.6, look = V3(tgt.x, tgt.y + fy, tgt.z), d = camDist * (riding ? 1.15 : 1), pos = V3(look.x + Math.sin(camYaw) * Math.cos(camPitch) * d, look.y + Math.sin(camPitch) * d, look.z + Math.cos(camYaw) * Math.cos(camPitch) * d);
    pos.y = Math.max(pos.y, world.groundAt(pos.x, pos.z) + 0.4);
    if (shot) { shotK = Math.min(1, shotK + dt * (shot.k || 1.6)); } else shotK = Math.max(0, shotK - dt * 1.2);
    const sp = shot ? (typeof shot.pos === 'function' ? shot.pos() : shot.pos) : pos, sl = shot ? (typeof shot.look === 'function' ? shot.look() : shot.look) : look, e = shotK * shotK * (3 - 2 * shotK);
    const wantP = pos.clone().lerp(sp, e), wantL = look.clone().lerp(sl, e), k = 1 - Math.exp(-dt * (shot ? 3 : 7)); camPos.lerp(wantP, k); camLook.lerp(wantL, k);
    world.hideBetween(camPos, camLook); cam.position.copy(camPos); if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); cam.position.add(V3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)); } cam.lookAt(camLook); }

  // ================= 3択・どの生き物だ！ =================
  const quizEl = $('quiz');
  function ask(q, choices) { return new Promise(res => { quizEl.querySelector('.q').textContent = q; const cs = quizEl.querySelector('.cs'); cs.innerHTML = '';
    choices.forEach((c, i) => { const b = document.createElement('button'); if (c.sil) { b.className = 'sil'; b.appendChild(c.sil()); } else b.textContent = c.label; b.disabled = !!c.off; b.onclick = () => { SND.pick(); quizEl.style.display = 'none'; res(i); }; cs.appendChild(b); });
    quizEl.style.display = 'block'; SND.setMood('think'); }); }
  // コルーチンの中で答えを待つ
  function* askY(q, choices) { let ans = null; ask(q, choices).then(i => { ans = i; }); while (ans == null) yield; SND.setMood('field'); return ans; }
  // 3択：間違えたらトカゲがやってみて失敗 → 同じ問題をもう一回（間違えたのは消える）。正解でカード
  function* quizY(q, choices, card) { const off = choices.map(() => false); for (;;) { const i = yield* askY(q, choices.map((c, k) => Object.assign({}, c, { off: off[k] })));
      yield* choices[i].act(); if (choices[i].ok) { SND.right(); if (card) { addCard(card); SND.card(); } return; } SND.wrong(); off[i] = true; yield* wait(0.3); } }
  // シルエット（色だけ少し違う。形はそっくり）
  function silCanvas(kind) { const c = document.createElement('canvas'); c.width = 260; c.height = 150; const g = c.getContext('2d'); g.fillStyle = '#f4efe4'; g.fillRect(0, 0, 260, 150);
    const col = { frog: '#4d6a34', toad: '#6a5f3a', bird: '#4d4466', squirrel: '#6a4f36' }[kind]; g.fillStyle = col; g.translate(130, 88);
    if (kind === 'frog' || kind === 'toad') { const bump = kind === 'toad'; g.beginPath(); g.ellipse(0, 0, 58, 32, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(46, -16, 26, 18, -0.2, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(52, -32, 8, 0, Math.PI * 2); g.arc(36, -33, 8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-36, 18, 30, 12, 0.3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(-8, 30, 26, 7, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(36, 26, 10, 6, 0, 0, Math.PI * 2); g.fill();
      if (bump) for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-44 + i * 11, -28 - Math.sin(i) * 3, 6, 0, Math.PI * 2); g.fill(); } }
    else { g.beginPath(); g.ellipse(0, 0, 26, 16, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(28, -6, 13, 0, Math.PI * 2); g.fill();
      if (kind === 'bird') { g.beginPath(); g.moveTo(-6, -8); g.quadraticCurveTo(-60, -70, -110, -30); g.lineTo(-40, 6); g.closePath(); g.fill(); g.beginPath(); g.moveTo(6, -8); g.quadraticCurveTo(60, -70, 110, -34); g.lineTo(30, 8); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-22, 4); g.lineTo(-56, 20); g.lineTo(-50, -4); g.fill(); g.beginPath(); g.moveTo(40, -6); g.lineTo(52, -3); g.lineTo(40, 0); g.fill(); }
      else { g.beginPath(); g.moveTo(-14, -12); g.quadraticCurveTo(-60, -50, -108, -26); g.lineTo(-40, 14); g.closePath(); g.fill(); g.beginPath(); g.moveTo(14, -12); g.quadraticCurveTo(60, -50, 106, -28); g.lineTo(30, 14); g.closePath(); g.fill(); g.lineWidth = 9; g.strokeStyle = col; g.beginPath(); g.moveTo(-24, 4); g.quadraticCurveTo(-52, 30, -70, 22); g.stroke(); g.beginPath(); g.moveTo(30, -18); g.lineTo(26, -30); g.lineTo(36, -22); g.fill(); } }
    return c; }

  // ================= トカゲの芝居（よく使う動き） =================
  const POSE = { look_up: { neckPitch: -0.6, hornPitch: -0.2 }, look_down: { neckPitch: 0.55, dy: -0.02 }, crouch: { dy: -0.13, neckPitch: 0.25, tailPitch: 0.15 }, low: { dy: -0.08, neckPitch: 0.15 }, flat: { dy: -0.17, neckPitch: 0.2 }, stretch: { dy: 0.05, neckPitch: -0.3 }, proud: { dy: 0.02, neckPitch: -0.35, tailPitch: -0.2 } };
  const hold = (L, k, w) => { L.pose = k ? L.custom(POSE[k] || k, w) : null; };
  function* flipOver(L, back) { const a = L.flip, b = back ? Math.round(a / (2 * Math.PI) + 0.5) * 2 * Math.PI : a + Math.PI; yield* tween(back ? 0.4 : 0.3, u => { L.flip = a + (b - a) * u; }); if (back) L.flip = 0; }
  function* sparkleEyes(L, s) { let t = 0, n = 0; while (t < s) { t += yield; if (t > n * 0.45) { n++; fx.sparkle(L.headPos(), 4, 0.25); if (n % 2) SND.sparkle(); } } }
  function* bonkCliff(L) { // 崖に向かってぴょん → ゴツン → 落ちる
    const cz = world.CLIFF_Z + 0.5 * L.size; yield* face(L, L.x, world.CLIFF_Z - 5, 0.3); hold(L, 'crouch'); yield* wait(0.2); hold(L, 'stretch'); L.st = 'air'; L.vy = 4.2; L.v = 2.2; L.y += 0.01; SND.jump();
    while (L.st === 'air') { if (L.z < cz + 0.25 && L.v > 0) { L.v = -1.4; L.vy = Math.min(L.vy, 0.5); SND.bonk(); L.squash(1.6); shake = 0.08; } yield; }
    L.v = 0; hold(L, 'flat'); SND.flop(); fx.dust(V3(L.x, L.y, L.z), 5, 0.3); yield* wait(0.6); hold(L, null); }
  // 「こっちじゃないのかも、、、」：もう一回じっと見る → 自分の体を見る → 首かしげ → ペンギンを見る
  function* doubt(L, tgt) { yield* face(L, tgt.x, tgt.z, 0.5); hold(L, { neckPitch: 0.1, dy: -0.03 }); yield* wait(1.0); hold(L, 'look_down'); yield* wait(0.9); hold(L, null); L.gesture('g_tilt'); yield* wait(1.1); yield* face(L, pen.x, pen.z, 0.5); L.gesture('g_tilt'); yield* wait(1.0); }

  // ================= 物語 =================
  const SPOT = { x: 2, z: world.CLIFF_Z + 3.4 }, DOSSUN_JUMP = { x: -1.5, z: world.CLIFF_Z + 2.4 }, DOSSUN_TOP = { x: 0, z: world.CLIFF_Z - 2.6 };
  // 観察の画：トカゲの肩ごしに、相手を見る（木に隠れにくい）
  const overShoulder = (o, up) => ({ pos: () => { const dx = o.x - hero.x, dz = o.z - hero.z, d = Math.hypot(dx, dz) || 1; return V3(hero.x - dx / d * 2.2 + dz / d * 0.9, hero.y + (up || 1.1), hero.z - dz / d * 2.2 - dx / d * 0.9); }, look: () => V3(o.x, (o.y || 0) + 0.2, o.z), k: 1.4 });
  // 教える時：ペンギンはカメラの後ろへ（画に入らない）
  function penBehind(cp) { const dx = cp.x - hero.x, dz = cp.z - hero.z, d = Math.hypot(dx, dz) || 1; pen.x = hero.x + dx / d * (d + 1.3); pen.z = hero.z + dz / d * (d + 1.3); pen.y = world.groundAt(pen.x, pen.z, hero.y + 0.3); pen.yaw = Math.atan2(-dx, -dz); pen.v = 0; }
  const near = (o, kind, r) => critters.filter(c => c.kind === kind).find(c => Math.hypot(c.x - o.x, c.z - o.z) < r);
  function placeStart() { Object.assign(pen, { x: 0, z: 20, y: 0, yaw: Math.PI, v: 0 }); Object.assign(hero, { x: 4.5, z: 10.5, y: 0, yaw: 0.6, v: 0, mode: 'idle' }); camYaw = 0; camPitch = 0.3; camPos.set(0, 2.2, 26); camLook.set(2, 1, 8); }
  // ---- 出会い ----
  function* meet() { story.busy = false; SND.setMood('field'); placeStart(); msg(matchMedia('(pointer: coarse)').matches ? '左の指で歩く・右でカメラを回す' : 'WASD／矢印で歩く・ドラッグでカメラ', 4000);
    yield* until(() => dist(pen, hero) < 7.5 || story.t > 9);
    // ！ → ペンギンの所へ全力で → まわりをぐるっと → つつく
    hero.mode = 'script'; yield* face(hero, pen.x, pen.z, 0.25); hero.squash(1.4); SND.hop(); hero.gesture('g_look'); yield* wait(0.6); yield* walk(hero, pen.x, pen.z, 3.6, 1.2);
    for (let a = 0; a < Math.PI * 2; a += DT * 4.2) { const r = 1.1; hero.walkTo(pen.x + Math.sin(a) * r, pen.z + Math.cos(a) * r, 3, DT, world, 0.05); yield; }
    yield* face(hero, pen.x, pen.z, 0.3); hero.gesture('g_poke'); SND.hop(); yield* wait(0.7); hero.gesture('g_hop'); yield* wait(0.5);
    // 崖の方へ数歩 → 振り返る（ついてきて！）
    const a = Math.atan2(SPOT.x - hero.x, SPOT.z - hero.z); yield* walk(hero, hero.x + Math.sin(a) * 3, hero.z + Math.cos(a) * 3, 2.6); yield* face(hero, pen.x, pen.z, 0.4); hero.gesture('g_hop');
    hero.mode = 'lead'; yield* until(() => dist(pen, SPOT) < 6 && dist(hero, SPOT) < 1.5);
    yield* dossunScene(); }
  // 案内：数歩先で振り返る。離れたら戻って待つ。止まってたらつつきに来る
  let leadStill = 0; function leadStep(dt) { const dp = dist(hero, pen), ds = dist(hero, SPOT); leadStill = pen.v < 0.1 ? leadStill + dt : 0;
    if (dp > 7) { if (hero.walkTo(pen.x, pen.z, 3.4, dt, world, 2.2)) { hero.yaw = turnTo(hero.yaw, Math.atan2(pen.x - hero.x, pen.z - hero.z), dt * 6); if (Math.random() < dt * 0.5) hero.gesture('g_hop'); } return; }
    if (leadStill > 3.2 && dp < 4) { if (hero.walkTo(pen.x, pen.z, 2.6, dt, world, 0.9)) { hero.gesture('g_poke'); leadStill = 0; } return; }
    if (dp > 3.6 || ds < 0.8) { hero.v = Math.max(0, hero.v - dt * 8); hero.yaw = turnTo(hero.yaw, Math.atan2(pen.x - hero.x, pen.z - hero.z), dt * 5); if (!hero.gest && Math.random() < dt * 0.4) hero.gesture(Math.random() < 0.5 ? 'g_hop' : 'g_look'); hero.move(dt, world); return; }
    hero.walkTo(SPOT.x, SPOT.z, 2.4, dt, world, 0.6); }
  // ---- ドッスン ----
  function* dossunScene() { story.busy = true; lockPen = true; pen.v = 0; hero.mode = 'script'; SND.setMood('wonder');
    yield* face(hero, world.CLIFF_Z > 0 ? 0 : SPOT.x, world.CLIFF_Z, 0.4);
    shot = { pos: () => V3(pen.x + 2.2, pen.y + 1.3, pen.z + 3.6), look: () => V3(dossun.visible ? dossun.x * 0.6 : -2, 1.6, world.CLIFF_Z + 0.5), k: 1.2 };
    // 横からのしのし歩いてくる
    Object.assign(dossun, { x: -17, z: DOSSUN_JUMP.z, y: 0, yaw: Math.PI / 2, visible: true, v: 0 }); let stepT = 0;
    while (!dossun.walkTo(DOSSUN_JUMP.x, DOSSUN_JUMP.z, 2.0, DT, world, 0.2)) { stepT -= DT; if (stepT <= 0) { stepT = 0.42; SND.land(); shake = Math.max(shake, 0.03); } yield; }
    yield* face(dossun, DOSSUN_TOP.x, DOSSUN_TOP.z, 0.6);
    // ぐっと沈み込む（ミシッ）
    SND.creak(); yield* tween(1.3, u => { hold(dossun, { dy: -0.17 * u, neckPitch: 0.3 * u, tailPitch: 0.25 * u }); if (Math.random() < 0.1) fx.dust(V3(dossun.x, 0, dossun.z), 1, 0.9); });
    // 跳ぶ
    hold(dossun, 'stretch'); SND.whoosh(); const p0 = { x: dossun.x, z: dossun.z };
    yield* tween(0.85, u => { dossun.x = lerp(p0.x, DOSSUN_TOP.x, u); dossun.z = lerp(p0.z, DOSSUN_TOP.z, u); dossun.y = world.TOP * u + Math.sin(u * Math.PI) * 2.6; });
    // ドスン！
    dossun.y = world.TOP; hold(dossun, { dy: -0.1, neckPitch: 0.2 }); SND.dossun(); shake = 0.55; fx.dust(V3(dossun.x, world.TOP, dossun.z), 16, 1.2); fx.dust(V3(hero.x, 0, hero.z), 6, 0.6);
    const flippers = crowd.filter(c => dist(c, hero) < 30).concat([hero]); for (const c of flippers) { c.mode = c === hero ? 'script' : 'flipped'; run(flipOver(c)); c.vy = 2; c.st = 'air'; c.y += 0.01; } SND.boing();
    yield* wait(0.5); hold(dossun, null);
    // 他の子はわたわた起き上がって逃げる
    for (const c of crowd) if (c.mode === 'flipped') run((function* () { yield* wait(0.5 + Math.random() * 0.6); yield* flipOver(c, true); c.mode = 'flee'; const a = Math.atan2(c.x - DOSSUN_JUMP.x, c.z - DOSSUN_JUMP.z) + (Math.random() - 0.5); c.tx = c.x + Math.sin(a) * 14; c.tz = Math.min(26, c.z + Math.abs(Math.cos(a)) * 14 + 6); })());
    shot = { pos: () => V3(hero.x + 2.4, 0.8, hero.z + 2.6), look: () => V3(hero.x, 0.4, hero.z), k: 1.5 };
    // この子だけ、ひっくり返ったまま固まってる
    yield* wait(2.0);
    yield* flipOver(hero, true); SND.boing(); hero.squash(1.8); yield* wait(0.25);
    // 逃げるどころか崖の方へ数歩 → キラキラ見上げる
    yield* walk(hero, hero.x - 0.3, world.CLIFF_Z + 1.2 * hero.size + 0.4, 1.4, 0.15); hold(hero, 'look_up');
    shot = { pos: () => V3(hero.x + 1.7, 0.55, hero.z + 1.1), look: () => V3(dossun.x, world.TOP + 1.2, dossun.z), k: 1.3 };
    // ドッスンは上で実をぱくっと食べて、奥へ去る
    run((function* () { yield* face(dossun, world.fruitTree.x, world.fruitTree.z, 0.5); yield* walk(dossun, world.fruitTree.x - 1.2, world.fruitTree.z + 0.6, 1.6, 0.3); hold(dossun, { neckPitch: -0.35 }); yield* wait(0.5); const f = world.fruits.find(f => f.visible); if (f) f.visible = false; SND.hop(); hold(dossun, { neckPitch: 0.15 }); yield* wait(0.5); hold(dossun, null);
      yield* walk(dossun, dossun.x - 3, world.CLIFF_Z - 22, 2.0, 0.5); dossun.visible = false; })());
    yield* sparkleEyes(hero, 2.8); hold(hero, null); SND.setMood('field');
    yield* tryJump1(); }
  // ---- 夢1：自力で失敗 → 3択 ----
  function* tryJump1() { shot = { pos: () => V3(hero.x + 3.2, 1.0, hero.z + 2.0), look: () => V3(hero.x, 0.8, hero.z - 0.6), k: 1.4 };
    yield* walk(hero, hero.x, world.CLIFF_Z + 2.6, 1.8, 0.1); yield* bonkCliff(hero); yield* walk(hero, hero.x + 0.4, world.CLIFF_Z + 2.4, 1.8, 0.1); yield* bonkCliff(hero);
    yield* face(hero, pen.x, pen.z, 0.5); hero.gesture('g_tilt'); yield* wait(0.8);
    shot = { pos: () => V3(hero.x + 2.6, 1.4, hero.z + 3.4), look: () => V3(hero.x - 0.4, 0.9, hero.z - 1), k: 1.4 }; lockPen = true;
    const base = () => ({ x: hero.x, z: hero.z });
    yield* quizY('どうやったら、上に行ける？', [
      { label: '走って、勢いで', act: function* () { const b = base(); yield* walk(hero, b.x, world.CLIFF_Z + 5.5, 2.0, 0.1); yield* face(hero, b.x, world.CLIFF_Z, 0.3); yield* walk(hero, b.x, world.CLIFF_Z + 0.55 * hero.size + 0.2, 4.2, 0.08); SND.bonk(); shake = 0.1; hero.squash(2); hold(hero, 'flat'); yield* tween(0.4, u => { hero.z += DT * 2.2; }); yield* wait(0.6); hold(hero, null); hero.gesture('g_shake'); yield* wait(0.9); } },
      { label: '壁を、よじ登る', act: function* () { const b = base(); yield* walk(hero, b.x, world.CLIFF_Z + 0.6 * hero.size, 1.4, 0.08); yield* tween(0.8, u => { hold(hero, { dy: 0.03, neckPitch: -0.5, arch: 0.08 }); hero.tilt = 0.9 * u; hero.y = 0.35 * u; }); yield* tween(0.7, u => { hero.y = 0.35 * (1 - u); }); hero.tilt = 0; hold(hero, 'flat'); SND.flop(); yield* wait(0.7); hold(hero, null); yield* walk(hero, b.x, b.z, 1.5, 0.1); } },
      { label: 'ぐっと縮んで、跳ぶ', ok: true, act: function* () { yield* face(hero, hero.x, world.CLIFF_Z, 0.3); yield* tween(0.5, u => hold(hero, { dy: -0.13 * u, neckPitch: 0.25 * u })); hold(hero, 'stretch'); yield* hopTo(hero, 5.2, 0.2); hold(hero, null); fx.sparkle(hero.headPos(), 6); hero.gesture('g_hop'); yield* wait(0.8); yield* face(hero, pen.x, pen.z, 0.4); } },
    ], 'jumpHow');
    yield* wait(0.6);
    yield* quizY('でも、まだ届かない。何が足りない？', [
      { label: '長いしっぽ', act: function* () { for (let i = 0; i < 3; i++) { hold(hero, { tailYaw: 0.9 }); yield* wait(0.15); hold(hero, { tailYaw: -0.9 }); yield* wait(0.15); } hold(hero, null); hero.yaw += 0.3; yield* tween(0.6, u => { hero.yaw += DT * 12; }); hold(hero, 'flat'); SND.flop(); yield* wait(0.8); hold(hero, null); } },
      { label: '太い脚', ok: true, act: function* () { hold(hero, 'look_down'); yield* wait(1.0); hold(hero, null); SND.wobble(); for (let i = 0; i < 6; i++) { hero.roll = (i % 2 ? 0.08 : -0.08); yield* wait(0.1); } hero.roll = 0; yield* face(hero, pen.x, pen.z, 0.4); hold(hero, 'proud'); yield* wait(0.6); hold(hero, null); } },
      { label: '大きい爪', act: function* () { yield* walk(hero, hero.x, world.CLIFF_Z + 0.6 * hero.size, 1.4, 0.08); for (let i = 0; i < 4; i++) { hero.gesture('g_poke'); SND.bonk(); yield* wait(0.35); } hold(hero, 'flat'); yield* wait(0.5); hold(hero, null); yield* walk(hero, hero.x, hero.z + 1.5, 1.4, 0.1); } },
    ], 'carry');
    saveProg('choose1'); yield* choose1(); }
  // ---- どの生き物だ！（夢1） → 探す ----
  function* choose1() { story.busy = true; lockPen = true; shot = { pos: () => V3(hero.x + 2.6, 1.4, hero.z + 3.4), look: () => V3(hero.x, 0.7, hero.z), k: 1.4 };
    const opts = ['frog', 'toad'], off = [false, false];
    for (;;) { const i = yield* askY('太い脚で、ぐっと縮んで跳ぶ。どの生き物だ！', opts.map((k, j) => ({ sil: () => silCanvas(k), off: off[j] }))); const kind = opts[i]; saveProg('search1', { target: kind });
      const found = yield* searchFor(kind); // 見つけて、観察
      if (kind === 'frog') { yield* observeFrog(found); return; }
      yield* observeToad(found); off[i] = true; SND.wrong(); } }
  // 探す：プレイヤーが自分で歩いて行く。トカゲはついてくる
  function* searchFor(kind) { story.busy = false; lockPen = false; shot = null; hero.mode = 'follow'; hero.pose = null; let c = null;
    yield* until(() => { const o = riding ? hero : pen; c = near(o, kind, 3.4); return !!c; }); story.busy = true; lockPen = true; if (riding) { setRide(false); } pen.v = 0; return c; }
  function* observeFrog(f) { hero.mode = 'script'; SND.setMood('wonder'); const others = critters.filter(c => c.kind === 'frog'); f.near = true;
    yield* walk(hero, f.x + 1.3, f.z + 1.0, 1.6, 0.4); yield* face(hero, f.x, f.z, 0.4); hold(hero, { neckPitch: 0.2, dy: -0.03 });
    shot = overShoulder(f, 0.9);
    // スロー：縮んで、ためて、一気に跳ぶ。脚が光る
    for (let n = 0; n < 2; n++) { f.slow = 0.45; yield* until(() => f.st === 'idle'); f.t = Math.min(f.t, 0.4); yield* until(() => f.st === 'crouch'); while (f.st !== 'idle' || f.t > 1) { f.glow = (f.st === 'crouch' || f.st === 'hold') ? 0.6 + 0.3 * Math.sin(story.t * 18) : f.st === 'air' && f.crouch < -0.3 ? 1 : 0; if (f.st === 'air') hold(hero, 'look_up'); else if (f.st === 'hold') hold(hero, { dy: -0.06, neckPitch: 0.25 }); yield; } f.glow = 0; yield* wait(0.5); }
    f.slow = 1; f.near = false;
    // トカゲもマネして、脚をぐっ
    shot = { pos: () => V3(hero.x + 2.0, 0.9, hero.z + 2.2), look: () => V3(hero.x, 0.5, hero.z), k: 1.5 }; yield* tween(0.6, u => hold(hero, { dy: -0.12 * u, neckPitch: 0.2 * u })); SND.wobble(); for (let i = 0; i < 5; i++) { hero.roll = (i % 2 ? 0.07 : -0.07); yield* wait(0.1); } hero.roll = 0; hold(hero, null);
    yield* face(hero, pen.x, pen.z, 0.4); hold(hero, 'look_down'); yield* wait(0.8); hold(hero, null); hero.gesture('g_hop'); SND.setMood('field');
    saveProg('tool1'); yield* needTool('carry'); }
  function* observeToad(f) { hero.mode = 'script'; SND.setMood('wonder'); f.near = true; yield* walk(hero, f.x + 1.2, f.z + 1.0, 1.6, 0.4); yield* face(hero, f.x, f.z, 0.4);
    shot = overShoulder(f, 0.9); f.st = 'walk'; f.t = 3; yield* wait(3.2); f.near = false;
    // マネしてのそのそ → 跳ぼうとしても跳べない
    shot = { pos: () => V3(hero.x + 2.2, 0.9, hero.z + 2.2), look: () => V3(hero.x, 0.4, hero.z), k: 1.5 }; hold(hero, 'low'); const a = hero.yaw; yield* tween(1.6, u => { hero.x += Math.sin(a) * DT * 0.3; hero.z += Math.cos(a) * DT * 0.3; hero.roll = Math.sin(u * 20) * 0.04; }); hero.roll = 0;
    hold(hero, 'flat'); yield* wait(0.4); hold(hero, 'stretch'); yield* wait(0.15); hold(hero, 'flat'); SND.flop(); yield* wait(0.8); hold(hero, null);
    yield* doubt(hero, f); SND.setMood('field'); }
  // ---- 工房へ（ボタンがぷるっと呼ぶ）→ 戻ってきたら確かめる ----
  let backFromTool = 0;
  function* needTool(kind) { story.busy = false; lockPen = false; shot = null; hero.mode = 'follow'; setToolCall(true); let ct = 0, seen = backFromTool;
    for (;;) { ct -= DT; if (ct <= 0) { ct = 5; SND.call(); hero.gesture('g_hop'); } if (backFromTool !== seen) { seen = backFromTool; setToolCall(false); const ok = judgeOk(kind); if (ok) { saveProg(kind === 'carry' ? 'teach1' : 'teach2'); yield* (kind === 'carry' ? teachJump() : teachFlap()); return; } yield* notYet(kind); setToolCall(true); } yield; } }
  function judgeOk(kind) { const d = hero.work.data; try { return kind === 'carry' ? J.carryJudge(d.bones, null, 0.7).ok : J.wingJudge(d.bones, null).ok; } catch (e) { console.error(e); return false; } }
  function* notYet(kind) { story.busy = true; lockPen = true; hero.mode = 'script'; yield* face(hero, pen.x, pen.z, 0.3); shot = { pos: () => V3(hero.x + 2.2, 1.0, hero.z + 2.4), look: () => V3(hero.x, 0.5, hero.z), k: 1.6 };
    if (kind === 'carry') { yield* tween(0.5, u => hold(hero, { dy: -0.12 * u })); SND.wobble(); for (let i = 0; i < 6; i++) { hero.roll = (i % 2 ? 0.1 : -0.1); yield* wait(0.1); } hero.roll = 0; hold(hero, 'flat'); SND.flop(); yield* wait(0.9); }
    else { hero.wing = 0; for (let i = 0; i < 4; i++) { yield* tween(0.12, u => { hero.wing = u; }); yield* tween(0.12, u => { hero.wing = 1 - u; }); } SND.flop(); hold(hero, 'flat'); yield* wait(0.8); hero.wing = null; }
    hold(hero, null); hero.gesture('g_shake'); yield* wait(0.8); story.busy = false; lockPen = false; shot = null; hero.mode = 'follow'; }

  // ================= 掴んで教える =================
  const teachEl = $('teach'); let TEACH = null;
  teachEl.addEventListener('pointerdown', e => { if (!TEACH) return; try { teachEl.setPointerCapture(e.pointerId); } catch (_) {} TEACH.down = true; TEACH.y0 = e.clientY; TEACH.y = e.clientY; TEACH.onDown && TEACH.onDown(e); });
  teachEl.addEventListener('pointermove', e => { if (TEACH && TEACH.down) TEACH.y = e.clientY; });
  const tUp = e => { if (TEACH && TEACH.down) { TEACH.down = false; TEACH.onUp && TEACH.onUp(e); } }; teachEl.addEventListener('pointerup', tUp); teachEl.addEventListener('pointercancel', tUp);
  function teachUI(text, need) { teachEl.style.display = 'block'; teachEl.querySelector('.tt').textContent = text; teachEl.querySelector('.tg').innerHTML = '<i></i>'; teachEl.querySelector('.tc').innerHTML = '<b></b>'.repeat(need); }
  const teachGauge = v => { const i = teachEl.querySelector('.tg i'); if (i) i.style.height = Math.round(Math.max(0, Math.min(1, v)) * 100) + '%'; };
  const teachDots = n => teachEl.querySelectorAll('.tc b').forEach((b, i) => b.classList.toggle('ok', i < n));
  // 跳ぶ：下に押す（縮む）→ ためる → はなす（一気に伸びる）。3回決まったら覚える。一番よかった振りがこの子のジャンプになる
  function* teachJump() { story.busy = true; lockPen = true; hero.mode = 'script'; pen.v = 0; SND.setMood('think');
    yield* walk(hero, hero.x, hero.z, 1, 1); let side = hero.yaw + Math.PI / 2; if (Math.sin(side) * (pen.x - hero.x) + Math.cos(side) * (pen.z - hero.z) > 0) side += Math.PI; const cpos = V3(hero.x + Math.sin(side) * 2.7, hero.y + 0.75, hero.z + Math.cos(side) * 2.7); penBehind(cpos); shot = { pos: () => V3(hero.x + Math.sin(side) * 2.7, hero.y + 0.75, hero.z + Math.cos(side) * 2.7), look: () => V3(hero.x, hero.y + 0.45, hero.z), k: 2 };
    const NEED = 3; teachUI('トカゲを下に押して → ためて → はなす', NEED); const T = TEACH = { down: false, y0: 0, y: 0, p: 0, holdT: 0, charged: false, good: 0, hist: [], strokes: [], cur: null, busy: false };
    T.onDown = () => { if (T.busy) return; T.cur = { s: [], t: 0 }; T.holdT = 0; T.charged = false; T.peak = 0; T.leftAt = null; };
    T.onUp = () => { if (T.busy) return; T.release = true; };
    let lastSlow = 0;
    for (;;) { const dt = DT;
      if (!T.busy) {
        const pRaw = T.down ? Math.max(0, Math.min(1, (T.y - T.y0) / (H * 0.24))) : 0; T.p += (pRaw - T.p) * Math.min(1, dt * 18); if (T.down && T.cur) { T.cur.t += dt; T.cur.s.push([T.cur.t, T.p]); }
        T.peak = Math.max(T.peak || 0, T.p); if (T.down && T.p > 0.82) { T.holdT += dt; if (T.holdT > 0.3 && !T.charged) { T.charged = true; SND.charge(); fx.sparkle(V3(hero.x, hero.y + 0.3, hero.z), 5, 0.6); } } else if (T.down && T.p < 0.7) T.holdT = Math.max(0, T.holdT - dt * 2);
        hold(hero, { dy: -0.14 * T.p, neckPitch: 0.25 * T.p, tailPitch: 0.18 * T.p }); hero.glowIds = T.charged ? [5, 6, 7, 8] : null; hero.glowA = T.charged ? 0.5 + 0.2 * Math.sin(story.t * 16) : 0; teachGauge(T.p);
        // ゆっくり伸ばした（ためたのに、押したままゆっくり戻した）＝びよーんと伸びるだけ。素早く戻したら「はなした」と同じ
        if (T.down && T.charged) { if (T.p < 0.8) { if (T.leftAt == null) T.leftAt = T.cur.t; } else T.leftAt = null;
          if (T.p < 0.35 && T.leftAt != null) { const dur = T.cur.t - T.leftAt; T.leftAt = null; if (dur > 0.16) { T.busy = true; T.charged = false; hero.glowIds = null; run((function* () { SND.wobble(); yield* tween(0.5, u => hold(hero, { dy: 0.06 * Math.sin(u * Math.PI), neckPitch: -0.3 })); hold(hero, null); T.busy = false; T.p = 0; T.down = false; T.peak = 0; T.holdT = 0; })()); if (story.t - lastSlow > 3) { lastSlow = story.t; msg('ゆっくり伸ばすと、びよーんとなるだけ'); } } else T.release = true; } }
        if (T.release) { T.release = false; const stroke = T.cur; T.cur = null;
          if (T.charged) { // 決まった！
            T.good++; T.strokes.push({ s: stroke ? stroke.s : [], hold: T.holdT }); teachDots(T.good); const h = [0.8, 1.3, 2.3][Math.min(2, T.good - 1)]; T.busy = true; T.charged = false; hero.glowIds = null;
            run((function* () { hold(hero, 'stretch'); fx.dust(V3(hero.x, hero.y, hero.z), 6, 0.4); yield* hopTo(hero, Math.sqrt(2 * 14 * h), 0); hold(hero, 'crouch'); SND.land(); hero.squash(1.2); yield* wait(0.15); hold(hero, null); if (T.good < NEED) SND.right(); T.busy = false; T.p = 0; })()); }
          else if ((T.peak || 0) > 0.3) { T.busy = true; run((function* () { hold(hero, 'stretch'); yield* hopTo(hero, 3, 0); hold(hero, null); T.busy = false; T.p = 0; })()); if (story.t - lastSlow > 3) { lastSlow = story.t; msg('もっと、ためてから'); } }
          T.peak = 0; T.holdT = 0; } }
      if (T.good >= NEED && !T.busy) break; yield; }
    teachEl.style.display = 'none'; TEACH = null; hold(hero, null); hero.glowIds = null;
    // 一番よかった振り（いちばん長くためた分）を、この子のジャンプとして残す
    const best = T.strokes.slice().sort((a, b) => b.hold - a.hold)[0]; saveJump(best ? best.s : []); hero.learned.jump = true; saveProg('ride1');
    SND.fanfare(); fx.sparkle(hero.headPos(), 14, 0.8); msg('跳び方を覚えた！'); yield* jumpUpCliff(); }
  function jumpKeysFrom(s) { // 押した深さの記録（t,p）→ 24コマ／秒のコマ列（ためが長すぎたら縮める）＋ 伸び切り
    const out = []; if (s.length < 2) { for (let i = 0; i <= 8; i++) out.push(Math.min(1, i / 6)); } else { const T1 = s[s.length - 1][0], step = Math.max(1 / 24, T1 / 18); for (let t = 0; t <= T1; t += step) { let j = 0; while (j < s.length - 1 && s[j + 1][0] < t) j++; out.push(s[j][1]); } }
    out.push(0.3, -0.4, -0.35); return out; }
  function poseOfJump(p) { return p >= 0 ? { dy: -0.14 * p, neckPitch: 0.25 * p, tailPitch: 0.18 * p } : { dy: 0.05 * (-p / 0.4), neckPitch: -0.25 * (-p / 0.4), tailPitch: -0.15 * (-p / 0.4) }; }
  function saveJump(s) { const seq = jumpKeysFrom(s); hero.jumpSeq = seq; const keys = seq.map((p, f) => ({ f, pose: TPL.poseOf('tokage', poseOfJump(p)) })).filter((k, i, a) => i % 2 === 0 || i === a.length - 1); keys.push({ f: seq.length + 4, pose: TPL.poseOf('tokage', poseOfJump(-0.2)) });
    putAct(hero.work.data, 'jump', 'ジャンプ', { len: seq.length + 4, loop: false, keys, seg: {}, taught: seq }); heroWorkSave(hero.work); }
  function putAct(d, slot, name, anim) { if (!d.acts) { d.acts = []; d.actI = 0; } if (d.acts[d.actI] && d.anim) d.acts[d.actI].anim = d.anim; const i = d.acts.findIndex(a => a.slot === slot); if (i >= 0) d.acts[i].anim = anim; else d.acts.push({ name, slot, anim }); d.actI = d.acts.findIndex(a => a.slot === slot); d.anim = d.acts[d.actI].anim; d.acts[d.actI].anim = null; }
  // 覚えた跳び方で、崖をひと跳び → 上で喜ぶ → 見下ろす → 降りてきて、乗ってと誘う
  function* jumpUpCliff() { story.busy = true; lockPen = true; hero.mode = 'script'; SND.setMood('field');
    const x = Math.max(-30, Math.min(30, hero.x)); yield* walk(hero, x, world.CLIFF_Z + 2.0, 2.4, 0.15); yield* face(hero, x, world.CLIFF_Z - 3, 0.4);
    shot = { pos: () => V3(hero.x + 4.5, 1.6, world.CLIFF_Z + 6.5), look: () => V3(hero.x, hero.y + 0.8, hero.z - 0.8), k: 1.5 };
    yield* taughtJump(hero, 8.3, 2.6); SND.fanfare(); fx.sparkle(hero.headPos(), 16, 0.9); hold(hero, 'proud'); yield* wait(0.7); hold(hero, null); hero.gesture('g_hop'); yield* wait(0.8);
    yield* face(hero, pen.x, pen.z, 0.5); hold(hero, 'look_down'); yield* wait(1.0); hold(hero, null);
    // 降りてくる
    yield* walk(hero, hero.x, world.CLIFF_Z - 0.4, 1.6, 0.1); yield* face(hero, hero.x, world.CLIFF_Z + 5, 0.3); yield* hopTo(hero, 3.5, 2.2); SND.land(); hero.squash(1.3);
    yield* walk(hero, pen.x + 0.9, pen.z - 0.6, 2.2, 0.3); yield* face(hero, pen.x, pen.z, 0.3); hold(hero, 'low'); story.busy = false; lockPen = false; shot = null; hero.mode = 'invite';
    msg('「乗る」で、背中に乗せてもらえる'); yield* until(() => riding); hold(hero, null); saveProg('ride1'); msg(matchMedia('(pointer: coarse)').matches ? '右下のボタンで跳ぶ。崖の上へ行こう' : 'Space で跳ぶ。崖の上へ行こう', 4000);
    yield* until(() => riding && hero.y > world.TOP - 0.2 && hero.st === 'ground'); yield* wait(1.2); yield* birdScene(); }
  // 覚えた振りを再生して跳ぶ（縮む → 一気に伸びる）
  function* taughtJump(L, vy, v) { const seq = L.jumpSeq || jumpKeysFrom([]); const tk = seq.findIndex(p => p < 0); for (let i = 0; i < (tk < 0 ? seq.length : tk); i++) { hold(L, poseOfJump(seq[i])); yield* wait(1 / 24); } hold(L, poseOfJump(-0.4)); yield* hopTo(L, vy, v); hold(L, 'crouch'); SND.land(); L.squash(1.2); yield* wait(0.12); hold(L, null); }

  // ---- 夢2：崖の上から、鳥が向こうへ飛んでいく ----
  const flyBird = TK.bird(scene, [{ x: 0, z: 0, y: -50, h: 0, s: 1, top: -50 }], world); flyBird.F.g.visible = false;
  function* birdScene() { story.busy = true; lockPen = true; SND.setMood('wonder'); if (riding) setRide(false); hero.mode = 'script'; pen.v = 0;
    const g = world.grove[0], a = [g.x + 1.5, g.y + g.h + 0.4, g.z], b = [hero.x + 2, world.TOP + 4, hero.z - 8], c = [hero.x - 6, 18, world.NORTH - 70]; flyBird.F.g.visible = true; flyBird.st = 'fly'; flyBird.slow = 0;
    shot = { pos: () => V3(hero.x + 1.6, hero.y + 0.6, hero.z + 2.4), look: () => flyBird.F.g.position.clone(), k: 1.2 };
    let u = 0; SND.chirp(); while (u < 1) { u = Math.min(1, u + DT / 7); const e = u < 0.35 ? u / 0.35 : (u - 0.35) / 0.65, p0 = u < 0.35 ? a : b, p1 = u < 0.35 ? b : c; flyBird.x = lerp(p0[0], p1[0], e); flyBird.y = lerp(p0[1], p1[1], e) + Math.sin(e * Math.PI) * 1.2; flyBird.z = lerp(p0[2], p1[2], e); flyBird.yaw = Math.atan2(p1[0] - p0[0], p1[2] - p0[2]); flyBird.flap += DT * 9; if (Math.random() < DT * 2) SND.flap();
      flyBird.F.g.position.set(flyBird.x, flyBird.y, flyBird.z); flyBird.F.g.rotation.y = flyBird.yaw; flyBird.F.wings[0].rotation.z = -Math.sin(flyBird.flap) * 0.9; flyBird.F.wings[1].rotation.z = Math.sin(flyBird.flap) * 0.9; hero.yaw = turnTo(hero.yaw, Math.atan2(flyBird.x - hero.x, flyBird.z - hero.z), DT * 4); hold(hero, flyBird.y > hero.y + 2 && dist(flyBird, hero) < 8 ? 'look_up' : { neckPitch: -0.25 }); yield; }
    flyBird.F.g.visible = false; yield* sparkleEyes(hero, 2.2); hold(hero, null); SND.setMood('field');
    // 自力で：切り株から跳んで、前脚をパタパタ → ぺしゃ
    shot = { pos: () => V3(world.stump.x + 2.8, world.TOP + 1.3, world.stump.z + 2.6), look: () => V3(world.stump.x, world.TOP + 0.6, world.stump.z), k: 1.3 };
    yield* walk(hero, world.stump.x, world.stump.z + 1.4, 2.4, 0.2); yield* face(hero, world.stump.x, world.stump.z, 0.3); yield* hopTo(hero, 5.2, 1.7); hero.v = 0; yield* wait(0.3);
    yield* face(hero, world.stump.x, world.stump.z - 5, 0.3); hold(hero, 'stretch'); hero.st = 'air'; hero.vy = 3; hero.v = 1.6; hero.y += 0.01; SND.jump();
    while (hero.st === 'air') { const f = Math.sin(story.t * 30) * 0.25; hold(hero, { dy: 0.03, legs: { 5: [0.05, 0.12 + f, 0], 6: [0.05, 0.12 - f, 0] } }); if (Math.random() < DT * 6) SND.flap(); yield; }
    hero.v = 0; hold(hero, 'flat'); SND.flop(); fx.dust(V3(hero.x, hero.y, hero.z), 5, 0.3); yield* wait(0.9); hold(hero, null); yield* face(hero, pen.x, pen.z, 0.4); hero.gesture('g_tilt'); yield* wait(0.8);
    shot = { pos: () => V3(hero.x + 2.6, hero.y + 1.4, hero.z + 3.4), look: () => V3(hero.x, hero.y + 0.7, hero.z), k: 1.4 };
    yield* quizY('どうやったら、飛べる？', [
      { label: '全力で、走る', act: function* () { const a = hero.yaw; yield* tween(1.4, u => { hero.v = 4; hero.move(DT, world); }); hero.v = 0; hold(hero, 'flat'); SND.flop(); yield* wait(0.6); hold(hero, null); hero.gesture('g_shake'); yield* wait(0.8); yield* walk(hero, pen.x + 1, pen.z - 1, 2.4, 0.4); } },
      { label: '高い所から、跳ぶ', act: function* () { yield* walk(hero, world.stump.x, world.stump.z + 1.4, 2.4, 0.2); yield* hopTo(hero, 5.2, 1.7); hero.v = 0; yield* wait(0.3); hold(hero, 'stretch'); yield* hopTo(hero, 3, 1.6); hold(hero, 'flat'); SND.flop(); yield* wait(0.8); hold(hero, null); yield* walk(hero, pen.x + 1, pen.z - 1, 2.4, 0.4); } },
      { label: '何かで、空気を押す', ok: true, act: function* () { yield* face(hero, pen.x, pen.z, 0.3); for (let i = 0; i < 6; i++) { hold(hero, { dy: 0.04, legs: { 5: [0.05, 0.2, 0], 6: [0.05, 0.2, 0] } }); yield* wait(0.08); hold(hero, { dy: 0.02, legs: { 5: [0.02, 0.0, 0], 6: [0.02, 0.0, 0] } }); SND.flap(); yield* wait(0.06); hero.y += 0.025; } hold(hero, null); fx.sparkle(hero.headPos(), 6); hero.gesture('g_hop'); yield* wait(0.8); } },
    ], 'flyHow');
    yield* wait(0.5);
    yield* quizY('でも、前脚じゃ小さすぎる。何が足りない？', [
      { label: '長いしっぽ', act: function* () { for (let i = 0; i < 4; i++) { hold(hero, { tailYaw: 0.9, tailPitch: -0.3 }); yield* wait(0.12); hold(hero, { tailYaw: -0.9, tailPitch: -0.3 }); yield* wait(0.12); } hold(hero, null); hero.gesture('g_shake'); yield* wait(0.9); } },
      { label: '軽い体', act: function* () { yield* tween(0.8, u => hold(hero, { dy: -0.04 * u, arch: -0.05 * u })); hold(hero, 'stretch'); yield* hopTo(hero, 3.6, 0); hold(hero, 'flat'); SND.flop(); yield* wait(0.7); hold(hero, null); } },
      { label: '広い面', ok: true, act: function* () { hold(hero, { neckYaw: 0.9, neckPitch: 0.2 }); yield* wait(0.7); hold(hero, { neckYaw: -0.9, neckPitch: 0.2 }); yield* wait(0.7); hold(hero, null); hero.gesture('g_hop'); yield* wait(0.7); } },
    ], 'wing');
    saveProg('choose2'); yield* choose2(); }
  function* choose2() { story.busy = true; lockPen = true; if (riding) setRide(false); shot = { pos: () => V3(hero.x + 2.6, hero.y + 1.4, hero.z + 3.4), look: () => V3(hero.x, hero.y + 0.7, hero.z), k: 1.4 };
    const opts = ['bird', 'squirrel'], off = [false, false];
    for (;;) { const i = yield* askY('広い面で、空気を押して飛ぶ。どの生き物だ！', opts.map((k, j) => ({ sil: () => silCanvas(k), off: off[j] }))); const kind = opts[i]; saveProg('search2', { target: kind });
      const found = yield* searchFor2(kind); if (kind === 'bird') { yield* observeBird(found); return; } yield* observeSquirrel(found); off[i] = true; SND.wrong(); } }
  function* searchFor2(kind) { story.busy = false; lockPen = false; shot = null; hero.mode = 'follow'; hero.pose = null; let c = null;
    yield* until(() => { const o = riding ? hero : pen; c = critters.filter(k => k.kind === kind && k !== skyBird).find(k => Math.hypot(k.x - o.x, k.z - o.z) < 5.5 && o.y > world.TOP - 0.3); return !!c; }); story.busy = true; lockPen = true; if (riding) setRide(false); pen.v = 0; return c; }
  function* observeBird(bd) { hero.mode = 'script'; SND.setMood('wonder'); bd.near = true; yield* walk(hero, bd.x + 1.5, bd.z + 2.0, 1.8, 0.6);
    shot = overShoulder(bd, 1.0); bd.slow = 0.4;
    for (let n = 0; n < 2; n++) { bd.t = 0; yield* until(() => bd.st === 'fly'); while (bd.st === 'fly') { bd.glow = 1; hero.yaw = turnTo(hero.yaw, Math.atan2(bd.x - hero.x, bd.z - hero.z), DT * 4); hold(hero, bd.y > hero.y + 1.5 ? 'look_up' : { neckPitch: -0.2 }); yield; } bd.glow = 0; yield* wait(0.3); }
    bd.slow = 1; bd.near = false; hold(hero, null);
    // 背中から羽の芽がにゅっ
    shot = { pos: () => V3(hero.x + 1.9, hero.y + 1.1, hero.z + 2.0), look: () => V3(hero.x, hero.y + 0.5, hero.z), k: 1.5 }; yield* wait(0.5);
    TK.sproutWings(hero.work.data); paintHero(hero.work); heroWorkSave(hero.work); hero.rebuild(hero.work); hero.squash(2.2); SND.boing(); fx.sparkle(V3(hero.x, hero.y + 0.6, hero.z), 10, 0.6); hero.wing = 0.3;
    yield* wait(0.6); for (let i = 0; i < 3; i++) { yield* tween(0.15, u => { hero.wing = 0.3 + 0.6 * u; }); yield* tween(0.15, u => { hero.wing = 0.9 - 0.6 * u; }); } hero.wing = null; hold(hero, 'look_down'); yield* wait(0.8); hold(hero, null); yield* face(hero, pen.x, pen.z, 0.4); hero.gesture('g_hop'); SND.setMood('field');
    saveProg('tool2'); yield* needTool('wing'); }
  function* observeSquirrel(sq) { hero.mode = 'script'; SND.setMood('wonder'); sq.near = true; yield* walk(hero, sq.x + 2, sq.z + 2.5, 1.8, 0.8);
    shot = overShoulder(sq, 1.0); yield* until(() => sq.st === 'glide'); sq.glow = 1; while (sq.st === 'glide') { hero.yaw = turnTo(hero.yaw, Math.atan2(sq.x - hero.x, sq.z - hero.z), DT * 4); yield; } sq.glow = 0; sq.near = false; yield* wait(0.5);
    // マネ：切り株から脚を広げて滑る → ちょっと滑って、落ちる。上には行けない
    shot = { pos: () => V3(world.stump.x + 3, world.TOP + 1.4, world.stump.z + 2.4), look: () => V3(world.stump.x, world.TOP + 0.6, world.stump.z - 1), k: 1.3 };
    yield* walk(hero, world.stump.x, world.stump.z + 1.4, 2.4, 0.2); yield* hopTo(hero, 5.2, 1.7); hero.v = 0; yield* wait(0.3); yield* face(hero, world.stump.x, world.stump.z - 5, 0.3);
    hero.st = 'air'; hero.vy = 1.5; hero.v = 2.4; hero.y += 0.01; SND.whoosh(); while (hero.st === 'air') { hold(hero, { dy: 0.03, legs: { 5: [0, 0.14, 0.1], 6: [0, 0.14, 0.1], 7: [0, 0.12, -0.1], 8: [0, 0.12, -0.1] } }); hero.vy = Math.max(hero.vy, -1.1); yield; }
    hero.v = 0; hold(hero, 'flat'); SND.flop(); yield* wait(0.6); hold(hero, null); yield* face(hero, world.stump.x, world.stump.z, 0.3); hold(hero, 'look_up'); yield* wait(0.8); hold(hero, null);
    yield* doubt(hero, sq); SND.setMood('field'); }
  // 羽ばたき：羽を掴んで、ゆっくり上げて → 一気に下ろす。4回決まったら飛べる
  function* teachFlap() { story.busy = true; lockPen = true; hero.mode = 'script'; pen.v = 0; SND.setMood('think');
    penBehind(V3(hero.x + Math.sin(hero.yaw) * 3.3, hero.y, hero.z + Math.cos(hero.yaw) * 3.3)); const fy = hero.yaw; shot = { pos: () => V3(hero.x + Math.sin(fy) * 3.3, hero.y + 0.9, hero.z + Math.cos(fy) * 3.3), look: () => V3(hero.x, hero.y + 0.6, hero.z), k: 2 };
    const NEED = 4; teachUI('羽を掴んで、ゆっくり上げて → 一気に下ろす', NEED); const T = TEACH = { down: false, y: 0, p: 0.5, good: 0, lastTop: 0, lastBot: 0, leftTop: null, leftBot: null, upDur: 0, best: null, rec: [], t: 0, lift: 0, busy: false };
    const baseY = hero.y; let hint = 0;
    for (;;) { const dt = DT; T.t += dt;
      const want = T.down ? Math.max(0, Math.min(1, (T.y / H - 0.25) / 0.5)) : T.p; T.p += (want - T.p) * Math.min(1, dt * 20); hero.wing = T.p; teachGauge(1 - T.p); T.rec.push([T.t, T.p]); while (T.rec.length > 2 && T.t - T.rec[0][0] > 1.6) T.rec.shift();
      // 上（0.15以下）・下（0.85以上）・間。上→間→下 が「下ろす」、下→間→上 が「上げる」
      const zone = T.p <= 0.15 ? 'top' : T.p >= 0.85 ? 'bot' : 'mid';
      if (zone !== T.zone) { if (zone !== 'mid' && (T.zone === 'top' || T.zone === 'bot')) { T.leave = T.t - dt; T.from = T.zone; } /* 1コマで端から端へ（すごく速い） */
        if (zone === 'mid') { T.leave = T.t; T.from = T.zone; }
        else if (zone === 'top' && T.from === 'bot' && T.leave != null) T.upDur = T.t - T.leave;
        else if (zone === 'bot' && T.from === 'top' && T.leave != null) { const down = T.t - T.leave, up = T.upDur; SND.flap();
          if (down <= 0.17 && up != null && up >= 0.26) { T.good++; teachDots(T.good); SND.right(); T.lift = Math.min(1.6, T.lift + 0.45); hero.squash(0.8); fx.sparkle(V3(hero.x, hero.y + 0.5, hero.z), 4, 0.8); const sc = up / down; if (!T.best || sc > T.best.sc) T.best = { sc, s: T.rec.filter(q => q[0] >= T.leave - up - 0.08).map(q => [q[0], q[1]]) }; }
          else { if (down > 0.17) { if (T.t - hint > 3) { hint = T.t; msg('下ろす時は、一気に'); } } else if (T.t - hint > 3) { hint = T.t; msg('上げる時は、ゆっくり'); } T.lift = Math.max(0, T.lift - 0.1); }
          T.upDur = null; }
        T.zone = zone; }
      // 浮く（決まった分だけ。ほっとくと沈む）
      T.lift = Math.max(0, T.lift - dt * 0.18); hero.y += ((baseY + T.lift) - hero.y) * Math.min(1, dt * 3); hero.st = 'ground'; hero.noPhys = true;
      if (T.good >= NEED) break; yield; }
    teachEl.style.display = 'none'; TEACH = null; saveFlap(T.best ? T.best.s : []); hero.learned.flap = true; saveProg('free');
    // ふわっと離陸 → 上でくるっと → 降りてくる
    SND.fanfare(); msg('飛び方を覚えた！'); const y0 = hero.y; yield* tween(1.6, u => { hero.y = y0 + u * 1.8; hero.wing = 0.5 + 0.5 * Math.sin(u * 40); }); for (let i = 0; i < 2; i++) fx.sparkle(hero.headPos(), 10, 0.8); yield* tween(1.2, u => { hero.yaw += DT * 5; hero.wing = 0.5 + 0.5 * Math.sin(u * 30); });
    yield* tween(1.4, u => { hero.y = y0 + 1.8 * (1 - u); hero.wing = 0.2; }); hero.noPhys = false; hero.wing = null; hero.y = world.groundAt(hero.x, hero.z, hero.y + 0.3);
    yield* walk(hero, pen.x + 0.9, pen.z - 0.6, 2, 0.3); yield* face(hero, pen.x, pen.z, 0.3); hold(hero, 'low'); story.busy = false; lockPen = false; shot = null; hero.mode = 'invite';
    yield* until(() => riding); hold(hero, null); msg(matchMedia('(pointer: coarse)').matches ? '跳んで、空中でボタン連打＝羽ばたき、長押し＝滑空。北の海へ' : '跳んで、空中で Space 連打＝羽ばたき、長押し＝滑空。北の海へ', 5000);
    yield* until(() => riding && hero.z < world.NORTH - 6 && hero.y > world.TOP - 1); yield* ending(); }
  function saveFlap(s) { let seq = []; if (s.length > 2) { const t0 = s[0][0], T1 = s[s.length - 1][0] - t0, step = Math.max(1 / 24, T1 / 16); for (let t = 0; t <= T1; t += step) { let j = 0; while (j < s.length - 1 && s[j + 1][0] - t0 < t) j++; seq.push(s[j][1]); } } if (seq.length < 4) seq = [0, 0.2, 0.4, 0.6, 0.8, 0.95, 0.4, 1, 1];
    hero.flapSeq = seq; const d = hero.work.data, wingRaw = a => { const out = {}; for (const id of [9, 10]) { const b = d.bones.find(x => x.id === id); if (!b) continue; const p0 = b.pts[0], sx = Math.sign(b.pts[b.pts.length - 1][0] - p0[0]) || 1, ang = (0.85 - a * 1.5) * sx; out[id] = b.pts.map(p => { const dx = p[0] - p0[0], dy = p[1] - p0[1]; return [p0[0] + dx * Math.cos(ang) - dy * Math.sin(ang), p0[1] + dx * Math.sin(ang) + dy * Math.cos(ang), p[2]]; }); } return out; };
    const keys = seq.map((a, f) => ({ f, pose: Object.assign(TPL.poseOf('tokage', { dy: 0.02 }), wingRaw(a)) })); putAct(d, 'flap', '羽ばたき', { len: seq.length - 1, loop: true, keys, seg: {}, taught: seq }); heroWorkSave(hero.work); }

  const ISLAND = { x: -6, z: -124, y: world.far.islandTop };
  // ---- おしまい：空から、まだ行けてない所が次々に見える → 遠くの島に降りる ----
  const fish = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8fb8d8, flatShading: true })); fish.visible = false; scene.add(fish);
  function* ending() { story.busy = true; lockPen = true; SND.setMood('end'); const cap = $('cap'); let lookAt = null;
    shot = { pos: () => V3(hero.x + 6, hero.y + 2.4, hero.z + 7), look: () => lookAt ? V3(hero.x, hero.y, hero.z).lerp(lookAt, 0.75) : V3(hero.x, hero.y + 0.5, hero.z - 4), k: 0.6 }; story.auto = true;
    const beat = function* (p, s, extra) { lookAt = p; const t0 = story.t; while (story.t - t0 < s) { hero.lookYaw = Math.atan2(p.x - hero.x, p.z - hero.z); if (extra) extra(story.t - t0); yield; } };
    yield* wait(1.5); SND.sparkle(); yield* beat(world.far.island, 3.2, t => { if (t > 0.6 && t < 0.7) fx.sparkle(hero.headPos(), 8, 0.5); });
    const fp = V3(hero.x + 6, world.SEA_Y, hero.z - 14); fish.visible = true; SND.splash(); yield* beat(fp, 2.6, t => { const u = Math.min(1, t / 1.6); fish.position.set(fp.x + u * 3, world.SEA_Y + Math.sin(u * Math.PI) * 3, fp.z - u * 2); fish.rotation.z = -u * Math.PI; if (u >= 1 && fish.visible) { fish.visible = false; SND.splash(); } });
    yield* beat(world.far.pillar, 2.8, t => { if (t < 0.05) SND.chirp(); }); yield* beat(world.far.mount, 2.6);
    lookAt = null; hero.lookYaw = null; let tw = 0; while (hero.st !== 'ground' && tw < 14) { tw += yield; } hero.noPhys = false; SND.land(); hero.squash(1.5); yield* wait(0.6); SND.sparkle(); fx.sparkle(hero.headPos(), 18, 1); hero.gesture('g_hop'); yield* wait(1.2);
    cap.querySelector('.big').textContent = 'おしまい'; cap.querySelector('.small').textContent = 'まだまだ、行きたい所だらけ。'; cap.style.opacity = 1; SND.fanfare(); yield* wait(2.2); cap.querySelector('.small').style.opacity = 1; yield* wait(4.5); cap.style.opacity = 0; cap.querySelector('.small').style.opacity = 0;
    story.auto = false; saveProg('ended', { ended: true }); story.busy = false; lockPen = false; shot = null; SND.setMood('field'); msg('このまま、自由に飛びまわれる', 4000); }

  // ================= 読み込み直した時：チェックポイントから =================
  function restore() { const st = prog.stage, onTop = ['ride1x', 'choose2', 'search2', 'tool2', 'teach2', 'free', 'ended'].includes(st);
    drawChips(false);
    if (st === 'meet' || !st) return run(meet());
    hero.learned.jump = ['ride1', 'choose2', 'search2', 'tool2', 'teach2', 'free', 'ended'].includes(st); hero.learned.flap = ['free', 'ended'].includes(st);
    { const d = hero.work.data, list = (d.acts || []).map((ac, i) => ({ slot: ac.slot, anim: i === d.actI ? d.anim : ac.anim })); for (const ac of list) if (ac.anim && ac.anim.taught) { if (ac.slot === 'jump') hero.jumpSeq = ac.anim.taught; if (ac.slot === 'flap') hero.flapSeq = ac.anim.taught; } }
    if (onTop) { Object.assign(pen, { x: 1, z: world.CLIFF_Z - 4, y: world.TOP, yaw: Math.PI }); Object.assign(hero, { x: 2, z: world.CLIFF_Z - 3.2, y: world.TOP, yaw: Math.PI, mode: 'follow' }); }
    else { Object.assign(pen, { x: 3, z: world.CLIFF_Z + 6, y: 0, yaw: 0 }); Object.assign(hero, { x: 4, z: world.CLIFF_Z + 5, y: 0, yaw: 0, mode: 'follow' }); }
    camYaw = pen.yaw + Math.PI; camPos.set(pen.x, pen.y + 3, pen.z + 6); camLook.set(pen.x, pen.y + 0.6, pen.z);
    run((function* () { yield* wait(0.3);
      if (st === 'choose1' || st === 'search1') yield* choose1();
      else if (st === 'tool1') yield* needTool('carry');
      else if (st === 'teach1') { if (judgeOk('carry')) yield* teachJump(); else yield* needTool('carry'); }
      else if (st === 'ride1') { hero.mode = 'invite'; hold(hero, 'low'); yield* until(() => riding); hold(hero, null); yield* until(() => riding && hero.y > world.TOP - 0.2 && hero.st === 'ground'); yield* wait(1.0); yield* birdScene(); }
      else if (st === 'choose2' || st === 'search2') yield* choose2();
      else if (st === 'tool2') yield* needTool('wing');
      else if (st === 'teach2') { if (judgeOk('wing')) yield* teachFlap(); else yield* needTool('wing'); }
      else if (st === 'free') { hero.mode = 'invite'; hold(hero, 'low'); yield* until(() => riding); hold(hero, null); yield* until(() => riding && hero.z < world.NORTH - 6 && hero.y > world.TOP - 1); yield* ending(); }
      else if (st === 'ended') { hero.mode = 'follow'; } })()); }

  // ================= 毎フレーム：トカゲたちの動き =================
  function heroAI(dt) { const m = hero.mode;
    if (m === 'lead') leadStep(dt);
    else if (m === 'follow') { const side = pen.yaw - Math.PI * 0.75, tx = pen.x + Math.sin(side) * 1.5, tz = pen.z + Math.cos(side) * 1.5, d = Math.hypot(tx - hero.x, tz - hero.z), lvl = pen.y - hero.y;
      if (Math.abs(lvl) > 1 && hero.learned.jump && hero.st === 'ground' && dist(hero, pen) < 12 && Math.abs(pen.z - world.CLIFF_Z) < 10) { hero.mode = 'script'; const x = Math.max(-36, Math.min(36, pen.x)); run((function* () { if (lvl > 0) { yield* walk(hero, x, world.CLIFF_Z + 2.0, 3, 0.3); yield* face(hero, x, world.CLIFF_Z - 3, 0.3); yield* taughtJump(hero, 8.3, 2.6); } else { yield* walk(hero, x, world.CLIFF_Z - 0.6, 3, 0.3); yield* face(hero, x, world.CLIFF_Z + 3, 0.3); yield* hopTo(hero, 3, 2.2); } if (hero.mode === 'script') hero.mode = 'follow'; })()); return; }
      if (d > 0.6) hero.walkTo(tx, tz, Math.min(3.6, 0.8 + d * 0.9), dt, world, 0.4); else { hero.v = Math.max(0, hero.v - dt * 6); hero.yaw = turnTo(hero.yaw, pen.yaw, dt * 2); if (!hero.gest && Math.random() < dt * 0.12) hero.gesture(['g_look', 'g_sniff', 'g_tilt', 'g_hop'][Math.floor(Math.random() * 4)]); } }
    else if (m === 'invite') { hero.v = 0; hero.yaw = turnTo(hero.yaw, Math.atan2(pen.x - hero.x, pen.z - hero.z), dt * 4); if (dist(hero, pen) > 3) hero.walkTo(pen.x, pen.z, 2, dt, world, 1.2); }
    else if (m === 'idle') { hero.v = 0; if (!hero.gest && Math.random() < dt * 0.3) hero.gesture(['g_look', 'g_sniff', 'g_hop'][Math.floor(Math.random() * 3)]); }
    else if (m === 'script' && hero.st === 'air') hero.move(dt, world, false); }
  // 乗ってる時：プレイヤーが動かす。跳ぶ（覚えてたら高く）、空中で羽ばたき・滑空
  let flapT = -1, coyote = 0, lastSafe = { x: 0, z: 0, y: 0 };
  function rideStep(dt, mx, mz, walkK, press, held) { const h = hero, mag = Math.min(1, Math.hypot(mx, mz));
    if (story.busy || story.auto) { if (story.auto) { const I = ISLAND, dI = Math.hypot(I.x - h.x, I.z - h.z), land = dI < 9; h.noPhys = true; h.yaw = turnTo(h.yaw, Math.atan2(I.x - h.x, I.z - h.z), dt * 0.6); h.v = land ? Math.max(0, dI * 0.4) : 4.2; h.move(dt, world, true);
        if (land) { h.y += ((I.y) - h.y) * Math.min(1, dt * 1.2); if (h.y < I.y + 0.08) { h.y = I.y; h.st = 'ground'; h.wing = null; } else { h.st = 'air'; h.wing = 0.35; } } else { h.st = 'air'; h.y += ((world.TOP + 4.5) - h.y) * dt * 0.5; flapT += dt; h.wing = flapT % 0.9 < 0.25 ? 0.95 : 0.25; } } return; }
    h.noPhys = false;
    if (h.st === 'ground') { coyote = 0.12; if (mag > 0.05) h.yaw = turnTo(h.yaw, Math.atan2(mx, mz), dt * 7); h.v += Math.max(-dt * 10, Math.min(dt * 7, mag * (walkK ? 1.6 : 4.0) - h.v)); h.move(dt, world); lastSafe = { x: h.x, z: h.z, y: h.y };
      if (press) { if (h.learned.jump) run(taughtRideJump()); else { h.st = 'air'; h.vy = 3.6; h.y += 0.01; SND.jump(); } } }
    else { if (mag > 0.05) h.yaw = turnTo(h.yaw, Math.atan2(mx, mz), dt * (h.learned.flap ? 2.2 : 1.4)); const gl = h.learned.flap && held && h.vy < 0.5; const target = gl ? Math.max(4.6, mag * 6) : mag * 3.6; h.v += (target - h.v) * Math.min(1, dt * (gl ? 1.2 : 1.6)); h.move(dt, world, h.y > world.TOP + 0.2 || h.z < world.NORTH + 1);
      if (h.learned.flap && press) { h.vy = Math.min(4.8, Math.max(h.vy, 0) + 3.6); flapT = 0; SND.flap(); }
      if (gl) h.vy = Math.max(h.vy, -1.2);
      if (flapT >= 0) { flapT += dt; const seq = h.flapSeq || [0, 0.3, 0.6, 1, 1], k = Math.min(seq.length - 1, Math.floor(flapT * 24)); h.wing = seq[k]; if (k >= seq.length - 1) flapT = -1; } else h.wing = h.learned.flap ? (gl ? 0.35 : 0.5) : null; }
    if (h.y < world.SEA_Y + 0.1) { SND.splash(); fx.dust(V3(h.x, world.SEA_Y, h.z), 8, 0.5); const isl = h.z < -100; Object.assign(h, isl ? { x: -6, z: -124, y: world.far.islandTop } : { x: Math.max(-30, Math.min(30, h.x)), z: world.NORTH + 3, y: world.TOP }, { vy: 0, v: 0, st: 'ground' }); msg('海に落ちた…'); } }
  function* taughtRideJump() { const h = hero; h.st = 'jumping'; const seq = h.jumpSeq || jumpKeysFrom([]), tk = Math.max(1, seq.findIndex(p => p < 0)), n = Math.min(tk, 8); for (let i = 0; i < n; i++) { h.pose = h.custom(poseOfJump(seq[Math.floor(i * tk / n)])); yield* wait(1 / 30); } h.pose = h.custom(poseOfJump(-0.4)); h.st = 'air'; h.vy = 8.3; h.y += 0.01; SND.jump(1); yield* wait(0.25); h.pose = null; }
  function crowdAI(c, dt) { if (c.mode === 'flipped') { c.v = 0; return; }
    if (c.mode === 'flee') { if (c.walkTo(c.tx, c.tz, 3.6, dt, world, 0.5)) { c.mode = 'wander'; c.home = [c.x, c.z]; } return; }
    c.t -= dt; if (c.t <= 0) { c.t = 2 + Math.random() * 4; if (Math.random() < 0.5) { c.tx = c.home[0] + (Math.random() - 0.5) * 6; c.tz = c.home[1] + (Math.random() - 0.5) * 6; if (c.tz < world.CLIFF_Z + 1.5) c.tz = world.CLIFF_Z + 1.5; } else { c.tx = c.x; c.tz = c.z; if (Math.random() < 0.5) c.gesture(['g_look', 'g_sniff', 'g_doze'][Math.floor(Math.random() * 3)]); } }
    c.walkTo(c.tx, c.tz, 0.9, dt, world, 0.3); }
  let skyT = 8; function skyBirdTick(dt) { // ときどき草原の上を1羽が飛んでいく（チラ見せ）
    if (!['meet', 'choose1', 'search1', 'tool1', 'teach1', 'ride1'].includes(prog.stage)) { skyBird.F.g.visible = false; return; } skyBird.F.g.visible = true; skyT -= dt; if (skyBird.st === 'perch' && skyBird.i !== 0) skyBird.t = 0; if (skyBird.st === 'perch' && skyT > 0) skyBird.t = 9; if (skyT <= 0) { skyT = 22; skyBird.t = 0; } }

  // ================= ループ =================
  const errBar = document.createElement('div'); errBar.id = 'errBar'; document.body.appendChild(errBar); let errN = 0;
  function showErr(e) { errN++; errBar.textContent = '止まりかけた（' + errN + '回目）：' + e.message + ' ／ ' + ((e.stack || '').split('\n')[1] || '').trim().replace(/https?:\/\/[^/]+\//, ''); errBar.style.display = 'block'; try { const L = JSON.parse(LS.get('yuya_tk_errors') || '[]'); L.push({ t: new Date().toISOString(), m: e.message, s: String(e.stack || '').slice(0, 600) }); LS.set('yuya_tk_errors', JSON.stringify(L.slice(-20))); } catch (_) {} console.error(e); }
  let last = performance.now(); story.t = 0;
  function frame(now) { const SPD = window.__tkSpeed || 1; let dt = Math.max(0, Math.min(0.05 * SPD, (now - last) / 1000 * SPD)); last = now; if (window.__paused || document.hidden) { dt = 0; } DT = dt; story.t += dt;
    const r = ctl.read(); const cy = Math.sin(camYaw), cc = Math.cos(camYaw); let mx = -cy * r.fz + cc * r.fx, mz = -cc * r.fz - cy * r.fx; /* カメラから見た前後左右 */
    if (window.__tkDrive) { mx = window.__tkDrive.mx; mz = window.__tkDrive.mz; } /* テスト用：世界の向きで直接動かす */
    const press = r.press || jumpPress > 0, held = r.held || jumpHeld; jumpPress = 0;
    if (riding) { rideStep(dt, mx, mz, r.walk, press, held); pen.seated = true; pen.x = hero.x; pen.z = hero.z; pen.y = hero.backY() - 0.06 * hero.size; pen.yaw = hero.yaw; pen.v = 0; }
    else if (!lockPen) pen.step(dt, mx, mz, r.walk, world); else pen.step(dt, 0, 0, false, world);
    stepRuns(dt);
    if (!riding) heroAI(dt);
    // 縦の動き（重力・着地）
    if (!hero.noPhys) { const ev = hero.fall(dt, world); if (ev && ev.land > 3 && hero.mode !== 'script') { SND.land(); hero.squash(Math.min(2, ev.land * 0.25)); } }
    for (const c of crowd) { if (c.mode !== 'flipped' || c.st !== 'air') crowdAI(c, dt); else c.move(dt, world); c.fall(dt, world); }
    
    skyBirdTick(dt); for (const c of critters) { c.near = c.near || false; c.tick(dt, world); }
    world.tick(dt); fx.tick(dt);
    // 首だけ向ける（おしまいの「見て！」）
    if (hero.lookYaw != null && hero.pose == null) { const d = Math.atan2(Math.sin(hero.lookYaw - hero.yaw), Math.cos(hero.lookYaw - hero.yaw)); hero.pose = hero.custom({ neckYaw: Math.max(-1, Math.min(1, -d)), neckPitch: -0.3 }, hero.wing); hero.lookPose = true; } else if (hero.lookPose && hero.lookYaw == null) { hero.pose = null; hero.lookPose = false; }
    hero.draw(dt); if (hero.lookPose) hero.pose = null; for (const c of crowd) c.draw(dt); dossun.draw(dt); pen.pose(dt); pen.place(); pen.g.scale.setScalar(riding ? 0.85 : 1);
    $('rideBtn').style.display = (canRide() || (riding && hero.st === 'ground' && !story.busy && !story.auto)) ? 'block' : 'none'; $('rideBtn').textContent = riding ? '降りる' : '乗る';
    camFollow(dt, r); renderer.render(scene, cam); }
  const perf = { n: 0, ms: 0 }; window.__tkPerf = perf;
  function loop(now) { const t0 = performance.now(); try { frame(now); } catch (e) { showErr(e); last = now; } perf.n++; perf.ms += performance.now() - t0; requestAnimationFrame(loop); }
  // 工房から戻った時（shell が呼ぶ）
  window.__field = { refresh() { const w = heroWorkLoad(); if (w) { hero.rebuild(w); } }, back() { backFromTool++; } };
  window.__clearMovementInput = () => { jumpHeld = false; };
  // テスト用（通しで遊ぶ時に中身を見る）
  window.__tk = { get toolCall() { return toolCall; }, get camYaw() { return camYaw; }, get prog() { return prog; }, hero, pen, crowd, dossun, critters, world, story, get riding() { return riding; }, setRide, get teach() { return TEACH; }, cards, judgeOk, heroWorkSave, heroWorkLoad, get shot() { return shot; }, toolBack() { window.__field.refresh(); window.__field.back(); }, get quiz() { return quizEl.style.display === 'block' ? [...quizEl.querySelectorAll('.cs button')].map(b => ({ text: b.textContent, off: b.disabled })) : null; } };
  restore(); requestAnimationFrame(loop);
})();
