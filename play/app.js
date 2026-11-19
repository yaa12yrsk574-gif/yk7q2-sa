// ---- 草原：全部をつなぐだけ（操作 control → 体 body → 皮 skin → カメラ）。工房の作品を相棒にして歩き回る ----
(() => {
  const canvas = document.getElementById('v'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  let W = 0, H = 0; const layout = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }; addEventListener('resize', layout); layout();
  const world = window.PlayWorld.create(scene), ctl = window.PlayControl.create(canvas, document.getElementById('rail'));
  const msg = (() => { let t = 0; return s => { const e = document.getElementById('msg'); e.textContent = s; e.style.opacity = 1; clearTimeout(t); t = setTimeout(() => e.style.opacity = 0, 2400); }; })();
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  // 相棒：工房で保存した作品（なければツノトカゲのお手本）
  function works() { const l = (window.BoneStorage.loadWorks() || []).filter(w => w && w.data && w.data.bones && w.data.bones.length); if (!l.length) l.push({ id: 'tpl', name: 'ツノトカゲ（お手本）', data: window.BoneTemplates.data('tokage') }); return l; }
  let B = null, skin = null, skinKind = LS.get('yuya_play_skin') || 'normal', camYaw = 0, camPitch = 0.32, camDist = 0, camT = new THREE.Vector3();
  function useWork(w, keepPos) { const old = B && B.h; try { B = window.PlayBody.make(w); } catch (e) { console.error(e); msg('この作品は読み込めへんかった'); return; }
    if (keepPos && old) Object.assign(B.h, { x: old.x, z: old.z, y: old.y, yaw: old.yaw }); LS.set('yuya_play_mate', w.id);
    document.getElementById('mateBtn').textContent = '相棒：' + (w.name || '名前なし') + ' ▸'; camDist = camDist || Math.max(4.5, B.size * 5); useSkin(skinKind);
    const miss = ['walk', 'run', 'jump'].filter(s => !B.M[s]); if (miss.length) msg('この子はまだ「' + miss.map(s => ({ walk: '歩く', run: '走る', jump: '跳ぶ' })[s]).join('・') + '」がない（工房で作ってな）'); }
  function useSkin(k) { if (!window.PlaySkins[k]) k = 'normal'; skinKind = k; LS.set('yuya_play_skin', k); if (skin) { scene.remove(skin.g); skin.dispose(); } skin = window.PlaySkins[k](B); scene.add(skin.g); document.getElementById('skinBtn').textContent = '見た目：' + window.PlaySkins.list.find(x => x[0] === k)[1]; }
  function pickFirst() { const l = works(), id = LS.get('yuya_play_mate'); useWork(l.find(w => w.id === id) || l.sort((a, b) => (b.t || 0) - (a.t || 0))[0]); B.h.x = 0; B.h.z = 2; B.h.yaw = Math.PI; }
  document.getElementById('mateBtn').onclick = () => { const l = works(), i = l.findIndex(w => w.id === (B && B.work.id)); useWork(l[(i + 1) % l.length], true); };
  document.getElementById('skinBtn').onclick = () => { const L = window.PlaySkins.list, i = L.findIndex(x => x[0] === skinKind); useSkin(L[(i + 1) % L.length][0]); };
  document.getElementById('toolBtn').onclick = () => { try { parent.__openTool && parent.__openTool(); } catch (_) {} };
  if (parent === window) document.getElementById('toolBtn').style.display = 'none';
  // 段の高さの札
  const tags = world.boxes.filter(b => b.label).map(b => { const e = document.createElement('div'); e.className = 'tag'; e.textContent = b.label; document.body.appendChild(e); return { b, e }; });
  const proj = v => { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, z: p.z }; };
  const info = document.getElementById('info'), knob = document.querySelector('#rail .tk');
  let last = performance.now(), shownLast = null;
  function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (B) { const r = ctl.read(); camYaw -= r.orbit.dx * 0.006; camPitch = Math.max(0.05, Math.min(1.2, camPitch + r.orbit.dy * 0.004)); camDist = Math.max(2, Math.min(30, camDist * r.orbit.zoom));
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw), mx = -sy * r.fz + cy * r.fx, mz = -cy * r.fz - sy * r.fx; /* カメラから見た前後左右 → 世界の向き */
      B.step(dt, { mx, mz, walk: r.walk, press: r.press, up: r.up, held: r.held, rail: r.rail, railTap: r.railTap }, world);
      const v = B.view(); skin.setPose(v); let ev = null; while (B.events.length) { const e = B.events.shift(); ev = e; if (e && e.land != null) shownLast = Object.assign({}, B.last || {}, { rise: e.rise }); }
      skin.update(dt, v, ev); skin.g.position.set(v.x, v.y, v.z); skin.g.rotation.y = v.yaw; skin.g.scale.setScalar(v.size); skin.inner.position.set(-v.ref[0], -v.ref[1], -v.ref[2]);
      // カメラ：後ろからついていく
      camT.lerp(new THREE.Vector3(B.h.x, B.h.y + B.cR[1] * B.size * 1.2, B.h.z), Math.min(1, dt * 6)); const cp = Math.cos(camPitch);
      cam.position.set(camT.x + Math.sin(camYaw) * cp * camDist, camT.y + Math.sin(camPitch) * camDist, camT.z + Math.cos(camYaw) * cp * camDist); cam.lookAt(camT);
      // 表示：溜め・前のジャンプ
      const h = B.h, rows = []; if (h.st === 'charge' || h.st === 'takeoff') rows.push('溜め ' + Math.round(h.c * 100) + '%');
      if (shownLast && shownLast.mode) rows.push(shownLast.mode === 'tap' ? '普段ジャンプ：' + Math.max(0, shownLast.rise).toFixed(2) + 'm' + (shownLast.capped ? '（普段はここまで）' : '') : '勝負ジャンプ：弾き ×' + shownLast.sp.toFixed(2) + '・溜め ' + Math.round(shownLast.c * 100) + '% → ' + Math.max(0, shownLast.rise).toFixed(2) + 'm（素は ' + shownLast.base.toFixed(2) + 'm）');
      info.innerHTML = rows.map(t => '<div>' + t + '</div>').join(''); info.style.display = rows.length ? 'block' : 'none';
      const J = B.M.jump && B.M.jump.J, kv = r.rail.active ? r.rail.v : (J && h.st === 'charge' ? h.f / Math.max(1, J.hold) * 0.9 : J && h.st === 'takeoff' ? 0.9 * (1 - (h.f - J.hold) / Math.max(1, J.tk - J.hold)) : 0); knob.style.top = (kv * 100) + '%'; knob.classList.toggle('full', h.c >= 1 && h.st === 'charge'); }
    for (const t of tags) { const p = proj(new THREE.Vector3(t.b.x, t.b.top + 0.25, t.b.z1)); t.e.style.display = p.z < 1 ? 'block' : 'none'; t.e.style.transform = 'translate(' + (p.x - 24) + 'px,' + (p.y - 12) + 'px)'; }
    renderer.render(scene, cam); requestAnimationFrame(frame); }
  pickFirst(); requestAnimationFrame(frame);
  msg(matchMedia('(pointer: coarse)').matches ? '左をなぞって移動・レールをちょんと触るとジャンプ・下まで下ろして溜め→弾くと勝負ジャンプ' : 'WASDで移動・Spaceでジャンプ（長押し→離すと勝負ジャンプ）・ドラッグでカメラ');
  // 工房から戻った時：作品を読み直す（形や動きが変わってるかも）
  window.__play = { refresh() { const l = works(), w = l.find(x => x.id === (B && B.work.id)) || l[0]; useWork(w, true); }, debug: () => ({ raw: B && JSON.stringify(B.h), h: B && B.h, last: B && B.last, skin: skinKind, M: B && Object.keys(B.M), size: B && B.size }) };
})();
