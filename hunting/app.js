
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
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfe6dc); scene.fog = new THREE.Fog(0xdfe6dc, 22, 110);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8a66, 1.15)); const sun = new THREE.DirectionalLight(0xfff3e0, 1.4); sun.position.set(4, 9, 5); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 176), new THREE.MeshStandardMaterial({ color: 0xb7c69c, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.z = -58; scene.add(ground); /* 陸（海は z<-146） */
const grid = new THREE.GridHelper(176, 88, 0xadbc93, 0xadbc93); grid.position.set(0, 0.002, -58); grid.material.transparent = true; grid.material.opacity = 0.45; scene.add(grid); /* 低い視点でも速さが分かる目印 */
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 260);
let W = 0, H = 0; function layout() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); } addEventListener('resize', layout); layout(); try { new ResizeObserver(() => layout()).observe(document.documentElement); } catch (_) {}
const msg = (() => { let t = 0; return s => { const e = document.getElementById('msg'); e.textContent = s; e.style.opacity = 1; clearTimeout(t); t = setTimeout(() => e.style.opacity = 0, 2200); }; })();
const proj = P => { const v = P.clone().project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; };
function pop(P, text, col, size) { const s = proj(P); if (s.z > 1) return; const e = document.createElement('div'); e.className = 'pop'; e.textContent = text; e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; e.style.color = col || '#fff'; e.style.fontSize = (size || 20) + 'px'; document.body.appendChild(e); requestAnimationFrame(() => { e.style.transform = 'translate(-50%,-140%)'; e.style.opacity = 0; }); setTimeout(() => e.remove(), 750); }
// 文字の看板（いつもカメラを向く）。size＝高さ(m)
function label(text, o) { o = o || {}; const fs = 56, pad = 20, c = document.createElement('canvas'), x = c.getContext('2d'), font = '900 ' + fs + 'px "Hiragino Sans","Zen Kaku Gothic New",sans-serif'; x.font = font;
  const w = Math.ceil(x.measureText(text).width) + pad * 2, h = Math.round(fs * 1.5); c.width = w; c.height = h; x.font = font;
  x.fillStyle = o.bg || 'rgba(255,255,255,.92)'; x.fillRect(0, 0, w, h); x.fillStyle = o.col || '#2b2a27'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); const k = o.size || 0.8; sp.scale.set(k * w / h, k, 1); return sp; }
function dropLabel(sp) { if (!sp) return; if (sp.parent) sp.parent.remove(sp); sp.material.map.dispose(); sp.material.dispose(); }
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
const pl = { x: 0, z: 0, y: 0, yaw: Math.PI, g: new THREE.Group() }; /* 奥（-z）を向いて始まる */
{ const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.95, 10), matBody(0x3b6ea8)); body.position.y = 0.72; const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), matBody(0xe9cfae)); head.position.y = 1.36;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), matBody(0xd9572b)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.0, 0.24); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), matBody(0x7a5a3a)); stick.position.set(0.28, 0.9, 0.15); stick.rotation.x = 0.4;
  pl.g.add(body, head, nose, stick); scene.add(pl.g); }
// ============ キャンプ（拠点）：工房をひらける ============
const CAMP = { x: 0, z: 0, r: 2.4 };
// 鳥人間の会場：海に突き出た高台（高さ h）＋桟橋。桟橋の先（edge）からの距離が飛距離
const VENUE = { x0: -14, x1: 14, z0: -150, z1: -122, h: 9, pier: { x0: -2, x1: 2 }, edge: -157, start: { x: 0, z: -125 }, booth: { x: 7, z: -129 }, camp: { x: -7, z: -131, r: 2.2 } };
const CAMPS = [{ x: CAMP.x, z: CAMP.z, r: CAMP.r, y: 0 }, { x: VENUE.camp.x, z: VENUE.camp.z, r: VENUE.camp.r, y: VENUE.h }];
for (const C of CAMPS) { const c = new THREE.Group(), CAMP = C;
  const ring = new THREE.Mesh(new THREE.RingGeometry(CAMP.r - 0.08, CAMP.r, 48), new THREE.MeshBasicMaterial({ color: 0xd9572b, transparent: true, opacity: 0.55, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; c.add(ring);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(CAMP.r - 0.08, 48), new THREE.MeshBasicMaterial({ color: 0xe9d9b0, transparent: true, opacity: 0.35, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; c.add(floor);
  const tent = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 4), new THREE.MeshStandardMaterial({ color: 0xd9572b, flatShading: true })); tent.position.set(-1.1, 0.55, -1.1); tent.rotation.y = Math.PI / 4; c.add(tent);
  const fire = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xffb03a, emissive: 0xff7a1a, emissiveIntensity: 0.9, flatShading: true })); fire.position.set(0.9, 0.18, -0.9); c.add(fire);
  c.position.set(CAMP.x, CAMP.y, CAMP.z); scene.add(c); }
const inCamp = (x, z, y) => CAMPS.some(c => Math.hypot(x - c.x, z - c.z) < c.r && Math.abs((y == null ? c.y : y) - c.y) < 0.5);
function openTool() { if (!inCamp(pl.x, pl.z, pl.y)) return; clearMovementInput(); try { window.parent.__openTool && window.parent.__openTool(); } catch (_) {} }
document.getElementById('campBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (window.parent.__editorInput.intent(e) !== 'primary') return; openTool(); });
// ============ 地形 ============
// 奥（-z）へ進む。右に一本道の草原、左にごちゃごちゃの森、真ん中に段々の高台、右奥に池と高い柱、奥の崖の向こうに盆地。
// 南（+z）がスタート。草原と森 → 崖（門・穴）→ 盆地 → 砂浜 → 海（z<sea）。崖の上の高台が鳥人間の会場
const MAP = { x0: -60, x1: 60, z0: -470, z1: 16, sea: -146, coast: -100, cliffZ0: -58, cliffZ1: -55, cliffH: 3.2,
  gate: { x0: 6.5, x1: 9.5 }, hole: { x0: -14.6, x1: -13.4, h: 0.66 }, rockNeed: 1.96,
  pond: { x0: 14, x1: 25, z0: -33, z1: -17, surf: 0.42 }, garden: { x0: -3, x1: 5, z0: -23, z1: -9 } };
const STEP = 0.3; // これ以下の段差は歩いて上がれる
const ROAD = [[[8, -58], [8, -96], [12, -104], [15.75, -111]]];
const TRAILS = [[[-4, -6], [-12, -14], [-22, -20], [-30, -30], [-24, -42], [-14, -50], [-14, -54.5]], [[-22, -20], [-36, -16], [-48, -24], [-52, -40]], [[-30, -30], [-42, -36], [-40, -50]]];
const CLEARINGS = [[-48, -24, 5], [-30, -30, 4]];
function segD(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); }
function lineD(x, z, L) { let d = 1e9; for (const p of L) for (let i = 1; i < p.length; i++) d = Math.min(d, segD(x, z, p[i - 1], p[i])); return d; }
function strip(p, w, color, y) { const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = new THREE.Mesh(new THREE.PlaneGeometry(w, L), mat); m.rotation.set(-Math.PI / 2, 0, Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]))); m.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); scene.add(m); }
  for (const q of p) { const d = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 14), mat); d.rotation.x = -Math.PI / 2; d.position.set(q[0], y, q[1]); scene.add(d); } }
const boxes = [], circles = [];
const matRock = new THREE.MeshStandardMaterial({ color: 0x9a9284, flatShading: true, roughness: 1 }), matLedge = new THREE.MeshStandardMaterial({ color: 0xb2a48a, flatShading: true, roughness: 1 });
// top＝上に乗れる高さ（stand:false なら乗れない）。h＝見た目の高さ
function addBox(x0, x1, z0, z1, h, opt) { const w = Object.assign({ x0, x1, z0, z1, h, top: h, stand: true }, opt || {}); boxes.push(w);
  if (!w.noMesh) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), w.mat || matRock); m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); scene.add(m); } return w; }
function flat(x0, x1, z0, z1, color, y, opt) { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 1 }, opt || {}))); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(m); return m; }
{ const H = MAP.cliffH, a = MAP.cliffZ0, b = MAP.cliffZ1;
  // 外周（見えない高さまで壁）
  addBox(MAP.x0 - 3, MAP.x0, MAP.sea, MAP.z1 + 3, H, { top: 99, stand: false }); addBox(MAP.x1, MAP.x1 + 3, MAP.sea, MAP.z1 + 3, H, { top: 99, stand: false });
  addBox(MAP.x0 - 3, MAP.x0, MAP.z0 - 3, MAP.sea, H, { top: 99, stand: false, noMesh: true }); addBox(MAP.x1, MAP.x1 + 3, MAP.z0 - 3, MAP.sea, H, { top: 99, stand: false, noMesh: true }); /* 海の上は見えない壁 */
  addBox(MAP.x0, MAP.x1, MAP.z1, MAP.z1 + 3, 1.2, { top: 99, stand: false }); addBox(MAP.x0, MAP.x1, MAP.z0 - 3, MAP.z0, H, { top: 99, stand: false, noMesh: true });
  // 崖（上には乗れる＝飛べば越えられる）。すき間は岩の門と低い穴
  addBox(MAP.x0, MAP.hole.x0, a, b, H); addBox(MAP.hole.x1, MAP.gate.x0, a, b, H); addBox(MAP.gate.x1, MAP.x1, a, b, H);
  const hh = MAP.hole.h; addBox(MAP.hole.x0, MAP.hole.x1, a, b, H, { noMesh: true, stand: true, gate: (body, o) => body.h <= hh && body.r <= 0.55 && o.y < 0.2, name: 'hole' });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(MAP.hole.x1 - MAP.hole.x0, H - hh, b - a), matRock); lintel.position.set((MAP.hole.x0 + MAP.hole.x1) / 2, hh + (H - hh) / 2, (a + b) / 2); scene.add(lintel);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(MAP.hole.x1 - MAP.hole.x0 + 0.5, hh + 0.25), new THREE.MeshBasicMaterial({ color: 0x3a342c, transparent: true, opacity: 0.55, depthWrite: false })); mouth.position.set((MAP.hole.x0 + MAP.hole.x1) / 2, (hh + 0.25) / 2, b + 0.02); scene.add(mouth);
  // 段々の高台（ジャンプで1段ずつ上がる）
  addBox(-2, 1, -14, -11, 0.6, { mat: matLedge }); addBox(-2, 1, -17, -14, 1.2, { mat: matLedge }); addBox(-2, 1, -20, -17, 1.8, { mat: matLedge }); addBox(1, 4.5, -22, -16, 1.8, { mat: matLedge });
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), matBody(0x7a5a3a)); pole.position.set(3.4, 2.5, -20.6); const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshStandardMaterial({ color: 0xd9572b, side: THREE.DoubleSide })); flag.position.set(3.72, 3.0, -20.6); scene.add(pole, flag); }
  // 高い柱（飛ばんと上がれん）。てっぺんに巣
  addBox(18, 20.5, -45, -42.5, 5.5); { const nest = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 6, 12), new THREE.MeshStandardMaterial({ color: 0x8a6a44, flatShading: true })); nest.rotation.x = -Math.PI / 2; nest.position.set(19.25, 5.62, -43.75); scene.add(nest);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf3ead8 })); egg.scale.y = 1.25; egg.position.set(19.25, 5.72, -43.75); scene.add(egg); }
  // 池（入ると泳ぐ）
  const P = MAP.pond; flat(P.x0, P.x1, P.z0, P.z1, 0x8a9a7a, 0.004); MAP.water = flat(P.x0, P.x1, P.z0, P.z1, 0x5aa6c9, P.surf, { transparent: true, opacity: 0.78, roughness: 0.3 });
  // 道・森・盆地の床
  flat(6, 10, -55, 1.5, 0xcbb88c, 0.004); flat(-58, -3, -54, -5, 0x9db07f, 0.003); flat(MAP.x0, MAP.x1, MAP.coast, a, 0xaebd8e, 0.003);
  flat(MAP.x0 - 3, MAP.x1 + 3, MAP.sea, MAP.coast, 0xe3d3a4, 0.003); // 砂浜
  flat(-240, 240, -560, MAP.sea, 0x5f877f, -0.01); MAP.seaM = flat(-240, 240, -560, MAP.sea, 0x4a9cc4, 0.42, { transparent: true, opacity: 0.84, roughness: 0.25 }); // 海（入ると泳ぐ）
  // 道（崖の門から海辺の石段まで）と森の獣道
  for (const p of ROAD) strip(p, 3.2, 0xcbb88c, 0.005); for (const p of TRAILS) strip(p, 1.9, 0xb9a77c, 0.006);
}
// ---- 鳥人間の会場：海に突き出た高台・桟橋・石段・受付・工房テント ----
{ const V = VENUE, matCliff = new THREE.MeshStandardMaterial({ color: 0xa8957a, flatShading: true, roughness: 1 }), matWood = new THREE.MeshStandardMaterial({ color: 0x9a7650, flatShading: true, roughness: 1 });
  addBox(V.x0, V.x1, V.z0, V.z1, V.h, { mat: matCliff });
  addBox(V.pier.x0, V.pier.x1, V.edge, V.z0, V.h, { mat: matWood });
  for (let i = 1; i <= 36; i++) addBox(14, 17.5, -112 - i, -111 - i, 0.25 * i, { mat: matLedge }); // 石段（1段0.25m）
  flat(-1.6, 1.6, V.z0, V.start.z + 0.6, 0xefe6d0, V.h + 0.01); flat(V.pier.x0 + 0.25, V.pier.x1 - 0.25, V.edge, V.z0, 0xd8c39a, V.h + 0.01); // 助走路
  flat(-2.2, 2.2, V.start.z - 0.15, V.start.z + 0.15, 0xd9572b, V.h + 0.02); flat(V.pier.x0, V.pier.x1, V.edge, V.edge + 0.3, 0xd9572b, V.h + 0.02); // スタート線と踏み切り線
  for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), matBody(0x7a5a3a)); post.position.set(V.booth.x + sx * 1.1, V.h + 1.3, V.booth.z); scene.add(post); }
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 0.7), matWood); desk.position.set(V.booth.x, V.h + 0.45, V.booth.z); scene.add(desk);
  const banner = label('鳥人間 受付', { size: 0.75, bg: '#2b8bb8', col: '#fff' }); banner.position.set(V.booth.x, V.h + 2.9, V.booth.z); scene.add(banner);
  const sign = label('↑ 鳥人間の会場', { size: 0.8, bg: '#2b8bb8', col: '#fff' }); sign.position.set(15.75, 2.4, -108); scene.add(sign);
  for (let d = 25; d <= 300; d += 25) for (const sx of [-1, 1]) { const by = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8), new THREE.MeshStandardMaterial({ color: d % 100 ? 0xf3ead8 : 0xd9572b, flatShading: true })); by.position.set(sx * 12, 0.5, V.edge - d); scene.add(by);
    if (sx > 0) { const t = label(d + 'm', { size: 0.9 }); t.position.set(sx * 12, 1.8, V.edge - d); scene.add(t); } } }
const inPond = (x, z) => x > MAP.pond.x0 && x < MAP.pond.x1 && z > MAP.pond.z0 && z < MAP.pond.z1;
const inWater = (x, z) => inPond(x, z) || z < MAP.sea;
// 押せる岩（門をふさいでいる）
const boulder = { x: (MAP.gate.x0 + MAP.gate.x1) / 2, z: (MAP.cliffZ0 + MAP.cliffZ1) / 2 + 0.6, r: 1.35, top: 2.4, moved: false };
boulder.m = new THREE.Mesh(new THREE.DodecahedronGeometry(boulder.r, 1), new THREE.MeshStandardMaterial({ color: 0x8c857a, flatShading: true, roughness: 1 })); boulder.m.position.set(boulder.x, boulder.r * 0.92, boulder.z); scene.add(boulder.m);
// 木（幹は乗れない、葉っぱの上は飛んで越える）・岩（乗れる）・草むら
{ const rnd = (() => { let t = 12345; return () => (t = (t * 16807) % 2147483647) / 2147483647; })(), G = MAP.garden, V = VENUE;
  const ok = (x, z) => Math.hypot(x - CAMP.x, z - CAMP.z) > CAMP.r + 1.5 && Math.hypot(x - (MAP.hole.x0 + MAP.hole.x1) / 2, z - MAP.cliffZ1) > 3.2 && !(x > G.x0 - 1 && x < G.x1 + 1 && z > G.z0 - 1 && z < G.z1 + 1) && !(x > MAP.pond.x0 - 1.5 && x < MAP.pond.x1 + 1.5 && z > MAP.pond.z0 - 1.5 && z < MAP.pond.z1 + 1.5) && Math.hypot(x - 19.25, z + 43.75) > 3
    && lineD(x, z, ROAD) > 3 && !(x > V.x0 - 3 && x < 21 && z < -104) && z > MAP.sea + 2 && !(z < MAP.cliffZ0 + 1.5 && z > MAP.cliffZ1 - 1.5);
  const T = [], Rk = [], clear = (x, z) => CLEARINGS.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);
  for (let x = -57; x <= -3; x += 2.45) for (let z = -53; z <= -6; z += 2.45) { const tx = x + (rnd() - 0.5) * 1.3, tz = z + (rnd() - 0.5) * 1.3; if (ok(tx, tz) && lineD(tx, tz, TRAILS) > 2.1 && !clear(tx, tz) && rnd() > 0.08) T.push({ x: tx, z: tz, r: 0.22 + rnd() * 0.1, h: 3.2 + rnd() * 1.6 }); } // 森（獣道と広場はあける）
  for (let i = 0; i < 150; i++) { const x = -1 + rnd() * 58, z = -52 + rnd() * 64; if (x > 4.5 && x < 11.5) continue; if (!ok(x, z)) continue; if (rnd() < 0.4) T.push({ x, z, r: 0.25 + rnd() * 0.1, h: 3.4 + rnd() * 1.6 }); else Rk.push({ x, z, r: 0.35 + rnd() * 0.5 }); } // 右の草原
  for (let i = 0; i < 80; i++) { const x = -57 + rnd() * 114, z = -99 + rnd() * 40; if (Math.hypot(x, z + 68.5) < 12.5 || Math.hypot(x + 18, z + 75) < 4 || !ok(x, z)) continue; T.push({ x, z, r: 0.25 + rnd() * 0.1, h: 3.6 + rnd() * 1.4 }); } // 盆地
  for (let i = 0; i < 40; i++) { const x = -57 + rnd() * 114, z = -143 + rnd() * 42; if (!ok(x, z)) continue; if (rnd() < 0.25) T.push({ x, z, r: 0.2 + rnd() * 0.08, h: 3 + rnd() * 1.2 }); else Rk.push({ x, z, r: 0.3 + rnd() * 0.6 }); } // 砂浜
  for (const t of T) circles.push({ x: t.x, z: t.z, r: t.r, top: t.h + 1.4, stand: false });
  for (const t of Rk) circles.push({ x: t.x, z: t.z, r: t.r, top: t.r * 0.85, stand: true });
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 1, 1, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, flatShading: true }), T.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x6f9a5a, flatShading: true }), T.length);
  T.forEach((t, i) => { M.compose(new THREE.Vector3(t.x, t.h * 0.5, t.z), q.identity(), new THREE.Vector3(t.r, t.h, t.r)); trunk.setMatrixAt(i, M); t.trunkM = M.clone();
    t.crownM = new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.h + 0.6, t.z), q.setFromEuler(e.set(rnd(), rnd() * 6, 0)), new THREE.Vector3(1.5, 1.25, 1.5).multiplyScalar(0.9 + rnd() * 0.5)); crown.setMatrixAt(i, t.crownM); t.ci = i; });
  scene.add(trunk, crown); MAP.crown = crown; MAP.trunk = trunk; MAP.crownTrees = T;
  const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), matRock, Rk.length);
  Rk.forEach((t, i) => { M.compose(new THREE.Vector3(t.x, t.r * 0.45, t.z), q.setFromEuler(e.set(rnd(), rnd(), 0)), new THREE.Vector3(t.r, t.r, t.r)); rock.setMatrixAt(i, M); }); scene.add(rock);
  const tuftN = 1500, tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.28, 4), new THREE.MeshStandardMaterial({ color: 0x8fa66e, flatShading: true }), tuftN);
  for (let i = 0; i < tuftN; i++) { let x, z; do { x = MAP.x0 + rnd() * (MAP.x1 - MAP.x0); z = MAP.coast + rnd() * (MAP.z1 - MAP.coast); } while (inWater(x, z)); M.compose(new THREE.Vector3(x, 0.12, z), q.identity(), new THREE.Vector3(1, 0.6 + rnd(), 1)); tuft.setMatrixAt(i, M); } scene.add(tuft); }
// カメラと乗り手の間にある木は隠す（低い視点で森に入っても見える）
const hiddenCrown = new Set(), zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
function updateCrowns(cx, cz, px, pz, py) { const sx = px - cx, sz = pz - cz, L2 = sx * sx + sz * sz || 1e-9; let changed = false;
  for (const t of MAP.crownTrees) { const u = ((t.x - cx) * sx + (t.z - cz) * sz) / L2, off = Math.hypot(cx + sx * u - t.x, cz + sz * u - t.z), hide = py < t.h + 2 && (u > -0.1 && u < 0.97 && off < 3 || Math.hypot(t.x - cx, t.z - cz) < 6.5); /* カメラのすぐ横の木も隠す（森で視界がふさがらんように） */
    if (hide !== hiddenCrown.has(t)) { changed = true; if (hide) { hiddenCrown.add(t); MAP.crown.setMatrixAt(t.ci, zeroM); MAP.trunk.setMatrixAt(t.ci, zeroM); } else { hiddenCrown.delete(t); MAP.crown.setMatrixAt(t.ci, t.crownM); MAP.trunk.setMatrixAt(t.ci, t.trunkM); } } }
  if (changed) { MAP.crown.instanceMatrix.needsUpdate = true; MAP.trunk.instanceMatrix.needsUpdate = true; } }
// カメラが崖や柱の中に埋まらないよう、乗り手からカメラへの線が当たったら上からのぞくか手前に寄せる
function camClamp(P, C) { const h = camHit(P, C); if (h >= 1) return C;
  for (const add of [0.8, 2, 3.5, 5]) { const up = C.clone(); up.y = Math.max(C.y, MAP.cliffH + add); if (camHit(P, up) >= 1) return up; }
  const d = C.clone().sub(P); C.copy(P).addScaledVector(d, Math.max(0.12, h - 0.04)); C.y = Math.max(C.y, P.y + 1.6); return C; }
function camHit(P, C) { let best = 1; const bx = boxes.filter(w => !w.noMesh && w.h > 1.5).map(w => [w.x0, w.x1, 0, w.h, w.z0, w.z1]);
  bx.push([MAP.hole.x0, MAP.hole.x1, MAP.hole.h, MAP.cliffH, MAP.cliffZ0, MAP.cliffZ1]);
  const d = [C.x - P.x, C.y - P.y, C.z - P.z];
  for (const [x0, x1, y0, y1, z0, z1] of bx) { let t0 = 0, t1 = 1, ok = true;
    for (const [o, v, a, b] of [[P.x, d[0], x0, x1], [P.y, d[1], y0, y1], [P.z, d[2], z0, z1]]) { if (Math.abs(v) < 1e-9) { if (o < a || o > b) { ok = false; break; } continue; } let ta = (a - o) / v, tb = (b - o) / v; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { ok = false; break; } }
    if (ok && t0 < best) best = t0; }
  return best; }
// 前の調査隊の野営地（盆地の奥）
const OLD_CAMP = { x: -18, z: -75, found: false };
{ const g = new THREE.Group(); const tent = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0x9c8b78, flatShading: true })); tent.position.set(0, 0.42, 0); tent.rotation.set(0.25, 0.7, 0.18);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0xc9a06a, flatShading: true })); board.position.set(1.2, 0.85, 0.4); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), matBody(0x7a5a3a)); post.position.set(1.2, 0.45, 0.4);
  g.add(tent, board, post); g.position.set(OLD_CAMP.x, 0, OLD_CAMP.z); scene.add(g); circles.push({ x: OLD_CAMP.x, z: OLD_CAMP.z, r: 0.75, top: 0.9, stand: true }); }
// ---- 高さのあるぶつかり ----
const hintAt = {}; function hint(key, text) { const t = performance.now(); if ((hintAt[key] || 0) > t) return; hintAt[key] = t + 2600; msg(text); }
// 足元の高さ（今の高さ＋STEP までの、乗れる物の上）
function groundAt(x, z, y) { let g = 0;
  for (const w of boxes) if (w.stand && w.top <= y + STEP && x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && w.top > g) g = w.top;
  for (const c of circles) if (c.stand && c.top <= y + STEP && c.top > g && Math.hypot(x - c.x, z - c.z) < c.r * 0.8) g = c.top;
  if (boulder.top <= y + STEP && Math.hypot(x - boulder.x, z - boulder.z) < boulder.r * 0.7 && boulder.top > g) g = boulder.top;
  return g; }
function collide(o, r, body, onHit) { const y = o.y || 0;
  for (const w of boxes) { if (w.top <= y + STEP) continue; if (w.gate && w.gate(body, o)) continue;
    const cx = Math.max(w.x0, Math.min(w.x1, o.x)), cz = Math.max(w.z0, Math.min(w.z1, o.z)); let dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 1e-6) { const opts = [[o.x - w.x0, -1, 0], [w.x1 - o.x, 1, 0], [o.z - w.z0, 0, -1], [w.z1 - o.z, 0, 1]].sort((a, b) => a[0] - b[0])[0]; dx = opts[1]; dz = opts[2]; o.x += dx * (opts[0] + r); o.z += dz * (opts[0] + r); }
    else { dx /= d; dz /= d; o.x += dx * (r - d); o.z += dz * (r - d); }
    if (onHit) onHit(dx, dz, w); }
  for (const t of circles) { if (t.top <= y + STEP) continue; const dx = o.x - t.x, dz = o.z - t.z, min = r + t.r; if (Math.abs(dx) > min || Math.abs(dz) > min) continue; const d = Math.hypot(dx, dz); if (d >= min || d < 1e-6) continue;
    o.x += dx / d * (min - d); o.z += dz / d * (min - d); if (onHit) onHit(dx / d, dz / d, t); } }
// 岩：力が足りれば押せる。足りなければ壁と同じ
function touchBoulder(o, r, body, onHit) { const b = boulder; if ((o.y || 0) > b.top - STEP) return false; const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz), min = r + b.r; if (d >= min || d < 1e-6) return false;
  const nx = dx / d, nz = dz / d, pen = min - d;
  if (body.power >= MAP.rockNeed) { b.x -= nx * pen; b.z -= nz * pen; collide(b, b.r, { h: 9, r: b.r, power: 0 });
    const e = Math.hypot(o.x - b.x, o.z - b.z); if (e < min) { o.x = b.x + (o.x - b.x) / (e || 1) * min; o.z = b.z + (o.z - b.z) / (e || 1) * min; }
    b.m.position.set(b.x, b.r * 0.92, b.z); b.m.rotation.x -= nz * pen / b.r; b.m.rotation.z += nx * pen / b.r;
    if (!b.moved && b.z < MAP.cliffZ0 - 1.2) { b.moved = true; msg('岩が動いた！ 奥への道がひらけた'); } else hint('rockOk', 'ゴゴゴ…押せる！');
    return true; }
  o.x += nx * pen; o.z += nz * pen; if (onHit) onHit(nx, nz, b); hint('rockNo', 'びくともせん…もっと大きい体なら押せそう'); return false; }
function holeHint(o, body) { const hx = (MAP.hole.x0 + MAP.hole.x1) / 2; if (Math.abs(o.x - hx) < 1.6 && o.z - MAP.cliffZ1 < 1.2 && o.z > MAP.cliffZ1 - 0.2 && (o.y || 0) < 0.3 && !(body.h <= MAP.hole.h)) hint('hole', '入られへん…もっと小さい体なら入れそう（高さ ' + body.h.toFixed(2) + 'm／穴 ' + MAP.hole.h.toFixed(2) + 'm）'); }
// ============ アニメの読み取り ============
function loadWorks() { return window.BoneStorage.loadWorks(); }
function animOf(d, slot) { if (!d || !d.acts) return null; const i = d.acts.findIndex(a => a.slot === slot); if (i < 0) return null; const A = i === d.actI ? d.anim : d.acts[i].anim; return A && A.keys && A.keys.length >= 2 ? A : null; }
const SLOTS_ALL = ['idle', 'walk', 'run', 'jump', 'flap', 'glide', 'fall', 'land', 'swim'];
// 作品にある動き→無ければ設計図のお手本
function animsFor(d) { const kind = TPL.detect(d), rest = d.rest || Object.fromEntries(d.bones.map(b => [b.id, b.pts])), out = {};
  for (const slot of SLOTS_ALL) { let A = animOf(d, slot); if (!A && kind) { try { A = TPL.animFor(kind, slot, rest, d.bones); } catch (_) { A = null; } } if (A && A.keys && A.keys.length) out[slot] = A; }
  return out; }
// 体を動きの f コマ目にする（同じコマは覚えておく）
function bodyFrame(body, A, f) { const fi = Math.floor(f); if (!body.fc || body.fcA !== A) { body.fc = new Map(); body.fcA = A; } let P = body.fc.get(fi); if (!P) { S = body.D; S.anim = A; P = shiftPose(poseAt(Math.min(fi, A.len)), body.D.__o); body.fc.set(fi, P); } body.setPose(P); }
// ジャンプ：一番しゃがんだコマ＝溜め、一番速く伸びるコマ＝踏み切り。羽ばたき：先っぽが一番速く下がるコマ＝打ち下ろし
function readMarks(body, A, kind) { if (!A || !A.len) return null; S = body.D; S.anim = A; const F = []; for (let f = 0; f <= A.len; f++) F.push(poseAt(f));
  const root = body.D.bones.find(b => b.parent == null) || body.D.bones[0], ry = F.map(P => { const p = P[root.id]; return p ? p.reduce((s, q) => s + q[1], 0) / p.length : 0; });
  let tk = 1, up = -1e9; for (let f = 0; f < A.len; f++) { const v = ry[f + 1] - ry[f]; if (v > up) { up = v; tk = f + 1; } }
  let hold = 0, lo = 1e9; for (let f = 0; f < tk; f++) if (ry[f] < lo) { lo = ry[f]; hold = f; }
  let dn = 1, dv = -1e9; for (let f = 0; f < A.len; f++) for (const b of body.D.bones) { const a = F[f][b.id], c = F[f + 1][b.id]; if (!a || !c) continue; const v = a[a.length - 1][1] - c[c.length - 1][1]; if (v > dv) { dv = v; dn = f + 1; } }
  return { hold, takeoff: tk, upV: up * 24, down: dn, downV: dv * 24 }; }
// 羽ばたきアニメの「羽の先の高さ」と「羽の広がり」をコマごとに測る（右パッドで指がなぞるのはこの高さ）
function wingProf(body, A) { if (!A || !A.len) return null; S = body.D; S.anim = A; const F = []; for (let f = 0; f <= A.len; f++) F.push(poseAt(f));
  const root = body.D.bones.find(b => b.parent == null) || body.D.bones[0], ry = F.map(P => { const p = P[root.id]; return p ? p.reduce((s, q) => s + q[1], 0) / p.length : 0; });
  const tips = body.D.bones.map(b => { const ys = F.map((P, f) => { const p = P[b.id]; return p ? p[p.length - 1][1] - ry[f] : 0; }); return { b, ys, r: Math.max(...ys) - Math.min(...ys) }; }).sort((a, c) => c.r - a.r).slice(0, 2).filter(t => t.r > 1e-3);
  if (!tips.length) return null;
  const th = F.map((_, f) => tips.reduce((s, t) => s + t.ys[f], 0) / tips.length);
  const sp = F.map((P, f) => tips.reduce((s, t) => { const p = P[t.b.id]; return s + (p ? Math.hypot(p[p.length - 1][0], p[p.length - 1][2] * 0.3) : 0); }, 0) / tips.length), sMax = Math.max(...sp, 1e-6);
  const lo = Math.min(...th), hi = Math.max(...th); let nd = 0, top = 0; for (let f = 0; f < A.len; f++) if (th[f + 1] < th[f]) nd++; for (let f = 0; f <= A.len; f++) if (th[f] > th[top]) top = f;
  return { th, span: sp.map(v => v / sMax), lo, hi, R: Math.max(1e-4, hi - lo), len: A.len, vRef: 24 / Math.max(1, nd), top }; }
const wWrap = (wp, f) => ((f % wp.len) + wp.len) % wp.len;
function wAt(wp, arr, f) { f = wWrap(wp, f); const i = Math.floor(f), t = f - i; return arr[i] + (arr[Math.min(i + 1, wp.len)] - arr[i]) * t; }
// 指が動いた分だけ羽の高さを動かす。下へ＝コマを進める／戻す（羽が下がる方へ）。羽が下がる＝揚力（広がってるほど強い）、上がる＝抵抗
function scrubWing(m, dpx, stroke) { const wp = m.wp; let d = dpx / stroke * wp.R, lift = 0, drag = 0, n = 0, flat = 0;
  while (Math.abs(d) > 1e-7 && n++ < 800) { const a = wAt(wp, wp.th, m.wf), sf = wAt(wp, wp.th, m.wf + 0.1) - a, sb = wAt(wp, wp.th, m.wf - 0.1) - a;
    if (Math.abs(sf) < 1e-7) { if (flat++ > 40) break; m.wf = wWrap(wp, m.wf + 0.1); continue; }
    let dir, sl; if (Math.sign(sf) === Math.sign(d)) { dir = 1; sl = sf; } else if (Math.abs(sb) > 1e-7 && Math.sign(sb) === Math.sign(d)) { dir = -1; sl = sb; } else break; /* 端まで来た＝それ以上は動かん */
    const k = Math.min(1, d / sl), open = wAt(wp, wp.span, m.wf); m.wf = wWrap(wp, m.wf + dir * 0.1 * k); d -= sl * k;
    if (sl < 0) lift += -sl * k / wp.R * open; else drag += sl * k / wp.R * open; }
  return { lift, drag }; }
// ============ 野生の子（暮らしてるだけ。Eで調べると設計図） ============
const wilds = [];
function wildOf(kind, x, z, opt) { const d = TPL.data(kind), body = new BoneBody(d, kind === 'tsubasa' ? 0x6d93b8 : kind === 'hebi' ? 0x3f8f96 : 0x8aa05a), w = Object.assign({ kind, name: TPL.KINDS[kind].name, body, x, z, y: 0, yaw: Math.random() * 6.28, t: Math.random() * 9, ph: 0, A: animsFor(d), mode: 'wander' }, opt || {}); wilds.push(w); return w; }
wildOf('tokage', 5, 8); wildOf('tokage', -6, 6); wildOf('tsubasa', -4, -5);
const flyer = wildOf('tsubasa', 19, -40, { mode: 'circle', cx: 19.25, cz: -43.75, R: 7, y: 7.5, look: false }); flyer.body.g.scale.setScalar(1.3);
for (const [x, z, R] of [[-6, -183, 6], [9, -226, 5], [-14, -165, 4]]) wildOf('hebi', x, z, { mode: 'swim', cx: x, cz: z, R, name: 'ウミヘビ' });
function stepWild(w, dt) { w.t += dt;
  if (w.mode === 'circle') { const sp = 4.2; w.th = (w.th || 0) + sp / w.R * dt; w.x = w.cx + Math.cos(w.th) * w.R; w.z = w.cz + Math.sin(w.th) * w.R; w.yaw = Math.atan2(-Math.sin(w.th), Math.cos(w.th));
    w.y = 7.5 + Math.sin(w.t * 0.7) * 1.2; const flap = Math.sin(w.t * 0.5) > 0.6, A = flap ? w.A.flap : w.A.glide; if (A) { w.ph = (w.ph + dt * 24 / A.len) % 1; bodyFrame(w.body, A, w.ph * A.len); } }
  else if (w.mode === 'swim') { const near = Math.hypot(pl.x - w.x, pl.z - w.z) < 4.5 && pl.y < 1.5;
    if (near) w.yaw = turnTo(w.yaw, Math.atan2(pl.x - w.x, pl.z - w.z), dt * 3); /* 目が合う */
    else { w.th = (w.th == null ? Math.random() * 6.28 : w.th) + 0.9 / w.R * dt; const tx = w.cx + Math.cos(w.th) * w.R, tz = w.cz + Math.sin(w.th) * w.R; w.yaw = turnTo(w.yaw, Math.atan2(tx - w.x, tz - w.z), dt * 2); w.x += (tx - w.x) * Math.min(1, dt * 2); w.z += (tz - w.z) * Math.min(1, dt * 2); }
    w.y = 0.3 + Math.sin(w.t * 1.3) * 0.03; const A = near ? (w.A.idle || w.A.walk) : (w.A.walk || w.A.idle); if (A) { w.ph = (w.ph + dt * 24 / A.len * (near ? 0.6 : 1)) % 1; bodyFrame(w.body, A, w.ph * A.len); } }
  else { const near = Math.hypot(pl.x - w.x, pl.z - w.z) < 3; let sp = 0;
    if (!near && Math.sin(w.t * 0.6) > 0.2) { sp = 0.55; w.x += Math.sin(w.yaw) * sp * dt; w.z += Math.cos(w.yaw) * sp * dt; }
    if (near) w.yaw = turnTo(w.yaw, Math.atan2(pl.x - w.x, pl.z - w.z), dt * 3); else if (Math.random() < 0.006) w.yaw += (Math.random() - 0.5) * 2;
    if (Math.hypot(w.x - CAMP.x, w.z - CAMP.z) < CAMP.r + 0.5) w.yaw = Math.atan2(w.x - CAMP.x, w.z - CAMP.z);
    collide(w, 0.33, { h: 0.85, r: 0.33, power: 1 }); w.y = groundAt(w.x, w.z, w.y);
    const A = sp ? w.A.walk : w.A.idle; if (A) { w.ph = (w.ph + (sp ? sp / 0.36 : 24 / A.len) * dt) % 1; bodyFrame(w.body, A, w.ph * A.len); } }
  w.body.g.position.set(w.x, w.y, w.z); w.body.g.rotation.y = w.yaw; }
function makeBlueprint(kind) { const L = loadWorks(), now = Date.now(), data = TPL.data(kind), R0 = Object.fromEntries(data.bones.map(b => [b.id, clone(b.pts)]));
  const acts = TPL.slots(kind).map(sl => ({ name: sl.name, slot: sl.slot, anim: TPL.animFor(kind, sl.slot, R0, data.bones) })), ai = Math.max(0, acts.findIndex(a => a.slot === 'walk'));
  data.acts = acts; data.actI = ai; data.anim = acts[ai].anim; acts[ai].anim = null;
  const w = { id: 'w' + now, name: '設計図：' + TPL.KINDS[kind].name, created: now, updated: now, data }; L.unshift(w);
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(L)); localStorage.setItem(BP_KEY, String((+localStorage.getItem(BP_KEY) || 0) + 1)); } catch (_) {} updBP(); return w; }
const hasBlueprint = kind => loadWorks().some(w => TPL.detect(w.data) === kind);
function nearWild() { let best = null, bd = 2.4; for (const w of wilds) { if (w.mode === 'circle') continue; const d = Math.hypot(w.x - pl.x, w.z - pl.z); if (d < bd) { bd = d; best = w; } } return best; }
function lookAt() { const w = nearWild(); if (!w) return;
  if (hasBlueprint(w.kind)) { msg(w.name + '：もう設計図はある。工房の「作品」にあるで'); return; }
  const work = makeBlueprint(w.kind); msg(w.name + 'を調べた！ ' + TPL.KINDS[w.kind].name + 'の設計図を手に入れた（工房の「作品」）'); if (!mate) setMate(work); }
document.getElementById('lookBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (window.parent.__editorInput.intent(e) !== 'primary') return; lookAt(); });
// ============ すげ！枠：同じ骨・同じ作り方で、造形とアニメが違う野生個体（盆地を周回） ============
const rival = (() => { try {
  const d = tokageData(), thick = { 1: [1.45, 1.3], 2: [1.5, 1.35], 3: [2.4, 1.6], 4: [1.7, 1.9], 5: [1.7, 1.5], 6: [1.7, 1.5], 7: [1.9, 1.6], 8: [1.9, 1.6] };
  for (const b of d.bones) { const k = thick[b.id]; if (!k) continue; for (const key of ['wp', 'wn', 'dp', 'dn']) b[key] = b[key].map(p => ({ t: p.t, r: p.r * (k[0] + (k[1] - k[0]) * p.t) })); }
  d.size = 1.8;
  const keys = []; for (let f = 0; f < 10; f += 2) { const ph = f / 10 * Math.PI * 2, legs = {}, St = 0.24, Lf = 0.18;
    for (const [id, off] of [[5, 0], [8, 0], [6, Math.PI], [7, Math.PI]]) { const u = ((ph + off) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); legs[id] = [St * Math.cos(u), u > Math.PI ? Lf * Math.sin(u - Math.PI) : 0, 0]; }
    keys.push({ f, pose: TPL.poseOf('tokage', { dy: -0.1 + 0.03 * Math.cos(2 * ph), sway: 0.08 * Math.sin(ph), neckYaw: -0.1 * Math.sin(ph), neckPitch: -0.22, tailYaw: 0.7 * Math.sin(ph + 1.2), tailPitch: 0.22, legs }) }); }
  const anim = { len: 10, loop: true, keys, seg: {} }, q = measureGaitQuality(d, anim, 'run'), P = window.BodyMotion.perf(d.size, q.factor, 'run');
  const body = new BoneBody(d, 0x7c5a9e); body.g.scale.setScalar(d.size);
  return { body, anim, speed: P.top, size: d.size, th: 0, ph: 0, cx: 0, cz: -68.5, R: 9.5, seen: false };
} catch (e) { console.warn(e); return null; } })();
function stepRival(dt) { if (!rival) return; const r = rival; r.th += r.speed / r.R * dt; const x = r.cx + Math.cos(r.th) * r.R, z = r.cz + Math.sin(r.th) * r.R;
  r.ph = (r.ph + Math.min(r.speed / r.size / 0.56, 3.2) * dt) % 1; bodyFrame(r.body, r.anim, r.ph * r.anim.len);
  r.body.g.position.set(x, 0, z); r.body.g.rotation.y = Math.atan2(-Math.sin(r.th), Math.cos(r.th));
  if (!OLD_CAMP.found && Math.hypot(pl.x - OLD_CAMP.x, pl.z - OLD_CAMP.z) < 3) { OLD_CAMP.found = true; msg('前の調査隊の野営地を見つけた'); } }
// ============ 相棒（乗って動かす） ============
let mate = null;
// 速さで歩き／走りを切りかえ、足の回転は上限まで
function gait(sp, W, Rn) { if (!(sp > 0.05)) return W ? { A: W, cyc: 0 } : null; if (Rn && (sp > 1.3 || !W)) return { A: Rn, cyc: Math.min(sp / 0.56, 3.2) }; if (W) return { A: W, cyc: Math.min(sp / 0.36, 2.4) }; return null; }
function setMate(w) {
  if (mate) mate.body.dispose(); mate = null;
  if (!w) { pl.g.scale.setScalar(1); document.getElementById('mateBtn').textContent = '相棒：なし'; showHelp(); msg('徒歩に戻った'); return; }
  const d = clone(w.data); if (d.rest) { for (const b of d.bones) if (d.rest[b.id]) b.pts = d.rest[b.id]; }
  const kind = TPL.detect(d);
  mate = { work: w, kind, body: new BoneBody(d, 0xd9b48a), x: pl.x, z: pl.z, y: groundAt(pl.x, pl.z, pl.y), vy: 0, yaw: pl.yaw, v: 0, st: 'ground', f: 0, ph: 0, airT: 0, seatY: 0.5, A: animsFor(d) };
  const refA = kind ? animsFor(TPL.data(kind)) : {}, refB = kind ? new BoneBody(TPL.data(kind), 0xffffff) : null;
  mate.jm = readMarks(mate.body, mate.A.jump, kind); mate.fm = readMarks(mate.body, mate.A.flap, kind);
  if (refB) { const rj = readMarks(refB, refA.jump, kind), rf = readMarks(refB, refA.flap, kind); mate.jumpK = rj && mate.jm && rj.upV > 0 ? Math.max(0.75, Math.min(1.3, mate.jm.upV / rj.upV)) : 1; mate.flapK = rf && mate.fm && rf.downV > 0 ? Math.max(0.6, Math.min(1.4, mate.fm.downV / rf.downV)) : 1; refB.dispose(); } else { mate.jumpK = 1; mate.flapK = 1; }
  mate.canFly = !!(mate.A.flap && mate.A.glide); mate.wp = mate.A.flap ? wingProf(mate.body, mate.A.flap) : null; mate.wf = 0; mate.sv = 0; mate.bank = 0;
  mate.baseSize = window.BodyMotion.sizeOf(d); applyMateSize();
  pl.g.scale.setScalar(0.56);
  document.getElementById('mateBtn').textContent = '騎乗：' + w.name;
  showHelp(); msg('「' + w.name + '」に騎乗！' + (mate.canFly ? ' 飛べる子や' : ''));
}
// 大きさを体に当てる：見た目の拡大、乗る高さ、ぶつかる太さと高さ、力。速さは大きさだけで決まる（アニメの出来は今は効かない）
let testSize = null; // ⚙のテスト用（保存しない）
function applyMateSize() { if (!mate) return; const s = testSize || mate.baseSize; mate.size = s;
  mate.body.setPose(null); mate.body.g.scale.setScalar(s); mate.body.g.rotation.y = 0; mate.body.g.position.set(0, 0, 0); mate.body.g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(mate.body.g); mate.body.g.position.set(mate.x, mate.y, mate.z); mate.body.g.rotation.y = mate.yaw;
  const top = Number.isFinite(bb.max.y) ? bb.max.y : 0.8 * s, half = Number.isFinite(bb.max.x) ? Math.min(Math.max(-bb.min.x, bb.max.x), 0.32 * s) : 0.25 * s;
  mate.seatY = Math.max(0.3, Math.min(top, 0.95 * s) * 0.8); mate.info = { h: Math.min(top, 0.95 * s), r: Math.max(0.18 * s, half * 1.05), power: s * s };
  const M = window.BodyMotion; mate.perfW = M.perf(s, 1, 'walk'); mate.perfR = M.perf(s, 1, 'run'); }
function showHelp() { const fly = mate && mate.canFly;
  document.getElementById('stat').innerHTML = mate ? '<span class="pcOnly"><b>WASD</b>移動・<b>Shift</b>歩く・<b>Space長押し→離す</b>でジャンプ' + (fly ? '<br>空中で<b>Space</b>＝羽ばたき（押しっぱなし＝滑空）・<b>A/D</b>＝旋回<br>画面の右半分を<b>上下ドラッグ</b>＝指と同じ羽ばたき' : '') + '<br>マウス右ドラッグ＝カメラ・<b>T</b>＝時間帯</span>'
      + '<span class="touchOnly"><b>左</b>をなぞる＝移動・' + (fly ? '<b>右を上下</b>＝羽ばたき（地上からでも飛べる・速く下ろすほど強い）<br>止める＝滑空・空中で<b>左右</b>＝旋回' : '<b>右</b>を下に引いて離す＝ジャンプ') + '<br>右を横になぞる＝カメラ・<b>右を2回タップ</b>＝カメラを背中側へ</span>'
    : 'WASD／矢印で歩く。野生の子に近づいて<b>E</b>で調べると設計図'; }
function renderPick() { const box = document.getElementById('pickList'), L = loadWorks(); box.innerHTML = '';
  if (!L.length) { box.innerHTML = '<div class="tag" style="padding:20px;text-align:center">工房の作品がまだない。野生の子に近づいてEで調べると設計図が手に入るで</div>'; return; }
  const none = document.createElement('div'); none.className = 'row'; none.innerHTML = '<span class="nm">相棒なし</span><button class="btn">えらぶ</button>'; none.querySelector('button').onclick = () => { setMate(null); closePick(); }; box.appendChild(none);
  for (const w of L) { const r = document.createElement('div'); r.className = 'row'; const A = animsFor(w.data), has = ['jump', 'flap', 'glide', 'swim'].filter(k => A[k]).map(k => ({ jump: 'ジャンプ', flap: '羽ばたき', glide: '滑空', swim: '泳ぐ' })[k]);
    r.innerHTML = '<img alt=""><div class="nm"></div><span class="tag"></span><button class="btn">えらぶ</button>'; r.querySelector('img').src = w.thumb || ''; r.querySelector('.nm').textContent = w.name; r.querySelector('.tag').textContent = has.length ? has.join('・') + 'できる' : '歩く・走るだけ';
    r.querySelector('button').onclick = () => { setMate(w); closePick(); }; box.appendChild(r); } }
const closePick = () => document.getElementById('pickDlg').classList.remove('show');
document.getElementById('mateBtn').onclick = () => { renderPick(); document.getElementById('pickDlg').classList.add('show'); };
document.getElementById('pickClose').onclick = closePick;
function updBP() { let n = 0; try { n = +localStorage.getItem(BP_KEY) || 0; } catch (_) {} document.getElementById('bp').textContent = '設計図 ' + n; } updBP();
window.__fieldDebug = () => ({ pl, mate, boulder, rival, wilds, setMate, applyMateSize, makeBlueprint, groundAt, setTestSize: v => { testSize = v; applyMateSize(); }, press: () => spaceDown(), release: () => spaceUp() }); /* 検証用 */
window.__field = { refresh() { if (mate) { const w = loadWorks().find(x => x.id === mate.work.id); if (w) { const keep = { x: mate.x, z: mate.z, y: mate.y, yaw: mate.yaw }; setMate(w); Object.assign(mate, keep); } } updBP(); } };
// ============ ⚙ 大きさと動きの調整（数値はこの端末に保存） ============
const TUNE_ROWS = [['camH', 'カメラの高さ', 0.5, 2, 0.05], ['camD', 'カメラの距離', 0.5, 2, 0.05], ['jumpV', 'ジャンプの強さ', 3, 10, 0.1], ['gravity', '重力', 6, 30, 0.5], ['flapV', '羽ばたきの強さ', 1, 10, 0.1], ['glideSink', '滑空で落ちる速さ', 0.2, 4, 0.1], ['glideSpeed', '滑空の速さ', 2, 10, 0.1], ['swimSpeed', '泳ぐ速さ', 0.5, 5, 0.1], ['padStroke', '羽ばたき1回の指の幅', 60, 320, 5], ['airTurn', '空中の旋回', 0.5, 4, 0.1], ['airMax', '飛行の最高速', 3, 25, 0.5], ['airAccel', '飛行の直線加速', 0.5, 8, 0.1], ['airCam', '飛行カメラの追いつき', 0.3, 4, 0.1], ['accel', '加速', 2, 20, 0.5], ['turn', '小回り', 2, 15, 0.5], ['agiExp', '大きさで鈍る効き', 0, 1.5, 0.05], ['weightExp', '大きい＝重さの壁', 0, 1.5, 0.05]];
function buildTune() { const box = document.getElementById('tuneRows'), T = window.BodyMotion.load(); box.innerHTML = '';
  for (const [k, lb, mn, mx, st] of TUNE_ROWS) { const row = document.createElement('label'); row.innerHTML = '<span></span><input type="range"><b></b>'; row.firstChild.textContent = lb; const inp = row.querySelector('input'), out = row.querySelector('b');
    Object.assign(inp, { min: mn, max: mx, step: st, value: T[k] }); out.textContent = (+T[k]).toFixed(2); inp.oninput = () => { window.BodyMotion.set(k, +inp.value); out.textContent = (+inp.value).toFixed(2); applyMateSize(); }; box.appendChild(row); }
  const row = document.createElement('label'); row.className = 'wide'; row.innerHTML = '<span>テスト：大きさ</span><input type="range" min="50" max="200" step="5"><b></b><button class="btn" type="button">作品のまま</button>';
  const inp = row.querySelector('input'), out = row.querySelector('b'), show = () => { out.textContent = testSize ? '×' + testSize.toFixed(2) : '作品のまま'; inp.value = Math.round((testSize || (mate ? mate.baseSize : 1)) * 100); };
  inp.oninput = () => { if (!mate) { msg('先に相棒に乗ってな'); return; } testSize = +inp.value / 100; show(); applyMateSize(); };
  row.querySelector('button').onclick = () => { testSize = null; show(); applyMateSize(); }; show(); box.appendChild(row); }
document.getElementById('tuneBtn').onclick = () => { const t = document.getElementById('tune'); t.classList.toggle('show'); if (t.classList.contains('show')) buildTune(); };
document.getElementById('tuneClose').onclick = () => document.getElementById('tune').classList.remove('show');
document.getElementById('tuneReset').onclick = () => { window.BodyMotion.reset(); buildTune(); applyMateSize(); msg('初期値に戻した'); };
document.getElementById('tuneCopy').onclick = () => { const t = JSON.stringify(window.BodyMotion.load()); try { navigator.clipboard.writeText(t).then(() => msg('コピーした'), () => prompt('コピーしてな', t)); } catch (_) { prompt('コピーしてな', t); } };
// ============ 入力 ============
const keys = new Set(); let joy = null, spaceHeld = false, spaceEdge = 0, spaceUpEdge = 0;
function turnTo(a, b, k) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, k); }
function spaceDown() { if (spaceHeld) return; spaceHeld = true; spaceEdge++; }
function spaceUp() { if (!spaceHeld) return; spaceHeld = false; spaceUpEdge++; }
// 別ウィンドウへ移動した時にkeyup/pointerupを受け取れず歩き続けるのを防止
function clearKeys() { keys.clear(); spaceUp(); } /* キーだけ。指の操作は指を離した時に終わる */
function clearMovementInput() { keys.clear(); joy = null; spaceUp(); padUp(); orbit = null; const pad = document.getElementById('pad'); if (pad) { pad.style.display = 'none'; pad.firstChild.style.transform = ''; } }
window.__clearMovementInput = clearKeys; window.__clearAllInput = clearMovementInput;
addEventListener('blur', clearKeys);
addEventListener('pagehide', clearMovementInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearMovementInput(); });
addEventListener('keydown', e => { if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); keys.add(k); if (!document.body.classList.contains('pc')) document.body.classList.add('pc');
  if (k === 'e') { if (BIRD.near()) BIRD.start(); else if (inCamp(pl.x, pl.z, pl.y)) openTool(); else lookAt(); }
  if (k === 'r') BIRD.again();
  if (k === 't' && !e.repeat) SKY.next();
  if (k === ' ') { e.preventDefault(); if (!e.repeat) spaceDown(); } });
addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); if (k === ' ') spaceUp(); });
addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') document.body.classList.add('pc'); }, true);
// 左＝スティック（カメラ基準）。右＝羽ばたきパッド：空中は指の上下＝羽ばたきアニメのコマ、地上は下に引いて離す（上に弾く）＝ジャンプ、横になぞる＝カメラ
let camYaw = Math.PI, camYawT = Math.PI, camHold = 0, lastTap = 0, stickFwd = false; // camYawT＝狙いの向き。実際の向きはそこへヌルっと追いつく // カメラの前の向き（sin,cos）。手で回した直後はしばらく自動で回り込まない
const rpad = { id: null, active: false, released: false, x0: 0, y0: 0, x: 0, y: 0, mode: null, pend: [], still: 0, maxY: 0, t: 0, fs: 0 };
let orbit = null;
const isAirSt = m => m.st === 'air' || m.st === 'flap' || m.st === 'glide' || m.st === 'wing' || (m.st === 'takeoff' && m.lifted);
function padDown(e) { Object.assign(rpad, { id: e.pointerId, active: true, released: false, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, mode: null, pend: [], still: 0, maxY: e.clientY, t: e.timeStamp, t0: e.timeStamp, fs: 0 });
  if (mate && mate.canFly && mate.wp && isAirSt(mate)) rpad.mode = 'wing'; }
function padMove(e) { const dx = e.clientX - rpad.x, dy = e.clientY - rpad.y; rpad.x = e.clientX; rpad.y = e.clientY;
  if (!rpad.mode) { const tx = rpad.x - rpad.x0, ty = rpad.y - rpad.y0; if (Math.hypot(tx, ty) > 10) rpad.mode = Math.abs(tx) > Math.abs(ty) * 1.2 ? 'cam' : (mate && mate.canFly && mate.wp) ? 'wing' : (ty > 0 ? 'jump' : 'none'); } /* 飛べる子は地上でも上下＝羽ばたき（その場から飛び立つ） */
  if (rpad.mode === 'cam') { camYawT -= dx * 0.0035; camHold = 1.5; }
  else if (rpad.mode === 'wing') { const te = Math.max(0.004, (e.timeStamp - rpad.t) / 1000); rpad.fs += (Math.abs(dy) / te - rpad.fs) * 0.5; if (dy) rpad.pend.push({ d: -dy, fs: rpad.fs }); if (Math.abs(dy) > 0.5) rpad.still = 0; }
  else if (rpad.mode === 'jump') rpad.maxY = Math.max(rpad.maxY, rpad.y);
  rpad.t = e.timeStamp; }
function padUp(e) { if (!rpad.active) return; rpad.active = false; rpad.released = true; rpad.id = null;
  if (e && !rpad.mode && e.timeStamp - rpad.t0 < 260) { if (e.timeStamp - lastTap < 380) { camYawT = mate ? mate.yaw : pl.yaw; camHold = 0; lastTap = 0; } else lastTap = e.timeStamp; } } /* 右を2回タップ＝カメラを背中側へ */
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { const it = window.parent.__editorInput.intent(e);
  if (it === 'select' || it === 'camera') { orbit = { id: e.pointerId, x: e.clientX }; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} return; } /* マウス右ドラッグ＝カメラ */
  if (it !== 'primary') return;
  if (e.clientX < W * 0.55) { if (joy) return; joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; const p = document.getElementById('pad'); p.style.display = 'block'; p.style.left = (e.clientX - 60) + 'px'; p.style.top = (e.clientY - 60) + 'px'; p.firstChild.style.transform = ''; }
  else { if (rpad.active) return; padDown(e); }
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
canvas.addEventListener('pointermove', e => {
  if (orbit && e.pointerId === orbit.id) { camYawT -= (e.clientX - orbit.x) * 0.003; orbit.x = e.clientX; camHold = 1.5; return; }
  if (rpad.active && e.pointerId === rpad.id) { padMove(e); return; }
  if (!joy || e.pointerId !== joy.id) return; let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const L = Math.hypot(dx, dy); if (L > 50) { dx *= 50 / L; dy *= 50 / L; } joy.dx = dx / 50; joy.dy = dy / 50; document.getElementById('pad').firstChild.style.transform = `translate(${dx}px,${dy}px)`; });
const jEnd = e => { if (orbit && e.pointerId === orbit.id) orbit = null; if (rpad.active && e.pointerId === rpad.id) padUp(e);
  if (joy && e.pointerId === joy.id) { joy = null; const pad = document.getElementById('pad'); pad.style.display = 'none'; pad.firstChild.style.transform = ''; } }; canvas.addEventListener('pointerup', jEnd); canvas.addEventListener('pointercancel', jEnd);
canvas.addEventListener('lostpointercapture', jEnd);
addEventListener('pointerup', jEnd); canvas.addEventListener('pointercancel', jEnd);
canvas.addEventListener('lostpointercapture', jEnd);
addEventListener('pointerup', jEnd);
{ const jb = document.getElementById('jumpBtn'); jb.addEventListener('pointerdown', e => { e.preventDefault(); if (window.parent.__editorInput.intent(e) !== 'primary') return; try { jb.setPointerCapture(e.pointerId); } catch (_) {} spaceDown(); });
  const up = e => { e.preventDefault(); spaceUp(); }; jb.addEventListener('pointerup', up); jb.addEventListener('pointercancel', up); jb.addEventListener('lostpointercapture', up); }
// ============ 相棒の動き：地上・溜め・踏み切り・空中・羽ばたき・滑空・着地・泳ぐ ============
const FR = 24;
function playOnce(dt, A) { const prev = mate.f; mate.f = Math.min(A.len, mate.f + dt * FR); return prev; }
function stepMate(dt, mx, mz, ml, moving, walking, rx, rz) { const m = mate, T = window.BodyMotion.load(), A = m.A, pressed = spaceEdge > 0, released = spaceUpEdge > 0; spaceEdge = 0; spaceUpEdge = 0;
  const padRel = rpad.released; rpad.released = false; m.gl = false; m.lift = 0;
  // ---- 右パッド：地上は下に引いて溜め、離す／上に弾くと踏み切り（溜めの深さ＝強さ） ----
  if (rpad.mode === 'jump' && (rpad.active || padRel)) { const depth = Math.max(0, Math.min(1, (rpad.maxY - rpad.y0) / 70)), cur = Math.max(0, Math.min(1, (rpad.y - rpad.y0) / 70)), flick = rpad.maxY - rpad.y > 24;
    if ((m.st === 'ground' || m.st === 'swim' || m.st === 'land') && rpad.active && cur > 0.05) { if (A.jump && m.jm) { m.st = 'charge'; m.padJ = true; m.f = 0; m.lifted = false; } }
    if (m.st === 'charge' && m.padJ) { m.f = Math.min(m.jm.hold, cur * m.jm.hold); if (!rpad.active || flick) { m.st = 'takeoff'; m.f = Math.max(m.f, Math.min(m.jm.hold, depth * m.jm.hold)); m.jpow = 0.55 + 0.45 * depth; m.padJ = false; if (rpad.active) { rpad.mode = 'wing'; rpad.pend = []; } } }
    else if (!A.jump && (m.st === 'ground' || m.st === 'swim') && (padRel || flick) && depth > 0.2) { m.vy = T.jumpV * (0.55 + 0.45 * depth); m.y += 0.02; m.st = 'air'; m.lifted = true; m.airT = 0; if (rpad.active) { rpad.mode = 'wing'; rpad.pend = []; } } }
  // ---- 右パッド：空中で指を当てている間は「羽ばたきパッド」 ----
  if (m.canFly && m.wp && rpad.active && rpad.mode !== 'cam' && (isAirSt(m) || (rpad.mode === 'wing' && (m.st === 'ground' || m.st === 'swim' || m.st === 'land'))) && m.st !== 'wing' && !(m.st === 'takeoff' && m.f < A.jump.len)) { m.wf = m.st === 'flap' ? Math.min(m.f, m.wp.len) : m.wp.top; m.st = 'wing'; rpad.mode = 'wing'; rpad.pend = []; rpad.still = 0; rpad.railTop = rpad.y - (1 - (wAt(m.wp, m.wp.th, m.wf) - m.wp.lo) / m.wp.R) * T.padStroke; }
  if (m.st === 'wing' && !rpad.active) { m.st = 'air'; m.airT = 0; }
  const air = isAirSt(m);
  if (m.st !== 'wing' && rpad.pend.length) rpad.pend.length = 0; /* 羽ばたき中以外の指の動きは捨てる */
  // ---- 状態の切りかえ ----
  if ((m.st === 'ground' || m.st === 'swim' || m.st === 'land') && pressed) { if (A.jump && m.jm) { m.st = 'charge'; m.f = 0; m.lifted = false; } else { m.vy = T.jumpV; m.y += 0.02; m.st = 'air'; m.lifted = true; } }
  else if (m.st === 'charge' && !m.padJ) { m.f = Math.min(m.jm.hold, m.f + dt * FR); if (released || !spaceHeld) { m.st = 'takeoff'; m.f = Math.max(m.f, m.jm.hold); m.jpow = 1; } }
  else if (m.st === 'takeoff') { const prev = playOnce(dt, A.jump); if (!m.lifted && prev < m.jm.takeoff && m.f >= m.jm.takeoff) { m.vy = T.jumpV * m.jumpK * (m.jpow || 1); m.y += 0.02; m.lifted = true; }
    if (m.f >= A.jump.len) { if (!m.lifted) { m.vy = T.jumpV * m.jumpK * (m.jpow || 1); m.y += 0.02; m.lifted = true; } m.st = 'air'; m.airT = 0; }
    if (m.lifted && pressed && m.canFly) { m.st = 'flap'; m.f = 0; m.flapped = false; } }
  else if (m.st === 'air') { m.airT += dt; if (m.canFly && pressed) { m.st = 'flap'; m.f = 0; m.flapped = false; } else if (m.canFly && spaceHeld && m.vy < 0.6) m.st = 'glide'; }
  else if (m.st === 'flap') { const prev = playOnce(dt, A.flap); if (!m.flapped && prev < m.fm.down && m.f >= m.fm.down) { m.vy = Math.max(m.vy, 0) * 0.35 + T.flapV * m.flapK * BIRD.flap(m); m.flapped = true; }
    if (pressed && m.flapped) { m.f = 0; m.flapped = false; } /* 連打：打ち下ろしの後なら次の羽ばたきへ */
    else if (m.f >= A.flap.len) { m.st = spaceHeld && A.glide ? 'glide' : 'air'; m.airT = 0; } }
  else if (m.st === 'glide') { if (pressed) { m.st = 'flap'; m.f = 0; m.flapped = false; } else if (!spaceHeld) { m.st = 'air'; m.airT = 0; } }
  else if (m.st === 'land') { playOnce(dt, A.land); if (m.f >= A.land.len) m.st = 'ground'; }
  // ---- 羽ばたきパッド：指で動かした分だけ羽が動く。速く下ろすほど強い。指を止めたら、そのコマの広がりで滑空 ----
  let wingOpen = 0;
  if (m.st === 'wing') { rpad.still += dt; const up = T.flapV * m.flapK, ref = T.padStroke * m.wp.vRef * 0.6; let L = 0, Dg = 0, Lw = 0;
    for (const seg of rpad.pend) { const r = scrubWing(m, seg.d, T.padStroke), sf = Math.max(0.35, Math.min(1.7, seg.fs / ref)); L += r.lift; Lw += r.lift * sf; Dg += r.drag * sf; } /* 指の速さ（お手本アニメの振りの速さが基準）で強さが変わる */
    rpad.pend = [];
    const stam = L > 0 ? BIRD.spend(L) : 1; if (m.y <= groundAt(m.x, m.z, m.y) + 0.05) Lw *= 1.5; /* 地面すれすれは地面効果で浮きやすい（その場から飛び立てるように） */
    if (L > 0) { m.vy *= m.vy < 0 ? 1 - Math.min(1, L * 1.2) : 1 - Math.min(0.9, L * 0.65); m.vy += up * Lw * stam; m.lift = Lw * stam / Math.max(dt, 1e-3); }
    if (Dg > 0) m.vy -= up * Dg * 0.15;
    m.vy = Math.min(m.vy, up * 2.2);
    wingOpen = wAt(m.wp, m.wp.span, m.wf); if (rpad.still > 0.15) m.gl = true; }
  // ---- 横の動き（勢いつき。空中は鈍い、滑空は前へ滑る。飛べる子は空中で左右＝旋回） ----
  const P = walking ? m.perfW : m.perfR, inAir = isAirSt(m), gliding = m.st === 'glide' || m.gl, ctl = inAir ? (gliding ? 0.7 : 0.4) : 1;
  let top = P.top; if (m.st === 'swim') top = T.swimSpeed * Math.pow(m.size, 0.3); if (m.st === 'charge') top *= 0.25; if (m.st === 'land') top *= 0.45; if (gliding) top = Math.max(P.top, T.glideSpeed); if (m.st === 'wing') top = Math.max(top, P.top * 1.3);
  let target = 0;
  const flying = m.canFly && inAir;
  if (flying) { const fwd = -(rz || 0), turnR = T.airTurn * Math.pow(m.size, -0.3); m.yaw -= (rx || 0) * turnR * dt; m.bank += (-(rx || 0) * 0.45 - m.bank) * Math.min(1, dt * 5);
    target = fwd < -0.15 ? 0 : m.v; } /* 後ろ＝ブレーキ。前・直線の加速は下でやる */
  else { m.bank += (0 - m.bank) * Math.min(1, dt * 6);
    if (moving) { const want = Math.atan2(mx, mz), diff = Math.atan2(Math.sin(want - m.yaw), Math.cos(want - m.yaw)), rate = P.turn * ctl * (1 - 0.5 * Math.min(1, m.v / Math.max(0.1, top)));
      m.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff)); target = top * Math.min(1, ml) * Math.max(0, Math.cos(diff)); } }
  if (m.st === 'glide') target = Math.max(target, top * 0.8); /* 滑空中は止まれへん */
  if (m.gl) target = Math.max(target, top * 0.8 * (0.4 + 0.6 * wingOpen));
  const dv = target - m.v, acc = (dv > 0 ? P.accel : P.brake) * (inAir ? (gliding ? 0.5 : 0.25) : 1); m.v += Math.sign(dv) * Math.min(Math.abs(dv), acc * dt);
  // ---- 飛行：左右を入れてない間はだんだん加速し続ける（龍と同じ）。前に倒すともっと速く、曲げると減速。上限は⚙「飛行の最高速」 ----
  if (flying && m.y > groundAt(m.x, m.z, m.y) + 0.3 && -(rz || 0) >= -0.15) { const turnAmt = Math.min(1, Math.abs(rx || 0) / 0.6), straight = 1 - turnAmt, airTop = T.airMax * Math.pow(m.size, 0.3);
    if (m.v < airTop) m.v = Math.min(airTop, m.v + T.airAccel * straight * (1 + 0.8 * Math.max(0, -(rz || 0))) * dt);
    m.v = Math.max(Math.min(m.v, top), m.v - T.airAccel * 1.2 * turnAmt * dt); /* 曲げると直線で稼いだ分だけ減る（ふだんの速さより下には落とさん） */ if (m.v > airTop) m.v += (airTop - m.v) * Math.min(1, dt * 1.5); }
  m.x += Math.sin(m.yaw) * m.v * dt; m.z += Math.cos(m.yaw) * m.v * dt;
  const bump = (nx, nz) => { const into = -(Math.sin(m.yaw) * nx + Math.cos(m.yaw) * nz); if (into <= 0.05) return; if (m.v > 2.6 && into > 0.55) pop(new THREE.Vector3(m.x, m.y + m.info.h + 0.3, m.z), 'ゴン！', '#fff', 16 + m.size * 6); m.v *= 1 - into * 0.85; };
  if (touchBoulder(m, m.info.r, m.info, bump)) m.v = Math.min(m.v, 1.4);
  collide(m, m.info.r, m.info, bump); holeHint(m, m.info);
  // ---- 縦の動き ----
  const g0 = groundAt(m.x, m.z, m.y);
  if (inAir) { const vy0 = m.vy; m.vy -= T.gravity * dt; const up = liftAt(m.x, m.z, m.y); if (up) m.vy = Math.min(m.vy + (T.gravity + up) * dt, Math.max(vy0, UP_MAX)); if (m.st === 'glide') m.vy = Math.max(m.vy, -T.glideSink); if (m.gl) m.vy = Math.max(m.vy, -T.glideSink / (0.3 + 0.7 * wingOpen)); m.y += m.vy * dt;
    if (m.vy < 0 && m.y <= g0 && m.st === 'wing' && rpad.active) { m.y = g0; m.vy = 0; } /* 羽ばたき中は地面に立ったまま、揚力が勝ったら浮く */
    else if (m.vy < 0 && m.y <= g0) { m.y = g0; m.vy = 0; const hard = -vy0 > 3.5; m.lifted = false; m.st = hard && A.land ? 'land' : (inWater(m.x, m.z) && g0 < 0.05 ? 'swim' : 'ground'); m.f = 0; } }
  else if (m.st !== 'takeoff' || !m.lifted) { if (g0 < m.y - 0.05 && m.st !== 'charge') { m.st = 'air'; m.vy = 0; m.lifted = true; m.airT = 0; } else m.y = g0;
    if ((m.st === 'ground' || m.st === 'land') && inWater(m.x, m.z) && m.y < 0.05 && (m.st === 'ground' || m.f >= (A.land ? A.land.len : 0))) m.st = 'swim'; else if (m.st === 'swim' && !(inWater(m.x, m.z) && m.y < 0.05)) m.st = 'ground'; }
  // ---- 見た目（その時のアニメのコマ） ----
  const sp = m.v / m.size;
  if (m.st === 'ground') { const G = walking && A.walk ? { A: A.walk, cyc: Math.min(sp / 0.6, 2.4) } : gait(sp, A.walk, A.run);
    if (sp > 0.05 && G) { m.ph = (m.ph + G.cyc * dt) % 1; bodyFrame(m.body, G.A, m.ph * G.A.len); m.moving = true; }
    else if (A.idle) { m.wf = (m.moving ? 0 : (m.wf || 0) + dt * FR) % A.idle.len; m.moving = false; bodyFrame(m.body, A.idle, m.wf); } else m.body.setPose(null); }
  else if (m.st === 'swim') { const S2 = A.swim || A.walk; if (S2) { m.ph = (m.ph + Math.max(0.35, Math.min(sp / 0.4, 2.2)) * dt) % 1; bodyFrame(m.body, S2, m.ph * S2.len); } }
  else if (m.st === 'charge' || m.st === 'takeoff') bodyFrame(m.body, A.jump, m.f);
  else if (m.st === 'flap') bodyFrame(m.body, A.flap, m.f);
  else if (m.st === 'wing') bodyFrame(m.body, A.flap, m.wf);
  else if (m.st === 'land') bodyFrame(m.body, A.land, m.f);
  else if (m.st === 'glide' && A.glide) { m.ph = (m.ph + dt * FR / A.glide.len) % 1; bodyFrame(m.body, A.glide, m.ph * A.glide.len); }
  else if (m.st === 'air') { if (A.fall) { m.ph = (m.ph + dt * FR / A.fall.len) % 1; bodyFrame(m.body, A.fall, m.ph * A.fall.len); } else if (A.jump) bodyFrame(m.body, A.jump, A.jump.len); }
  const bob = m.st === 'swim' ? -0.12 * m.size + Math.sin(performance.now() / 300) * 0.02 : 0;
  m.body.g.position.set(m.x, m.y + bob, m.z); m.body.g.rotation.set(0, m.yaw, m.bank || 0);
  pl.x = m.x; pl.z = m.z; pl.y = m.y + bob; pl.yaw = m.yaw; }
// 影（空中で高さが分かるように）
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
// ============ ループ ============
let last = performance.now(), camS = null, camPos = null, camLook = null, camEye = null, camAhead = 0;
let loopErr = ''; function loop(now) { requestAnimationFrame(loop); try { step(now); } catch (e) { const m = String(e && e.message || e); if (m !== loopErr) { loopErr = m; const el = document.getElementById('dbg'); el.textContent = '止まった理由：' + m; el.style.display = 'block'; } } }
function step(now) {
  const pcFocusLost = document.body.classList.contains('pc') && keys.size === 0 && !joy && !rpad.active && !document.hasFocus() && !(window.parent !== window && window.parent.document.hasFocus() && window.parent.__gameOn);
  const away = window.__paused || document.hidden || pcFocusLost; /* iPadはiframeにフォーカスが来ないので、フォーカスで止めない */
  document.getElementById('pauseV').style.display = away && !window.__paused ? 'flex' : 'none';
  if (away) { clearMovementInput(); last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (keys.size && (!document.hasFocus() || (window.parent !== window && !window.parent.document.hasFocus()))) clearKeys();
  let mx = 0, mz = 0;
  if (keys.has('w') || keys.has('arrowup')) mz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) mz += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (joy) { mx += joy.dx; mz += joy.dy; }
  const rx = mx, rz = mz, cs = Math.sin(camYaw), cc = Math.cos(camYaw); mx = -cs * rz - cc * rx; mz = -cc * rz + cs * rx; /* カメラの向き基準 */
  const ml = Math.hypot(mx, mz), moving = ml > 0.1, walking = keys.has('shift'); stickFwd = ml > 0.3 && -rz > 0.7 * Math.hypot(rx, rz); /* ほぼ前に倒してる時だけ */
  if (mate) stepMate(dt, mx, mz, ml, moving, walking, rx, rz);
  else { spaceEdge = 0; spaceUpEdge = 0; rpad.released = false; rpad.pend.length = 0; if (moving) { const sp = Math.min(1, ml) * 3.4; pl.x += mx / ml * sp * dt; pl.z += mz / ml * sp * dt; pl.yaw = Math.atan2(mx, mz); }
    const me = { h: 1.5, r: 0.3, power: 0.3 }; touchBoulder(pl, me.r, me); collide(pl, me.r, me); holeHint(pl, me); pl.y = groundAt(pl.x, pl.z, pl.y); }
  pl.g.position.set(pl.x, mate ? pl.y + mate.seatY : pl.y + (moving ? Math.abs(Math.sin(now / 90)) * 0.05 : 0), pl.z);
  pl.g.rotation.y = pl.yaw;
  for (const w of wilds) stepWild(w, dt);
  stepRival(dt);
  BIRD.tick(dt);
  SKY.tick(dt); GLOW.tick(dt);
  { const g = groundAt(pl.x, pl.z, pl.y + 0.01), h = Math.max(0, pl.y - g), s = (mate ? mate.info.r * 2.2 : 0.7); shadow.position.set(pl.x, g + 0.03, pl.z); shadow.scale.setScalar(s * (1 + h * 0.08)); shadow.material.opacity = Math.max(0.05, 0.25 - h * 0.025); shadow.visible = !(mate && mate.st === 'swim'); }
  // 右パッドの目印：空中＝羽の高さ（光る＝揚力が出てる、黄色＝滑空）、地上＝溜めの深さ
  { const el = document.getElementById('wpad'), wing = rpad.active && mate && mate.st === 'wing' && mate.wp, jmp = rpad.active && rpad.mode === 'jump';
    el.style.display = wing || jmp ? 'block' : 'none';
    if (wing) { const H = window.BodyMotion.load().padStroke, hn = (wAt(mate.wp, mate.wp.th, mate.wf) - mate.wp.lo) / mate.wp.R; el.className = mate.lift > 0.4 ? 'lift' : mate.gl ? 'glide' : ''; el.style.height = H + 'px'; el.style.left = (rpad.x0 - 15) + 'px'; el.style.top = rpad.railTop + 'px'; el.firstChild.style.top = ((1 - hn) * H) + 'px'; }
    else if (jmp) { const H = 90; el.className = 'jump'; el.style.height = H + 'px'; el.style.left = (rpad.x0 - 15) + 'px'; el.style.top = (rpad.y0 - 10) + 'px'; el.firstChild.style.top = (10 + Math.max(0, Math.min(70, rpad.y - rpad.y0))) + 'px'; } }
  // ボタン：キャンプ＝工房、野生の子の近く＝調べる
  { const c = inCamp(pl.x, pl.z, pl.y), bn = !c && BIRD.near(), nw = !c && !bn && pl.y < 0.6 && nearWild(); document.getElementById('campBtn').style.display = c ? 'block' : 'none'; document.getElementById('birdBtn').style.display = bn ? 'block' : 'none'; const lb = document.getElementById('lookBtn'); lb.style.display = nw ? 'block' : 'none'; if (nw) lb.firstChild.textContent = '🔍 ' + nw.name + 'を調べる'; }
  // カメラ：乗り手の後ろ斜め上・低め。大きい子ほど高く引き、小さい子ほど地面すれすれに寄る。高さにも付いていく
  { const T = window.BodyMotion.load(), k = Math.max(1, 1.25 / Math.max(0.45, W / H)), want = mate ? Math.pow(mate.size, 0.75) : 0.85;
    camS = camS == null ? want : camS + (want - camS) * (1 - Math.exp(-dt * 3)); const c = camS, a = 1 - Math.exp(-dt * 7), yy = pl.y;
    if (camHold > 0) camHold -= dt;
    const flyCam = !!(mate && mate.canFly && isAirSt(mate) && mate.y > groundAt(mate.x, mate.z, mate.y) + 0.3);
    if (flyCam) { if (camHold <= 0) camYawT = turnTo(camYawT, mate.yaw, dt * T.airCam); } /* 飛んでる間は背中へ、遅れてヌルっと追いつく（ベタ付けやと旋回で酔う）。手で回したらしばらくそっち */
    else if (camHold <= 0 && stickFwd) { const yw = mate ? mate.yaw : pl.yaw, spd = mate ? Math.min(1, mate.v / Math.max(0.5, mate.perfR.top)) : (moving ? 1 : 0), dd = Math.atan2(Math.sin(yw - camYawT), Math.cos(yw - camYawT)), w = Math.max(0, (Math.cos(dd) + 0.3) / 1.3); camYawT = turnTo(camYawT, yw, dt * 1.4 * w * spd); } /* 前に走ってる時だけ、ゆっくり背中側へ */
    camYaw = turnTo(camYaw, camYawT, 1 - Math.exp(-dt * (flyCam ? 4 : 10))); /* 手で回してもヌルっと。飛行中はさらにゆっくり */
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), D = 5.6 * c * T.camD * k;
    // 回る中心は乗り手。追いかけるのは中心だけで、向きは camYaw の円の上をそのまま回る（弦を切ってフラつかない）
    const tgt = new THREE.Vector3(pl.x, yy, pl.z); if (!camPos) camPos = tgt.clone(); else { const yPrev = camPos.y; camPos.lerp(tgt, 1 - Math.exp(-dt * 10)); if (flyCam) camPos.y = yPrev + (yy - yPrev) * (1 - Math.exp(-dt * 2.5)); } /* 飛行中は羽ばたきの上下でカメラが揺れんように、高さだけゆっくり追う */
    const run = mate ? Math.min(1, mate.v / Math.max(0.5, mate.perfR.top)) : (moving ? 1 : 0); camAhead += (run * 2.2 * c - camAhead) * (1 - Math.exp(-dt * 3)); /* 走ってる時だけ少し先を見る。止まってたら乗り手を見る */
    const P = new THREE.Vector3(camPos.x - fx * D, camPos.y + 3.0 * c * T.camH, camPos.z - fz * D); camLook = new THREE.Vector3(camPos.x + fx * camAhead, camPos.y + 0.55 * c, camPos.z + fz * camAhead);
    const eye = camClamp(new THREE.Vector3(camPos.x, camPos.y + Math.max(0.5, (mate ? mate.seatY : 1) + 0.3), camPos.z), P.clone());
    if (!camEye) camEye = eye.clone(); else camEye.lerp(eye, 1 - Math.exp(-dt * 14));
    cam.position.copy(camEye); cam.lookAt(camLook); updateCrowns(camEye.x, camEye.z, pl.x, pl.z, pl.y); }
  renderer.render(scene, cam); }
// ============ 鳥人間：桟橋の先から海へ。羽ばたき＝スタミナ、気流と滑空はタダ、輪っかで回復 ============
const UP_MAX = 3.4; // 気流でのぼる速さの上限(m/s)
const UPDRAFTS = [{ x: 0, z: -172, r: 2.8, top: 14 }, { x: -7, z: -199, r: 2.6, top: 12.5 }, { x: 7, z: -228, r: 2.6, top: 12 }, { x: -3, z: -260, r: 2.4, top: 10.5 }, { x: 5, z: -297, r: 2.4, top: 9.5 }];
function liftAt(x, z, y) { for (const u of UPDRAFTS) if (y < u.top && Math.hypot(x - u.x, z - u.z) < u.r) return 9 * Math.min(1, (u.top - y) / 2); return 0; }
const BIRD = (() => {
  const KEY = 'yuya_birdman_best_v1', MAXS = 100, RINGS = [[0, 7.6, -168], [3.5, 9.6, -189], [-6, 6.6, -213], [6.5, 8.4, -241], [-2, 6, -273], [2.5, 5.5, -313]];
  const hud = document.getElementById('bird'), res = document.getElementById('birdRes');
  let st = 'off', stam = MAXS, dist = 0, who = null, landAt = null, bestNow = 0, bestSp = null;
  // 気流（白い柱＋のぼる輪）と輪っか
  const wisps = [];
  for (const u of UPDRAFTS) { const col = new THREE.Mesh(new THREE.CylinderGeometry(u.r, u.r, u.top, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); col.position.set(u.x, u.top / 2, u.z); scene.add(col);
    for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(u.r * 0.75, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); w.rotation.x = Math.PI / 2; w.userData = { u, ph: i / 3 }; scene.add(w); wisps.push(w); } }
  const rings = RINGS.map(([x, y, z]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.13, 8, 32), new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xc98a12, emissiveIntensity: 0.5, flatShading: true, transparent: true })); m.position.set(x, y, z); scene.add(m); return { x, y, z, m, used: false }; });
  const resetRings = () => { for (const r of rings) { r.used = false; r.m.material.opacity = 1; r.m.scale.setScalar(1); } };
  // ベストの旗（この子のベストの位置に立つ。海を横切る線つき）
  const flag = new THREE.Group(); { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), matBody(0xffffff)); pole.position.set(-13.5, 2.2, 0); const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xd9572b, flatShading: true })); buoy.position.set(-13.5, 0.45, 0);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshStandardMaterial({ color: 0xd9572b, side: THREE.DoubleSide })); cloth.position.set(-12.88, 3.8, 0); const line = new THREE.Mesh(new THREE.PlaneGeometry(26, 0.22), new THREE.MeshBasicMaterial({ color: 0xd9572b, transparent: true, opacity: 0.8, depthWrite: false })); line.rotation.x = -Math.PI / 2; line.position.y = 0.45; flag.add(pole, buoy, cloth, line); }
  flag.visible = false; scene.add(flag);
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); splash.rotation.x = -Math.PI / 2; scene.add(splash); let splashT = 9;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } };
  const bestOf = () => { const B = load(); return mate && B.w && B.w[mate.work.id] || 0; };
  function save(d) { const B = load(); B.w = B.w || {}; const id = mate.work.id, nb = d > (B.w[id] || 0) + 0.05; if (nb) B.w[id] = d; if (!B.all || d > B.all.d) B.all = { d, name: mate.work.name }; try { localStorage.setItem(KEY, JSON.stringify(B)); } catch (_) {} return nb; }
  function placeBest() { bestNow = bestOf(); flag.visible = bestNow > 0.5; dropLabel(bestSp); bestSp = null; if (!flag.visible) return; flag.position.set(0, 0, VENUE.edge - bestNow); bestSp = label('ベスト ' + bestNow.toFixed(1) + 'm', { size: 0.8, bg: '#d9572b', col: '#fff' }); bestSp.position.set(-13.5, 5, 0); flag.add(bestSp); }
  const cost = () => 12 * Math.pow(mate ? mate.size : 1, 1.3); // 体が大きいほど1回が重い
  const air = m => isAirSt(m) || m.st === 'charge';
  const near = () => (st === 'off' || st === 'done') && pl.y > VENUE.h - 0.6 && Math.hypot(pl.x - VENUE.booth.x, pl.z - VENUE.booth.z) < 3;
  function help(on) { if (!on) { showHelp(); return; } document.getElementById('stat').innerHTML = '<b>鳥人間</b>：桟橋の先まで走って飛び出す<br>空中で<b>右を上下</b>＝羽ばたき（速く下ろすほど強い・スタミナを使う）・指を止める＝広げたコマで滑空（タダ）<span class="pcOnly">・<b>Space</b>でもOK</span><br>左右＝旋回・白い柱＝上昇気流・金の輪＝スタミナ回復・<b>R</b>＝やり直し'; }
  function start() { if (!mate) { msg('相棒に乗ってから出よう'); return; } clearMovementInput(); st = 'ready'; stam = MAXS; dist = 0; landAt = null; resetRings(); res.classList.remove('show'); who = mate;
    Object.assign(mate, { x: VENUE.start.x, z: VENUE.start.z, y: VENUE.h, vy: 0, v: 0, yaw: Math.PI, st: 'ground', f: 0, lifted: false }); pl.x = mate.x; pl.z = mate.z; pl.y = mate.y; pl.yaw = Math.PI; camPos = null; camEye = null; camYaw = Math.PI; camYawT = Math.PI; camHold = 0;
    placeBest(); hud.classList.add('show'); help(true); draw(); msg(mate.canFly ? '桟橋の先から飛び出せ！' : '飛べへん子やけど…いったれ！'); }
  function off() { st = 'off'; hud.classList.remove('show'); res.classList.remove('show'); help(false); }
  function end() { st = 'done'; landAt = { x: mate.x, z: mate.z }; const prev = bestNow, nb = save(dist); hud.classList.remove('show'); help(false);
    splash.position.set(mate.x, 0.45, mate.z); splashT = 0; pop(new THREE.Vector3(mate.x, mate.y + 1.2, mate.z), mate.y < 0.3 ? 'ドボン！' : 'ズザッ！', '#fff', 26);
    document.getElementById('rT').textContent = nb ? '新記録！' : (mate.y < 0.3 ? 'ドボン！' : '着地！');
    document.getElementById('rR').innerHTML = '今回 <b>' + dist.toFixed(1) + 'm</b><br><span style="color:#6d685f">ベスト ' + Math.max(prev, dist).toFixed(1) + 'm' + (nb && prev > 0 ? '（+' + (dist - prev).toFixed(1) + 'm）' : '') + '</span>';
    res.classList.toggle('nb', nb); res.classList.add('show'); placeBest(); }
  function again() { if (!mate || st === 'off' && !(landAt && Math.hypot(pl.x - landAt.x, pl.z - landAt.z) < 40)) return; start(); } // 着いた所の近くならRで会場へ一瞬で戻る
  function flap() { if (st !== 'ready' && st !== 'fly') return 1; const c = cost(); if (stam >= c) { stam -= c; return 1; } const k = stam / c; stam = 0; if (mate) pop(new THREE.Vector3(mate.x, mate.y + mate.info.h + 0.4, mate.z), 'ヘトヘト…', '#ffd6c9', 16); return k * 0.6; }
  let tiredT = 0; // 右パッドの羽ばたき：下ろした分（q＝1で1回分）だけスタミナを使う
  function spend(q) { if (st !== 'ready' && st !== 'fly') return 1; const c = cost() * q; if (stam >= c) { stam -= c; return 1; } const k = c > 0 ? stam / c : 0; stam = 0;
    if (mate && performance.now() - tiredT > 900) { tiredT = performance.now(); pop(new THREE.Vector3(mate.x, mate.y + mate.info.h + 0.4, mate.z), 'ヘトヘト…', '#ffd6c9', 16); } return k * 0.6; }
  function draw() { document.getElementById('bD').textContent = dist.toFixed(1); const over = bestNow > 0.5 && dist > bestNow;
    document.getElementById('bB').textContent = bestNow > 0.5 ? (over ? 'ベスト更新中！（' + bestNow.toFixed(1) + 'm）' : 'ベスト ' + bestNow.toFixed(1) + 'm') : 'ベスト まだなし';
    hud.classList.toggle('over', over); hud.classList.toggle('low', stam < cost()); document.getElementById('bS').style.width = (stam / MAXS * 100) + '%'; }
  function tick(dt) { const t = performance.now() / 1000;
    for (const w of wisps) { const { u, ph } = w.userData, k = (t * 0.35 + ph) % 1; w.position.set(u.x, k * u.top, u.z); w.material.opacity = 0.5 * Math.sin(k * Math.PI); }
    for (const r of rings) r.m.rotation.y = r.used ? r.m.rotation.y : Math.sin(t * 1.4 + r.z) * 0.35;
    if (splashT < 1.2) { splashT += dt; splash.scale.setScalar(1 + splashT * 5); splash.material.opacity = Math.max(0, 0.9 - splashT * 0.8); }
    if (st === 'off') { if (mate !== who) { who = mate; placeBest(); } return; }
    if (mate !== who || !mate) { who = mate; off(); placeBest(); return; }
    const m = mate;
    if (st === 'ready') { if (m.z < VENUE.edge) st = 'fly'; else if (m.y < VENUE.h - 0.5) { if (m.z < VENUE.z0) st = 'fly'; else { msg('コースアウト！ 受付からやり直そ'); off(); return; } } }
    if (st === 'fly') { dist = Math.max(0, VENUE.edge - m.z); const cy = m.y + m.info.h * 0.5;
      for (const r of rings) if (!r.used && Math.abs(m.z - r.z) < 1 && Math.hypot(m.x - r.x, cy - r.y) < 2.1) { r.used = true; stam = Math.min(MAXS, stam + 30); r.m.material.opacity = 0.25; r.m.scale.setScalar(1.25); pop(new THREE.Vector3(r.x, r.y + 1.2, r.z), '+スタミナ', '#ffe9a8', 18); }
      if (!air(m)) { end(); return; } }
    if (st === 'ready' || st === 'fly') draw();
    if (st === 'done' && landAt && Math.hypot(m.x - landAt.x, m.z - landAt.z) > 14) res.classList.remove('show'); }
  document.getElementById('birdBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (window.parent.__editorInput.intent(e) !== 'primary') return; start(); });
  document.getElementById('rAgain').addEventListener('pointerdown', e => { e.preventDefault(); if (window.parent.__editorInput.intent(e) !== 'primary') return; start(); });
  document.getElementById('rSwim').addEventListener('pointerdown', e => { e.preventDefault(); res.classList.remove('show'); st = 'off'; });
  return { near, start, again, flap, spend, tick, off, get st() { return st; }, get stam() { return stam; }, get dist() { return dist; }, rings, UPDRAFTS };
})();
window.__bird = BIRD; /* 検証用 */
// ============ 時間帯：朝→昼→夕方→夜 がゆっくり回る。右上の時計ボタン（T）で次の時間帯へ早回し ============
const SKY = (() => {
  const CYCLE = 480, C = h => new THREE.Color(h); // 1日＝8分
  // p：0＝夜明け 0.15〜0.42＝昼 0.5＝夕方 0.66〜0.92＝夜
  const K = [
    { p: 0.00, sky: C(0xe9cdb8), sun: C(0xffcfa0), si: 0.9, hs: C(0xffe2cc), hg: C(0x6f7a5c), hi: 0.85, sea: C(0x5f8fae), pond: C(0x5a96b0), el: 0.18, near: 20, far: 100, night: 0.15 },
    { p: 0.15, sky: C(0xdfe6dc), sun: C(0xfff3e0), si: 1.4, hs: C(0xffffff), hg: C(0x7d8a66), hi: 1.15, sea: C(0x4a9cc4), pond: C(0x5aa6c9), el: 0.85, near: 22, far: 110, night: 0 },
    { p: 0.42, sky: C(0xdfe6dc), sun: C(0xfff3e0), si: 1.4, hs: C(0xffffff), hg: C(0x7d8a66), hi: 1.15, sea: C(0x4a9cc4), pond: C(0x5aa6c9), el: 0.85, near: 22, far: 110, night: 0 },
    { p: 0.50, sky: C(0xf0b088), sun: C(0xff9a58), si: 1.2, hs: C(0xffd0ac), hg: C(0x6e6a50), hi: 0.85, sea: C(0x4f7d9e), pond: C(0x52809a), el: 0.12, near: 20, far: 100, night: 0.05 },
    { p: 0.58, sky: C(0x46496e), sun: C(0xb08ab0), si: 0.35, hs: C(0x8a8cc0), hg: C(0x2e3328), hi: 0.6, sea: C(0x1d3550), pond: C(0x22405a), el: 0.05, near: 18, far: 90, night: 0.7 },
    { p: 0.66, sky: C(0x0d1530), sun: C(0x9fb6ff), si: 0.5, hs: C(0x5a6a9e), hg: C(0x1a2018), hi: 0.55, sea: C(0x0a1a2e), pond: C(0x0e2236), el: 0.7, near: 16, far: 85, night: 1 },
    { p: 0.92, sky: C(0x0d1530), sun: C(0x9fb6ff), si: 0.5, hs: C(0x5a6a9e), hg: C(0x1a2018), hi: 0.55, sea: C(0x0a1a2e), pond: C(0x0e2236), el: 0.7, near: 16, far: 85, night: 1 }];
  const NAMES = [[0.0, '🌅 朝', 0.0], [0.12, '☀ 昼', 0.15], [0.46, '🌇 夕方', 0.47], [0.62, '🌙 夜', 0.66]];
  const hemi = scene.children.find(o => o.isHemisphereLight);
  let p = 0.2, target = null, shown = '';
  // 星と月（霧に溶けない）
  const stars = (() => { const n = 700, pos = new Float32Array(n * 3); let s = 777; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const a = r() * 6.283, y = 0.08 + r() * 0.92, k = Math.sqrt(1 - y * y); pos.set([Math.cos(a) * k * 180, y * 180, Math.sin(a) * k * 180], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); m.frustumCulled = false; m.renderOrder = -2; scene.add(m); return m; })();
  const moon = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,232,1)'); gr.addColorStop(0.42, 'rgba(255,250,232,1)'); gr.addColorStop(0.5, 'rgba(200,215,255,.35)'); gr.addColorStop(1, 'rgba(200,215,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false, fog: false })); s.scale.setScalar(22); s.renderOrder = -1; scene.add(s); return s; })();
  const MOON_DIR = new THREE.Vector3(-0.35, 0.55, -0.76).normalize();
  const tmp = {};
  function sample(q) { let a = K[K.length - 1], b = K[0], t = 0;
    for (let i = 0; i < K.length; i++) { const A = K[i], B = K[(i + 1) % K.length], bp = i + 1 < K.length ? B.p : 1 + B.p; if (q >= A.p && q < bp) { a = A; b = B; t = (q - A.p) / (bp - A.p); break; } }
    t = t * t * (3 - 2 * t);
    for (const k of ['sky', 'sun', 'hs', 'hg', 'sea', 'pond']) tmp[k] = (tmp[k] || new THREE.Color()).copy(a[k]).lerp(b[k], t);
    for (const k of ['si', 'hi', 'el', 'near', 'far', 'night']) tmp[k] = a[k] + (b[k] - a[k]) * t; return tmp; }
  function nameOf(q) { let n = NAMES[0][1]; for (const [s, nm] of NAMES) if (q >= s) n = nm; return n; }
  function next() { const cur = NAMES.findIndex(([s], i) => p >= s && (i + 1 >= NAMES.length || p < NAMES[i + 1][0])), nx = NAMES[(cur + 1) % NAMES.length]; target = nx[2]; msg(nx[1] + ' にする'); }
  function tick(dt) {
    if (target != null) { const d = ((target - p) % 1 + 1) % 1, st = Math.min(d, dt * 0.35); p = (p + st) % 1; if (d < 0.002) { p = target; target = null; } }
    else p = (p + dt / CYCLE) % 1;
    const s = sample(p);
    scene.background.copy(s.sky); scene.fog.color.copy(s.sky); scene.fog.near = s.near; scene.fog.far = s.far;
    if (hemi) { hemi.color.copy(s.hs); hemi.groundColor.copy(s.hg); hemi.intensity = s.hi; }
    const night = s.night, ang = p * Math.PI * 2; sun.color.copy(s.sun); sun.intensity = s.si;
    if (night > 0.5) sun.position.copy(MOON_DIR).multiplyScalar(10); else sun.position.set(Math.cos(ang) * 6, 9 * Math.max(0.15, s.el), 5);
    MAP.seaM.material.color.copy(s.sea); MAP.seaM.material.opacity = 0.84 + night * 0.12; MAP.seaM.material.roughness = 0.25 + night * 0.55; MAP.water.material.color.copy(s.pond);
    grid.material.opacity = 0.45 * (1 - night * 0.8);
    stars.position.copy(cam.position); stars.material.opacity = Math.max(0, night - 0.2) * 1.1;
    moon.position.copy(cam.position).addScaledVector(MOON_DIR, 170); moon.material.opacity = Math.max(0, night - 0.3) * 1.4;
    document.body.classList.toggle('night', night > 0.5);
    const nm = nameOf(p); if (nm !== shown) { shown = nm; document.getElementById('timeBtn').textContent = nm; } }
  document.getElementById('timeBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (window.parent.__editorInput.intent(e) !== 'primary') return; next(); });
  return { tick, next, get p() { return p; }, set p(v) { p = ((v % 1) + 1) % 1; target = null; }, get night() { return sample(p).night; } };
})();
// ============ 夜の海が光る（夜光虫）：水の中で動いた所・着水・波打ち際だけ青く光る ============
const GLOW = (() => {
  const N = 4000, SURF = 0.44, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), P = [];
  for (let i = 0; i < N; i++) { P.push({ t: 0, L: 0, b: 0, vx: 0, vz: 0 }); pos[i * 3 + 1] = -999; }
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.2, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 })); pts.frustumCulled = false; scene.add(pts);
  let head = 0, live = 0, night = 0, waveT = 0, lastMate = null, prevSt = '', prevVy = 0;
  const inSea = (x, z) => z < MAP.sea - 0.2 && x > -240 && x < 240;
  function emit(x, z, b, L, vx, vz) { const i = head; head = (head + 1) % N; const q = P[i]; q.t = 0; q.L = L; q.b = b * night; q.vx = vx || 0; q.vz = vz || 0; pos[i * 3] = x; pos[i * 3 + 1] = SURF; pos[i * 3 + 2] = z; }
  // 体の表面の点を拾って、水面近くで動いた所に光を置く（＝体の動きがそのまま光の線になる）
  const SAMPLES = 110;
  function stir(body, dt, gain) { if (!body || !body.g.visible) return; body.g.updateMatrixWorld(true);
    const ms = [...body.meshes.values()]; if (!ms.length) return;
    if (!body.__glow || body.__glow.length !== SAMPLES) { body.__glow = []; for (let i = 0; i < SAMPLES; i++) body.__glow.push({ mi: i % ms.length, vi: Math.floor(Math.random() * 1e6), x: null, y: 0, z: 0 }); }
    const v = new THREE.Vector3();
    for (const s of body.__glow) { const m = ms[s.mi % ms.length], A = m.geometry.attributes.position; if (!A || !A.count) continue;
      v.fromBufferAttribute(A, s.vi % A.count).applyMatrix4(m.matrixWorld);
      if (s.x != null && v.y < SURF + 0.32 && v.y > SURF - 1.6 && inSea(v.x, v.z)) { const sp = Math.hypot(v.x - s.x, v.z - s.z, (v.y - s.y) * 0.5) / Math.max(dt, 1e-3);
        if (Math.random() < Math.min(1, Math.max(0, sp - 0.15) * dt * 1.6 * gain)) emit(v.x + (Math.random() - 0.5) * 0.08, v.z + (Math.random() - 0.5) * 0.08, 0.55 + Math.min(1, sp / 3) * 0.6, 1.6 + Math.random() * 1.2); }
      s.x = v.x; s.y = v.y; s.z = v.z; } }
  function burst(x, z, power) { const n = Math.round(50 + 160 * Math.min(1, power)); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = (0.6 + Math.random() * 2.6) * (0.6 + power); emit(x, z, 0.9 + Math.random() * 0.6, 1.4 + Math.random() * 1.6, Math.cos(a) * sp, Math.sin(a) * sp); } }
  function tick(dt) { night = SKY.night; pts.material.opacity = Math.min(1, night * 1.15); pts.visible = night > 0.02;
    if (night > 0.05) {
      for (const w of wilds) if (inSea(w.x, w.z)) stir(w.body, dt, 1.4);
      if (mate) { if (mate !== lastMate) { lastMate = mate; prevSt = mate.st; } stir(mate.body, dt, 1);
        if (mate.st === 'swim' && prevSt !== 'swim' && inSea(mate.x, mate.z)) burst(mate.x, mate.z, Math.min(1.4, Math.max(0.2, -prevVy / 9)) * Math.pow(mate.size, 0.5));
        prevSt = mate.st; prevVy = mate.vy; }
      // 波打ち際：数秒ごとに寄せる波が光る
      waveT += dt; const ph = waveT % 4.2; if (ph < 1.1) { const k = Math.sin(ph / 1.1 * Math.PI), n = Math.round(420 * k * dt); for (let i = 0; i < n; i++) { const x = -62 + Math.random() * 124; emit(x, MAP.sea - 0.35 - Math.random() * 0.9 - ph * 0.6, 0.5 + Math.random() * 0.6, 0.9 + Math.random() * 0.8, 0, 0.35); } }
      // ときどき沖でポツッと光る
      const n2 = Math.random() < dt * 22 ? 1 : 0; for (let i = 0; i < n2; i++) { const a = Math.random() * 6.283, r = 6 + Math.random() * 40, x = pl.x + Math.cos(a) * r, z = pl.z + Math.sin(a) * r; if (inSea(x, z)) emit(x, z, 0.25 + Math.random() * 0.35, 0.8 + Math.random() * 1.2); }
    }
    live = 0;
    for (let i = 0; i < N; i++) { const q = P[i]; if (q.L <= 0) continue; q.t += dt;
      if (q.t >= q.L) { q.L = 0; pos[i * 3 + 1] = -999; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      live++; if (q.vx || q.vz) { pos[i * 3] += q.vx * dt; pos[i * 3 + 2] += q.vz * dt; const d = Math.exp(-dt * 2.2); q.vx *= d; q.vz *= d; }
      const u = q.t / q.L, e = Math.min(1, q.t / 0.08) * (1 - u) * (1 - u) * q.b;
      col[i * 3] = 0.1 * e; col[i * 3 + 1] = 0.42 * e; col[i * 3 + 2] = 0.62 * e; }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; }
  return { tick, burst, get live() { return live; } };
})();
window.__stressState = () => ({ mate: mate ? { name: mate.work.name, st: mate.st, size: +mate.size.toFixed(2), canFly: mate.canFly, v: +mate.v.toFixed(2) } : null, bird: BIRD.st, stam: Math.round(BIRD.stam), pad: rpad.mode, camYaw: +camYaw.toFixed(2), pos: [pl.x, pl.y, pl.z].map(v => +v.toFixed(1)), time: +SKY.p.toFixed(2) }); /* 💢用 */
window.__sky = SKY; window.__glow = GLOW; window.__pad = () => ({ rpad, camYaw, camYawT, scrubWing, wAt }); window.__scene = scene; window.__mate = () => mate; /* 検証用 */
addEventListener('error', e => { const el = document.getElementById('dbg'); el.textContent = 'エラー：' + (e.message || ''); el.style.display = 'block'; });
// はじめて来た時：ツノトカゲの設計図を渡して乗せる。前に乗ってた子がいれば、いちばん新しい作品に乗る
{ let L = loadWorks(); if (!L.length) { makeBlueprint('tokage'); L = loadWorks(); } if (L.length) setMate(L[0]); else showHelp(); }
requestAnimationFrame(loop);
})();
