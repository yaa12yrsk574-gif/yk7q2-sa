
(function () {
const THREE = window.THREE;
const {smoothPath,profAt,frames,boneGeom,topoBones,blendPose,segInfo,keyAt,segOf,nOf,drawFrames,drawIdx,spacingOf,bezNorm,bezBake,cubicAt,bezSample,evalPath,txTree,applyPath,poseU,poseAt,measureGaitQuality,detailPointsFromMesh,ptsOf,ringsOf,angOf,bezStore,kidsOf} = window.BoneCore.create(THREE, () => S, value => { S = value; });
let S = null; const clone = o => JSON.parse(JSON.stringify(o)); const boneById = id => S.bones.find(b => b.id === id);
const V3 = a => new THREE.Vector3(a[0], a[1], a[2]), r4 = v => Math.round(v * 1e4) / 1e4;



























// ---- 設計図のテンプレ（動きのお手本）と、今の骨への当てはめ ----
// お手本は「拾った時の骨」で作ってある。骨の形・長さ・関節の数を変えても、各骨の「向きの変わり方」を写すので付いてくる。
const TPL = window.BoneTemplates;

// ============ 基本 ============
const WORKS_KEY = window.ProjectData.keys.works, BP_KEY = window.ProjectData.keys.blueprints;
const canvas = document.getElementById('v'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfe6dc); scene.fog = new THREE.Fog(0xdfe6dc, 18, 42);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8a66, 1.15)); const sun = new THREE.DirectionalLight(0xfff3e0, 1.4); sun.position.set(4, 9, 5); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0xb7c69c, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new THREE.GridHelper(80, 80, 0xa3b38a, 0xa9b890); grid.position.y = 0.002; scene.add(grid);
for (let i = 0; i < 26; i++) { const r = 0.3 + Math.random() * 0.9, m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: 0x9a9284, flatShading: true })); const a = Math.random() * 6.28, d = 9 + Math.random() * 24; m.position.set(Math.cos(a) * d, r * 0.4, Math.sin(a) * d); m.rotation.set(Math.random(), Math.random(), 0); scene.add(m); }
const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
let W = 0, H = 0; function layout() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); } addEventListener('resize', layout); layout(); try { new ResizeObserver(() => layout()).observe(document.documentElement); } catch (_) {}
const msg = (() => { let t = 0; return s => { const e = document.getElementById('msg'); e.textContent = s; e.style.opacity = 1; clearTimeout(t); t = setTimeout(() => e.style.opacity = 0, 2200); }; })();
const proj = P => { const v = P.clone().project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; };
function pop(P, text, col, size) { const s = proj(P); if (s.z > 1) return; const e = document.createElement('div'); e.className = 'pop'; e.textContent = text; e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; e.style.color = col || '#fff'; e.style.fontSize = (size || 20) + 'px'; document.body.appendChild(e); requestAnimationFrame(() => { e.style.transform = 'translate(-50%,-140%)'; e.style.opacity = 0; }); setTimeout(() => e.remove(), 750); }
// ============ ボーンの体（工房と同じ計算で形を作る） ============
const matBody = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
function prepData(d) { // 足元を地面、真ん中を原点にそろえる
  const D = clone(d); D.bones = D.bones.filter(b => b.pts && b.pts.length >= 2); let minY = 1e9, sx = 0, sz = 0, n = 0;
  for (const b of D.bones) for (const p of b.pts) { minY = Math.min(minY, p[1]); sx += p[0]; sz += p[2]; n++; }
  const ox = n ? sx / n : 0, oz = n ? sz / n : 0; for (const b of D.bones) { b.pts = b.pts.map(p => [p[0] - ox, p[1] - minY + 0.02, p[2] - oz]); if (!b.off) b.off = {}; if (!b.wp) b.wp = [{ t: 0, r: 0.04 }]; if (!b.wn) b.wn = b.wp; if (!b.dp) b.dp = b.wp; if (!b.dn) b.dn = b.dp; }
  S = D; let my = Infinity; for (const b of D.bones) { const G = boneGeom(b); if (G) for (let i = 1; i < G.V.length; i += 3) my = Math.min(my, G.V[i]); } if (!isFinite(my)) my = 0.02; /* 肉付けした体の一番下を地面に（工房の「地面に置く」と同じ） */
  for (const b of D.bones) b.pts = b.pts.map(p => [p[0], p[1] - my, p[2]]); D.__o = [ox, minY - 0.02 + my, oz]; return D; }
function shiftPose(P, o) { const out = {}; for (const id in P) out[id] = P[id].map(p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]); return out; }

// 面塗り: 工房と同じ三角面の並びから、頂点色付き形状を生成する。
function bodyPaintGeometry(G, bone, defaultColor) {
  const pos = new Float32Array(G.I.length * 3), col = new Float32Array(G.I.length * 3);
  const base = new THREE.Color(defaultColor);
  for (let t = 0; t < G.I.length / 3; t++) {
    const hex = bone.paint && bone.paint[t];
    const color = (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) ? new THREE.Color(hex) : base;
    for (let q=0;q<3;q++) {
      const src=G.I[t*3+q]*3,dst=(t*3+q)*3;
      pos[dst]=G.V[src];pos[dst+1]=G.V[src+1];pos[dst+2]=G.V[src+2];
      col[dst]=color.r;col[dst+1]=color.g;col[dst+2]=color.b;
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.computeVertexNormals();
  return g;
}



function updateBodyDetails(lines,meshes,group){
  const active=(lines||[]).filter(s=>Array.isArray(s.pts)&&s.pts.length>1&&meshes.has(s.id));
  for(let i=0;i<active.length;i++){
    const s=active[i],pts=detailPointsFromMesh(meshes.get(s.id),s);if(pts.length<2)continue;
    let line=group.children[i];
    if(!line){line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:s.color||'#2b2a27',depthTest:true}));group.add(line);}
    const geom=new THREE.BufferGeometry().setFromPoints(pts);
    line.geometry.dispose();line.geometry=geom;
    if(line.userData.inkColor!==s.color){line.material.color.set(s.color||'#2b2a27');line.userData.inkColor=s.color;}
  }
  while(group.children.length>active.length){const l=group.children[group.children.length-1];group.remove(l);l.geometry.dispose();l.material.dispose();}
}
class BoneBody { constructor(data, color) { this.D = prepData(data); this.g = new THREE.Group(); this.details = new THREE.Group(); this.g.add(this.details); this.mat = matBody(0xffffff); this.mat.vertexColors = true; this.baseColor = color; this.meshes = new Map(); this.setPose(null); scene.add(this.g); }
  setPose(P) { S = this.D; const keep = new Map(); for (const b of this.D.bones) { const tb = P && P[b.id] && P[b.id].length === b.pts.length ? Object.assign({}, b, { pts: P[b.id] }) : b; const G = boneGeom(tb); if (!G) continue;
      let m = this.meshes.get(b.id);
      if (m && m.geometry.attributes.position.count === G.I.length) {
        const v=m.geometry.attributes.position.array;
        for(let j=0;j<G.I.length;j++){const src=G.I[j]*3,dst=j*3;v[dst]=G.V[src];v[dst+1]=G.V[src+1];v[dst+2]=G.V[src+2];}
        m.geometry.attributes.position.needsUpdate=true;m.geometry.computeVertexNormals();
      } else {
        if(m){m.geometry.dispose();this.g.remove(m);}
        const g=bodyPaintGeometry(G,b,this.baseColor);
        m=new THREE.Mesh(g,this.mat);this.g.add(m);
      }
      keep.set(b.id,m); }
    for (const [id, m] of this.meshes) if (!keep.has(id)) { m.geometry.dispose(); this.g.remove(m); } this.meshes = keep; updateBodyDetails(this.D.detailLines,this.meshes,this.details); }
  joints(P) { const out = []; for (const b of this.D.bones) { const pts = P && P[b.id] && P[b.id].length === b.pts.length ? P[b.id] : b.pts; pts.forEach((p, i) => out.push({ k: b.id + '_' + i, v: new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(this.g.matrixWorld) })); } return out; }
  dispose() { for (const m of this.meshes.values()) m.geometry.dispose(); for(const l of this.details.children){l.geometry.dispose();l.material.dispose();} this.mat.dispose(); scene.remove(this.g); } }
// ============ ツノトカゲの設計図（骨だけ） ============
function tokageData() { return TPL.data('tokage'); } // 骨と動きのお手本は tpl_lib.js
// ============ 調査隊員（プレイヤー） ============
const pl = { x: 0, z: 0, yaw: 0, g: new THREE.Group(), cd: 0, hp: 24, maxHp: 24, invuln: 0, hasMounted: false };
{ const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.95, 10), matBody(0x3b6ea8)); body.position.y = 0.72; const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), matBody(0xe9cfae)); head.position.y = 1.36;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), matBody(0xd9572b)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.0, 0.24); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), matBody(0x7a5a3a)); stick.position.set(0.28, 0.9, 0.15); stick.rotation.x = 0.4; pl.stick = stick;
  pl.g.add(body, head, nose, stick); scene.add(pl.g); }
// ============ 敵 ============
const enemies = [];
let TOK_WALK = null, TOK_RUN = null, TOK_FAST = null, TOK_HEAVY = null; try { const D0 = tokageData(), R0 = Object.fromEntries(D0.bones.map(b => [b.id, b.pts])); TOK_WALK = TPL.animFor('tokage', 'walk', R0, D0.bones); TOK_RUN = TPL.animFor('tokage', 'run', R0, D0.bones); TOK_FAST = TPL.animFor('tokage', 'attack_fast', R0, D0.bones); TOK_HEAVY = TPL.animFor('tokage', 'attack', R0, D0.bones);
  // 強い野生個体は同じ原画の「溜めを長く・打撃を短く」編集した動き。工房でも再現できる。
  if (TOK_HEAVY && TOK_HEAVY.keys.length === 5) {
    const timing = [0, 6, 8, 14, 20];
    TOK_HEAVY.keys.forEach((k, i) => { k.f = timing[i]; }); TOK_HEAVY.len = 20;
    TOK_HEAVY.guides = [{ f: 0, label: '構え' }, { f: 6, label: '溜め' }, { f: 8, label: '強打' }, { f: 20, label: '戻り' }];
  }
} catch (_) {}
// 速さで歩き／走りを切りかえ、足の回転は上限まで（それ以上は歩幅で稼いだことにする）。歩きと走りは同じ足運びの位相を共有するので切りかえで飛ばない
// 工房・狩り場で共通：脚の前後ストロークと持ち上げ高さをお手本と比較する暫定歩行性能。

function gait(sp, W, Rn) { if (!(sp > 0.05)) return W ? { A: W, cyc: 0 } : null; if (Rn && (sp > 1.3 || !W)) return { A: Rn, cyc: Math.min(sp / 0.56, 3.2) }; if (W) return { A: W, cyc: Math.min(sp / 0.36, 2.4) }; return null; }
function spawnTokage(x, z) {
  // 初回は設計図を拾える難易度にし、相棒を作った後の狩りは歯応えを上げる。
  const hasBlueprint = loadWorks().some(w => (w.name || '').startsWith('設計図：ツノトカゲ'));
  const hp = hasBlueprint ? 24 : 9;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.78, 28), new THREE.MeshBasicMaterial({ color: 0xe45a35, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  const e = { kind: 'wild', name: 'ツノトカゲ', x, z, yaw: Math.random() * 6.28, hp, max: hp, r: 0.55,
    body: new BoneBody(tokageData(), 0x8aa05a), ring, mode: 'wander', atk: null, attackCount: 0,
    cooldown: 0.7, recover: 0, warn: 0, t: Math.random() * 10, aggro: false, flash: 0, vx: 0, vz: 0 };
  enemies.push(e); return e; }
function spawnDummy(x, z) { const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.2, 10), matBody(0xb08a5a)); post.position.y = 0.6; const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), matBody(0xc9a06a)); top.position.y = 1.3; g.add(post, top); g.position.set(x, 0, z); scene.add(g);
  enemies.push({ kind: 'dummy', name: 'まと', x, z, yaw: 0, hp: Infinity, r: 0.28, g, flash: 0, vx: 0, vz: 0 }); }
// ============ キャンプ（拠点）：中は安全。HPが戻り、工房をひらける ============
const CAMP = { x: 0, z: 0, r: 2.4 };
{ const c = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(CAMP.r - 0.08, CAMP.r, 48), new THREE.MeshBasicMaterial({ color: 0xd9572b, transparent: true, opacity: 0.55, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; c.add(ring);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(CAMP.r - 0.08, 48), new THREE.MeshBasicMaterial({ color: 0xe9d9b0, transparent: true, opacity: 0.35, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; c.add(floor);
  const tent = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 4), new THREE.MeshStandardMaterial({ color: 0xd9572b, flatShading: true })); tent.position.set(-1.1, 0.55, -1.1); tent.rotation.y = Math.PI / 4; c.add(tent);
  const fire = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xffb03a, emissive: 0xff7a1a, emissiveIntensity: 0.9, flatShading: true })); fire.position.set(0.9, 0.18, -0.9); c.add(fire);
  c.position.set(CAMP.x, 0, CAMP.z); scene.add(c); }
const inCamp = (x, z) => Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r;
function openTool() { if (!inCamp(pl.x, pl.z)) return; clearMovementInput(); try { window.parent.__openTool && window.parent.__openTool(); } catch (_) {} }
document.getElementById('campBtn').addEventListener('pointerdown', e => { e.preventDefault(); if(window.parent.__editorInput.intent(e)!=='primary')return; openTool(); });
spawnTokage(5, 4); spawnDummy(-3, 3); spawnDummy(-4.5, 1.5); spawnDummy(-3, -0.2);
const drops = [];
// ============ 相棒 ============
let mate = null; // { work, body, x, z, yaw, atk:{f, anim, hit:Set, maxV, prev}, lunge }
const loadWorks = window.BoneStorage.loadWorks;
function animOf(d, slot) { if (!d || !d.acts) return null; const i = d.acts.findIndex(a => a.slot === slot); if (i < 0) return null; const A = i === d.actI ? d.anim : d.acts[i].anim; return A && A.keys && A.keys.length >= 2 ? A : null; }
const attackOf = d => animOf(d, 'attack');
// 体を動きの f コマ目にする（同じコマは覚えておく）
function bodyFrame(body, A, f) { const fi = Math.floor(f); if (!body.fc || body.fcA !== A) { body.fc = new Map(); body.fcA = A; } let P = body.fc.get(fi); if (!P) { S = body.D; S.anim = A; P = shiftPose(poseAt(Math.min(fi, A.len)), body.D.__o); body.fc.set(fi, P); } body.setPose(P); }
function updateBattleButtons() {
  const h = document.getElementById('hit'), k = document.getElementById('mateAtk');
  h.innerHTML = mate ? '速い技<span class="kb">J</span>' : '叩く<span class="kb">J</span>';
  k.innerHTML = '重い技<span class="kb">K</span>'; k.disabled = !mate;
}
function setMate(w) {
  if (mate) mate.body.dispose(); mate = null;
  if (!w) {
    pl.g.scale.setScalar(1); document.getElementById('mateBtn').textContent = '相棒：なし';
    updateBattleButtons(); msg('徒歩に戻った'); return;
  }
  const d = clone(w.data); if (d.rest) { for (const b of d.bones) if (d.rest[b.id]) b.pts = d.rest[b.id]; }
  const base = Object.fromEntries(d.bones.map(b => [b.id, clone(b.pts)]));
  const fast = animOf(d, 'attack_fast') || TPL.animFor('tokage', 'attack_fast', base, d.bones);
  mate = { work: w, body: new BoneBody(d, 0xd9b48a), x: pl.x, z: pl.z, yaw: pl.yaw,
    atk: null, anim: attackOf(d), fast, walk: animOf(d, 'walk'), run: animOf(d, 'run'),
    idle: animOf(d, 'idle'), wf: 0, ph: 0, moving: false, seatY: 0.5 };
  mate.pace = {walk:measureGaitQuality(d,mate.walk,'walk'),run:measureGaitQuality(d,mate.run,'run')};
  mate.body.g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(mate.body.g);
  if (Number.isFinite(bb.max.y)) mate.seatY = Math.min(1.35, Math.max(0.42, bb.max.y * 0.8));
  pl.g.scale.setScalar(0.56);
  // 体力は騎乗した最初の一度だけ回復。相棒の選び直しによる無限回復は防ぐ。
  if (!pl.hasMounted) { pl.hp = pl.maxHp; pl.hasMounted = true; }
  if (mate.anim) measureReach(mate.anim);
  document.getElementById('mateBtn').textContent = '騎乗：' + w.name;
  updateBattleButtons();
  msg('「' + w.name + '」に騎乗！ J＝速い技 / K＝重い技');
}
function renderPick() { const box = document.getElementById('pickList'), L = loadWorks(); box.innerHTML = '';
  if (!L.length) { box.innerHTML = '<div class="tag" style="padding:20px;text-align:center">工房の作品がまだない。ツノトカゲを倒して設計図を取るか、工房で作って「保存」してな</div>'; return; }
  const none = document.createElement('div'); none.className = 'row'; none.innerHTML = '<span class="nm">相棒なし</span><button class="btn">えらぶ</button>'; none.querySelector('button').onclick = () => { setMate(null); closePick(); }; box.appendChild(none);
  for (const w of L) { const r = document.createElement('div'); r.className = 'row'; const A = attackOf(w.data); r.innerHTML = '<img alt=""><div class="nm"></div><span class="tag"></span><button class="btn">えらぶ</button>'; r.querySelector('img').src = w.thumb || ''; r.querySelector('.nm').textContent = w.name; r.querySelector('.tag').textContent = A ? '攻撃あり（原画' + A.keys.length + '枚・' + A.len + 'コマ）' : '攻撃の原画なし';
    r.querySelector('button').onclick = () => { setMate(w); closePick(); }; box.appendChild(r); } }
const closePick = () => document.getElementById('pickDlg').classList.remove('show');
document.getElementById('mateBtn').onclick = () => { renderPick(); document.getElementById('pickDlg').classList.add('show'); };
document.getElementById('pickClose').onclick = closePick;
function updBP() { let n = 0; try { n = +localStorage.getItem(BP_KEY) || 0; } catch (_) {} document.getElementById('bp').textContent = '設計図 ' + n; } updBP();
window.__field = { refresh() { if (mate) { const w = loadWorks().find(x => x.id === mate.work.id); if (w) setMate(w); } updBP(); } };
// ============ 入力 ============
const keys = new Set(); let joy = null, mouseScr = null;
const aimRay = new THREE.Raycaster(), aimGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
// マウスは画面上の位置だけ覚えておき、使う瞬間に今のカメラで地面の点を求める（カメラが動いても古い点を向かない）
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') mouseScr = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerleave', () => { mouseScr = null; });
function mouseAimYaw(x, z) { if (!mouseScr) return null;
  aimRay.setFromCamera(new THREE.Vector2(mouseScr.x / W * 2 - 1, 1 - mouseScr.y / H * 2), cam);
  const p = new THREE.Vector3(); if (!aimRay.ray.intersectPlane(aimGround, p)) return null;
  return Math.hypot(p.x - x, p.z - z) > 0.32 ? Math.atan2(p.x - x, p.z - z) : null; }
function turnTo(a, b, k) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, k); }
// 別ウィンドウへ移動した時にkeyup/pointerupを受け取れず歩き続けるのを防止
function clearMovementInput() { keys.clear(); joy = null; const pad = document.getElementById('pad'); if (pad) { pad.style.display = 'none'; pad.firstChild.style.transform = ''; } }
// iframe内と外側、両方から強制停止できるようにする
window.__clearMovementInput = clearMovementInput;
addEventListener('blur', clearMovementInput);
addEventListener('pagehide', clearMovementInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearMovementInput(); });
addEventListener('keydown', e => { const k = e.key.toLowerCase(); keys.add(k); if (k === 'e') openTool(); if (!document.body.classList.contains('pc')) document.body.classList.add('pc'); if (k === 'j' || k === ' ') { e.preventDefault(); if (mate) doMate('attack_fast'); else doHit(); } if (k === 'k') { e.preventDefault(); doMate('attack'); } });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') document.body.classList.add('pc'); }, true);
canvas.addEventListener('pointerdown', e => { if(window.parent.__editorInput.intent(e)!=='primary')return; if (e.clientX < W * 0.55) { joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; const p = document.getElementById('pad'); p.style.display = 'block'; p.style.left = (e.clientX - 60) + 'px'; p.style.top = (e.clientY - 60) + 'px'; p.firstChild.style.transform = ''; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} } });
canvas.addEventListener('pointermove', e => { if (!joy || e.pointerId !== joy.id) return; let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const L = Math.hypot(dx, dy); if (L > 50) { dx *= 50 / L; dy *= 50 / L; } joy.dx = dx / 50; joy.dy = dy / 50; document.getElementById('pad').firstChild.style.transform = `translate(${dx}px,${dy}px)`; });
const jEnd = e => { if (joy && e.pointerId === joy.id) { joy = null; const pad = document.getElementById('pad'); pad.style.display = 'none'; pad.firstChild.style.transform = ''; } }; canvas.addEventListener('pointerup', jEnd); canvas.addEventListener('pointercancel', jEnd);
canvas.addEventListener('lostpointercapture', jEnd);
addEventListener('pointerup', jEnd);
document.getElementById('hit').addEventListener('pointerdown', e => { e.preventDefault(); if(window.parent.__editorInput.intent(e)!=='primary')return; if (mate) doMate('attack_fast'); else doHit(); });
document.getElementById('mateAtk').addEventListener('pointerdown', e => { e.preventDefault(); if(window.parent.__editorInput.intent(e)!=='primary')return; doMate('attack'); });
// ============ 叩く（隊員の棒） ============
const swings = [];
function doHit() { if (pl.cd > 0) return; pl.cd = 0.35; const f = new THREE.Vector3(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
  const arc = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.3, 16, 1, -0.9, 1.8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); arc.rotation.x = -Math.PI / 2; arc.rotation.z = pl.yaw - Math.PI / 2; arc.position.set(pl.x, 0.6, pl.z); scene.add(arc); swings.push({ m: arc, t: 0.18 });
  for (const e of enemies) { const dx = e.x - pl.x, dz = e.z - pl.z, d = Math.hypot(dx, dz); if (d > 1.3 + e.r) continue; if ((dx * f.x + dz * f.z) / (d || 1) < 0.35) continue; damage(e, 1, new THREE.Vector3(e.x, 1, e.z), dx / (d || 1), dz / (d || 1), 2); } }
function damage(e, n, P, kx, kz, kb) { if (e.dead) return; e.flash = 0.15; if (e.kind === 'wild') { e.hp -= n; e.aggro = true; e.vx += kx * kb; e.vz += kz * kb;
    // 強い一撃なら敵の溜めを崩せる。小技連打で永久に止め続けるのは防ぐ。
    if (n >= 5 && e.mode === 'warn') { e.mode = 'recover'; e.recover = 0.55; e.cooldown = 0.55; e.ring.visible = false; msg('敵の溜めを崩した！'); }
  } pop(P, String(n), n >= 6 ? '#ffd23f' : '#fff', 16 + Math.min(20, n * 2)); if (e.hp <= 0) defeat(e); }
function defeat(e) { e.dead = true; e.deadT = 0.6; if (e.ring) e.ring.visible = false; const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: 0x5ab0ff, emissive: 0x2a70c0, emissiveIntensity: 0.8, flatShading: true })); m.position.set(e.x, 0.5, e.z); scene.add(m); drops.push({ m, x: e.x, z: e.z, name: e.name, t: 0 }); msg(e.name + 'をたおした！ 青い結晶をひろうと設計図'); }
function pickup(d) { scene.remove(d.m); const L = loadWorks(), now = Date.now(), n = L.filter(w => (w.name || '').startsWith('設計図：' + d.name)).length;
  const data = tokageData(), R0 = Object.fromEntries(data.bones.map(b => [b.id, clone(b.pts)])); /* 歩き・攻撃・待機はお手本入り。工房でいじって強くする */
  const acts = TPL.slots('tokage').map(sl => ({ name: sl.name, slot: sl.slot, anim: TPL.animFor('tokage', sl.slot, R0, data.bones) })), ai = Math.max(0, acts.findIndex(a => a.slot === 'attack'));
  data.acts = acts; data.actI = ai; data.anim = acts[ai].anim; acts[ai].anim = null;
  L.unshift({ id: 'w' + now, name: '設計図：' + d.name + (n ? ' ' + (n + 1) : ''), created: now, updated: now, data });
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(L)); localStorage.setItem(BP_KEY, String((+localStorage.getItem(BP_KEY) || 0) + 1)); } catch (_) {} updBP();
  msg('設計図「' + d.name + '」を手に入れた！ 工房の「作品」に入ったで'); setTimeout(() => spawnTokage((Math.random() - 0.5) * 16, 6 + Math.random() * 6), 6000); }
// ============ 相棒の技：動きの先っぽの速さ＝威力 ============
const trails = [];
function doMate(slot = 'attack') {
  if (!mate) { msg('先に「相棒」をえらんでな'); return; }
  const A = slot === 'attack_fast' ? mate.fast : mate.anim;
  if (!A) { msg('工房のアニメで「攻撃」の原画を2枚以上置いてな'); return; }
  if (mate.atk) return;
  let tgt = null, bd = 7;
  for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - mate.x, e.z - mate.z); if (d < bd) { bd = d; tgt = e; } }
  mate.lastTgt = tgt;
  measureReach(A);
  mate.atk = { slot, anim: A, f: -1, acc: 0, hit: new Map(), maxV: 0, prev: null };
}
function measureReach(A = mate.anim) { const o = mate.body.D.__o; let prev = null, best = { z: 0.5, v: 0 }, maxZ = 0; S = mate.body.D; S.anim = A;
  for (let f = 0; f <= A.len; f++) { const P = shiftPose(poseAt(f), o), cur = new Map(); for (const id in P) P[id].forEach((p, i) => { cur.set(id + '_' + i, p); maxZ = Math.max(maxZ, p[2]); });
    if (prev) for (const [k, p] of cur) { const q = prev.get(k); if (!q) continue; const v = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 24; if (v > 2.2 && p[2] > best.z) best = { z: p[2], v }; } prev = cur; }
  mate.reach = best.v ? best.z : maxZ; } /* 技の時に一番前まで速く届く場所（相棒の中心からの距離） */
function mateFrame(f, A) { S = mate.body.D; S.anim = A; const P = shiftPose(poseAt(Math.min(f, A.len)), mate.body.D.__o); mate.body.setPose(P); mate.body.g.updateMatrixWorld(true); return mate.body.joints(P); }
function stepAttack(dt) { const a = mate.atk;
  a.acc += dt; const fr = 1 / 24; while (a.acc >= fr || a.f < 0) { if (a.f >= 0) a.acc -= fr; a.f++;
    const J = mateFrame(a.f, a.anim);
    if (a.prev) for (const j of J) { const p = a.prev.get(j.k); if (!p) continue; const v = j.v.distanceTo(p) * 24; if (v > a.maxV) a.maxV = v;
      if (v > 0.8 && v <= 2.2) trails.push({ a: p.clone(), b: j.v.clone(), t: 0.12, v });
      if (v > 2.2) { trails.push({ a: p.clone(), b: j.v.clone(), t: 0.3, v });
        for (const e of enemies) { if (e.dead) continue; const top = e.kind === 'dummy' ? 1.5 : 0.9, sx = j.v.x - p.x, sz = j.v.z - p.z, L2 = sx * sx + sz * sz || 1e-9, u = Math.max(0, Math.min(1, ((e.x - p.x) * sx + (e.z - p.z) * sz) / L2)), cx = p.x + sx * u, cz = p.z + sz * u, cy = p.y + (j.v.y - p.y) * u;
          if (Math.hypot(cx - e.x, cz - e.z) < e.r + 0.22 && cy < top + 0.3) { const n = Math.max(1, Math.round(v * 1.4)), had = a.hit.get(e) || 0; if (n > had) { a.hit.set(e, n); const d = Math.hypot(e.x - mate.x, e.z - mate.z) || 1; damage(e, n - had, j.v.clone(), (e.x - mate.x) / d, (e.z - mate.z) / d, Math.min(6, v)); } } /* 1回の技で同じ敵には「一番速く当たった分」まで（遅い所が先にかすっても損しない） */ } } }
    a.prev = new Map(J.map(j => [j.k, j.v])); if (a.f >= a.anim.len) break; }
  if (a.f >= a.anim.len) { const tot = [...a.hit.values()].reduce((s, n) => s + n, 0); showStat(a.maxV, tot, a.hit.size, a.slot); mate.atk = null; mate.body.setPose(null); } }
function showStat(v, tot, n, slot) { if (!n && mate.lastTgt) { const t = mate.lastTgt, d = Math.hypot(t.x - mate.x, t.z - mate.z) - t.r; msg('届かんかった：速い先っぽが' + Math.max(0, d - (mate.reach || 0)).toFixed(2) + 'm足りん'); } document.getElementById('stat').innerHTML = (slot === 'attack_fast' ? '速い技' : '重い技') + '：先っぽの最高速 <b>' + v.toFixed(1) + ' m/秒</b><br>' + (n ? n + '体に当たって 合計 <b>' + tot + '</b> ダメージ' : '当たらんかった（速さ2.2m/秒以上の部分が敵に触れたら当たり）') + '<br><span style="color:#6d685f">工房でツメを変えると威力が変わる</span>'; }
// ============ 野生トカゲの攻撃：同じ骨アニメと接触先端速度で判定 ============
function startWildAttack(e, slot) {
  const A = slot === 'attack_fast' ? TOK_FAST : TOK_HEAVY;
  if (!A) return;
  e.mode = 'warn'; e.attackSlot = slot; e.attackAnim = A;
  e.warn = slot === 'attack_fast' ? 0.24 : 0.72;
  e.ring.material.color.setHex(slot === 'attack_fast' ? 0xf1a33b : 0xf04444);
  e.ring.visible = true;
  e.yaw = Math.atan2(pl.x - e.x, pl.z - e.z);
  e.attackCount++;
}
function updateWildAttack(e, dt) {
  const a = e.atk; if (!a) return;
  a.acc += dt;
  const fr = 1 / 24;
  while (a.acc >= fr || a.f < 0) {
    if (a.f >= 0) a.acc -= fr;
    a.f++;
    S = e.body.D; S.anim = a.anim;
    const P = shiftPose(poseAt(Math.min(a.f, a.anim.len)), e.body.D.__o);
    e.body.setPose(P); e.body.g.updateMatrixWorld(true);
    const J = e.body.joints(P);
    if (a.prev) for (const j of J) {
      const prev = a.prev.get(j.k); if (!prev) continue;
      const v = j.v.distanceTo(prev) * 24;
      if (v <= 2.2) continue;
      const sx = j.v.x - prev.x, sz = j.v.z - prev.z, L2 = sx * sx + sz * sz || 1e-9;
      const u = Math.max(0, Math.min(1, ((pl.x - prev.x) * sx + (pl.z - prev.z) * sz) / L2));
      const cx = prev.x + sx * u, cz = prev.z + sz * u, cy = prev.y + (j.v.y - prev.y) * u;
      if (Math.hypot(cx - pl.x, cz - pl.z) < (mate ? 0.72 : 0.46) && cy < (mate ? 1.8 : 1.7)) {
        const n = Math.max(1, Math.round(v * 1.4));
        if (n > a.hit) { const extra = n - a.hit; a.hit = n; hurtPlayer(extra, e); }
      }
    }
    a.prev = new Map(J.map(j => [j.k, j.v]));
    if (a.f >= a.anim.len) break;
  }
  if (a.f >= a.anim.len) {
    e.atk = null; e.mode = 'recover';
    e.recover = e.attackSlot === 'attack_fast' ? 0.44 : 0.82;
    e.cooldown = 0.25;
  }
}
function hurtPlayer(n, enemy) {
  if (pl.invuln > 0 || n <= 0 || inCamp(pl.x, pl.z)) return;
  pl.hp = Math.max(0, pl.hp - n); pl.invuln = 0.6;
  const dx = pl.x - enemy.x, dz = pl.z - enemy.z, d = Math.hypot(dx, dz) || 1;
  if (mate) {
    mate.x += dx / d * 0.3; mate.z += dz / d * 0.3;
    // 被弾すると技を中断：無敵のモーション連打を防ぐ。
    if (mate.atk) { mate.atk = null; mate.body.setPose(null); msg('被弾！ 技が中断された'); }
  } else { pl.x += dx / d * 0.3; pl.z += dz / d * 0.3; }
  pop(new THREE.Vector3(pl.x, 1.4, pl.z), '-' + n, '#ff6b57', 26);
  if (pl.hp <= 0) {
    pl.hp = pl.maxHp; pl.invuln = 2;
    pl.x = 0; pl.z = 0;
    if (mate) { mate.x = 0; mate.z = 0; mate.atk = null; }
    for (const e of enemies) if (e.kind === 'wild' && !e.dead) { e.aggro = false; e.mode = 'wander'; e.atk = null; e.cooldown = 1; e.ring.visible = false; }
    msg('やられた！ HPを回復して拠点に戻った');
  }
}
// ============ ループ ============
const trailGeo = new THREE.BufferGeometry(), trailMat = new THREE.LineBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.9 }), trailLines = new THREE.LineSegments(trailGeo, trailMat); scene.add(trailLines);
let last = performance.now();
let loopErr = ''; function loop(now) { requestAnimationFrame(loop); try { step(now); } catch (e) { const m = String(e && e.message || e); if (m !== loopErr) { loopErr = m; const el = document.getElementById('dbg'); el.textContent = '止まった理由：' + m; el.style.display = 'block'; } } }
function step(now) {
  const away = window.__paused || document.hidden || !document.hasFocus() && !(window.parent !== window && window.parent.document.hasFocus() && window.parent.__gameOn);
  document.getElementById('pauseV').style.display = away && !window.__paused ? 'flex' : 'none';
  if (away) { clearMovementInput(); last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // 別ウィンドウ・工房などに操作を移したときは、keyupが来なくても入力を無効化
  if (!document.hasFocus() || (window.parent !== window && !window.parent.document.hasFocus())) clearMovementInput();
  // 歩く／騎乗する（向きはマウス。マウス未使用時は移動方向）
  let mx = 0, mz = 0;
  if (keys.has('w') || keys.has('arrowup')) mz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) mz += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (joy) { mx += joy.dx; mz += joy.dy; }
  const ml = Math.hypot(mx, mz), moving = ml > 0.1;
  const walking=keys.has('shift');
  const paceSpeed=mate?(walking?1.45*mate.pace.walk.factor:3.4*mate.pace.run.factor):3.4;
  if (mate) {
    // 攻撃の最中も速い技は少し移動できる。重い技は足が止まる。
    const lock = mate.atk ? (mate.atk.slot === 'attack_fast' ? 0.38 : 0) : 1;
    if (moving && lock) { const sp = Math.min(1, ml) * paceSpeed * lock; mate.x += mx / ml * sp * dt; mate.z += mz / ml * sp * dt; }
    // 歩いてる間は進む方向へなめらかに向く。止まったら最後の向きのまま。技は向いてる方向に出る
    if (moving && !mate.atk) mate.yaw = turnTo(mate.yaw, Math.atan2(mx, mz), dt * 12);
    pl.x = mate.x; pl.z = mate.z; pl.yaw = mate.yaw;
    mate.body.g.position.set(mate.x, 0, mate.z); mate.body.g.rotation.y = mate.yaw;
  } else if (moving) {
    const sp = Math.min(1, ml) * 3.4; pl.x += mx / ml * sp * dt; pl.z += mz / ml * sp * dt; pl.yaw = Math.atan2(mx, mz);
  }
  pl.cd = Math.max(0, pl.cd - dt);
  pl.invuln = Math.max(0, pl.invuln - dt);
  pl.g.position.set(pl.x, mate ? mate.seatY : moving ? Math.abs(Math.sin(now / 90)) * 0.05 : 0, pl.z);
  pl.g.rotation.y = pl.yaw;
  pl.g.visible = pl.invuln <= 0 || Math.floor(now / 100) % 2 === 0;
  pl.stick.rotation.y = pl.cd > 0.2 ? -1.6 * (pl.cd - 0.2) / 0.15 + 0.8 : 0;
  // 敵
  for (const e of enemies) { if (e.kind === 'dummy') { e.g.position.x = e.x + (e.flash > 0 ? Math.sin(now / 15) * 0.04 : 0); e.g.children.forEach(c => c.material.emissive && c.material.emissive.setHex(e.flash > 0 ? 0x553300 : 0)); e.flash -= dt; continue; }
    if (e.dead) { e.deadT -= dt; e.body.g.scale.setScalar(Math.max(0.01, e.deadT / 0.6)); if (e.deadT <= 0 && !e.gone) { e.gone = true; e.body.dispose(); if (e.ring) { scene.remove(e.ring); e.ring.geometry.dispose(); e.ring.material.dispose(); } } continue; }
    e.t += dt; e.cooldown = Math.max(0, e.cooldown - dt);
    const dx = pl.x - e.x, dz = pl.z - e.z, d = Math.hypot(dx, dz);
    const safe = inCamp(pl.x, pl.z);
    if (d < 5.5 && !safe) e.aggro = true;
    if (safe && e.mode === 'stalk') { e.aggro = false; e.mode = 'wander'; }
    { const cx = e.x - CAMP.x, cz = e.z - CAMP.z, cd = Math.hypot(cx, cz) || 1, lim = CAMP.r + (e.r || 0.4); if (cd < lim) { e.x = CAMP.x + cx / cd * lim; e.z = CAMP.z + cz / cd * lim; } }
    e.ring.position.set(e.x, 0.055, e.z);
    if (e.mode === 'warn') {
      e.warn -= dt;
      e.ring.visible = true;
      e.ring.scale.setScalar(1 + 0.07 * Math.sin(now / 80));
      if (e.attackAnim) bodyFrame(e.body, e.attackAnim, Math.min(e.attackAnim.len - 1, e.attackSlot === 'attack_fast' ? 2 : 4));
      if (e.warn <= 0) { e.mode = 'attack'; e.ring.visible = false; e.atk = { anim: e.attackAnim, f: -1, acc: 0, hit: 0, prev: null }; }
    } else if (e.mode === 'attack') {
      updateWildAttack(e, dt);
    } else if (e.mode === 'recover') {
      e.recover -= dt;
      if (e.recover <= 0) e.mode = 'stalk';
    } else if (e.aggro) {
      e.mode = 'stalk';
      if (d > 1.25) {
        e.yaw = Math.atan2(dx, dz);
        const sp = 1.55; e.x += Math.sin(e.yaw) * sp * dt; e.z += Math.cos(e.yaw) * sp * dt;
      } else if (e.cooldown <= 0) {
        // 速い突きと溜め攻撃を交互に使う。予兆を読んで回避→反撃が可能。
        startWildAttack(e, e.attackCount % 3 === 2 ? 'attack' : 'attack_fast');
      }
    } else { // 未発見の間は歩き回る
      if (Math.sin(e.t * 0.7) > 0.3) { e.x += Math.sin(e.yaw) * 0.6 * dt; e.z += Math.cos(e.yaw) * 0.6 * dt; }
      if (Math.random() < 0.005) e.yaw += (Math.random() - 0.5) * 2;
    }
    e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= Math.pow(0.02, dt); e.vz *= Math.pow(0.02, dt);
    { const mv = Math.hypot(e.x - (e.px ?? e.x), e.z - (e.pz ?? e.z)); e.px = e.x; e.pz = e.z; const G = gait(mv / (dt || 1e-3), TOK_WALK, TOK_RUN); if (G && e.mode !== 'warn' && e.mode !== 'attack') { if (mv > 1e-4) e.ph = ((e.ph || 0) + G.cyc * dt) % 1; bodyFrame(e.body, G.A, (e.ph || 0) * G.A.len); } }
    e.body.g.position.set(e.x, 0, e.z); e.body.g.rotation.y = e.yaw; e.body.g.updateMatrixWorld(true); e.body.mat.emissive.setHex(e.flash > 0 ? 0x662200 : 0); e.flash -= dt; }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].gone) enemies.splice(i, 1);
  // 結晶
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.t += dt; d.m.rotation.y += dt * 2; d.m.position.y = 0.5 + Math.sin(d.t * 3) * 0.1; if (Math.hypot(pl.x - d.x, pl.z - d.z) < 0.8) { pickup(d); drops.splice(i, 1); } }
  // 相棒：自動追従ではなく、プレイヤーが直接操作する。
  if (mate) {
    if (mate.atk) stepAttack(dt);
    else {
      const sp = moving ? paceSpeed * Math.min(1,ml) : 0;
      const G = walking && mate.walk ? {A:mate.walk,cyc:Math.min(sp/0.6,2.4)} : gait(sp,mate.walk,mate.run), I = mate.idle;
      if (sp && G) { mate.ph = (mate.ph + G.cyc * dt) % 1; bodyFrame(mate.body, G.A, mate.ph * G.A.len); mate.moving = true; }
      else if (I) { mate.wf = (mate.moving ? 0 : mate.wf + dt * 24) % I.len; mate.moving = false; bodyFrame(mate.body, I, mate.wf); }
      else if (mate.moving) { mate.moving = false; mate.body.setPose(null); }
    }
    mate.body.g.position.set(mate.x, 0, mate.z); mate.body.g.rotation.y = mate.yaw;
  }
  // ライフと敵のHP（戦闘中に目で確認できるように）
  { const c = inCamp(pl.x, pl.z); document.getElementById('campBtn').style.display = c ? 'block' : 'none';
    if (c && pl.hp < pl.maxHp) { pl.regen = (pl.regen || 0) + dt * 6; if (pl.regen >= 1) { const k = Math.floor(pl.regen); pl.regen -= k; pl.hp = Math.min(pl.maxHp, pl.hp + k); } } }
  document.getElementById('life').textContent = 'HP ' + pl.hp + '/' + pl.maxHp;
  const live = enemies.filter(e => e.kind === 'wild' && !e.dead).sort((a,b) => Math.hypot(a.x - pl.x, a.z - pl.z) - Math.hypot(b.x - pl.x, b.z - pl.z))[0];
  document.getElementById('enemySt').textContent = live ? '敵HP ' + live.hp + '/' + live.max : '野生トカゲ HP —';
  // 斬撃の軌跡
  for (let i = trails.length - 1; i >= 0; i--) { trails[i].t -= dt; if (trails[i].t <= 0) trails.splice(i, 1); }
  { const arr = new Float32Array(trails.length * 6); trails.forEach((t, i) => { arr.set([t.a.x, t.a.y, t.a.z, t.b.x, t.b.y, t.b.z], i * 6); }); trailGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3)); trailGeo.computeBoundingSphere(); }
  for (let i = swings.length - 1; i >= 0; i--) { const s = swings[i]; s.t -= dt; s.m.material.opacity = Math.max(0, s.t / 0.18) * 0.6; if (s.t <= 0) { scene.remove(s.m); s.m.geometry.dispose(); swings.splice(i, 1); } }
  // カメラ（斜め上から追う）
  { const k = Math.max(1, 1.25 / Math.max(0.45, W / H)); cam.position.set(pl.x, 9.5 * k, pl.z + 8.5 * k); cam.lookAt(pl.x, 0.5, pl.z - 0.8); } /* 縦長の画面ほど引いて広く見せる */
  renderer.render(scene, cam); }
addEventListener('error', e => { const el = document.getElementById('dbg'); el.textContent = 'エラー：' + (e.message || ''); el.style.display = 'block'; });
requestAnimationFrame(loop);
})();
