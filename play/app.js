// ---- 草原：全部をつなぐだけ（操作 control → 体 body → 皮 skin → カメラ）。工房の作品を相棒にして歩き回る ----
(() => {
  const canvas = document.getElementById('v'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  let W = 0, H = 0; const layout = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }; addEventListener('resize', layout); layout();
  const world = window.PlayWorld.create(scene), ctl = window.PlayControl.create(canvas), pad = window.PlayPad.create(document.getElementById('pad'));
  const msg = (() => { let t = 0; return s => { const e = document.getElementById('msg'); e.textContent = s; e.style.opacity = 1; clearTimeout(t); t = setTimeout(() => e.style.opacity = 0, 2400); }; })();
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  // 相棒：工房で保存した作品（なければツノトカゲのお手本）
  function works() { const l = (window.BoneStorage.loadWorks() || []).filter(w => w && w.data && w.data.bones && w.data.bones.length); if (!l.length) l.push({ id: 'tpl', name: 'ツノトカゲ（お手本）', data: window.BoneTemplates.data('tokage') }); return l; }
  let held = null, B = null, skin = null, skinKind = LS.get('yuya_play_skin2') || 'pulu', camYaw = 0, camPitch = 0.42, camDist = 0, camT = new THREE.Vector3();
  // ---- 序盤：ペンギン（プレイヤー）とプルプル。phase＝small（0.4m・自分で動く）→ big（0.7m・乗れる）。乗ってる間だけプルプルを操作 ----
  const ST = window.PlayStory, pen = ST.penguin(scene, world), rock0 = world.boxes.find(b => b.label === '0.6m'), flower = ST.flower(scene, rock0.x + 0.9, rock0.top, rock0.z - 0.4), brain = ST.brain(world, { flower }), bub = ST.bubble();
  let phase = 'small', riding = false, growT = -1, growFrom = 1;
  const hCache = {};
  // 作品の背の高さ（大きさ1の時、m）→ 狙いの背の高さになる大きさ
  function heightOf(w) { const k = w.id + ':' + (w.t || 0); if (hCache[k]) return hCache[k]; const B1 = window.PlayBody.make(Object.assign({}, w, { __size: 1 })); let top = 0.05;
    window.PlayBody.withState(B1.D, core => { for (const b of B1.D.bones) { const G = core.boneGeom(b); if (G) for (let i = 1; i < G.V.length; i += 3) top = Math.max(top, G.V[i]); } }); return (hCache[k] = top); }
  function useWork(w, keepPos) { const old = B && B.h; try { const H = heightOf(w); B = window.PlayBody.make(Object.assign({}, w, { __size: ST.SIZE[phase] / H })); B.Hm = ST.SIZE[phase]; } catch (e) { console.error(e); msg('この作品は読み込めへんかった'); return; }
    if (keepPos && old) Object.assign(B.h, { x: old.x, z: old.z, y: old.y, yaw: old.yaw }); LS.set('yuya_play_mate', w.id);
    document.getElementById('mateBtn').textContent = '相棒：' + (w.name || '名前なし') + ' ▸'; camDist = camDist || 5.6; useSkin(skinKind); held = null;
    pad.use(w.id, ['jump', 'swing', 'grab'].filter(m => m === 'jump' ? B.M.jump : B.M.attack)); /* 跳ぶ・振る・掴む（攻撃の動きがある子だけ） */
    const miss = ['walk', 'run', 'jump'].filter(s => !B.M[s]); if (miss.length) msg('この子はまだ「' + miss.map(s => ({ walk: '歩く', run: '走る', jump: '跳ぶ' })[s]).join('・') + '」がない（工房で作ってな）'); }
  function useSkin(k) { if (!window.PlaySkins[k]) k = 'pulu'; skinKind = k; LS.set('yuya_play_skin2', k); if (skin) { scene.remove(skin.g); skin.dispose(); } skin = window.PlaySkins[k](B); scene.add(skin.g); document.getElementById('skinBtn').textContent = '見た目：' + window.PlaySkins.list.find(x => x[0] === k)[1]; }
  function pickFirst() { const l = works(), id = LS.get('yuya_play_mate'); useWork(l.find(w => w.id === id) || l.sort((a, b) => (b.t || 0) - (a.t || 0))[0]); placeStart(); }
  function placeStart() { Object.assign(B.h, { x: -0.5, z: 3, y: 0, yaw: Math.PI, v: 0, vy: 0, st: 'ground' }); Object.assign(pen, { x: 0.5, z: 3.2, y: 0, yaw: Math.PI, v: 0, vy: 0, seated: false }); camYaw = 0; camT.set(0, 0.5, 3); }
  // 乗る／降りる（0.7m になってから）。乗ったら操作がプルプルに移る
  const rideBtn = document.getElementById('rideBtn'), growBtn = document.getElementById('growBtn');
  function canRide() { return phase === 'big' && !riding && growT < 0 && B.h.st === 'ground' && Math.hypot(pen.x - B.h.x, pen.z - B.h.z) < B.radius + 1.1 && Math.abs(pen.y - B.h.y) < 0.4; }
  function canDrop() { return riding && B.h.st === 'ground'; }
  function setRide(on) { riding = on; pen.seated = on; document.body.classList.toggle('riding', on); if (on) { brain.S.emo = null; requestAnimationFrame(() => { dispatchEvent(new Event('resize')); pad.use(B.work.id, pad.moves); }); } /* 隠れてる間に大きさ0になったパッドを測り直す */
    if (!on) { const a = B.h.yaw + Math.PI / 2; pen.x = B.h.x + Math.sin(a) * (B.radius + 0.45); pen.z = B.h.z + Math.cos(a) * (B.radius + 0.45); pen.y = world.groundAt(pen.x, pen.z, B.h.y + 0.25); pen.yaw = B.h.yaw; pen.v = 0; brain.S.st = 'follow'; msg('降りた'); }
    else msg(matchMedia('(pointer: coarse)').matches ? '乗った！ ここからはプルプルを動かせる（右のパッドで跳ぶ・振る・掴む）' : '乗った！ ここからはプルプルを動かせる（Space 跳ぶ・J 振る・K 掴む・Q 降りる）'); }
  const toggleRide = () => { if (riding ? canDrop() : canRide()) setRide(!riding); };
  rideBtn.onclick = toggleRide; addEventListener('keydown', e => { if (e.key.toLowerCase() === 'q' && !e.repeat) toggleRide(); });
  // （仮）願いを叶える：観察→工房の1周ができるまでの代わり。0.7m の乗せられる体になる
  function grant() { if (phase !== 'small') return; phase = 'big'; const w = B.work; useWork(w, true); brain.S.st = 'grow'; growT = 0; growFrom = ST.SIZE.small / ST.SIZE.big; bub.show(null); msg('プルプルの体が、ぐーっと大きくなっていく…'); }
  growBtn.onclick = grant;
  document.getElementById('storyBtn').onclick = () => { if (riding) setRide(false); phase = 'small'; brain.reset(); useWork(B.work, false); placeStart(); bub.show(null); msg('最初から'); };
  document.getElementById('mateBtn').onclick = () => { const l = works(), i = l.findIndex(w => w.id === (B && B.work.id)); useWork(l[(i + 1) % l.length], true); };
  document.getElementById('skinBtn').onclick = () => { const L = window.PlaySkins.list, i = L.findIndex(x => x[0] === skinKind); useSkin(L[(i + 1) % L.length][0]); };
  document.getElementById('toolBtn').onclick = () => { try { parent.__openTool && parent.__openTool(); } catch (_) {} };
  if (parent === window) document.getElementById('toolBtn').style.display = 'none';
  // 段の高さの札
  const tags = world.boxes.filter(b => b.label).map(b => { const e = document.createElement('div'); e.className = 'tag'; e.textContent = b.label; document.body.appendChild(e); return { b, e }; });
  const proj = v => { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, z: p.z }; };
  const info = document.getElementById('info');
  // ✏：線の描き直し（動きを選んで、パッドに描く）
  { const eb = document.getElementById('padEdit'), row = document.getElementById('padRow'); eb.onclick = () => { row.innerHTML = pad.moves.map(m => '<button class="btn" data-m="' + m + '">' + window.PlayPad.MOVES[m].icon + ' ' + window.PlayPad.MOVES[m].name + '</button>').join('') + '<button class="btn" data-r="1">元の線に戻す</button>'; row.classList.toggle('show');
      row.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.r) { pad.moves.forEach(m => pad.reset(m)); msg('線を元に戻した'); } else { pad.startEdit(b.dataset.m); msg(window.PlayPad.MOVES[b.dataset.m].name + 'の線をパッドに描いてな（描き始めが開始の点）'); } row.classList.remove('show'); }); }; }
  let feel = null, feelT = 0;
  let last = performance.now(), shownLast = null;
  function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (B) { const r = ctl.read(); camYaw -= r.orbit.dx * 0.006; camPitch = Math.max(0.05, Math.min(1.2, camPitch + r.orbit.dy * 0.004)); camDist = Math.max(2, Math.min(30, camDist * r.orbit.zoom));
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw), mx = -sy * r.fz + cy * r.fx, mz = -cy * r.fz - sy * r.fx; /* カメラから見た前後左右 → 世界の向き */
      const a = pad.read(), air = B.h.st === 'jair' || B.h.st === 'air' || B.h.st === 'flap';
      if (riding) B.step(dt, { mx, mz, walk: r.walk, press: r.press || (air && a.airTap), up: r.up, held: r.held, act: a, keySwing: r.keySwing, keyGrab: r.keyGrab }, world);
      else { pen.step(dt, mx, mz, r.walk, world); /* プレイヤーはペンギン。プルプルは自分で動く */
        const inp = brain.tick(B, pen, dt, { riding, squash: k => skin.squash && skin.squash(k), push: (dx, dz) => pen.nudge(dx, dz, world), lift: () => pen.bump() }); /* 言葉では説明しない */
        if (inp) B.step(dt, { mx: inp.mx, mz: inp.mz, walk: inp.walk, press: !!inp.press, up: false, held: false, act: {}, keySwing: false, keyGrab: false }, world); }
      world.tick(dt);
      const v = B.view(); skin.setPose(v); let ev = null; while (B.events.length) { const e = B.events.shift(); ev = e; if (e && e.land != null) shownLast = Object.assign({}, B.last || {}, { rise: e.rise }); }
      // 振る・掴む：口（頭の先）のまわりで当たり・掴みを見る
      const head = B.headAt(v);
      if (riding && ev && typeof ev.strike === 'number') { /* ev が 'lift' みたいな文字の時、'lift'.strike は文字列の古い関数になってまう → 数字の時だけ */ const res = world.strike(head, ev.strike, 0.5 + B.radius); feel = res === 'cut' ? '振る：×' + ev.strike.toFixed(2) + ' → 切れた！' : res === 'weak' ? '振る：×' + ev.strike.toFixed(2) + ' → ペチッ（もっと速く振り抜く）' : '振る：×' + ev.strike.toFixed(2); feelT = 2.5; if (res === 'cut') msg('ツタが切れた！'); }
      if (riding && B.h.st === 'grab') { const q = B.h.grip; if (!held) { const f = world.fruitNear(head, 0.4 + 0.2 * B.size, 1.0 * B.size); if (f && q >= 0.45) { if (q > 0.78) { world.crush(f); feel = '掴む：力 ' + Math.round(q * 100) + '% → 潰れた…'; feelT = 2.5; } else { held = f; f.st = 'held'; feel = '掴んだ！（力 ' + Math.round(q * 100) + '%）'; feelT = 2; } } }
        else if (q > 0.78) { world.crush(held); held = null; feel = '力入れすぎて潰れた…'; feelT = 2.5; } else if (q < 0.3) { world.drop(held); held = null; } }
      else if (held) { world.drop(held); held = null; }
      if (held) held.m.position.set(head[0], head[1] - 0.05, head[2]);
      let gm = 1; if (growT >= 0) { growT += dt; const u = Math.min(1, growT / 1.4); gm = growFrom + (1 - growFrom) * (1 - Math.pow(1 - u, 3)) + Math.sin(growT * 18) * 0.06 * (1 - u); if (u >= 1) { growT = -1; brain.S.st = 'follow'; skin.squash && skin.squash(2.4); msg('乗せられる体になった！ 近くで「乗る」（Q）'); } }
      const tilt = brain.S.tilt; skin.update(dt, v, ev); skin.g.position.set(v.x, v.y + B.radius * 0.6 * Math.max(0, tilt), v.z); skin.g.rotation.order = 'YXZ'; skin.g.rotation.y = v.yaw; skin.g.rotation.x = -tilt; skin.g.scale.setScalar(v.size * gm); skin.inner.position.set(-v.ref[0], -v.ref[1], -v.ref[2]);
      // ペンギン：乗ってる時はプルプルの背中に座る
      if (riding) { pen.x = v.x; pen.z = v.z; pen.y = v.y + B.cR[1] * B.size * gm + 0.06; /* 背中（胴の骨の高さ）に座る */ pen.yaw = v.yaw; pen.v = 0; pen.pose(dt, true); } pen.place();
      // 吹き出し：プルプルの頭の上
      bub.show(null); /* 吹き出しは出さない（動きで伝える） */ bub.tick(dt); { const p = proj(new THREE.Vector3(v.x, v.y + B.Hm * gm + 0.18, v.z)); bub.place(p.x, p.y, p.z < 1); }
      growBtn.style.display = phase === 'small' && brain.S.wished ? 'block' : 'none';
      rideBtn.style.display = (riding ? canDrop() : canRide()) ? 'block' : 'none'; rideBtn.textContent = riding ? '⤵ 降りる' : '🫧 乗る';
      // カメラ：後ろからついていく（歩いてる間はペンギン、乗ったらプルプル）
      const fx = riding ? B.h.x : pen.x, fz = riding ? B.h.z : pen.z, fy = riding ? B.h.y + B.cR[1] * B.size + 0.75 : pen.y + 0.55;
      camT.lerp(new THREE.Vector3(fx, fy, fz), Math.min(1, dt * 6)); const cp = Math.cos(camPitch);
      cam.position.set(camT.x + Math.sin(camYaw) * cp * camDist, camT.y + Math.sin(camPitch) * camDist, camT.z + Math.cos(camYaw) * cp * camDist); cam.lookAt(camT);
      // 表示：溜め・前のジャンプ
      const h = B.h, rows = []; if (h.st === 'charge' || h.st === 'takeoff') rows.push('溜め ' + Math.round(h.c * 100) + '%'); if (h.st === 'grab') rows.push('力 ' + Math.round(h.grip * 100) + '%（ちょうど 45〜78%）');
      if (feelT > 0) { feelT -= dt; rows.push(feel); }
      if (shownLast && shownLast.mode) rows.push(shownLast.mode === 'tap' ? '普段ジャンプ：' + Math.max(0, shownLast.rise).toFixed(2) + 'm' + (shownLast.capped ? '（普段はここまで）' : '') : '勝負ジャンプ：弾き ×' + shownLast.sp.toFixed(2) + '・溜め ' + Math.round(shownLast.c * 100) + '% → ' + Math.max(0, shownLast.rise).toFixed(2) + 'm（素は ' + shownLast.base.toFixed(2) + 'm）');
      info.innerHTML = rows.map(t => '<div>' + t + '</div>').join(''); info.style.display = rows.length && riding ? 'block' : 'none';
    }
    for (const t of tags) { const p = proj(new THREE.Vector3(t.b.x, t.b.top + 0.25, t.b.z1)); t.e.style.display = p.z < 1 ? 'block' : 'none'; t.e.style.transform = 'translate(' + (p.x - 24) + 'px,' + (p.y - 12) + 'px)'; }
    renderer.render(scene, cam); requestAnimationFrame(frame); }
  pickFirst(); requestAnimationFrame(frame);
  msg(matchMedia('(pointer: coarse)').matches ? '左をなぞってペンギンを歩かせる。プルプルについて行こう' : 'WASDでペンギンを歩かせる。プルプルについて行こう');
  // 工房から戻った時：作品を読み直す（形や動きが変わってるかも）
  window.__play = { refresh() { const l = works(), w = l.find(x => x.id === (B && B.work.id)) || l[0]; useWork(w, true); }, pad, world, head: () => B.headAt(B.view()), story: { pen, brain, grant, setRide, canRide, get phase() { return phase; }, get riding() { return riding; } }, debug: () => ({ held: !!held, feel, raw: B && JSON.stringify(B.h), h: B && B.h, last: B && B.last, skin: skinKind, M: B && Object.keys(B.M), size: B && B.size }) };
})();
