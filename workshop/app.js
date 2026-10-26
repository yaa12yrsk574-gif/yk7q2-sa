
(function(){
const THREE = window.THREE;
const {poseKeys,perfPose,perfIds,sideOf,ringTs,mirK,flipZK,smoothPath,profAt,frames,boneGeom,topoBones,blendPose,segInfo,keyAt,segOf,nOf,drawFrames,drawIdx,spacingOf,bezNorm,bezBake,cubicAt,bezSample,evalPath,txTree,applyPath,poseU,poseAt,measureGaitQuality,detailPointsFromMesh,ptsOf,ringsOf,angOf,bezStore,kidsOf} = window.BoneCore.create(THREE, () => S, value => { S = value; });
// ============ データ ============
// 骨：pts（関節）, parent/at（どの骨のどの関節から生えたか）
// シルエット：wp/wn（幅の＋側/−側）, dp/dn（厚みの＋側/−側）＝ [{t, r}]
// 形のいじり：off { "輪_角": [幅方向, 厚み方向, 骨方向] }（骨にくっついてるので、ポーズでもついてくる）
const SAVE_KEY = window.ProjectData.keys.draft;
const newState = window.ProjectData.newState;
let S = newState(); try { const sv = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (sv && sv.bones) S = sv; } catch (_) {}
let nextId = 1;
function migrate() { nextId = 1; for (const b of S.bones) { nextId = Math.max(nextId, b.id + 1); if (!b.wp) b.wp = clone(b.w || [{ t: 0, r: 0.04 }]); if (!b.wn) b.wn = clone(b.w || b.wp); if (!b.dp) b.dp = clone(b.d || b.wp); if (!b.dn) b.dn = clone(b.d || b.dp); if (!b.off) b.off = {}; if (!b.sides) b.sides = 8; } }
const clone = o => JSON.parse(JSON.stringify(o)), undoS = [], redoS = [];
migrate(); if (S.rest) { for (const b of S.bones) if (S.rest[b.id]) b.pts = clone(S.rest[b.id]); delete S.rest; }
function pushUndo() { undoS.push(clone(S)); if (undoS.length > 80) undoS.shift(); redoS.length = 0; updBtns(); }
let saveT = 0; function save() { try { if (mode === 'pose' && S.anim && S.anim.mirrorHalf) { regenHalf(); if (inMirroredHalf()) { applyPose(poseAt(ANIM.f)); needRebuild = true; } } } catch (_) {} clearTimeout(saveT); saveT = setTimeout(() => { try { window.BoneStorage.saveDraft(S); } catch (_) {} }, 300); }
const V3 = a => new THREE.Vector3(a[0], a[1], a[2]), r4 = v => Math.round(v * 1e4) / 1e4;
// ---- 3D ----
const canvas = document.getElementById('view'), over = document.getElementById('over'), og = over.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(0xece7dd);
const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7c66, 1.1));
const kl = new THREE.DirectionalLight(0xffffff, 1.5); kl.position.set(1.5, 3, 2.5); scene.add(kl); const rl = new THREE.DirectionalLight(0xfff0dd, 0.5); rl.position.set(-2, 1.5, -2); scene.add(rl);
const grid = new THREE.GridHelper(4, 40, 0xb9b0a0, 0xd6cfc2); scene.add(grid);
const matFlat = new THREE.MeshStandardMaterial({ color: 0xd9c6ad, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
const matSmooth = new THREE.MeshStandardMaterial({ color: 0xd9c6ad, roughness: 0.8, flatShading: false, side: THREE.DoubleSide });
let smooth = false; const meshes = new THREE.Group(); scene.add(meshes); const detailInkGroup = new THREE.Group(); scene.add(detailInkGroup);
const cam = new THREE.PerspectiveCamera(32, 1, 0.02, 60);
const orbit = { yaw: 0.6, pitch: 0.15, dist: 4.2, tx: 0, ty: 0.9, tz: 0, goal: null };
let W = 0, H = 0;
function layout() { W = innerWidth; H = innerHeight; const d = Math.min(2, devicePixelRatio || 1); renderer.setSize(W, H, false); over.width = W * d; over.height = H * d; og.setTransform(d, 0, 0, d, 0, 0); cam.aspect = W / H; viewShift(); needDraw = true; const tb = document.getElementById('top').getBoundingClientRect(), t2 = document.getElementById('top2'); t2.style.top = (tb.bottom + 6) + 'px'; document.getElementById('toast').style.top = (t2.getBoundingClientRect().bottom + 8) + 'px'; }
let needDraw = true, k_vcur = undefined; addEventListener('resize', layout); layout(); addEventListener('resize', paintPanelPosition);
// アニメの下のパネルが出てる間は、見える所（パネルの上）の真ん中に体が来るように画面ごとずらす
function viewShift() { const tl = document.getElementById('tl'), on = document.body.classList.contains('anim') && tl; const h = on ? tl.getBoundingClientRect().height + 16 : 0;
  if (h > 0 && W && H) cam.setViewOffset(W, H, 0, Math.round(h / 2), W, H); else cam.clearViewOffset(); cam.updateProjectionMatrix(); needDraw = true; }
function camUpdate() {
  if (orbit.goal) { let dy = orbit.goal.yaw - orbit.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); orbit.yaw += dy * 0.25; orbit.pitch += (orbit.goal.pitch - orbit.pitch) * 0.25; if (Math.abs(dy) < 0.002 && Math.abs(orbit.goal.pitch - orbit.pitch) < 0.002) orbit.goal = null; }
  cam.position.set(orbit.tx + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, orbit.ty + Math.sin(orbit.pitch) * orbit.dist, orbit.tz + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist);
  cam.lookAt(orbit.tx, orbit.ty, orbit.tz); cam.updateMatrixWorld(); }
const proj = P => { const v = P.clone().project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; };
const camDir = () => new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate();
const planeN = () => { const N = camDir(), c = [Math.abs(N.x), Math.abs(N.y), Math.abs(N.z)], m = Math.max(...c), i = c.indexOf(m); return m > 0.94 ? new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0) : N; }; /* 正面・横・上から見てる時は、その向きの平面にピタッと */
function unprojectOnPlane(x, y, P0, N) { const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(x / W * 2 - 1, -(y / H) * 2 + 1), cam); const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(N, P0), out = new THREE.Vector3(); return r.ray.intersectPlane(pl, out) ? out : null; }
const editorInput = window.parent.__editorInput;
function skeletonEditable(){if(!S.tpl)return true;toast('種族の骨格は固定です。形・細部・アニメを調整してな');return false;}
// ============ 骨 → 形 ============
const AX = () => S.axis || 0; // 対称の軸（x）
const isCenter = b => b.pts.every(p => Math.abs(p[0] - AX()) < 0.03);
function allBones() { return S.bones.map(b => ({ b, mir: false })); } // 両側とも本物の骨
function mirrorInto(src, t) { const keepSkeleton=S.tpl&&mode!=='pose'?{pts:clone(t.pts),atOff:t.atOff?clone(t.atOff):null}:null; if (src.atOff) t.atOff = [-src.atOff[0], src.atOff[1], src.atOff[2]]; else delete t.atOff; const a2 = 2 * AX(), n = src.sides || 8, off = {}; t.pts = src.pts.map(p => [r4(a2 - p[0]), p[1], p[2]]); t.wp = clone(src.wn); t.wn = clone(src.wp); t.dp = clone(src.dp); t.dn = clone(src.dn); if (src.av) t.av = 1; else delete t.av;
  for (const key in src.off || {}) { const [r, k] = key.split('_').map(Number), k2 = mirK(src, k, n), o = src.off[key]; off[r + '_' + k2] = [-o[0], o[1], o[2]]; } t.off = off; t.sides = src.sides; t.rings = src.rings; if(keepSkeleton){t.pts=keepSkeleton.pts;if(keepSkeleton.atOff)t.atOff=keepSkeleton.atOff;else delete t.atOff;} }
let lastJ = new Map(); const bJ = b => JSON.stringify([b.pts, b.wp, b.wn, b.dp, b.dn, b.off, b.sides]);
function markSynced() { lastJ = new Map(S.bones.map(b => [b.id, bJ(b)])); }
function syncTwins() { if (mode === 'pose' ? S.animSym : S.sym) { const ch = new Set(S.bones.filter(b => lastJ.get(b.id) !== bJ(b)).map(b => b.id)); for (const id of ch) { const b = boneById(id), t = b && b.twin != null && boneById(b.twin); if (t && !ch.has(t.id)) mirrorInto(b, t); } } markSynced(); }
function makeTwin(b) { if(!skeletonEditable())return false; const p = b.parent != null && boneById(b.parent), t = { id: nextId++, parent: p ? (p.twin != null && boneById(p.twin) ? p.twin : p.id) : null, at: b.at, twin: b.id }; mirrorInto(b, t); b.twin = t.id; S.bones.push(t); return t; }
function migrate6() { if (S.v6) return; S.v6 = 1; if (S.axis == null) S.axis = 0; if (!S.sym) return; const side = S.bones.filter(b => !isCenter(b) && !(b.twin != null && S.bones.some(c => c.id === b.twin))), idMap = new Map(); side.forEach(b => idMap.set(b.id, nextId++));
  for (const b of side) { const m = mirrorBoneData(b, idMap.get(b.id), idMap); b.twin = m.id; S.bones.push(m); } }








// v1 面単位のペイント。三角面の番号で保存し、造形データと一緒に作品へ残す。
// 非インデックス化により隣り合う面を異なる色で描ける。
function paintGeometry(G, bone, baseColor) {
  const pos = new Float32Array(G.I.length * 3), col = new Float32Array(G.I.length * 3);
  const base = new THREE.Color(baseColor);
  for (let t = 0; t < G.I.length / 3; t++) {
    const hex = bone.paint && bone.paint[t];
    const color = (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) ? new THREE.Color(hex) : base;
    for (let q = 0; q < 3; q++) {
      const src = G.I[t * 3 + q] * 3, dst = (t * 3 + q) * 3;
      pos[dst] = G.V[src]; pos[dst + 1] = G.V[src + 1]; pos[dst + 2] = G.V[src + 2];
      col[dst] = color.r; col[dst + 1] = color.g; col[dst + 2] = color.b;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // 共有頂点で法線を計算してから面ごとに展開する。なめらか表示と形編集の判定を守る。
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(G.V, 3));
  indexed.setIndex(G.I); indexed.computeVertexNormals();
  const originalNormals = indexed.attributes.normal.array;
  const expandedNormals = new Float32Array(G.I.length * 3);
  for (let i=0;i<G.I.length;i++) {
    const src=G.I[i]*3,dst=i*3;
    expandedNormals[dst]=originalNormals[src];
    expandedNormals[dst+1]=originalNormals[src+1];
    expandedNormals[dst+2]=originalNormals[src+2];
  }
  g.setAttribute('normal',new THREE.BufferAttribute(expandedNormals,3));
  g.userData.indexedNormals = originalNormals.slice();
  indexed.dispose();
  return g;
}
const paintMatFlat = new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8,flatShading:true,side:THREE.DoubleSide,vertexColors:true});
const paintMatSmooth = new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8,flatShading:false,side:THREE.DoubleSide,vertexColors:true});
const pickMat = new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}); /* 見えない当たり用（割った塗りの下） */
// ---- 線で割って、バケツで塗る ----
const cutLineGroup = new THREE.Group(); scene.add(cutLineGroup);
function drawCutLines(){
  for(const l of [...cutLineGroup.children]){cutLineGroup.remove(l);l.geometry.dispose();l.material.dispose();}
  if(mode!=='paint'||!window.PaintCut)return;
  for(const b of S.bones){const G=geomCache.get(b.id);if(!G||!b.pc||!b.pc.cuts)continue;
    for(const c of b.pc.cuts){const P=PaintCut.cutPoints(G,c,0.004);if(P.length<2)continue;
      const hot=paintErase&&cutHot&&cutHot.has(c);
      cutLineGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(P.map(p=>new THREE.Vector3(p[0],p[1],p[2]))),new THREE.LineBasicMaterial({color:hot?0xe0402f:0x2b2a27,transparent:true,opacity:hot?1:.75,depthTest:true})));}}
}
let paintErase=false,cutHot=null;
function hitTK(h){ /* 当たった所 → その骨の (t,kf)。ふたの上は null */
  const b=boneById(h.object.userData.id),G=b&&geomCache.get(b.id);if(!G||!Number.isInteger(h.faceIndex))return null;
  const ar=h.object.geometry.attributes.position.array,i=h.faceIndex*9;if(i+8>=ar.length)return null;
  const w=THREE.Triangle.getBarycoord(h.point,new THREE.Vector3(ar[i],ar[i+1],ar[i+2]),new THREE.Vector3(ar[i+3],ar[i+4],ar[i+5]),new THREE.Vector3(ar[i+6],ar[i+7],ar[i+8]),new THREE.Vector3());
  if(!w||!Number.isFinite(w.x))return null;const q=PaintCut.hitToTK(G,h.faceIndex,[w.x,w.y,w.z]);
  if(q)return {b,G,...q};
  const Nb=(G.rings-1)*G.n*2,j=h.faceIndex-Nb,cap=j&1,k=j>>1,r=cap?G.rings-1-0.05:0.05; /* ふた＝となりの胴の端っこを塗る */
  return {b,G,t:PaintCut.rToT(G.ts,r),kf:(k+0.5)/G.n,r,k:k+0.5,cap:true};
}
function mirMap(b,tb,t){ /* 反対側の角の対応を実際の形から測る（骨の向きで「横」が断面のどっちになるか変わるため）。鏡＝向きが逆回りになる対応の中で一番ズレが小さいもの */
  const G=geomCache.get(b.id),Gt=geomCache.get(tb.id);if(!G||!Gt||G.n!==Gt.n)return null;const n=G.n,a2=2*AX();let best=null,bd=1e18;
  const r0=Math.round(PaintCut.tToR(G.ts,t==null?0.5:t)),rs=[r0]; /* 輪ごとに測る（骨の途中で断面の向きが変わることがある） */
  for(let C=0;C<n;C++){let d=0;for(const r of rs){const rt=Math.round(r*(Gt.rings-1)/Math.max(1,G.rings-1));for(let k=0;k<n;k++){const o=(r*n+k)*3,q=(((C-k)%n)+n)%n,u=(rt*n+q)*3;d+=(Gt.V[u]-(a2-G.V[o]))**2+(Gt.V[u+1]-G.V[o+1])**2+(Gt.V[u+2]-G.V[o+2])**2;}}if(d<bd){bd=d;best={C,rev:true,n,nt:n};}}
  return best;}
const mirKf=(b,kf,tb,t)=>{const M=mirMap(b,tb||b,t);if(!M)return kf;let k=M.rev?M.C-kf*M.n:M.C+kf*M.n;k=((k%M.nt)+M.nt)%M.nt;return r4(k/M.nt);}; /* 反対側の角（鏡） */
function symTargets(b){ /* 左右対称：反対側の骨／真ん中の骨は自分の反対側 */
  if(!S.sym)return [];const t=b.twin!=null&&boneById(b.twin);if(t)return [t];return isCenter(b)?[b]:[];}
function fillAt(x,y){
  camUpdate();const h=meshHit(x,y);if(!h)return;const q=hitTK(h);if(!q)return;
  const color=document.getElementById('paintColor').value;pushUndo();
  const add=(b,t,kf)=>{if(!b.pc)b.pc={cuts:[],fills:[]};if(!b.pc.fills)b.pc.fills=[];b.pc.fills.push({t:r4(t),kf:r4(((kf%1)+1)%1),c:color});};
  add(q.b,q.t,q.kf);for(const tb of symTargets(q.b))add(tb,q.t,mirKf(q.b,q.kf,tb,q.t));
  rebuild();save();
}
function commitCutStroke(stk){
  camUpdate();const runs=[];let cur=null,last=null;
  for(const p of stk.pts){if(last&&Math.hypot(p.x-last.x,p.y-last.y)<3)continue;last=p;
    const h=meshHit(p.x,p.y),q=h&&hitTK(h);
    if(!q||q.cap){cur=null;continue;}
    if(!cur||cur.b!==q.b){cur={b:q.b,G:q.G,pts:[]};runs.push(cur);}
    const n=q.G.n,pv=cur.pts[cur.pts.length-1];let k=q.k;if(pv){while(k-pv.y>n/2)k-=n;while(pv.y-k>n/2)k+=n;}
    cur.pts.push({x:q.r,y:k});}
  const gid='c'+Date.now().toString(36);let added=0;const todo=[];
  for(const R of runs){if(R.pts.length<2)continue;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const q of R.pts){x0=Math.min(x0,q.x);x1=Math.max(x1,q.x);y0=Math.min(y0,q.y);y1=Math.max(y1,q.y);}
    const P=PaintCut.simplify(R.pts,Math.max(0.02,Math.min(0.35,Math.hypot(x1-x0,y1-y0)*0.08))); /* 大きい線はマス目くらいカクカク、目みたいな小さい線は形を残す */if(P.length<2)continue; /* カクカクに間引く */
    const L=P.reduce((s,p,i)=>i?s+Math.hypot(p.x-P[i-1].x,p.y-P[i-1].y):0,0);if(L<0.05)continue;
    const tk=P.map(p=>[r4(PaintCut.rToT(R.G.ts,p.x)),r4((((p.y/R.G.n)%1)+1)%1)]);todo.push({b:R.b,tk});}
  if(!todo.length){toast('体の上をなぞってな');return;}
  pushUndo();
  for(const {b,tk} of todo){const push=(bb,pts)=>{if(!bb.pc)bb.pc={cuts:[],fills:[]};if(!bb.pc.cuts)bb.pc.cuts=[];bb.pc.cuts.push({p:pts,g:gid});added++;};
    push(b,tk);
    for(const tb of symTargets(b)){const m=tk.map(([t,kf])=>[t,mirKf(b,kf,tb,t)]);if(tb===b&&m.every((q,i)=>Math.abs(q[0]-tk[i][0])<.01&&Math.min(Math.abs(q[1]-tk[i][1]),1-Math.abs(q[1]-tk[i][1]))<.02))continue;push(tb,m);}}
  rebuild();save();
}
function cutsNear(stk){ /* なぞった所の近くにある線（組ごと） */
  const hit=new Set();
  for(const b of S.bones){const G=geomCache.get(b.id);if(!G||!b.pc||!b.pc.cuts)continue;
    for(const c of b.pc.cuts){const P=PaintCut.cutPoints(G,c,0).map(p=>proj(new THREE.Vector3(p[0],p[1],p[2])));
      if(stk.pts.some(s=>P.some(q=>Math.hypot(q.x-s.x,q.y-s.y)<16)))hit.add(c);}}
  const groups=new Set([...hit].map(c=>c&&c.g).filter(Boolean));
  for(const b of S.bones)if(b.pc&&b.pc.cuts)for(const c of b.pc.cuts)if(c&&c.g&&groups.has(c.g))hit.add(c);
  return hit;
}
function eraseCuts(stk){const hit=cutsNear(stk);cutHot=null;if(!hit.size){toast('消す線の上をなぞってな');drawCutLines();return;}
  pushUndo();for(const b of S.bones)if(b.pc&&b.pc.cuts)b.pc.cuts=b.pc.cuts.filter(c=>!hit.has(c));rebuild();save();toast('線を消した');}



function drawDetailInk(){
  for(const line of [...detailInkGroup.children]){detailInkGroup.remove(line);line.geometry.dispose();line.material.dispose();}
  for(const mark of S.detailLines||[]){
    const mesh=meshes.children.find(m=>m.userData.id===mark.id),pts=detailPointsFromMesh(mesh,mark);
    if(pts.length<2)continue;
    detailInkGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:mark.color||'#2b2a27',depthTest:true})));
  }
}
function commitDetailInk(stk){
  const samples=[];let firstId=null,last=null;
  for(const p of stk.pts){
    if(last&&Math.hypot(p.x-last.x,p.y-last.y)<4)continue;last=p;
    const h=meshHit(p.x,p.y);if(!h||!Number.isInteger(h.faceIndex))continue;
    const id=h.object.userData.id;if(firstId!=null&&firstId!==id)continue;firstId=id;
    const ar=h.object.geometry.attributes.position.array,i=h.faceIndex*9;if(i+8>=ar.length)continue;
    const A=new THREE.Vector3(ar[i],ar[i+1],ar[i+2]),B=new THREE.Vector3(ar[i+3],ar[i+4],ar[i+5]),C=new THREE.Vector3(ar[i+6],ar[i+7],ar[i+8]);
    const b=THREE.Triangle.getBarycoord(h.point,A,B,C,new THREE.Vector3());
    if(!b||!Number.isFinite(b.x))continue;
    samples.push({face:h.faceIndex,bary:[b.x,b.y,b.z].map(r4)});
    if(samples.length>=128)break;
  }
  if(samples.length<2){toast('モデルの面に沿って線を引いてな');return;}
  pushUndo();(S.detailLines||(S.detailLines=[])).push({id:firstId,color:document.getElementById('detailInkColor').value,pts:samples});
  drawDetailInk();save();toast('ラインを追加した');
}
let detailInkMode=false;
function setDetailInkMode(on){
  detailInkMode=!!on;document.getElementById('detailInkBtn').classList.toggle('on',detailInkMode);
  document.getElementById('detailInkColor').style.display=detailInkMode?'':'none';
  document.getElementById('detailInkDel').style.display=detailInkMode?'':'none';needDraw=true;
}
document.getElementById('detailInkBtn').addEventListener('click',()=>setDetailInkMode(!detailInkMode));
document.getElementById('detailInkDel').addEventListener('click',()=>{
  if(!S.detailLines||!S.detailLines.length){toast('消すラインがない');return;}
  pushUndo();S.detailLines.pop();drawDetailInk();save();
});
let silSizeStart=null;
const silSlider=document.getElementById('silSize');
function silStart(){
  const b=sel==null?null:boneById(sel);if(!b)return;
  silSizeStart={id:b.id,original:clone({wp:b.wp,wn:b.wn,dp:b.dp,dn:b.dn})};pushUndo();
}
silSlider.addEventListener('pointerdown',silStart);
silSlider.addEventListener('input',()=>{
  const b=sel==null?null:boneById(sel);if(!b)return;
  if(!silSizeStart||silSizeStart.id!==b.id)silStart();
  const f=+silSlider.value/100;
  for(const k of ['wp','wn','dp','dn'])b[k]=silSizeStart.original[k].map(p=>({...p,r:r4(Math.max(.004,p.r*f))})); /* k（角）はそのまま */
  document.getElementById('silSizeLbl').textContent=Math.round(f*100)+'%';rebuild();save();
});
function silEnd(){silSizeStart=null;silSlider.value='100';document.getElementById('silSizeLbl').textContent='100%';}
silSlider.addEventListener('change',silEnd);silSlider.addEventListener('pointerup',silEnd);
let geomCache = new Map();
function rebuild() { syncTwins(); geometryRevision++; vertexVisibilityCache.key=''; for (const m of [...meshes.children]) { m.geometry.dispose(); meshes.remove(m); } geomCache = new Map();
  for (const b of S.bones) { const G = boneGeom(b); if (!G) continue; geomCache.set(b.id, G);
    for (const mir of [false]) {
      const V = mir ? G.V.map((v, i) => i % 3 === 0 ? -v : v) : G.V, I = mir ? G.I.slice().map((_, i, a) => a[i - i % 3 + [0, 2, 1][i % 3]]) : G.I;
      const g = paintGeometry({V,I}, b, 0xd9c6ad);
      if (window.PaintCut && PaintCut.has(b)) { /* 線で割った塗り：当たり判定は元の三角（顔ライン・選ぶ処理はそのまま）、見た目は割った形 */
        const m = new THREE.Mesh(g, pickMat); m.userData = { id: b.id, mir }; const pg = PaintCut.build(THREE, G, b, 0xd9c6ad);
        if (pg.userData.pcDead.length) { const dead = new Set(pg.userData.pcDead); b.pc.fills = b.pc.fills.filter((_, i) => !dead.has(i)); }
        m.add(new THREE.Mesh(pg, smooth ? paintMatSmooth : paintMatFlat)); meshes.add(m);
      } else { const m = new THREE.Mesh(g, smooth ? paintMatSmooth : paintMatFlat); m.userData = { id: b.id, mir }; meshes.add(m); } } }
  drawDetailInk(); drawCutLines(); needDraw = true; }
const vPos = (id, mir, r, k) => { const G = geomCache.get(id); if (!G) return null; const o = (r * G.n + k) * 3; return new THREE.Vector3(mir ? -G.V[o] : G.V[o], G.V[o + 1], G.V[o + 2]); };
// ============ 状態 ============
let mode = 'bone', sel = null, selJ = null, selMir = false, needRebuild = false, SELB = [], linkMode = false; // SELB＝いっしょに選んでる骨
 // sel = 骨の id, selJ = 関節番号
let elm = 'v', addMode = false, lassoMode = false; let VSEL = []; // 形モードで選んだ点 [{id, mir, r, k}]
const st = { stroke: null, drag: null, tap: null, cam: null };
const boneById = id => S.bones.find(b => b.id === id);
const selBones = () => sel == null ? [] : [sel, ...SELB.filter(id => id !== sel && boneById(id))];
const toast = (() => { let t = 0; return m => { const e = document.getElementById('toast'); e.textContent = m; e.style.opacity = 1; clearTimeout(t); t = setTimeout(() => e.style.opacity = 0, 1800); }; })();
function jointHit(x, y, R, onlyId=null) { let best = null, bd = R; for (const { b, mir } of allBones().filter(v=>onlyId==null||v.b.id===onlyId)) ptsOf(b, mir).forEach((p, i) => { const s = proj(p), d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = { b, mir, i, P: p }; } }); return best; }
function boneHit(x, y, R) { let best = null, bd = R; for (const { b, mir } of allBones()) { const G = geomCache.get(b.id); if (!G) continue; const sc = G.path.map(p => proj(mir ? new THREE.Vector3(-p.x, p.y, p.z) : p));
  for (let i = 0; i < sc.length - 1; i++) { const a = sc[i], c = sc[i + 1], dx = c.x - a.x, dy = c.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y); if (d < bd) { bd = d; best = { b, mir }; } } } return best; }
function meshHit(x, y) { const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(x / W * 2 - 1, -(y / H) * 2 + 1), cam); return r.intersectObjects(meshes.children, false)[0] || null; }
function rdpIdx(P, eps) { const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const rec = (a, b) => { const A = P[a], B = P[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1; let mi = -1, md = 0; for (let i = a + 1; i < b; i++) { const d = Math.abs((P[i].x - A.x) * dy - (P[i].y - A.y) * dx) / L; if (d > md) { md = d; mi = i; } } if (mi >= 0 && md > eps) { keep[mi] = 1; rec(a, mi); rec(mi, b); } };
  rec(0, P.length - 1); const o = []; keep.forEach((k, i) => { if (k) o.push(i); }); return o; }
// ---- 骨を描く ----
function finishBone(stk) { if(!skeletonEditable())return false;
  let L = 0; for (let i = 1; i < stk.pts.length; i++) L += Math.hypot(stk.pts[i].x - stk.pts[i - 1].x, stk.pts[i].y - stk.pts[i - 1].y); if (L < 20) return false;
  let endA = null; if (!stk.anchor) { const q = stk.pts[stk.pts.length - 1], jh = jointHit(q.x, q.y, 16); if (jh) endA = jh; }
  const P0 = stk.anchor ? stk.anchor.P.clone() : endA ? endA.P.clone() : new THREE.Vector3(orbit.tx, orbit.ty, orbit.tz); const N = planeN(); if (!stk.anchor && !endA) { if (N.x === 1) P0.x = AX(); if (N.z === 1) P0.z = 0; } /* 正面・横・上から描いたら、その向きの平面にピタッと描く（横から＝真ん中の面） */
  let eps = 10, ix = rdpIdx(stk.pts, eps); while (ix.length > 8) { eps *= 1.4; ix = rdpIdx(stk.pts, eps); }
  const W3 = ix.map(i => unprojectOnPlane(stk.pts[i].x, stk.pts[i].y, P0, N)).filter(Boolean); if (W3.length < 2) return false;
  if (stk.anchor) W3[0] = stk.anchor.P.clone(); if (endA) { W3.reverse(); W3[0] = endA.P.clone(); stk.anchor = endA; } /* 描き終わりが関節＝そこが根元 */
  if (S.sym) { if (W3.every(p => Math.abs(p.x - AX()) < 0.06)) W3.forEach(p => { p.x = AX(); }); }
  let len = 0; for (let i = 1; i < W3.length; i++) len += W3[i].distanceTo(W3[i - 1]);
  const r = r4(Math.max(0.012, Math.min(0.09, len * 0.12))), pr = () => [{ t: 0, r }, { t: 1, r: r4(r * 0.8) }];
  pushUndo(); const b = { id: nextId++, parent: stk.anchor ? stk.anchor.b.id : null, at: stk.anchor ? stk.anchor.i : null, pts: W3.map(p => [p.x, p.y, p.z].map(r4)), wp: pr(), wn: pr(), dp: pr(), dn: pr(), off: {}, sides: 8, av: 1 };
  ringsOf(b); S.bones.push(b); if (S.sym && !isCenter(b)) makeTwin(b); sel = b.id; selJ = null; rebuild(); save(); return true; }

function centerSilhouettePair(b,G){
  if(!S.sym||!isCenter(b)||!G||!G.F||!G.F.length)return null;
  const f=G.F[Math.floor(G.F.length/2)];
  return Math.abs(f.Wd.x)>=Math.abs(f.Dd.x)?['wp','wn']:['dp','dn'];
}
function alignSilhouetteSymmetryOnEnable(){
  // When symmetry was OFF during free-form bone creation, restore missing partner bones on enabling it.
  // Fixed-species templates must not gain new bones.
  if(!S.tpl){
    const depth=b=>{let n=0,p=b.parent,seen=new Set([b.id]);while(p!=null&&!seen.has(p)&&n<64){seen.add(p);n++;const a=boneById(p);p=a?a.parent:null;}return n;};
    const pending=S.bones.filter(b=>!isCenter(b)&&!(b.twin!=null&&boneById(b.twin))).sort((a,b)=>depth(a)-depth(b));
    const mirrorDistance=(a,b)=>{
      if(a.pts.length!==b.pts.length)return Infinity;
      let total=0;for(let i=0;i<a.pts.length;i++){
        const x=a.pts[i],y=b.pts[i],dx=(2*AX()-x[0])-y[0],dy=x[1]-y[1],dz=x[2]-y[2];
        total+=Math.hypot(dx,dy,dz);
      }
      return total/a.pts.length;
    };
    for(const b of pending){
      if(b.twin!=null&&boneById(b.twin))continue;
      let candidate=null,best=0.04;
      for(const t of pending){
        if(t.id===b.id||t.twin!=null&&boneById(t.twin))continue;
        const d=mirrorDistance(b,t);if(d<best){best=d;candidate=t;}
      }
      if(candidate){b.twin=candidate.id;candidate.twin=b.id;}
      else makeTwin(b);
    }
  }
  const selected=sel==null?null:boneById(sel),done=new Set();
  for(const b of [...S.bones]){
    if(done.has(b.id))continue;
    const t=b.twin!=null?boneById(b.twin):null;
    if(!t||done.has(t.id))continue;
    const src=selected&&(selected.id===b.id||selected.id===t.id)?selected:
      (b.pts.reduce((n,p)=>n+p[0],0)/b.pts.length>=t.pts.reduce((n,p)=>n+p[0],0)/t.pts.length?b:t);
    mirrorInto(src,src.id===b.id?t:b);done.add(b.id);done.add(t.id);
  }
  for(const b of S.bones)if(isCenter(b)){
    const pair=centerSilhouettePair(b,boneGeom(b));
    if(pair)b[pair[1]]=clone(b[pair[0]]);
  }
}
// ---- シルエット：描いた側だけ ----
function finishSil(stk) {
  const b = boneById(sel); if (!b) { toast('先に骨をタップして選んでな'); return false; }
  const G = geomCache.get(b.id); if (!G) return false; const mir = !!stk.mir, mx = p => mir ? new THREE.Vector3(-p.x, p.y, p.z) : p;
  const path = G.path.map(mx), Fm = G.F.map(f => ({ Wd: mx(f.Wd.clone()), Dd: mx(f.Dd.clone()) }));
  if (facing(path)) return crossSil(b, path, Fm, stk);
  const mid = Math.floor(path.length / 2), s0 = proj(path[mid]), sw = proj(path[mid].clone().add(Fm[mid].Wd)), sd = proj(path[mid].clone().add(Fm[mid].Dd));
  const useW = Math.hypot(sw.x - s0.x, sw.y - s0.y) >= Math.hypot(sd.x - s0.x, sd.y - s0.y);
  const sc = path.map(proj), raw = []; let sideSum = 0;
  for (const q of stk.pts) { let bd = Infinity, bi = 0, bu = 0;
    for (let i = 0; i < sc.length - 1; i++) { const a = sc[i], c = sc[i + 1], dx = c.x - a.x, dy = c.y - a.y, u = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a.x + dx * u - q.x, a.y + dy * u - q.y); if (d < bd) { bd = d; bi = i; bu = u; } }
    const t = G.ts[bi] + (G.ts[bi + 1] - G.ts[bi]) * bu, P = path[bi].clone().lerp(path[bi + 1], bu), A = Fm[bi][useW ? 'Wd' : 'Dd'], s1 = proj(P), s2 = proj(P.clone().add(A)), ax = s2.x - s1.x, ay = s2.y - s1.y, ppm = Math.hypot(ax, ay) || 1;
    const end = (bi === 0 && bu <= 0) || (bi === sc.length - 2 && bu >= 1); /* 骨の端より外は「端の向こう」なので使わない */
    sideSum += Math.sign((q.x - s1.x) * ax + (q.y - s1.y) * ay); raw.push({ t, r: Math.max(0.004, bd / ppm), end }); }
  // 山と谷を残す：画面上の線から、2.5px以上の出っ張り・へこみは全部残して、まっすぐな所だけ点を減らす（平均でならさない）
  let eps = 2.5, ix = rdpIdx(stk.pts, eps); while (ix.length > 48) { eps *= 1.3; ix = rdpIdx(stk.pts, eps); }
  let out = ix.map(i => raw[i]).filter(o => !o.end); if (out.length < 2) out = raw.filter(o => !o.end); if (out.length < 2) return false;
  out.sort((a, c) => a.t - c.t); const t0 = out[0].t, t1 = out[out.length - 1].t; if (t1 - t0 < 0.03) return false;
  const pts = []; for (const o of out) { let t = o.t; if (pts.length && t <= pts[pts.length - 1].t + 0.001) t = pts[pts.length - 1].t + 0.002; if (t > 1) break; pts.push({ t: r4(t), r: r4(o.r), k: 1 }); }
  const key = (useW ? 'w' : 'd') + (sideSum >= 0 ? 'p' : 'n'); // 描いた側だけ
  const pair=centerSilhouettePair(b,G),both=!!(pair&&pair.includes(key)),keys=both?pair:[key]; // 世界X軸が幅か厚みか判定
  pushUndo(); const tw = S.sym && b.twin != null ? boneById(b.twin) : null, O = topoOf(b), Ot = tw && topoOf(tw);
  for (const kk of keys) { const kept = (b[kk] || []).filter(p => p.t < t0 - 0.02 || p.t > t1 + 0.02); b[kk] = kept.concat(pts).sort((a, c) => a.t - c.t).map(p => p.k ? { t: r4(p.t), r: r4(p.r), k: 1 } : { t: r4(p.t), r: r4(p.r) }); }
  b.av = 1; afterTopo(b, O, tw, Ot);
  rebuild(); save(); toast((useW ? '幅' : '厚み') + (both ? '（左右そろえて）' : '（こっち側だけ）') + 'が決まった'); return true; }
// ---- 輪の並び・頂点の角度が変わった時：形のいじり（off）・色（paint）・顔ラインを新しい並びへ移す ----
const topoOf = b => ({ ts: ringTs(b), av: !!b.av, n: b.sides || 8 });
function remapTopo(b, O, N, keepOff) { if (!O || O.n !== N.n) return; const n = N.n, shift = O.av !== N.av;
  if (!shift && O.ts.length === N.ts.length && O.ts.every((t, i) => Math.abs(t - N.ts[i]) < 1e-6)) return;
  const nearR = (T, t) => { let bi = 0, bd = 9; T.forEach((q, i) => { const d = Math.abs(q - t); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const segR = (T, t) => { for (let i = 0; i < T.length - 1; i++) if (t <= T[i + 1]) return i; return T.length - 2; };
  if (!keepOff && b.off && Object.keys(b.off).length) { const off = {}; for (let r = 0; r < N.ts.length; r++) { const ro = nearR(O.ts, N.ts[r]); for (let k = 0; k < n; k++) { const ks = shift ? [(k - 1 + n) % n, k] : [k], vs = ks.map(q => b.off[ro + '_' + q]).filter(Boolean); if (!vs.length) continue; const o = [0, 0, 0]; for (const v of vs) for (let c = 0; c < 3; c++) o[c] += v[c] / ks.length; off[r + '_' + k] = o.map(r4); } } b.off = off; }
  const Ob = (O.ts.length - 1) * n * 2, Nb = (N.ts.length - 1) * n * 2;
  const n2o = tn => { if (tn >= Nb) return Ob + (tn - Nb); const q = tn >> 1, h = tn & 1, r = Math.floor(q / n), k = q % n, ro = segR(O.ts, (N.ts[r] + N.ts[r + 1]) / 2); return (ro * n + k) * 2 + h; };
  const o2n = to => { if (to >= Ob) return Nb + (to - Ob); const q = to >> 1, h = to & 1, r = Math.floor(q / n), k = q % n, rn = segR(N.ts, (O.ts[r] + O.ts[r + 1]) / 2); return (rn * n + k) * 2 + h; };
  if (b.paint && Object.keys(b.paint).length) { const p = {}; for (let tn = 0; tn < Nb + 2 * n; tn++) { const c = b.paint[n2o(tn)]; if (c) p[tn] = c; } b.paint = p; }
  for (const L of S.detailLines || []) if (L.id === b.id) for (const s2 of L.pts) s2.face = o2n(s2.face); }
function afterTopo(b, O, tw, Ot) { remapTopo(b, O, topoOf(b)); if (tw) { mirrorInto(b, tw); remapTopo(tw, Ot, topoOf(tw), true); markSynced(); } } /* 反対側の off は鏡で写し済み */
const facing = path => Math.abs(path[path.length - 1].clone().sub(path[0]).normalize().dot(camDir())) > 0.7; // 骨がこっち向き＝断面で描く
function crossSil(b, path, Fm, stk) { const mid = Math.floor(path.length / 2), C = path[mid], s0 = proj(C), e = 0.05, sw = proj(C.clone().addScaledVector(Fm[mid].Wd, e)), sd = proj(C.clone().addScaledVector(Fm[mid].Dd, e));
  const ax = (sw.x - s0.x) / e, ay = (sw.y - s0.y) / e, bx = (sd.x - s0.x) / e, by = (sd.y - s0.y) / e, det = ax * by - ay * bx; if (Math.abs(det) < 1e-6) return false;
  const M = { wp: [], wn: [], dp: [], dn: [] };
  for (const q of stk.pts) { const qx = q.x - s0.x, qy = q.y - s0.y, u = (qx * by - qy * bx) / det, v = (ax * qy - ay * qx) / det; (u >= 0 ? M.wp : M.wn).push(Math.abs(u)); (v >= 0 ? M.dp : M.dn).push(Math.abs(v)); }
  const tgt = {}; for (const k in M) if (M[k].length > 3 && Math.max(...M[k]) > 0.004) tgt[k] = Math.max(...M[k]);
  const pair=centerSilhouettePair(b,geomCache.get(b.id));
  if(pair&&(tgt[pair[0]]!=null||tgt[pair[1]]!=null))tgt[pair[0]]=tgt[pair[1]]=Math.max(tgt[pair[0]]||0,tgt[pair[1]]||0);
  const ks = Object.keys(tgt); if (!ks.length) return false; pushUndo(); const tw = S.sym && b.twin != null ? boneById(b.twin) : null, O = topoOf(b), Ot = tw && topoOf(tw);
  for (const k of ks) { const mxR = Math.max(...b[k].map(p => p.r)) || 0.01, f = tgt[k] / mxR; b[k] = b[k].map(p => p.k ? { t: p.t, r: r4(Math.max(0.004, p.r * f)), k: 1 } : { t: p.t, r: r4(Math.max(0.004, p.r * f)) }); }
  if(pair&&ks.includes(pair[0]))b[pair[1]]=clone(b[pair[0]]); b.av = 1; afterTopo(b, O, tw, Ot);
  rebuild(); save(); toast('断面で太さが決まった（' + ks.map(k => ({ wp: '幅＋', wn: '幅−', dp: '厚み＋', dn: '厚み−' })[k]).join('・') + '）'); return true; }
// ---- 細部：画面手前の点だけを表示・選択（他の骨に隠れた点も除く） ----
let vertexVisibilityCache={key:'',values:[]},geometryRevision=0;
function allVerts(){
  const key=geometryRevision+':'+cam.position.toArray().map(x=>x.toFixed(3)).join(',')+':'+cam.quaternion.toArray().map(x=>x.toFixed(3)).join(',');
  if(vertexVisibilityCache.key===key)return vertexVisibilityCache.values;
  const out=[],ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
  for(const m of meshes.children){
    const {id,mir}=m.userData,G=geomCache.get(id);if(!G)continue;
    for(let r=0;r<G.rings;r++)for(let k=0;k<G.n;k++){
      const o=(r*G.n+k)*3,P=new THREE.Vector3(mir?-G.V[o]:G.V[o],G.V[o+1],G.V[o+2]),sc=proj(P);
      if(!Number.isFinite(sc.x)||sc.z<=-1||sc.z>=1||sc.x < -20||sc.x>W+20||sc.y < -20||sc.y>H+20)continue;
      ndc.set(sc.x/W*2-1,1-sc.y/H*2);ray.setFromCamera(ndc,cam);
      const hit=ray.intersectObjects(meshes.children,false)[0],distance=ray.ray.origin.distanceTo(P);
      if(hit&&hit.distance<distance-Math.max(0.014,distance*0.003))continue;
      out.push({id,mir,r,k,P,s:sc,front:true});
    }
  }
  vertexVisibilityCache={key,values:out};return out;
}
const vKey = v => v.id + (v.mir ? 'm' : '') + ':' + v.r + '_' + v.k;
function selectAt(x, y, finger) {
  const R = finger ? 22 : 14, AV = allVerts(); let pick = [];
  if (elm === 'v') { let best = null, bd = R; for (const v of AV) { if (!v.front) continue; const d = Math.hypot(v.s.x - x, v.s.y - y); if (d < bd) { bd = d; best = v; } } if (best) pick = [best]; }
  else if (elm === 'e') { const map = new Map(AV.map(v => [vKey(v), v])); let best = null, bd = R;
    for (const a of AV) { if (!a.front) continue; const G = geomCache.get(a.id); for (const [r2, k2] of [[a.r, (a.k + 1) % G.n], [a.r + 1, a.k]]) { const b = map.get(a.id + (a.mir ? 'm' : '') + ':' + r2 + '_' + k2); if (!b || !b.front) continue;
      const dx = b.s.x - a.s.x, dy = b.s.y - a.s.y, t = Math.max(0, Math.min(1, ((x - a.s.x) * dx + (y - a.s.y) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a.s.x + dx * t - x, a.s.y + dy * t - y); if (d < bd) { bd = d; best = [a, b]; } } }
    if (best) pick = best; }
  else { const h = meshHit(x, y); if (h) { const { id, mir } = h.object.userData, G = geomCache.get(id), q = Math.floor(h.faceIndex / 2); if (q < (G.rings - 1) * G.n) { const r = Math.floor(q / G.n), k = q % G.n; pick = [[r, k], [r, (k + 1) % G.n], [r + 1, k], [r + 1, (k + 1) % G.n]].map(([r2, k2]) => ({ id, mir, r: r2, k: k2 })); } } }
  if (!pick.length) { if (!addMode) VSEL = []; needDraw = true; return false; }
  const P = pick.map(v => ({ id: v.id, mir: v.mir, r: v.r, k: v.k }));
  VSEL = editorInput.selection(VSEL,P,addMode,vKey); needDraw = true; return true; }
function loopSelect(axis='ring'){
  if(!VSEL.length){toast('先に点・線・面を選んでな');return;}
  const a=VSEL[0],G=geomCache.get(a.id);if(!G)return;
  const visible=new Set(allVerts().map(vKey)),out=[],seed=VSEL.filter(v=>v.id===a.id&&v.mir===a.mir);
  const indices=axis==='strip'?[...new Set(seed.map(v=>v.k))]:[...new Set(seed.map(v=>v.r))];
  for(const j of indices){
    if(axis==='strip')for(let r=0;r<G.rings;r++)out.push({id:a.id,mir:a.mir,r,k:j});
    else for(let k=0;k<G.n;k++)out.push({id:a.id,mir:a.mir,r:j,k});
  }
  VSEL=out.filter(v=>visible.has(vKey(v)));needDraw=true;
  toast(VSEL.length?(axis==='strip'?'見える縦の点を選んだ':'見える輪の点を選んだ'):'見える点がなかった');
}
// ---- 矢印（X・Y・Z）：骨・関節・形の点 ----
const AXES = [{ key: 'x', v: new THREE.Vector3(1, 0, 0), col: '#d23b3b', label: 'X' }, { key: 'y', v: new THREE.Vector3(0, 1, 0), col: '#2f9a4a', label: 'Y' }, { key: 'z', v: new THREE.Vector3(0, 0, 1), col: '#2f6fd0', label: 'Z' }];
function gizmoAnchor() {
  if (axisMode && mode === 'bone') return new THREE.Vector3(AX(), 0.9, 0);
  if (mode === 'shape' && VSEL.length) { const A = new THREE.Vector3(); let n = 0, visible=new Set(allVerts().map(vKey)); for (const v of VSEL) { if(!visible.has(vKey(v)))continue; const p = vPos(v.id, v.mir, v.r, v.k); if (p) { A.add(p); n++; } } return n ? A.multiplyScalar(1 / n) : null; }
  if (mode === 'bone' && sel != null) { const b = boneById(sel); if (!b) return null; if (selJ != null && b.pts[selJ]) return V3(b.pts[selJ]); const A = new THREE.Vector3(); let n = 0; for (const id of selBones()) { const c = boneById(id); if (!c) continue; c.pts.forEach(p => { A.add(V3(p)); n++; }); } return A.multiplyScalar(1 / Math.max(1, n)); }
  return null; }
function gizmoGeo() { const A = gizmoAnchor(); if (!A) return null; const sa = proj(A), b = proj(A.clone().add(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(0.01))), wpp = 0.01 / Math.max(1e-6, Math.hypot(b.x - sa.x, b.y - sa.y)), len = 70 * wpp;
  return { A, sa, len, axes: AXES.filter(a => !(axisMode && mode === 'bone') || a.key === 'x').map(a => { let e = proj(A.clone().addScaledVector(a.v, len)); const dx = e.x - sa.x, dy = e.y - sa.y, L = Math.hypot(dx, dy); if (L < 30) { const u = L > 2 ? [dx / L, dy / L] : [-0.7, -0.7]; e = { x: sa.x + u[0] * 55, y: sa.y + u[1] * 55 }; } return { ...a, e }; }) }; }
function gizmoHit(x, y, finger) { const g = gizmoGeo(); if (!g) return null; const R = finger ? 22 : 14; let best = null, bd = R; if (Math.hypot(x - g.sa.x, y - g.sa.y) < (finger ? 14 : 9)) return { g, a: { key: 'free' } };
  for (const a of g.axes) { const dx = a.e.x - g.sa.x, dy = a.e.y - g.sa.y, l2 = dx * dx + dy * dy || 1, t = Math.max(0.25, Math.min(1.2, ((x - g.sa.x) * dx + (y - g.sa.y) * dy) / l2)), d = Math.hypot(g.sa.x + dx * t - x, g.sa.y + dy * t - y); if (d < bd) { bd = d; best = { g, a }; } }
  if (!best && Math.hypot(x - g.sa.x, y - g.sa.y) < R) best = { g, a: { key: 'free' } }; return best; }
function moveBone(b, D, seen = new Set()) { if(S.tpl && mode!=='pose')return; if (seen.has(b.id)) return; seen.add(b.id); b.pts = b.pts.map(p => [p[0] + D.x, p[1] + D.y, p[2] + D.z].map(r4)); for (const c of S.bones) if (c.parent === b.id) moveBone(c, D, seen); }
const offOf = c => c.atOff ? V3(c.atOff) : new THREE.Vector3(); const jointPlus = (p, c) => { const v = V3(p).add(offOf(c)); return [v.x, v.y, v.z].map(r4); };
function updOff(c) { const p = c.parent != null && boneById(c.parent); if (!p || c.at == null || !p.pts[c.at]) { delete c.atOff; return; } const d = V3(c.pts[0]).sub(V3(p.pts[c.at])); if (d.length() < 0.002) delete c.atOff; else c.atOff = [d.x, d.y, d.z].map(r4); }
function syncChildren(b) { for (const c of S.bones) if (c.parent === b.id && c.at != null && b.pts[c.at]) { const d = V3(b.pts[c.at]).add(offOf(c)).sub(V3(c.pts[0])); if (d.lengthSq() > 1e-10) moveBone(c, d); } }
function startGizmo(e, hit) { if(mode==='bone'&&!skeletonEditable())return; if(mode==='shape'){const vis=new Set(allVerts().map(vKey));VSEL=VSEL.filter(v=>vis.has(vKey(v)));if(!VSEL.length)return;} const g = hit.g; let u = null, k = 1; if (hit.a.key !== 'free') { const dx = hit.a.e.x - g.sa.x, dy = hit.a.e.y - g.sa.y, L = Math.hypot(dx, dy) || 1; u = { x: dx / L, y: dy / L }; k = L / g.len; }
  st.drag = { kind: 'gizmo', id: e.pointerId, x: e.clientX, y: e.clientY, axis: hit.a, u, k, A: g.A.clone(), S0: clone(S), pushed: false }; }
function moveGizmo(e) { if(mode==='bone'&&!skeletonEditable())return; const d = st.drag, dx = e.clientX - d.x, dy = e.clientY - d.y; if (!d.pushed) { if (Math.hypot(dx, dy) < 3) return; pushUndo(); d.pushed = true; }
  let D; if (d.axis.key === 'free') { const v = d.A.clone().project(cam); D = new THREE.Vector3(v.x + dx / W * 2, v.y - dy / H * 2, v.z).unproject(cam).sub(d.A); }
  else D = d.axis.v.clone().multiplyScalar((dx * d.u.x + dy * d.u.y) / Math.max(1e-6, d.k));
  if (axisMode && mode === 'bone') { S = clone(d.S0); S.axis = r4((d.S0.axis || 0) + D.x); markSynced(); needDraw = true; save(); return; }
  S = clone(d.S0); markSynced(); // 毎回、つかんだ時の状態から動かす（ずれがたまらない）
  if (mode === 'bone') { const b = boneById(sel); if (!b) return; if (selJ == null) { const seen = new Set(); for (const id of selBones()) { const c = boneById(id); if (c) moveBone(c, D, seen); } for (const id of selBones()) { const c = boneById(id); if (c) updOff(c); } } else if (selJ != null) { const p = V3(b.pts[selJ]).add(D); b.pts[selJ] = [p.x, p.y, p.z].map(r4); if (S.sym && isCenter(b)) b.pts[selJ][0] = AX(); syncChildren(b); if (selJ === 0) updOff(b); } else moveBone(b, D); }
  else if (mode === 'shape') { const done = new Set();
    for (const v of VSEL) { const b = boneById(v.id), G = geomCache.get(v.id); if (!b || !G) continue; const f = G.F[v.r], Dl = v.mir ? new THREE.Vector3(-D.x, D.y, D.z) : D, key = v.r + '_' + v.k; if (done.has(v.id + ':' + key)) continue; done.add(v.id + ':' + key);
      const o = (b.off[key] || [0, 0, 0]).slice(); o[0] += Dl.dot(f.Wd); o[1] += Dl.dot(f.Dd); o[2] += Dl.dot(f.T); b.off[key] = o.map(r4);
      if (S.sym && isCenter(b)) { const k2 = mirK(b, v.k, G.n), key2 = v.r + '_' + k2; if (k2 !== v.k && !done.has(v.id + ':' + key2) && !VSEL.some(w => w.id === v.id && w.r === v.r && w.k === k2)) { const o2 = (b.off[key2] || [0, 0, 0]).slice(); o2[0] -= Dl.dot(f.Wd); o2[1] += Dl.dot(f.Dd); o2[2] += Dl.dot(f.T); b.off[key2] = o2.map(r4); done.add(v.id + ':' + key2); } } } }
  needRebuild = true; save(); }
// ---- ポーズ ----
function rotateFrom(b, i, q, pivot) { const rot = p => { const v = V3(p).sub(pivot).applyQuaternion(q).add(pivot); return [v.x, v.y, v.z].map(r4); };
  for (let j = i; j < b.pts.length; j++) b.pts[j] = rot(b.pts[j]); const kids = c => { for (const g of S.bones) if (g.parent === c.id) { g.pts = g.pts.map(rot); kids(g); } };
  for (const c of S.bones) if (c.parent === b.id && c.at != null && c.at >= i) { c.pts = c.pts.map(rot); kids(c); } }
// ---- 先っぽを引っぱる（IK）：骨の先っぽをつかんで動かすと、途中の関節が長さを保ったまま付いてくる ----
function tipHit(x, y, R) { const h = jointHit(x, y, R); if (!h || h.i !== h.b.pts.length - 1 || h.b.pts.length < 2) return null; return h; }
function fabrik(pts, T, iters = 12) { const n = pts.length, L = []; for (let i = 1; i < n; i++) L.push(pts[i].distanceTo(pts[i - 1])); const root = pts[0].clone(), tot = L.reduce((a, b) => a + b, 0);
  if (root.distanceTo(T) >= tot) { const d = T.clone().sub(root).normalize(); for (let i = 1; i < n; i++) pts[i] = pts[i - 1].clone().addScaledVector(d, L[i - 1]); return pts; }
  for (let it = 0; it < iters; it++) { pts[n - 1] = T.clone(); for (let i = n - 2; i >= 0; i--) pts[i] = pts[i + 1].clone().add(pts[i].clone().sub(pts[i + 1]).normalize().multiplyScalar(L[i]));
    pts[0] = root.clone(); for (let i = 1; i < n; i++) pts[i] = pts[i - 1].clone().add(pts[i].clone().sub(pts[i - 1]).normalize().multiplyScalar(L[i - 1])); if (pts[n - 1].distanceTo(T) < 1e-4) break; }
  return pts; }
// ---- 歩き・走りの後半＝前半の反転（右足の一歩を作れば、左足の一歩は自動） ----
const halfOf = A => A && A.loop && A.len % 2 === 0 ? A.len / 2 : null;
const inMirroredHalf = () => S.anim && S.anim.mirrorHalf && halfOf(S.anim) != null && ANIM.f >= halfOf(S.anim);
function mirrorPose(P) { const a2 = 2 * AX(), out = {};
  for (const b of S.bones) { const t = b.twin != null ? boneById(b.twin) : null, src = t && P[t.id] && P[t.id].length === (P[b.id] || b.pts).length ? P[t.id] : P[b.id]; if (src) out[b.id] = src.map(p => [r4(a2 - p[0]), p[1], p[2]]); }
  return out; }
function mirrorSeg(sg) { const o = clone(sg), a2 = 2 * AX(); if (sg.paths) { o.paths = {}; for (const k in sg.paths) { const [id, i] = k.split('_'), b = boneById(+id), t = b && b.twin != null ? b.twin : id; o.paths[t + '_' + i] = sg.paths[k].map(p => [r4(a2 - p[0]), p[1], p[2]]); } }
  if (sg.fix) { o.fix = {}; for (const j in sg.fix) o.fix[j] = mirrorPose(sg.fix[j]); } return o; }
function regenHalf() { const A = S.anim, h = halfOf(A); if (!A || !A.mirrorHalf || h == null) return; const K1 = A.keys.filter(k => k.f < h); if (!K1.length) return;
  const seg = {}; for (const k in A.seg || {}) if (+k < h) seg[k] = A.seg[k];
  const K2 = K1.map(k => ({ f: k.f + h, pose: mirrorPose(k.pose) })); for (const k of K1) if (A.seg && A.seg[k.f]) seg[k.f + h] = mirrorSeg(A.seg[k.f]);
  A.keys = [...K1, ...K2, ...A.keys.filter(k => k.f >= A.len)].sort((a, b) => a.f - b.f); A.seg = seg; trCache.key = ''; }
// ============ v6：アニメ＝原画＋軌道＋スライダーで割る・回転ギズモ・アクションライン ============
const ANIM = { f: 0, playing: false, last: 0, acc: 0 };
const snapshot = () => { const P = {}; for (const b of S.bones) P[b.id] = clone(b.pts); return P; };
function applyPose(P) { for (const b of S.bones) if (P[b.id] && P[b.id].length === b.pts.length) b.pts = clone(P[b.id]); markSynced(); }




// ---- 区間（原画→次の原画）：枚数・寄せ・軌道・中割りの手直し ----





// 軌道＝ベジェ：{a:アンカー, hi:入りハンドル, ho:出ハンドル}。両端は原画に自動で合わせる











function migrateAnim() { const A = S.anim; if (!A.seg) A.seg = {}; if (A.sp) { const st = A.step || 2;
    for (let i = 0; i < A.keys.length - 1; i++) { const a = A.keys[i], b = A.keys[i + 1], v = A.sp[a.f], s = segOf(a); s.n = Math.max(0, Math.ceil((b.f - a.f) / st) - 1);
      if (Array.isArray(v)) { s.sp = v; s.n = v.length; } else s.bias = { in: -0.7, out: 0.7 }[v] || 0; }
    delete A.sp; } delete A.step; }
// 工房・狩り場で共通：脚の前後ストロークと持ち上げ高さをお手本と比較する暫定歩行性能。

function enterAnim() { if (!S.rest) S.rest = snapshot(); if (!S.acts) { S.acts = [{ name: S.anim ? 'アニメ1' : '待機', slot: S.anim ? 'free' : 'idle', anim: null }]; S.actI = 0; if (!S.anim) S.anim = newAnim('idle'); } if (!S.anim) S.anim = newAnim('idle'); migrateAnim(); if (!S.anim.keys.length) S.anim.keys.push({ f: 0, pose: clone(S.rest) }); ANIM.f = Math.min(ANIM.f, S.anim.len); applyPose(poseAt(ANIM.f)); rebuild(); }
// ---- アクション枠（ゲームはこの名前で動きを呼ぶ） ----
const SLOTS = { idle: { name: '待機', len: 24, loop: true, guides: [[0, 'はじめ'], [12, '息を吸う']] }, walk: { name: '歩き', len: 16, loop: true, guides: [[0, '接地'], [4, '通過'], [8, '逆足で接地'], [12, '通過']] },
  notice: { name: '気づく', len: 12, loop: false, guides: [[0, 'ふだん'], [3, 'ハッ'], [8, 'ふり向く']] }, run: { name: '走る', len: 12, loop: true, guides: [[0, '接地'], [3, '通過'], [6, '逆足で接地'], [9, '通過']] }, flee: { name: '逃げる', len: 12, loop: true, guides: [[0, '踏み切り'], [3, '伸び'], [6, '着地'], [9, '縮み']] },
  threat: { name: '威嚇', len: 24, loop: false, guides: [[0, 'かまえ'], [6, '溜め'], [12, '威嚇！'], [24, '戻り']] },
  attack: { name: '攻撃', len: 16, loop: false, guides: [[0, 'かまえ'], [5, '溜め'], [8, '打つ！'], [16, '戻り']] },
  attack_fast: { name: '速い技', len: 10, loop: false, guides: [[0, '構え'], [2, '小さく溜め'], [4, '突き！'], [10, '戻り']] },
  jump: { name: 'ジャンプ', len: 14, loop: false, guides: [[0, '構え'], [5, '溜め'], [7, '踏み切り'], [14, '空中']] },
  flap: { name: '羽ばたき', len: 12, loop: false, guides: [[0, '振り上げ'], [6, '打ち下ろし'], [12, '戻り']] },
  glide: { name: '滑空', len: 24, loop: true, guides: [[0, '広げる']] },
  fall: { name: '落下', len: 12, loop: true, guides: [[0, '落ちる']] },
  land: { name: '着地', len: 10, loop: false, guides: [[0, '着地'], [3, '沈み'], [10, '戻り']] },
  swim: { name: '泳ぐ', len: 16, loop: true, guides: [[0, 'かく'], [8, '逆でかく']] } };
function newAnim(slot) { { const k = TPL.detect(S), A = k && TPL.animFor(k, slot, S.rest || snapshot(), S.bones); if (A) return A; } /* 設計図にお手本があればそれで始める */ const T = SLOTS[slot] || SLOTS.idle; return { len: T.len, loop: T.loop, guides: T.guides.map(([f, label]) => ({ f, label })), keys: [{ f: 0, pose: clone(S.rest || snapshot()) }], seg: {} }; }
function drawActSel() { const el = $('actSel'); if (!S.acts) return; const sig = JSON.stringify([S.acts.map(a => a.name), S.actI]); if (el.dataset.sig === sig) return; el.dataset.sig = sig; el.innerHTML = '';
  S.acts.forEach((a, i) => { const o = document.createElement('option'); o.value = 'a:' + i; o.textContent = (SLOTS[a.slot] ? '' : '・') + a.name; el.appendChild(o); });
  const tk = TPL.detect(S), tsl = new Set(tk ? TPL.slots(tk).map(x => x.slot) : []); for (const k in SLOTS) { const o = document.createElement('option'); o.value = 't:' + k; o.textContent = '＋' + SLOTS[k].name + 'を作る' + (tsl.has(k) ? '（お手本つき）' : ''); el.appendChild(o); } el.value = 'a:' + S.actI; }
function switchAct(i) { if (i === S.actI || !S.acts[i]) return; S.acts[S.actI].anim = S.anim; S.anim = S.acts[i].anim || newAnim(S.acts[i].slot); S.acts[i].anim = null; S.actI = i; migrateAnim(); ANIM.f = 0; ANIM.tsel = null; ANIM.playing = false; trCache.key = ''; applyPose(poseAt(0)); needRebuild = true; save(); drawTL(); }
function addAct(slot, base) { pushUndo(); const names = S.acts.map(a => a.name); let name = base ? base.name : SLOTS[slot].name, n = 2; const root = name; while (names.includes(name)) name = root + String.fromCharCode(64 + n++);
  S.acts.push({ name, slot, anim: base ? clone(base.anim) : newAnim(slot) }); switchAct(S.acts.length - 1); toast('「' + name + '」を作った'); }
document.getElementById('actSel').addEventListener('change', e => { const v = e.target.value; if (v.startsWith('a:')) switchAct(+v.slice(2)); else addAct(v.slice(2)); $('actSel').dataset.sig = ''; drawActSel(); });
document.getElementById('actDup').onclick = () => { const cur = S.acts[S.actI]; addAct(cur.slot, { name: cur.name, anim: S.anim }); };
let boneOnly = false; document.getElementById('boneOnly').onclick = () => { boneOnly = !boneOnly; meshes.visible = !boneOnly; document.getElementById('boneOnly').classList.toggle('on', boneOnly); };
function exitAnim() { if (ANIM.rec) ANIM.rec = null; ANIM.linkMode = false; boneOnly = false; meshes.visible = true; document.getElementById('boneOnly').classList.remove('on'); ANIM.playing = false; ANIM.traj = false; ANIM.tsel = null; if (S.rest) { applyPose(S.rest); delete S.rest; } rebuild(); }
function addKey(P) { const f = ANIM.f, { a } = segInfo(f); if (a && a.f !== f) { const s = segOf(a); s.fix = {}; } S.anim.keys.push({ f, pose: P }); S.anim.keys.sort((x, c) => x.f - c.f); }
function commitPose() { if (inMirroredHalf()) { toast('後半は前半の反転で自動。前半をいじってな'); gotoFrame(ANIM.f); return; } syncTwins(); const P = snapshot(), k = keyAt(ANIM.f);
  if (k) k.pose = P; else if ((S.anim.guides || []).some(g => g.f === ANIM.f)) addKey(P); /* ガイドのコマ＝原画 */ else { const { a, b } = segInfo(ANIM.f); if (a && b) { const j = drawIdx(a, b, ANIM.f); if (j === 0) a.pose = P; else segOf(a).fix[j] = P; } else addKey(P); }
  save(); drawTL(); }
function gotoFrame(f) { ANIM.f = Math.max(0, Math.min(S.anim.len, Math.round(f))); const { a } = segInfo(ANIM.f); if (ANIM.tsel && (!a || ANIM.tsel.a !== a.f)) ANIM.tsel = null; applyPose(poseAt(ANIM.f)); needRebuild = true; drawTL(); }
// ---- 回転ギズモ（関節を選ぶと、X・Y・Z の輪） ----
function rotIdx(b) { const last = b.pts.length - 1; return selJ === last && selJ > 0 && !S.bones.some(c => c.parent === b.id && c.at === last) ? selJ - 1 : selJ; } /* 先っぽは一つ手前で回す */
function rotPivot() { if ((mode !== 'pose' && !(mode === 'bone' && !S.tpl)) || sel == null || selJ == null) return null; const b = boneById(sel); if (!b || !b.pts[selJ]) return null; const G = jointGraph(), rs = rotSet(G, keyOfJoint(G, b, selJ)); return rs ? G.posVia(rs.pivot, rs.keys[0]) : null; }
function rotRings() { const C = rotPivot(); if (!C) return null; const sa = proj(C), b = proj(C.clone().add(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(0.01))), R = 62 * 0.01 / Math.max(1e-6, Math.hypot(b.x - sa.x, b.y - sa.y));
  return { C, sa, R, rings: AXES.map(a => { const u = Math.abs(a.v.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(a.v).normalize() : new THREE.Vector3(1, 0, 0), v = a.v.clone().cross(u).normalize(), pts = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2, P = C.clone().addScaledVector(u, Math.cos(t) * R).addScaledVector(v, Math.sin(t) * R); pts.push({ P, s: proj(P) }); } return { ...a, pts }; }) }; }
function rotHit(x, y, finger) { const G = rotRings(); if (!G) return null; const Rr = finger ? 20 : 12; let best = null, bd = Rr;
  for (const r of G.rings) for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i].s, c = r.pts[i + 1].s, dx = c.x - a.x, dy = c.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y); if (d < bd) { bd = d; best = { G, r, P: r.pts[i].P.clone().lerp(r.pts[i + 1].P, t) }; } }
  if (!best && Math.hypot(x - G.sa.x, y - G.sa.y) < (finger ? 22 : 14)) best = { G, center: true }; return best; }
function startRot(e, h) { const b = boneById(sel); if (h.center) { if (mode !== 'pose') return; st.drag = { kind: 'pose', id: e.pointerId, b, i: selJ, mir: selMir, P: h.G.C, rotCenter: true }; pushUndo(); return; }
  if (mode === 'bone' && !skeletonEditable()) return; const G = jointGraph(), rs = b && rotSet(G, keyOfJoint(G, b, selJ)); if (!rs) { toast(mode === 'bone' ? '腰は回されへん。腰の先の関節を選んでな' : '回せる所がない'); return; }
  const T3 = h.r.v.clone().cross(h.P.clone().sub(h.G.C)).normalize(), s0 = proj(h.P), s1 = proj(h.P.clone().addScaledVector(T3, h.G.R * 0.1)), tx = s1.x - s0.x, ty = s1.y - s0.y, L = Math.hypot(tx, ty) || 1;
  const live = G.bonesOf(rs.keys); if (mode === 'pose') { const lk = linkedIn(live); if (lk) { toast('この骨は「' + lk + '」の動きにつながってる。元の骨を動かしてな'); return; } }
  st.drag = { kind: 'rot', id: e.pointerId, x: e.clientX, y: e.clientY, axis: h.r.v.clone(), key: h.r.key, u: { x: tx / L, y: ty / L }, ppr: L / 0.1, G, pk: rs.pivot, piv0: G.pos(rs.pivot), orig: new Map(rs.keys.map(k => [k, G.pos(k)])), live, pushed: false }; st.drag.piv0 = G.posVia(rs.pivot, rs.keys[0]); st.drag.via = rs.keys[0]; }
function moveRot(e) { const d = st.drag; if (e) { d.lx = e.clientX; d.ly = e.clientY; } if (d.lx == null) return; const dx = d.lx - d.x, dy = d.ly - d.y; if (!d.pushed) { if (Math.hypot(dx, dy) < 3) return; if (!ANIM.rec) pushUndo(); d.pushed = true; }
  const ang = (dx * d.u.x + dy * d.u.y) / Math.max(1e-6, d.ppr), q = new THREE.Quaternion().setFromAxisAngle(d.axis, ang), pv = d.G.posVia(d.pk, d.via);
  for (const [k, P] of d.orig) d.G.set(k, pv.clone().add(P.clone().sub(d.piv0).applyQuaternion(q))); needRebuild = true; if (mode === 'bone') save(); }
// ---- アクションライン：線を描くと、その線に骨の並びが沿う ----
function chainFrom(b, i) { const nodes = []; let cur = b, idx = i, guard = 0;
  while (cur && guard++ < 20) { for (let k = idx; k < cur.pts.length; k++) nodes.push({ b: cur, i: k }); const last = cur.pts.length - 1, kid = S.bones.find(c => c.parent === cur.id && c.at === last); if (!kid) break; cur = kid; idx = 1; }
  return nodes; }
function actionLine(stk) {
  const pick = pts => { const s0 = pts[0]; let k = 1; while (k < pts.length - 1 && Math.hypot(pts[k].x - s0.x, pts[k].y - s0.y) < 25) k++; const dv = { x: pts[k].x - s0.x, y: pts[k].y - s0.y }, dl = Math.hypot(dv.x, dv.y) || 1; let best = null, bs = 0.2;
    for (const b of S.bones) b.pts.forEach((p, i) => { const q = proj(V3(p)), dist = Math.hypot(q.x - s0.x, q.y - s0.y); if (dist > 26) return; const nodes = chainFrom(b, i); if (nodes.length < 2) return; const q1 = proj(V3(nodes[1].b.pts[nodes[1].i])), L = Math.hypot(q1.x - q.x, q1.y - q.y) || 1, sc = ((q1.x - q.x) * dv.x + (q1.y - q.y) * dv.y) / (L * dl) - dist / 40; if (sc > bs) { bs = sc; best = { b, i, sc }; } });
    return best; };
  let pts = stk.pts, h = pick(pts); const rp = pts.slice().reverse(), h2 = pick(rp); if (h2 && (!h || h2.sc > h.sc)) { h = h2; pts = rp; } /* 先っぽから描いても、根元から描いたことにする */
  if (!h) { const bh = boneHit(pts[0].x, pts[0].y, 40); if (bh) h = { b: bh.b, i: 0 }; } if (!h) { toast('骨の関節の近くから描いてな'); return false; }
  const nodes = chainFrom(h.b, h.i); if (nodes.length < 2) return false;
  const P0 = V3(nodes[0].b.pts[nodes[0].i]), N = planeN(), W3 = pts.map(q => unprojectOnPlane(q.x, q.y, P0, N)).filter(Boolean); if (W3.length < 2) return false;
  const off = P0.clone().sub(W3[0]); W3.forEach(p => p.add(off)); const acc = [0]; for (let i = 1; i < W3.length; i++) acc.push(acc[i - 1] + W3[i].distanceTo(W3[i - 1]));
  const at = s => { if (s >= acc[acc.length - 1]) { const n = W3.length, dir = W3[n - 1].clone().sub(W3[Math.max(0, n - 4)]).normalize(); return W3[n - 1].clone().addScaledVector(dir, s - acc[n - 1]); } let j = 0; while (j < acc.length - 2 && acc[j + 1] < s) j++; return W3[j].clone().lerp(W3[j + 1], (s - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j])); };
  pushUndo(); const L0 = []; for (let n = 1; n < nodes.length; n++) L0.push(V3(nodes[n - 1].b.pts[nodes[n - 1].i]).distanceTo(V3(nodes[n].b.pts[nodes[n].i]))); let s = 0;
  for (let n = 1; n < nodes.length; n++) { const nd = nodes[n]; s += L0[n - 1]; const P = at(s); nd.b.pts[nd.i] = [P.x, P.y, P.z].map(r4);
    if (nd.i === nd.b.pts.length - 1) for (const k of S.bones) if (k.parent === nd.b.id && k.at === nd.i) k.pts[0] = jointPlus(nd.b.pts[nd.i], k); }
  for (const b of new Set(nodes.map(n => n.b))) syncChildren(b); sel = h.b.id; needRebuild = true; return true; }
// ---- 選び方 ----
function descIds(id) { const out = []; const rec = i => { for (const c of S.bones) if (c.parent === i && !out.includes(c.id)) { out.push(c.id); rec(c.id); } }; rec(id); return out; }
const depthOf = b => { let d = 0, c = b; while (c && c.parent != null && d < 99) { c = boneById(c.parent); d++; } return d; };
function setSel(ids) { const L = ids.map(boneById).filter(Boolean); if (!L.length) { sel = null; SELB = []; return; } L.sort((a, c) => depthOf(a) - depthOf(c)); sel = L[0].id; SELB = L.slice(1).map(b => b.id); }
function pipS(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
function lassoSelect(stk) { lassoMode = false; const poly = stk.pts, hit = [];
  if (poly.length > 4) for (const b of S.bones) { const P = b.pts.map(p => proj(V3(p))); let n = 0; P.forEach(q => { if (pipS(poly, q.x, q.y)) n++; }); for (let i = 0; i < P.length - 1; i++) if (pipS(poly, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2)) n++; if (n * 2 >= P.length * 2 - 1) hit.push(b.id); }
  if (!hit.length) { toast('囲んだ中に骨がなかった'); updBtns(); return; }
  if (addMode && sel != null) setSel([...new Set([sel, ...SELB, ...hit])]); else setSel(hit); selJ = null; updBtns(); toast(hit.length + '本えらんだ' + (mode === 'pose' ? '→流れを描いてな' : '')); }
// ---- 流れ：選んだ骨のつながりを、描いた線に沿わせる（カクッと曲げた角に、骨のつなぎ目が吸い付く） ----
function flowSel(stk) { const set = new Set([sel, ...SELB]), bs = [...set].map(boneById).filter(Boolean); if (!bs.length) return false;
  const roots = bs.filter(b => b.parent == null || !set.has(b.parent)); roots.sort((a, c) => depthOf(a) - depthOf(c));
  const lenR = (b, a, z) => { let L = 0; for (let i = a + 1; i <= z; i++) L += V3(b.pts[i]).distanceTo(V3(b.pts[i - 1])); return L; };
  const best = (b, from) => { let res = { list: [{ b, from, to: b.pts.length - 1 }], len: lenR(b, from, b.pts.length - 1) };
    for (const k of bs) { if (k.parent !== b.id || k.at == null || k.at < from || k === b) continue; const sub = best(k, 1), L = lenR(b, from, k.at) + sub.len; if (L > res.len) res = { list: [{ b, from, to: k.at }, ...sub.list], len: L }; }
    return res; };
  let segs = null, bl = -1; for (const r of roots) { const p = best(r, 0); if (p.len > bl) { bl = p.len; segs = p.list; } }
  const path = segs.map(g => g.b), nodes = []; segs.forEach((g, k) => { for (let i = k ? 1 : g.from; i <= g.to; i++) nodes.push({ b: g.b, i, junc: k < segs.length - 1 && i === g.to }); }); if (nodes.length < 2) return false;
  const old = new Map(path.map(b => [b.id, b.pts.map(V3)]));
  const root = path[0], P0 = V3(root.pts[0]), sr = proj(P0); let pts = stk.pts; const d0 = Math.hypot(pts[0].x - sr.x, pts[0].y - sr.y), d1 = Math.hypot(pts[pts.length - 1].x - sr.x, pts[pts.length - 1].y - sr.y); if (d1 < d0) pts = pts.slice().reverse(); /* 根元に近い方が始まり */
  const N = planeN(), W3 = pts.map(q => unprojectOnPlane(q.x, q.y, P0, N)).filter(Boolean); if (W3.length < 2) return false;
  if (root.parent != null) { const off = P0.clone().sub(W3[0]); W3.forEach(p => p.add(off)); } /* 親につながってる→根元は動かさない／親なし→線の始まりへ移動 */
  const acc = [0]; for (let i = 1; i < W3.length; i++) acc.push(acc[i - 1] + W3[i].distanceTo(W3[i - 1])); const Ltot = acc[acc.length - 1];
  const at = s => { if (s >= Ltot) { const n = W3.length, dir = W3[n - 1].clone().sub(W3[Math.max(0, n - 4)]).normalize(); return W3[n - 1].clone().addScaledVector(dir, s - Ltot); } let j = 0; while (j < acc.length - 2 && acc[j + 1] < s) j++; return W3[j].clone().lerp(W3[j + 1], (s - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j])); };
  // 角を探す（画面上で 35°以上曲がった所）
  const ix = rdpIdx(pts, 9), corners = []; for (let k = 1; k < ix.length - 1; k++) { const a = pts[ix[k - 1]], b = pts[ix[k]], c = pts[ix[k + 1]], v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: c.x - b.x, y: c.y - b.y }, cs = (v1.x * v2.x + v1.y * v2.y) / ((Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)) || 1); if (cs < Math.cos(35 * Math.PI / 180) && ix[k] < W3.length) corners.push(acc[ix[k]]); }
  const L0 = [0]; for (let n = 1; n < nodes.length; n++) L0.push(L0[n - 1] + V3(nodes[n - 1].b.pts[nodes[n - 1].i]).distanceTo(V3(nodes[n].b.pts[nodes[n].i])));
  const anch = [{ n: 0, s: 0 }], jn = nodes.map((d, n) => n > 0 && n < nodes.length - 1 ? n : -1).filter(n => n > 0); /* 膝でも足首でも、全部の関節が角に吸い付く */ let lastJ = -1;
  for (const cs of corners) { let bj = -1, bd = Infinity; for (const n of jn) { if (n <= lastJ) continue; const d = Math.abs(L0[n] * (Ltot / Math.max(1e-6, L0[L0.length - 1])) - cs); if (d < bd) { bd = d; bj = n; } } if (bj > 0 && bd < Ltot * 0.35) { anch.push({ n: bj, s: cs }); lastJ = bj; } }
  const tgt = n => { let a = anch[0], b = null; for (const x of anch) { if (x.n <= n) a = x; else { b = x; break; } } if (a.n === n) return at(a.s); if (b) return at(a.s + (b.s - a.s) * (L0[n] - L0[a.n]) / Math.max(1e-9, L0[b.n] - L0[a.n])); return at(a.s + (L0[n] - L0[a.n])); };
  pushUndo(); if (root.parent == null) { const D = W3[0].clone().sub(V3(root.pts[0])); moveBone(root, D); }
  for (let n = 1; n < nodes.length; n++) { const nd = nodes[n], pv = V3(nodes[n - 1].b.pts[nodes[n - 1].i]), len = L0[n] - L0[n - 1], dir = tgt(n).sub(pv); if (dir.lengthSq() < 1e-12) continue; const P = pv.clone().addScaledVector(dir.normalize(), len); /* 長さはそのまま、向きだけ合わせる */
    nd.b.pts[nd.i] = [P.x, P.y, P.z].map(r4); if (nd.junc) { const nx = nodes[n + 1]; if (nx) nx.b.pts[0] = jointPlus(nd.b.pts[nd.i], nx.b); } }
  segs.forEach(g => { if (g.to < g.b.pts.length - 1 && g.to > 0) { const o = old.get(g.b.id), q = new THREE.Quaternion().setFromUnitVectors(o[g.to].clone().sub(o[g.to - 1]).normalize(), V3(g.b.pts[g.to]).sub(V3(g.b.pts[g.to - 1])).normalize()), J = V3(g.b.pts[g.to]);
    for (let i = g.to + 1; i < g.b.pts.length; i++) { const v = J.clone().add(o[i].clone().sub(o[g.to]).applyQuaternion(q)); g.b.pts[i] = [v.x, v.y, v.z].map(r4); } } }); /* 途中から分かれた残りの関節は、そのままの形でついてくる */
  for (const b of path) syncChildren(b); needRebuild = true; return true; }
// ---- 軌道：最初から見えてる。変なとこだけ描き直す／点を動かす ----
function trackKeys(extra) { const out = new Set(); for (const b of S.bones) { if (b.parent == null) out.add(b.id + '_0'); const last = b.pts.length - 1; if (!S.bones.some(c => c.parent === b.id && c.at === last)) out.add(b.id + '_' + last); } for (const k of extra || []) out.add(k); return [...out]; }
let trCache = { key: '', v: null };
function tracks() { const { a, b } = segInfo(ANIM.f); if (!a || !b) return null; const s = segOf(a), ck = a.f + '|' + b.f + '|' + JSON.stringify(a.pose) + JSON.stringify(b.pose) + JSON.stringify(s) + nOf(a, b);
  if (trCache.key === ck) return trCache.v; const keys = trackKeys(Object.keys(s.paths)), list = keys.map(k => ({ k, pts: [], bad: [], ticks: [], custom: !!s.paths[k] })), at = (P, k) => { const [id, i] = k.split('_').map(Number); return P[id] && P[id][i] ? V3(P[id][i]) : null; };
  for (let m = 0; m <= 48; m++) { const u = m / 48, P = poseU(a, b, u); for (const t of list) { const p = at(P, t.k); if (!p) continue; t.pts.push(p); let bad = false; if (t.custom) { const [id, i] = t.k.split('_').map(Number); if (a.pose[id] && b.pose[id]) bad = evalPath(s.paths[t.k], u, V3(a.pose[id][i]), V3(b.pose[id][i])).distanceTo(p) > 0.015; } t.bad.push(bad); } }
  for (const u of spacingOf(a, b)) { const P = poseU(a, b, u); for (const t of list) { const p = at(P, t.k); if (p) t.ticks.push(p); } }
  trCache = { key: ck, v: { a, b, list: list.filter(t => t.pts.length > 1 && t.pts[0].distanceTo(t.pts[t.pts.length - 1]) + t.pts[24].distanceTo(t.pts[0]) > 0.003 || t.custom) } }; return trCache.v; }
function drawTraj() { const T = tracks(); if (!T) return; const on = ANIM.traj, s = segOf(T.a);
  for (const t of T.list) { const sel = ANIM.tsel && ANIM.tsel.k === t.k, sc = t.pts.map(proj); og.setLineDash(t.custom ? [] : [5, 5]); og.lineCap = 'round';
    for (let i = 0; i < sc.length - 1; i++) { og.strokeStyle = t.bad[i] ? 'rgba(210,50,50,.9)' : t.custom ? (sel ? 'rgba(138,79,208,1)' : 'rgba(138,79,208,.8)') : on ? 'rgba(138,79,208,.6)' : 'rgba(138,79,208,.3)'; og.lineWidth = sel ? 4 : t.custom ? 2.5 : 1.5; og.beginPath(); og.moveTo(sc[i].x, sc[i].y); og.lineTo(sc[i + 1].x, sc[i + 1].y); og.stroke(); }
    og.setLineDash([]); if (on || t.custom) for (const p of t.ticks) { const q = proj(p); og.fillStyle = '#2f6fd0'; og.strokeStyle = '#fff'; og.lineWidth = 1.5; og.beginPath(); og.arc(q.x, q.y, on ? 5 : 3, 0, 7); og.fill(); if (on) og.stroke(); } }
  const sb = selBez(); if (sb) { const B = sb.B, n = B.a.length; og.strokeStyle = 'rgba(138,79,208,.55)'; og.lineWidth = 2; og.setLineDash([2, 4]); og.beginPath(); bezSample(B, 30).forEach((P, i) => { const q = proj(P); i ? og.lineTo(q.x, q.y) : og.moveTo(q.x, q.y); }); og.stroke(); og.setLineDash([]); /* ベジェそのもの（骨が届かんとこはずれて見える） */
    for (let i = 0; i < n; i++) { const A = proj(B.a[i]); for (const w of ['hi', 'ho']) { if ((w === 'hi' && i === 0) || (w === 'ho' && i === n - 1)) continue; const h = proj(B[w][i]); og.strokeStyle = 'rgba(138,79,208,.7)'; og.lineWidth = 1.5; og.beginPath(); og.moveTo(A.x, A.y); og.lineTo(h.x, h.y); og.stroke(); og.fillStyle = '#8a4fd0'; og.fillRect(h.x - 5, h.y - 5, 10, 10); }
      const end = i === 0 || i === n - 1; og.fillStyle = end ? '#ddd' : '#fff'; og.strokeStyle = '#8a4fd0'; og.lineWidth = 2; og.beginPath(); og.arc(A.x, A.y, end ? 4 : 7, 0, 7); og.fill(); og.stroke(); } }
  og.setLineDash([]); }
function nearTrack(x, y, R) { const T = tracks(); if (!T) return null; let best = null, bd = R; for (const t of T.list) { const sc = t.pts.map(proj); for (let i = 0; i < sc.length - 1; i++) { const a = sc[i], c = sc[i + 1], dx = c.x - a.x, dy = c.y - a.y, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a.x + dx * u - x, a.y + dy * u - y); if (d < bd) { bd = d; best = t; } } } return best; }
function selBez() { const { a, b } = segInfo(ANIM.f); if (!a || !b || !ANIM.tsel) return null; const p = segOf(a).paths[ANIM.tsel.k]; if (!p) return null; const [id, i] = ANIM.tsel.k.split('_').map(Number); if (!a.pose[id] || !b.pose[id] || !a.pose[id][i]) return null; return { a, b, k: ANIM.tsel.k, B: bezBake(p, V3(a.pose[id][i]), V3(b.pose[id][i])) }; }
let lastAnc = { t: 0, i: -1 };
function trajDown(e, x, y) { const { a, b } = segInfo(ANIM.f); if (!a || !b) { toast('原画と原画の「間」のコマで使ってな'); return; }
  const sb = selBez(); if(e.pointerType==='mouse'&&!sb){toast('右クリックで軌道を選んでな');return;} if (sb) { const B = sb.B, n = B.a.length; let best = null, bd = 14;
    for (let i = 0; i < n; i++) for (const w of ['a', 'hi', 'ho']) { if ((w === 'a' && (i === 0 || i === n - 1)) || (w === 'hi' && i === 0) || (w === 'ho' && i === n - 1)) continue; const q = proj(B[w][i]), d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = [w, i]; } }
    if (best) { const now = performance.now(), [w, i] = best;
      if (w === 'a' && lastAnc.i === i && now - lastAnc.t < 330) { pushUndo(); B.a.splice(i, 1); B.hi.splice(i, 1); B.ho.splice(i, 1); segOf(a).paths[sb.k] = bezStore(B); lastAnc.t = 0; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); toast('点を消した'); return; } // ダブルタップで点を消す
      lastAnc = { t: now, i: w === 'a' ? i : -1 }; pushUndo(); segOf(a).paths[sb.k] = bezStore(B); st.drag = { kind: 'tpt', id: e.pointerId, k: sb.k, w, i, P: B[w][i].clone() }; return; } }
  const T = tracks(); if (T) { let bt = null, bd = 12; for (const t of T.list.filter(t=>e.pointerType!=='mouse'||(ANIM.tsel&&t.k===ANIM.tsel.k))) t.ticks.forEach((p, j) => { const q = proj(p), d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; bt = { k: t.k, j }; } });
    if (bt) { pushUndo(); segOf(a).sp = spacingOf(a, b).slice(); st.drag = { kind: 'ttick', id: e.pointerId, ...bt }; return; } }
  if (sb) { for (const P of bezSample(sb.B, 30)) { const q = proj(P); if (Math.hypot(q.x - x, q.y - y) < 20) { st.drag = { kind: 'tcurve', id: e.pointerId, x, y, k: sb.k }; return; } } } /* 選んでるベジェの線の上 */
  if(e.pointerType==='mouse')return; const t = nearTrack(x, y, 24); st.drag = { kind: 'tcurve', id: e.pointerId, x, y, k: t ? t.k : null }; }
function trajMovePt(d, x, y) { const { a } = segInfo(ANIM.f); if (!a) return; const p = segOf(a).paths[d.k]; if (!p) return; const P = unprojectOnPlane(x, y, d.P, planeN()); if (!P) return; const B = bezNorm(p), n = B.a.length;
  if (d.w === 'a') { const D = P.clone().sub(B.a[d.i]); B.a[d.i].add(D); B.hi[d.i].add(D); B.ho[d.i].add(D); }
  else { B[d.w][d.i] = P; const o = d.w === 'hi' ? 'ho' : 'hi'; if ((o === 'ho' && d.i < n - 1) || (o === 'hi' && d.i > 0)) { const A = B.a[d.i], L = B[o][d.i].distanceTo(A), dir = A.clone().sub(P); if (dir.lengthSq() > 1e-10) B[o][d.i] = A.clone().add(dir.setLength(L)); } } // 反対のハンドルも一直線に
  segOf(a).paths[d.k] = bezStore(B); applyPose(poseAt(ANIM.f)); needRebuild = true; save(); }
function trajMoveTick(d, x, y) { const T = tracks(), t = T && T.list.find(q => q.k === d.k); if (!t) return; const sc = t.pts.map(proj); let bu = 0, bd = 1e9;
  for (let i = 0; i < sc.length - 1; i++) { const a = sc[i], c = sc[i + 1], dx = c.x - a.x, dy = c.y - a.y, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1))), dd = Math.hypot(a.x + dx * u - x, a.y + dy * u - y); if (dd < bd) { bd = dd; bu = (i + u) / (sc.length - 1); } }
  const sp = segOf(T.a).sp; if (!Array.isArray(sp)) return; const lo = d.j > 0 ? sp[d.j - 1] + 0.01 : 0.01, hi = d.j < sp.length - 1 ? sp[d.j + 1] - 0.01 : 0.99; sp[d.j] = r4(Math.max(lo, Math.min(hi, bu))); applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); }
function trajTap(d) { const T = tracks(); if (!T || !d.k) { ANIM.tsel = null; needDraw = true; drawTL(); return; } const s = segOf(T.a);
  if (ANIM.tsel && ANIM.tsel.k === d.k && s.paths[d.k]) { const sb = selBez(); if (!sb) return; const B = sb.B, n = B.a.length; let best = null, bd = 24; // 線の上をタップ＝点を足す
    for (let i = 0; i < n - 1; i++) for (let m = 1; m < 30; m++) { const q = proj(cubicAt(B, i, m / 30)), dd = Math.hypot(q.x - d.x, q.y - d.y); if (dd < bd) { bd = dd; best = [i, m / 30]; } }
    if (best) { const [i, t] = best, L = (p, q) => p.clone().lerp(q, t), p01 = L(B.a[i], B.ho[i]), p12 = L(B.ho[i], B.hi[i + 1]), p23 = L(B.hi[i + 1], B.a[i + 1]), p012 = L(p01, p12), p123 = L(p12, p23), P = L(p012, p123);
      pushUndo(); B.ho[i] = p01; B.hi[i + 1] = p23; B.a.splice(i + 1, 0, P); B.hi.splice(i + 1, 0, p012); B.ho.splice(i + 1, 0, p123); s.paths[d.k] = bezStore(B); save(); toast('点を足した（ダブルタップで消す）'); needDraw = true; } return; }
  if (!s.paths[d.k]) { const t = T.list.find(q => q.k === d.k); if (!t) return; const P = t.pts, N = P.length - 1, P0 = P[0], P3 = P[N], Q1 = P[Math.round(N / 3)], Q2 = P[Math.round(2 * N / 3)]; // 自動の軌道をそのままベジェに
    const C1 = P0.clone().multiplyScalar(-5).addScaledVector(Q1, 18).addScaledVector(Q2, -9).addScaledVector(P3, 2).multiplyScalar(1 / 6), C2 = P0.clone().multiplyScalar(2).addScaledVector(Q1, -9).addScaledVector(Q2, 18).addScaledVector(P3, -5).multiplyScalar(1 / 6);
    pushUndo(); s.paths[d.k] = bezStore({ a: [P0, P3], hi: [P0.clone(), C2], ho: [C1, P3.clone()] }); save(); }
  ANIM.tsel = { a: T.a.f, k: d.k }; toast('□ハンドルで形／線をタップで点を足す／青い点をすべらせてツメ'); needDraw = true; drawTL(); }
// ---- タイムライン ----
const tl = document.getElementById('tl'), tlc = document.getElementById('tlc'), tg = tlc.getContext('2d');
function tlLayout() { const r = tlc.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); tlc.width = r.width * d; tlc.height = r.height * d; tg.setTransform(d, 0, 0, d, 0, 0); }
const TL = { x0: 18, w: () => tlc.getBoundingClientRect().width - 36 };
const fx = f => TL.x0 + f / S.anim.len * TL.w();
const $ = id => document.getElementById(id);
function drawTL() { syncSize(); if (mode !== 'pose' || !S.anim) return; const r = tlc.getBoundingClientRect(), Wt = r.width, Ht = r.height; tg.clearRect(0, 0, Wt, Ht);
  const A = S.anim, { a, b } = segInfo(ANIM.f); { const hb = document.getElementById('halfBtn'); hb.classList.toggle('on', !!A.mirrorHalf); hb.style.display = A.loop ? '' : 'none'; }
  if (A.mirrorHalf && halfOf(A) != null) { const xh = fx(halfOf(A)), xe = fx(A.len); tg.fillStyle = 'rgba(47,111,208,.10)'; tg.fillRect(xh, 2, xe - xh, Ht - 4); tg.fillStyle = '#2f6fd0'; tg.font = '800 9px sans-serif'; tg.textAlign = 'left'; tg.fillText('↔ 反転で自動', xh + 3, Ht - 4); }
  if (a && b) { const xa = fx(a.f), xb = fx(b.f), y = 14, sp = spacingOf(a, b); tg.fillStyle = 'rgba(138,79,208,.08)'; tg.fillRect(xa, 2, xb - xa, Ht - 4); tg.strokeStyle = '#2b2a27'; tg.lineWidth = 2; tg.beginPath(); tg.moveTo(xa, y); tg.lineTo(xb, y); tg.stroke();
    for (const x of [xa, xb]) { tg.beginPath(); tg.moveTo(x, y - 8); tg.lineTo(x, y + 8); tg.stroke(); }
    sp.forEach(u => { const x = xa + (xb - xa) * u; tg.strokeStyle = '#2f6fd0'; tg.lineWidth = 3; tg.beginPath(); tg.moveTo(x, y - 6); tg.lineTo(x, y + 6); tg.stroke(); }); }
  const yb = 44; tg.fillStyle = 'rgba(0,0,0,.06)'; tg.fillRect(TL.x0, yb - 10, TL.w(), 24);
  for (let f = 0; f <= A.len; f++) { const x = fx(f); tg.strokeStyle = f % 12 === 0 ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.15)'; tg.lineWidth = 1; tg.beginPath(); tg.moveTo(x, yb - 10); tg.lineTo(x, f % 6 === 0 ? yb + 14 : yb - 3); tg.stroke();
    if (f % 12 === 0) { tg.fillStyle = '#6d685f'; tg.font = '700 10px sans-serif'; tg.textAlign = 'center'; tg.fillText(f, x, yb + 25); } }
  const KK = A.loop && A.keys.length ? [...A.keys, { f: A.len, pose: A.keys[0].pose }] : A.keys;
  for (const g of A.guides || []) { const x = fx(g.f); tg.strokeStyle = 'rgba(138,79,208,.5)'; tg.setLineDash([3, 3]); tg.beginPath(); tg.moveTo(x, yb - 10); tg.lineTo(x, yb + 14); tg.stroke(); tg.setLineDash([]); tg.fillStyle = '#8a4fd0'; tg.font = '800 9px sans-serif'; tg.textAlign = 'left'; tg.fillText(g.label, x + 2, 31); } /* テンプレの原画ガイド */
  if (A.loop) { const x = fx(A.len); tg.fillStyle = 'rgba(217,87,43,.35)'; tg.beginPath(); tg.moveTo(x, yb - 6); tg.lineTo(x + 7, yb + 2); tg.lineTo(x, yb + 10); tg.lineTo(x - 7, yb + 2); tg.closePath(); tg.fill(); }
  for (let i = 0; i < KK.length - 1; i++) { const ka = KK[i], kb = KK[i + 1], fix = segOf(ka).fix; drawFrames(ka, kb).forEach((f, j) => { tg.fillStyle = fix[j + 1] ? '#2f9a4a' : '#2f6fd0'; tg.beginPath(); tg.arc(fx(f), yb + 2, fix[j + 1] ? 4 : 3, 0, 7); tg.fill(); }); }
  for (const k of A.keys) { const x = fx(k.f); tg.fillStyle = '#d9572b'; tg.beginPath(); tg.moveTo(x, yb - 6); tg.lineTo(x + 7, yb + 2); tg.lineTo(x, yb + 10); tg.lineTo(x - 7, yb + 2); tg.closePath(); tg.fill(); }
  { const I = perfInfo(); if (I) { tg.fillStyle = 'rgba(192,57,43,.12)'; tg.fillRect(TL.x0, yb + 12, TL.w(), 5); for (const f of I.marks) { const x = fx(f); tg.fillStyle = '#e0a020'; tg.beginPath(); tg.moveTo(x - 5, yb - 18); tg.lineTo(x + 5, yb - 18); tg.lineTo(x, yb - 11); tg.closePath(); tg.fill(); } } } /* 記録あり＝赤い帯、黄色の▼＝原画の候補（止まる・折り返す） */
  const xp = fx(ANIM.f); tg.strokeStyle = '#c0392b'; tg.lineWidth = 2; tg.beginPath(); tg.moveTo(xp, yb - 12); tg.lineTo(xp, yb + 16); tg.stroke();
  // ラベル・スライダー
  let fl = ANIM.f + ' / ' + A.len + (A.loop ? ' 🔁' : ''); if (keyAt(ANIM.f)) fl += '（原画）'; else if (a && b) { const j = drawIdx(a, b, ANIM.f); if (j) fl += '（中割り' + j + (segOf(a).fix[j] ? '・手直し' : '') + '）'; } $('frameLbl').textContent = fl;
  $('lenBtn').textContent = '長さ ' + A.len; drawActSel(); $('playBtn').textContent = ANIM.playing ? '■ 止める' : '▶ 再生'; $('trajBtn').classList.toggle('on', !!ANIM.traj);
  const has = !!(a && b); $('segRow').style.opacity = has ? 1 : 0.4; $('nSl').disabled = $('bSl').disabled = !has;
  if (has) { const n = nOf(a, b), s = segOf(a), L = b.f - a.f; $('nSl').max = Math.max(0, L - 1); if (document.activeElement !== $('nSl')) $('nSl').value = n; if (document.activeElement !== $('bSl')) $('bSl').value = Math.round((s.bias || 0) * 100);
    $('nLbl').textContent = n + '枚' + (n ? '（≈' + (Math.round(L / (n + 1) * 10) / 10) + 'コマ打ち）' : '（止め絵のまま）'); const bv = s.bias || 0; $('bLbl').textContent = Array.isArray(s.sp) && s.sp.length === n ? '手でずらした' : bv < -0.15 ? '先ツメ' : bv > 0.15 ? '後ツメ' : '均等'; }
  else { $('nLbl').textContent = '原画の間で使える'; $('bLbl').textContent = ''; }
  try { updRec(); } catch (_) {}
  $('fixDel').style.display = has && segOf(a).fix[drawIdx(a, b, ANIM.f)] && drawIdx(a, b, ANIM.f) ? '' : 'none'; $('trajDel').style.display = ANIM.tsel && has && segOf(a).paths[ANIM.tsel.k] ? '' : 'none'; try { updTpl(); } catch (_) {} }
let tlDrag = null;
tlc.addEventListener('pointerdown', e => { e.preventDefault(); if(editorInput.intent(e)!=='primary')return; try { tlc.setPointerCapture(e.pointerId); } catch (_) {} const r = tlc.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, { a, b } = segInfo(ANIM.f);
  if (y < 26 && a && b) { const sp = spacingOf(a, b), xa = fx(a.f), xb = fx(b.f); let bj = -1, bd = 16; sp.forEach((u, j) => { const d = Math.abs(xa + (xb - xa) * u - x); if (d < bd) { bd = d; bj = j; } });
    if (bj >= 0) { pushUndo(); segOf(a).sp = sp.slice(); tlDrag = { kind: 'sp', j: bj, a, b }; return; } }
  if (y >= 28) { let bk = null, bd = 11; for (const k of S.anim.keys) { const d = Math.abs(fx(k.f) - x); if (k.f > 0 && d < bd) { bd = d; bk = k; } } if (bk) { pushUndo(); ANIM.playing = false; tlDrag = { kind: 'key', k: bk }; gotoFrame(bk.f); return; } } /* 原画◆を左右にずらす＝タイミング */
  ANIM.playing = false; tlDrag = { kind: 'scrub' }; gotoFrame((x - TL.x0) / TL.w() * S.anim.len); });
tlc.addEventListener('pointermove', e => { if (!tlDrag) return; const r = tlc.getBoundingClientRect(), x = e.clientX - r.left;
  if (tlDrag.kind === 'scrub') gotoFrame((x - TL.x0) / TL.w() * S.anim.len);
  else if (tlDrag.kind === 'key') { const K = S.anim.keys, i = K.indexOf(tlDrag.k), lo = K[i - 1] ? K[i - 1].f + 1 : 1, hi = K[i + 1] ? K[i + 1].f - 1 : S.anim.len, nf = Math.max(lo, Math.min(hi, Math.round((x - TL.x0) / TL.w() * S.anim.len)));
    if (nf !== tlDrag.k.f) { const sg = S.anim.seg || {}, old = tlDrag.k.f; if (sg[old]) { sg[nf] = sg[old]; delete sg[old]; } tlDrag.k.f = nf; trCache.key = ''; gotoFrame(nf); save(); } }
  else { const { j, a, b } = tlDrag, sp = segOf(a).sp, xa = fx(a.f), xb = fx(b.f); const u = (x - xa) / Math.max(1, xb - xa), lo = j > 0 ? sp[j - 1] + 0.01 : 0.01, hi = j < sp.length - 1 ? sp[j + 1] - 0.01 : 0.99; sp[j] = r4(Math.max(lo, Math.min(hi, u))); applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); } });
tlc.addEventListener('contextmenu',e=>e.preventDefault());
const tlUp = () => { tlDrag = null; }; tlc.addEventListener('pointerup', tlUp); tlc.addEventListener('pointercancel', tlUp);
// スライダー：枚数・寄せ
const slBegin = () => { pushUndo(); }; $('nSl').addEventListener('pointerdown', slBegin); $('bSl').addEventListener('pointerdown', slBegin);
$('nSl').addEventListener('input', () => { const { a, b } = segInfo(ANIM.f); if (!a || !b) return; const s = segOf(a), n = +$('nSl').value; if (n === nOf(a, b) && s.n >= 0) return; s.n = n; s.sp = null; s.fix = {}; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); });
$('bSl').addEventListener('input', () => { const { a, b } = segInfo(ANIM.f); if (!a || !b) return; const s = segOf(a); s.bias = +$('bSl').value / 100; s.sp = null; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); });
$('playBtn').onclick = () => { ANIM.playing = !ANIM.playing; ANIM.last = performance.now(); ANIM.acc = 0; drawTL(); };
$('lenBtn').onclick = () => { pushUndo(); S.anim.len = { 8: 12, 12: 16, 16: 24, 24: 32, 32: 48, 48: 72, 72: 96, 96: 8 }[S.anim.len] || 24; S.anim.keys = S.anim.keys.filter(k => k.f <= S.anim.len); if (!S.anim.keys.length) S.anim.keys.push({ f: 0, pose: snapshot() }); gotoFrame(ANIM.f); save(); };
$('keyAdd').onclick = () => { if (keyAt(ANIM.f)) { toast('ここはもう原画や'); return; } pushUndo(); addKey(snapshot()); save(); drawTL(); toast(ANIM.f + 'コマ目に原画を置いた'); };
$('keyDel').onclick = () => { const k = keyAt(ANIM.f); if (!k || S.anim.keys.length < 2) { toast('ここは原画やない'); return; } pushUndo(); const i = S.anim.keys.indexOf(k); S.anim.keys.splice(i, 1); if (S.anim.seg) { delete S.anim.seg[k.f]; const p = S.anim.keys[i - 1]; if (p && S.anim.seg[p.f]) S.anim.seg[p.f].fix = {}; } gotoFrame(ANIM.f); save(); };
$('holdBtn').onclick = () => { const { a } = segInfo(ANIM.f - 1); if (!a) return; pushUndo(); applyPose(a.pose); const k = keyAt(ANIM.f); if (k) k.pose = snapshot(); else addKey(snapshot()); needRebuild = true; save(); drawTL(); toast('止め：前の原画と同じポーズを置いた'); };
$('trajBtn').onclick = () => { ANIM.traj = !ANIM.traj; if (!ANIM.traj) ANIM.tsel = null; else { const { a, b } = segInfo(ANIM.f); toast(a && b ? '軌道モード：右クリック（ペン・指はタップ）で紫の線を選ぶ→左でベジェを直す／青い点をすべらせてツメ' : '原画と原画の間のコマに行ってな'); } selJ = null; needDraw = true; drawTL(); };
$('trajDel').onclick = () => { const { a } = segInfo(ANIM.f); if (!a || !ANIM.tsel) return; pushUndo(); delete segOf(a).paths[ANIM.tsel.k]; ANIM.tsel = null; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); };
$('fixDel').onclick = () => { const { a, b } = segInfo(ANIM.f); if (!a || !b) return; pushUndo(); delete segOf(a).fix[drawIdx(a, b, ANIM.f)]; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); };
// 工房で10mの計算上の試走。狩り場の移動性能と同じ値を使う。
document.getElementById('halfBtn').onclick = () => { const A = S.anim; if (!A) return; if (!A.loop) { toast('ループする動き（歩き・走りなど）で使えるで'); return; } if (halfOf(A) == null) { toast('長さを偶数にしてな'); return; }
  pushUndo(); A.mirrorHalf = !A.mirrorHalf; if (A.mirrorHalf) { regenHalf(); toast('後半＝前半の反転：前半（0〜' + (halfOf(A) - 1) + 'コマ）だけ作ればOK（戻すで戻せる）'); } else toast('後半の自動反転をやめた（今の後半はそのまま残る）');
  applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); };
let paceTrial=null;
// 大きさ（体全体の倍率）。形は今のまま、狩り場で体ごと拡大・縮小する
function syncSize(){const sl=document.getElementById('sizeSl');if(!sl||!S)return;const v=window.BodyMotion.sizeOf(S);if(document.activeElement!==sl)sl.value=Math.round(v*100);document.getElementById('sizeLbl').textContent='×'+v.toFixed(2);}
{const sl=document.getElementById('sizeSl');
  sl.addEventListener('pointerdown',()=>pushUndo());
  sl.addEventListener('keydown',()=>pushUndo());
  sl.addEventListener('input',()=>{const v=Math.max(0.5,Math.min(2,(+sl.value||100)/100));if(Math.abs(v-1)<1e-6)delete S.size;else S.size=Math.round(v*100)/100;syncSize();save();
    const p=window.BodyMotion.perf(v,1,'run');document.getElementById('paceInfo').textContent='大きさ×'+v.toFixed(2)+'：体重×'+p.mass.toFixed(1)+'　力×'+p.power.toFixed(1)+'　加速・小回り '+Math.round(p.agility*100)+'%'+(p.need>1?'　この体が要る動き '+Math.round(p.need*100)+'%':'')+'（保存すると狩り場に反映）';});}
document.getElementById('paceTestBtn').onclick=()=>{
  if(mode!=='pose'||!S.anim||!S.acts||!S.acts[S.actI])return;
  const action=S.acts[S.actI],slot=action.slot;
  if(slot!=='walk'&&slot!=='run'){toast('「歩き」か「走る」を選んでな');return;}
  const q=measureGaitQuality(S,S.anim,slot),M=window.BodyMotion,size=M.sizeOf(S),p=M.perf(size,1,slot); /* いまは速さ＝大きさだけ（アニメの出来は効かない） */
  const speed=p.top,seconds=M.runTime(p,10),fit=Math.min(1,q.factor/p.need);
  document.getElementById('paceInfo').textContent=action.name+'：最高速 '+speed.toFixed(2)+'m/秒／10m '+seconds.toFixed(1)+'秒（大きさ×'+size.toFixed(2)+'　加速・小回り '+Math.round(p.agility*100)+'%）※いまは速さは大きさだけで決まる';
  document.getElementById('paceFill').style.width='0%';
  paceTrial={start:performance.now(),ms:seconds*1000};
  ANIM.playing=true;ANIM.last=performance.now();drawTL();
};
function paceTrialTick(now){
  if(!paceTrial)return;
  const p=Math.min(1,Math.max(0,(now-paceTrial.start)/paceTrial.ms));
  document.getElementById('paceFill').style.width=(p*100).toFixed(2)+'%';
  if(p>=1)paceTrial=null;
}
function animTick(now) { if (mode !== 'pose' || !ANIM.playing || !S.anim) return; const dt = now - ANIM.last; ANIM.last = now; ANIM.acc += dt; const fr = 1000 / 24 / (ANIM.rec && ANIM.slow ? 0.5 : 1); let moved = false;
  while (ANIM.acc >= fr) { ANIM.acc -= fr; ANIM.f = ANIM.f >= S.anim.len - (S.anim.loop ? 1 : 0) ? 0 : ANIM.f + 1; moved = true; }
  if (moved) { const P = poseAt(ANIM.f), d = st.drag; if (ANIM.rec && d && d.live) { for (const b of S.bones) if (!d.live.has(b.id) && P[b.id] && P[b.id].length === b.pts.length) b.pts = clone(P[b.id]); markSynced(); if (d.kind === 'ik' || d.kind === 'rope') moveIK(); else if (d.kind === 'rot') moveRot(); recCapture(d.live); } else applyPose(P); needRebuild = true; drawTL(); } }
// ============ パフォーム（記録） ============
// 再生しながら動かした骨だけ、そのコマの形を録る。録ってない骨は今のアニメのまま。何回でも上から録り直せる
function recCapture(live) { const R = ANIM.rec; if (!R) return; const fr = R.buf[ANIM.f] || (R.buf[ANIM.f] = {}); for (const id of live) { const b = boneById(id); if (b) fr[id] = clone(b.pts); } }
function startRec() { if (mode !== 'pose' || !S.anim) return; if (S.anim.mirrorHalf) toast('後半＝反転がONの間は、前半だけ録れば後半は自動'); ANIM.rec = { buf: {} }; ANIM.traj = false; ANIM.tsel = null; ANIM.playing = true; ANIM.last = performance.now(); ANIM.acc = 0;
  toast('● 録ってる：先っぽを引っぱる／関節の輪を回すと、その骨だけ録れる。もう一回押すと止まる'); drawTL(); }
function stopRec() { const R = ANIM.rec; ANIM.rec = null; ANIM.playing = false; const fs = Object.keys(R.buf); if (!fs.length) { applyPose(poseAt(ANIM.f)); needRebuild = true; drawTL(); toast('何も録れてへん（再生中に骨を動かしてな）'); return; }
  pushUndo(); const A = S.anim; if (!A.perf) A.perf = { fr: {}, sm: 0, step: 1 }; for (const f of fs) A.perf.fr[f] = Object.assign(A.perf.fr[f] || {}, R.buf[f]); pmCache.k = '';
  applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); toast('録った（' + fs.length + 'コマ）。なめらか・コマ打ちで育てて、決定で原画にする'); }
let pmCache = { k: '', marks: [], trails: [] };
function perfInfo() { const A = S.anim, ids = A && perfIds(A); if (!ids || !ids.size) return null; const k = Object.keys(A.perf.fr).length + ':' + A.perf.sm + ':' + A.len + ':' + JSON.stringify(A.keys.map(x => x.f)) + ':' + JSON.stringify(A.links || {}) + ':' + undoS.length;
  if (pmCache.k === k) return pmCache; const st0 = A.perf.step; A.perf.step = 1; const N = A.loop ? A.len : A.len + 1, T = [];
  try { for (let f = 0; f < N; f++) { const P = perfPose(f); T.push([...ids].map(id => P[id] ? V3(P[id][P[id].length - 1]) : null)); } } finally { A.perf.step = st0; }
  const at = f => T[A.loop ? ((f % N) + N) % N : Math.max(0, Math.min(N - 1, f))], sp = [];
  for (let f = 0; f < N; f++) { let v = 0; const a = at(f - 1), c = at(f + 1); a.forEach((p, i) => { if (p && c[i]) v += p.distanceTo(c[i]); }); sp.push(v); }
  const mean = sp.reduce((a, b) => a + b, 0) / Math.max(1, N), marks = [];
  for (let f = 0; f < N; f++) { const v = sp[f], vp = sp[A.loop ? (f - 1 + N) % N : Math.max(0, f - 1)], vn = sp[A.loop ? (f + 1) % N : Math.min(N - 1, f + 1)]; let rev = false; const a = at(f - 1), b = at(f), c = at(f + 1);
    a.forEach((p, i) => { if (p && b[i] && c[i]) { const d1 = b[i].clone().sub(p), d2 = c[i].clone().sub(b[i]); if (d1.length() > 0.004 && d2.length() > 0.004 && d1.dot(d2) < -0.3 * d1.length() * d2.length()) rev = true; } });
    if (((v <= vp && v <= vn && v < mean * 0.55) || rev) && !marks.includes(f - 1)) marks.push(f); } /* 止まる・折り返すコマ＝原画の候補（目印だけ） */
  const trails = [...ids].map((_, i) => T.map(r => r[i]).filter(Boolean)); pmCache = { k, marks, trails, ids }; return pmCache; }
function drawPerf() { const I = perfInfo(); if (!I) return; og.setLineDash([2, 5]); og.lineWidth = 1.5; og.strokeStyle = 'rgba(192,57,43,.45)';
  for (const tr of I.trails) { if (tr.length < 2) continue; og.beginPath(); tr.forEach((P, i) => { const q = proj(P); i ? og.lineTo(q.x, q.y) : og.moveTo(q.x, q.y); }); if (S.anim.loop) og.closePath(); og.stroke(); } og.setLineDash([]); }
function bakeAll() { const A = S.anim; if (!A || !A.perf) return; const step = Math.max(1, A.perf.step || 1), end = A.loop ? A.len : A.len + 1; pushUndo(); const keys = [];
  for (let f = 0; f < end; f += step) keys.push({ f, pose: clone(poseAt(f)) }); delete A.perf; A.keys = keys; A.seg = {}; for (const k of keys) A.seg[k.f] = { n: 0, bias: 0, sp: null, paths: {}, fix: {} };
  pmCache.k = ''; trCache.key = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); toast('記録をそのまま原画にした（' + keys.length + '枚・' + step + 'コマ打ち）'); }
function bakePick() { const A = S.anim, ids = A && perfIds(A); if (!ids) return; const step = Math.max(1, A.perf.step || 1); pushUndo(); const st0 = A.perf.step; A.perf.step = 1;
  try { for (const k of A.keys) { const P = perfPose(k.f); for (const id of ids) if (P[id]) k.pose[id] = clone(P[id]); } /* 置いた原画の、録った骨は記録の形に */
    const tips = f => { const P = perfPose(A.loop && f >= A.len ? f - A.len : f); return [...ids].map(id => P[id] ? V3(P[id][P[id].length - 1]) : null); };
    for (let i = 0; i < A.keys.length; i++) { const a = A.keys[i], b = A.keys[i + 1] || (A.loop ? { f: A.len } : null); if (!b) break; const L = b.f - a.f, n = Math.max(0, Math.round(L / step) - 1), s2 = segOf(a); s2.n = n; s2.fix = {}; s2.bias = 0; s2.sp = null; if (!n) continue;
      const T = []; for (let f = a.f; f <= b.f; f++) T.push(tips(f)); let best = -1, bt = 0; T[0].forEach((_, j) => { let t = 0; for (let f = 1; f < T.length; f++) if (T[f][j] && T[f - 1][j]) t += T[f][j].distanceTo(T[f - 1][j]); if (t > bt) { bt = t; best = j; } });
      if (best < 0 || bt < 1e-3) continue; const cum = [0]; for (let f = 1; f < T.length; f++) cum.push(cum[f - 1] + (T[f][best] && T[f - 1][best] ? T[f][best].distanceTo(T[f - 1][best]) : 0));
      const sp = []; for (let j = 1; j <= n; j++) { const fj = Math.round(j * L / (n + 1)); let u = cum[fj] / bt; const lo = j > 1 ? sp[j - 2] + 0.01 : 0.01; sp.push(r4(Math.max(lo, Math.min(0.99 - (n - j) * 0.01, u)))); } s2.sp = sp; } /* 間のツメ＝手で動かした時の緩急 */
  } finally { A.perf.step = st0; }
  delete A.perf; pmCache.k = ''; trCache.key = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); toast('置いた原画で決定。間は記録の緩急で中割り（' + step + 'コマ打ち）'); }
// ============ 脚のリンク ============
function linkSrcOf(id) { const L = S.anim && S.anim.links; return L && L[id] ? L[id].src : id; }
function toggleLink(id) { const A = S.anim, src = ANIM.linkSrc, b = boneById(id), sb = boneById(src); if (!b || !sb || id === src) return; if (b.pts.length !== sb.pts.length) { toast('関節の数が違う骨はつなげへん'); return; }
  pushUndo(); if (!A.links) A.links = {}; if (A.links[id] && A.links[id].src === src) { delete A.links[id]; toast('つながりを外した'); } else { A.links[id] = { src, off: 0 }; delete A.links[src]; toast('つないだ（ずらし0）'); }
  sel = id; SELB = []; selJ = null; pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); }
function linkStroke(stk) { const A = S.anim, src = ANIM.linkSrc, sb = boneById(src); if (!sb) return; const gap = ANIM.linkGap || 2, hits = [];
  for (const b of S.bones) { if (b.pts.length !== sb.pts.length) continue; const P = b.pts.map(p => proj(V3(p))); let bi = -1, bd = 24; stk.pts.forEach((q, i) => { for (let k = 0; k < P.length - 1; k++) { const a = P[k], c = P[k + 1], dx = c.x - a.x, dy = c.y - a.y, t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a.x + dx * t - q.x, a.y + dy * t - q.y); if (d < bd) { bd = d; bi = i; } } }); if (bi >= 0) hits.push({ id: b.id, at: bi }); }
  if (hits.length < 2) { toast('脚を2本以上なぞってな'); return; } hits.sort((a, c) => a.at - c.at); const ks = hits.findIndex(h => h.id === src); pushUndo(); if (!A.links) A.links = {};
  hits.forEach((h, k) => { if (h.id === src) return; const off = ks >= 0 ? (k - ks) * gap : (k + 1) * gap; A.links[h.id] = Object.assign(A.links[h.id] || {}, { src, off }); });
  pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); toast('なぞった順に' + gap + 'コマずつずらした'); }
function updRec() { const A = S.anim, has = !!(A && perfIds(A)); $('recBtn').classList.toggle('on', !!ANIM.rec); $('recBtn').textContent = ANIM.rec ? '■ 止める' : '● 録る'; $('slowBtn').classList.toggle('on', !!ANIM.slow);
  for (const id of ['smSl', 'bakePick', 'bakeAll', 'perfDel']) $(id).disabled = !has || !!ANIM.rec; document.querySelectorAll('#stepSeg button').forEach(b => { b.disabled = !has || !!ANIM.rec; b.classList.toggle('on', has && +b.dataset.s === (A.perf.step || 1)); });
  if (has && document.activeElement !== $('smSl')) $('smSl').value = Math.round((A.perf.sm || 0) * 100);
  $('lnkSrc').classList.toggle('on', !!ANIM.linkMode); const L = A && A.links, l = L && sel != null && L[sel]; $('lnkGrp').style.display = l ? 'inline-flex' : 'none';
  if (l) $('lnkLbl').textContent = '骨' + l.src + 'から ' + (l.off || 0) + 'コマずらし' + (l.half ? '＋半周' : '');
  $('lnkHalf').style.display = L && Object.keys(L).length ? '' : 'none'; $('rootBtn2').style.display = selJ != null && sel != null ? '' : 'none'; }
$('recBtn').onclick = () => { if (ANIM.rec) stopRec(); else startRec(); updRec(); };
$('slowBtn').onclick = () => { ANIM.slow = !ANIM.slow; updRec(); toast(ANIM.slow ? '録る間だけ再生を0.5倍にする' : '録る時も等速'); };
$('smSl').addEventListener('pointerdown', () => pushUndo()); $('smSl').addEventListener('input', () => { const A = S.anim; if (!A || !A.perf) return; A.perf.sm = +$('smSl').value / 100; pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); });
document.querySelectorAll('#stepSeg button').forEach(b => b.onclick = () => { const A = S.anim; if (!A || !A.perf) return; pushUndo(); A.perf.step = +b.dataset.s; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); updRec(); toast(b.dataset.s + 'コマ打ち'); });
$('bakeAll').onclick = bakeAll; $('bakePick').onclick = bakePick;
$('perfDel').onclick = () => { const A = S.anim; if (!A || !A.perf) return; pushUndo(); delete A.perf; pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); toast('記録を消した（戻すで戻せる）'); };
$('lnkSrc').onclick = () => { if (ANIM.linkMode) { ANIM.linkMode = false; updRec(); return; } if (sel == null) { toast('先に元にする骨を右クリックで選んでな'); return; } ANIM.linkSrc = linkSrcOf(sel); ANIM.linkMode = true; ANIM.linkGap = ANIM.linkGap || 2; updRec();
  toast('元＝骨' + ANIM.linkSrc + '。右クリックで同じ動きにする骨（もう一回で外す）／左でなぞると、なぞった順に' + ANIM.linkGap + 'コマずつずらす／Escで終わり'); };
$('lnkMinus').onclick = () => { const l = S.anim.links && S.anim.links[sel]; if (!l) return; pushUndo(); l.off = (l.off || 0) - 1; pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); };
$('lnkPlus').onclick = () => { const l = S.anim.links && S.anim.links[sel]; if (!l) return; pushUndo(); l.off = (l.off || 0) + 1; pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); };
$('lnkCut').onclick = () => { const L = S.anim.links; if (!L || !L[sel]) return; pushUndo(); delete L[sel]; pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); toast('つながりを外した'); };
$('lnkHalf').onclick = () => { const L = S.anim.links; if (!L) return; const src = ANIM.linkMode ? ANIM.linkSrc : linkSrcOf(sel != null ? sel : +Object.keys(L)[0]); const opp = Object.keys(L).map(Number).filter(id => L[id].src === src && sideOf(id) * sideOf(src) < 0);
  if (!opp.length) { toast('元と反対側につながってる骨がない'); return; } pushUndo(); const on = !opp.every(id => L[id].half); for (const id of opp) { if (on) L[id].half = true; else delete L[id].half; } pmCache.k = ''; applyPose(poseAt(ANIM.f)); needRebuild = true; save(); drawTL(); toast(on ? '反対側の' + opp.length + '本を半周ずらした' : '半周ずらしをやめた'); };
$('rootBtn2').onclick = setRootHere;
function keepCenter(ids) { if (mode === 'pose' ? !S.animSym : !S.sym) return; for (const id of ids) { const b = boneById(id); if (b) b.pts.forEach(p => { p[0] = AX(); }); } }
const centerIds = () => S.bones.filter(isCenter).map(b => b.id);

// ============ 関節のつながり（グラフ）：親子は「根っこ（腰）」から数えて決める ============
// 骨のデータの向き（どっちから描いたか）に関係なく、腰に近い方が親。頭から作っても尻尾から作ってもOK
const nk = (id, i) => id + ':' + i;
function jointGraph() { const par = new Map(), f = k => { let r = k; while (par.has(r)) r = par.get(r); return r; };
  for (const b of S.bones) if (b.parent != null && b.at != null) { const p = boneById(b.parent); if (p && p.pts[b.at]) { const a = f(nk(b.id, 0)), c = f(nk(p.id, b.at)); if (a !== c) par.set(a, c); } }
  const N = new Map(), node = k => { let n = N.get(k); if (!n) N.set(k, n = { key: k, refs: [], nb: new Set() }); return n; };
  for (const b of S.bones) b.pts.forEach((_, i) => { const n = node(f(nk(b.id, i))); n.refs.push({ b, i, child: i === 0 && b.parent != null }); if (i > 0) { const m = node(f(nk(b.id, i - 1))); n.nb.add(m.key); m.nb.add(n.key); } });
  for (const n of N.values()) { const r = n.refs.find(x => !x.child) || n.refs[0]; n.main = r; }
  const G = { N, find: f, pos: k => { const n = N.get(k); return n ? V3(n.main.b.pts[n.main.i]) : null; } };
  let root = S.root && boneById(S.root.id) && boneById(S.root.id).pts[S.root.i] ? f(nk(S.root.id, S.root.i)) : null;
  if (!root || !N.has(root)) { const mr = mainRoot(); root = mr ? f(nk(mr.id, 0)) : (N.keys().next().value || null); }
  G.root = root; G.up = new Map(); G.kids = new Map(); const seen = new Set(), q = [];
  const bfs = s0 => { seen.add(s0); q.push(s0); G.kids.set(s0, []); while (q.length) { const k = q.shift(); for (const m of N.get(k).nb) if (!seen.has(m)) { seen.add(m); G.up.set(m, k); G.kids.get(k).push(m); G.kids.set(m, []); q.push(m); } } };
  if (root) bfs(root); for (const k of N.keys()) if (!seen.has(k)) bfs(k); /* つながってない骨はそれぞれ自分の端から */
  G.deg = k => N.get(k).nb.size; G.sub = k => { const out = [], st2 = [k]; while (st2.length) { const x = st2.pop(); for (const c of G.kids.get(x) || []) { out.push(c); st2.push(c); } } return out; };
  G.set = (k, P) => { const n = N.get(k); if (!n) return; for (const r of n.refs) { const v = r.child ? P.clone().add(offOf(r.b)) : P; r.b.pts[r.i] = [v.x, v.y, v.z].map(r4); } };
  G.posVia = (k, via) => { const n = N.get(k), vb = new Set(N.get(via).refs.map(r => r.b.id)), r = n.refs.find(x => vb.has(x.b.id)) || n.main; return V3(r.b.pts[r.i]); }; /* 枝の骨から見たこの関節（根元のずれ込み） */
  G.bonesOf = keys => { const s2 = new Set(); for (const k of keys) for (const r of N.get(k).refs) s2.add(r.b.id); return s2; };
  return G; }
const keyOfJoint = (G, b, i) => G.find(nk(b.id, i));
function drawRoot() { if (mode === 'shape' || mode === 'paint' || !S.bones.length) return; const G = jointGraph(), P = G.root && G.pos(G.root); if (!P) return; const s0 = proj(P);
  og.strokeStyle = '#2f6fd0'; og.lineWidth = 2.5; og.setLineDash([3, 3]); og.beginPath(); og.arc(s0.x, s0.y, 13, 0, 7); og.stroke(); og.setLineDash([]); og.fillStyle = '#2f6fd0'; og.font = '900 11px sans-serif'; og.textAlign = 'center'; og.fillText('腰', s0.x, s0.y - 17); }
function setRootHere() { const b = boneById(sel); if (!b || selJ == null || !b.pts[selJ]) { toast('右クリックで関節を選んでから押してな'); return; } pushUndo(); const G = jointGraph(), n = G.N.get(keyOfJoint(G, b, selJ)); S.root = { id: n.main.b.id, i: n.main.i }; save(); needDraw = true; updBtns(); toast('ここを腰（根っこ）にした。親子はここから数え直し'); }
// ---- 骨モード：関節から生やす（左ドラッグ） ----
function addBoneToPoses(b) { const p = b.parent != null && boneById(b.parent); for (const P of poseStores()) { if (P[b.id] && P[b.id].length === b.pts.length) continue; if (!p || !P[p.id] || P[p.id].length !== p.pts.length) continue;
    const k = b.at, k0 = k > 0 ? k - 1 : 0, k1 = k > 0 ? k : Math.min(1, p.pts.length - 1), q = new THREE.Quaternion().setFromUnitVectors(V3(p.pts[k1]).sub(V3(p.pts[k0])).normalize(), V3(P[p.id][k1]).sub(V3(P[p.id][k0])).normalize()), O = V3(p.pts[k]), Nw = V3(P[p.id][k]);
    P[b.id] = b.pts.map(x => { const v = Nw.clone().add(V3(x).sub(O).applyQuaternion(q)); return [v.x, v.y, v.z].map(r4); }); } }
function appendJoint(b, T) { const n0 = b.pts.length, L0 = boneLen(b), last = V3(b.pts[n0 - 1]), prev = V3(b.pts[n0 - 2] || b.pts[n0 - 1]); const O = topoOf(b); b.pts.push([T.x, T.y, T.z].map(r4)); const L1 = boneLen(b), s = L0 / Math.max(1e-6, L1);
  for (const k of ['wp', 'wn', 'dp', 'dn']) { const pr = b[k] || [{ t: 0, r: 0.03 }], end = profAt(pr, 1); b[k] = pr.map(p => Object.assign({}, p, { t: r4(p.t * s) })).concat([{ t: 1, r: r4(Math.max(0.006, end * 0.85)) }]); }
  delete b.rings; ringsOf(b); O.ts = O.ts.map(t => t * s); remapTopo(b, O, topoOf(b));
  for (const P of poseStores()) { const q = P[b.id]; if (!q || q.length !== n0) continue; const r = new THREE.Quaternion().setFromUnitVectors(last.clone().sub(prev).normalize(), V3(q[n0 - 1]).sub(V3(q[n0 - 2] || q[n0 - 1])).normalize()), v = V3(q[n0 - 1]).add(T.clone().sub(last).applyQuaternion(r)); q.push([v.x, v.y, v.z].map(r4)); } }
function growFrom(jh, x, y) { if (!skeletonEditable()) return false; const G = jointGraph(), key = keyOfJoint(G, jh.b, jh.i), node = G.N.get(key), P0 = G.pos(key), T = unprojectOnPlane(x, y, P0, planeN()); if (!T || T.distanceTo(P0) < 0.02) return false;
  if (S.sym && Math.abs(P0.x - AX()) < 0.03 && Math.abs(T.x - AX()) < 0.06) T.x = AX();
  pushUndo(); const tip = node.refs.find(r => r.i === r.b.pts.length - 1 && !S.bones.some(c => c.parent === r.b.id && c.at === r.i)), leaf = G.deg(key) === 1 && key !== G.root;
  if (tip && leaf) { const b = tip.b; appendJoint(b, T); const tw = S.sym && b.twin != null && boneById(b.twin); if (tw && tw.pts.length === b.pts.length - 1) appendJoint(tw, new THREE.Vector3(2 * AX() - T.x, T.y, T.z)); markSynced(); sel = b.id; SELB = []; selJ = b.pts.length - 1; rebuild(); save(); toast('骨を伸ばした'); return true; }
  const m = node.main, len = T.distanceTo(P0), r = r4(Math.max(0.012, Math.min(0.09, len * 0.12))), pr = () => [{ t: 0, r }, { t: 1, r: r4(r * 0.8) }];
  const b = { id: nextId++, parent: m.b.id, at: m.i, pts: [[P0.x, P0.y, P0.z].map(r4), [T.x, T.y, T.z].map(r4)], wp: pr(), wn: pr(), dp: pr(), dn: pr(), off: {}, sides: 8, av: 1 };
  ringsOf(b); S.bones.push(b); addBoneToPoses(b); if (S.sym && !isCenter(b)) { const t = makeTwin(b); if (t) addBoneToPoses(t); } sel = b.id; SELB = []; selJ = 1; rebuild(); save(); toast('関節から骨を生やした'); return true; }
// ---- 骨モード：関節を右ドラッグで動かす（子は形を保ったまま付いてくる。腰は1個だけ動く） ----
function startJMove(e, jh) { if (!skeletonEditable()) return false; const G = jointGraph(), key = keyOfJoint(G, jh.b, jh.i), keys = key === G.root ? [key] : [key, ...G.sub(key)];
  st.drag = { kind: 'jmove', id: e.pointerId, x: e.clientX, y: e.clientY, G, key, orig: new Map(keys.map(k => [k, G.pos(k)])), P0: G.pos(key), pushed: false, cids: centerIds() }; sel = jh.b.id; SELB = []; selJ = jh.i; return true; }
function moveJMove(x, y) { const d = st.drag; if (!d.pushed) { if (Math.hypot(x - d.x, y - d.y) < 4) return; pushUndo(); d.pushed = true; } const T = unprojectOnPlane(x, y, d.P0, planeN()); if (!T) return; const D = T.sub(d.P0);
  for (const [k, P] of d.orig) d.G.set(k, P.clone().add(D)); keepCenter(d.cids); needRebuild = true; save(); }
// ---- 回転：骨モード＝その関節から先を親を軸に振る／アニメ＝その関節から先を、その関節を軸に回す ----
function rotSet(G, key) { if (mode === 'bone') { const piv = G.up.get(key); if (!piv) return null; return { pivot: piv, keys: [key, ...G.sub(key)] }; }
  const kids = G.sub(key); if (kids.length) return { pivot: key, keys: kids }; const piv = G.up.get(key); return piv ? { pivot: piv, keys: [key] } : null; }
// ---- アニメ：先っぽを引っぱる（IK）。分かれ道まで付いてくる（Shiftで腰まで）。膝は最初に曲がってた向きにしか曲げない ----
function ikChain(G, leaf, far) { const ch = [leaf]; let k = leaf; while (G.up.has(k)) { k = G.up.get(k); ch.push(k); if (k === G.root || (!far && G.deg(k) >= 3)) break; } return ch.reverse(); }
function bendRef(P) { const out = []; for (let i = 1; i < P.length - 1; i++) { const a = P[i - 1], c = P[i + 1], ac = c.clone().sub(a), t = ac.lengthSq() > 1e-12 ? P[i].clone().sub(a).dot(ac) / ac.lengthSq() : 0, w = P[i].clone().sub(a.clone().addScaledVector(ac, t)); out.push(w.length() > 0.004 ? w.normalize() : null); } return out; }
function startIK(e, jh, far) { const G = jointGraph(), key = keyOfJoint(G, jh.b, jh.i);
  if (key === G.root) { if (G.deg(key) !== 1) return false; const keys = [key, ...G.sub(key)]; st.drag = { kind: 'rope', id: e.pointerId, G, key, P0: G.pos(key), N: planeN(), live: G.bonesOf(keys), cids: centerIds() }; }
  else { const ch = ikChain(G, key, far), live = G.bonesOf([...ch.slice(1), ...ch.slice(1).flatMap(k => G.sub(k))]); if (ch.length < 2) return false;
    const P = ch.map((k, i) => i === 0 ? G.posVia(k, ch[1]) : G.pos(k)); let ref = bendRef(P); if (S.rest) { const RP = ch.map((k, i) => { const n = i === 0 ? (G.N.get(k).refs.find(r => G.N.get(ch[1]).refs.some(q => q.b.id === r.b.id)) || G.N.get(k).main) : G.N.get(k).main; return S.rest[n.b.id] ? V3(S.rest[n.b.id][n.i]) : G.pos(k); }), rr = bendRef(RP); ref = ref.map((w, i) => w || rr[i]); }
    st.drag = { kind: 'ik', id: e.pointerId, G, ch, ref, P0: G.pos(key), N: planeN(), live, cids: centerIds() }; }
  const lk = linkedIn(st.drag.live); if (lk) { st.drag = null; toast('この骨は「' + lk + '」の動きにつながってる。元の骨を動かしてな'); return true; }
  if (!ANIM.rec) pushUndo(); sel = jh.b.id; SELB = []; selJ = jh.i; selMir = false; return true; }
function moveIK(x, y) { const d = st.drag; if (x != null) { d.lx = x; d.ly = y; } x = d.lx; y = d.ly; if (x == null) return; const T = unprojectOnPlane(x, y, d.G.pos(d.ch ? d.ch[d.ch.length - 1] : d.key), d.N); if (!T) return; const G = d.G;
  if (d.kind === 'rope') { const keys = [d.key, ...G.sub(d.key)], old = new Map(keys.map(k => [k, G.pos(k)])), nw = new Map([[d.key, T]]); /* 頭が先導して、体は後からついてくる */
    for (const k of keys.slice(1)) { const pk = G.up.get(k), sh = G.posVia(pk, k).sub(old.get(pk)), pp = nw.get(pk).clone().add(sh), L = old.get(k).distanceTo(old.get(pk).clone().add(sh)), dir = old.get(k).clone().sub(pp); nw.set(k, pp.clone().addScaledVector(dir.lengthSq() > 1e-12 ? dir.normalize() : new THREE.Vector3(0, -1, 0), L)); }
    for (const [k, P] of nw) G.set(k, P); keepCenter(d.cids); needRebuild = true; return; }
  const ch = d.ch, old = ch.map((k, i) => i === 0 ? G.posVia(k, ch[1]) : G.pos(k)), pts = fabrik(old.map(v => v.clone()), T);
  for (let i = 1; i < pts.length - 1; i++) { const r = d.ref[i - 1]; if (!r) continue; const a = pts[i - 1], c = pts[i + 1], ac = c.clone().sub(a); if (ac.lengthSq() < 1e-12) continue; const t = pts[i].clone().sub(a).dot(ac) / ac.lengthSq(), base = a.clone().addScaledVector(ac, t), w = pts[i].clone().sub(base);
    if (w.length() > 0.002 && w.dot(r) < 0) pts[i] = base.clone().sub(w); } /* 逆に折れたら、線の反対側へ折り返す（長さはそのまま） */
  const onCh = new Set(ch); for (let i = 1; i < ch.length; i++) { const q = new THREE.Quaternion().setFromUnitVectors(old[i].clone().sub(old[i - 1]).normalize(), pts[i].clone().sub(pts[i - 1]).normalize());
    for (const k of G.sub(ch[i])) if (!onCh.has(k)) { const v = G.pos(k); G.set(k, pts[i].clone().add(v.sub(old[i]).applyQuaternion(q))); } }
  for (let i = 1; i < ch.length; i++) G.set(ch[i], pts[i]); keepCenter(d.cids); needRebuild = true; }
// ---- 脚のリンク（アニメ）：元の骨と同じ動き、〇コマずらし ----
function linkedIn(ids) { const L = S.anim && S.anim.links; if (!L) return null; for (const id of ids) if (L[id]) { const s2 = boneById(L[id].src); return s2 ? '骨' + s2.id : '元'; } return null; }
// ============ 指・ペン ============
const fingers = new Map(); let pinch = null, lastPT = '';
over.addEventListener('pointerdown', e => {
  e.preventDefault(); try { over.setPointerCapture(e.pointerId); } catch (_) {}
  const x = e.clientX, y = e.clientY, pen = e.pointerType !== 'touch'; lastPT = e.pointerType; if (lastPT === 'mouse' && !document.body.classList.contains('pc')) { document.body.classList.add('pc'); updBtns(); }
  const intent=editorInput.intent(e); if(intent==='ignore')return; if (intent === 'camera') { st.cam = { id: e.pointerId, x, y, pan: e.shiftKey }; orbit.goal = null; return; } /* 中ボタン（かAlt＋左）で回す、Shift付きで平行移動 */
  if (intent === 'select' && mode === 'bone' && !S.tpl && !lassoMode) { const jr = jointHit(x, y, 12); if (jr) { st.drag = { kind: 'rpress', id: e.pointerId, x, y, jh: jr, add: e.shiftKey }; return; } } /* 関節を右ドラッグ＝動かす */
  if (intent === 'select') { st.stroke = { id: e.pointerId, pts: [{ x, y }], lasso: mode === 'bone' || mode === 'pose', rclick: true, add: e.shiftKey }; return; }
  if(mode==='shape'&&detailInkMode&&e.button===0){st.stroke={id:e.pointerId,pts:[{x,y}],detailInk:true};return;} /* 右クリック：押すだけ＝1本だけ選ぶ／なぞる＝投げ縄 */
  let gh =!lassoMode && gizmoHit(x, y, !pen); if (gh && gh.a.key === 'free' && mode === 'bone' && !S.tpl && jointHit(x, y, 12)) gh = null; /* 骨モード：関節の上は「生やす」が先 */
  if (gh && !fingers.size) { startGizmo(e, gh); return; }
  if (mode === 'bone' && !lassoMode && !S.tpl && !fingers.size) { const rb = rotHit(x, y, !pen); if (rb && !rb.center) { startRot(e, rb); return; } }
  if (!pen || fingers.size) { fingers.set(e.pointerId, { x, y }); if (fingers.size === 2) { const [a, c] = [...fingers.values()]; pinch = { d: Math.hypot(a.x - c.x, a.y - c.y), dist: orbit.dist, m: { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 } }; st.tap = null; } else st.tap = { x, y, t: performance.now() };
    if (pen && fingers.size === 1) fingers.delete(e.pointerId); else return; }
  if (lassoMode && (mode === 'bone' || mode === 'pose')) { st.stroke = { id: e.pointerId, pts: [{ x, y }], lasso: true }; return; } /* 投げ縄 */
  if(mode==='paint'){st.stroke={id:e.pointerId,pts:[{x,y}],paintCut:true};return;}
  if (mode === 'pose' && ANIM.traj) { ANIM.playing = false; trajDown(e, x, y); return; }
  if (mode === 'pose' && !ANIM.traj && inMirroredHalf()) { toast('後半は前半の反転で自動。前半をいじってな'); return; }
  if (mode === 'pose' && !ANIM.traj) { if (!ANIM.rec) ANIM.playing = false; const rh = rotHit(x, y, !pen); if (rh && !rh.center) { startRot(e, rh); if (st.drag) st.drag.cids = centerIds(); return; }
    if (ANIM.linkMode && e.button === 0) { st.stroke = { id: e.pointerId, pts: [{ x, y }], link: true }; return; } /* つなぐ中：なぞった順に等間隔ずらし */
    const jt = jointHit(x, y, pen ? 14 : 22); if (jt) { const G = jointGraph(), k = keyOfJoint(G, jt.b, jt.i); if (G.deg(k) === 1 && startIK(e, jt, e.shiftKey)) return; } /* 先っぽをつかむ＝引っぱる（Shiftで腰まで） */
    if (rh) { if (!(selJ > 0)) return; startRot(e, rh); st.drag.cids = centerIds(); return; } }
  const jh = jointHit(x, y, 16);
  if (mode === 'pose' && jh && sel != null && jh.b.id !== sel) { const sb = boneById(sel); if (sb) ptsOf(sb, selMir).forEach((q, i) => { const s2 = proj(q); if (Math.hypot(s2.x - x, s2.y - y) < 16 && Math.hypot(s2.x - proj(jh.P).x, s2.y - proj(jh.P).y) < 3) { jh.b = sb; jh.mir = selMir; jh.i = i; jh.P = q; } }); }
  if(lastPT==='mouse'&&(mode==='sil'||mode==='pose')&&sel==null&&!ANIM.traj){toast('先っぽをつかんで引っぱるか、右クリックで骨を選んでな');return;}
  if (mode === 'pose' && jh && lastPT!=='mouse') { st.drag = { kind: 'poseJ', id: e.pointerId, x, y, ...jh, cids: centerIds() }; return; }
  if (mode === 'bone' && lastPT !== 'mouse' && !jh && (boneHit(x, y, 12) || meshHit(x, y))) { st.drag = { kind: 'tapOnly', id: e.pointerId, x, y }; return; } /* iPad：骨の上からは描かず選ぶだけ（マウスは左＝描く） */
  if (mode === 'shape') { if(lastPT!=='mouse')st.drag = { kind: 'tapsel', id: e.pointerId, x, y }; return; }
  if (mode === 'bone' && jh) { st.drag = { kind: 'grow', id: e.pointerId, x, y, cx: x, cy: y, jh, moved: false }; return; } /* 関節をタッチ→ドラッグで生える */
  st.stroke = { id: e.pointerId, pts: [{ x, y }], anchor: null };
});
over.addEventListener('pointermove', e => {
  const x = e.clientX, y = e.clientY;
  if (st.cam && e.pointerId === st.cam.id) { const dx = x - st.cam.x, dy = y - st.cam.y; st.cam.x = x; st.cam.y = y;
    if (st.cam.pan || e.shiftKey) { const k = 2 * orbit.dist * Math.tan(cam.fov * Math.PI / 360) / H, R = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), U = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1); orbit.tx += (-R.x * dx + U.x * dy) * k; orbit.ty += (-R.y * dx + U.y * dy) * k; orbit.tz += (-R.z * dx + U.z * dy) * k; }
    else { orbit.yaw -= dx * 0.008; orbit.pitch = Math.max(-1.45, Math.min(1.45, orbit.pitch + dy * 0.006)); } return; }
  if (st.drag && st.drag.kind === 'gizmo' && e.pointerId === st.drag.id) { moveGizmo(e); return; }
  if (fingers.has(e.pointerId)) { const prev = fingers.get(e.pointerId); fingers.set(e.pointerId, { x, y });
    if (st.tap && Math.hypot(x - st.tap.x, y - st.tap.y) > 8) st.tap = null;
    if (fingers.size === 1 && !st.tap) { orbit.goal = null; orbit.yaw -= (x - prev.x) * 0.008; orbit.pitch = Math.max(-1.45, Math.min(1.45, orbit.pitch + (y - prev.y) * 0.006)); }
    else if (fingers.size === 2 && pinch) { const [a, c] = [...fingers.values()], d = Math.hypot(a.x - c.x, a.y - c.y), m = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; orbit.dist = Math.max(0.4, Math.min(12, pinch.dist * pinch.d / Math.max(1, d)));
      const k = 2 * orbit.dist * Math.tan(cam.fov * Math.PI / 360) / H, R = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), U = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1), dx = (m.x - pinch.m.x) * k, dy = (m.y - pinch.m.y) * k; pinch.m = m;
      orbit.tx += -R.x * dx + U.x * dy; orbit.ty += -R.y * dx + U.y * dy; orbit.tz += -R.z * dx + U.z * dy; }
    return; }
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [], list = evs.length ? evs : [e];
  if (st.stroke && e.pointerId === st.stroke.id) { for (const ce of list) st.stroke.pts.push({ x: ce.clientX, y: ce.clientY }); if (st.stroke.paintCut && paintErase) { cutHot = cutsNear(st.stroke); drawCutLines(); } needDraw = true; return; }
  const d = st.drag; if (!d || e.pointerId !== d.id) return;
  if (d.kind === 'grow') { d.cx = x; d.cy = y; if (!d.moved && Math.hypot(x - d.x, y - d.y) > 8) d.moved = true; needDraw = true; return; }
  if (d.kind === 'rpress') { if (Math.hypot(x - d.x, y - d.y) > 5) { const e2 = { pointerId: d.id, clientX: d.x, clientY: d.y }; if (startJMove(e2, d.jh)) moveJMove(x, y); else st.drag = null; } return; }
  if (d.kind === 'jmove') { moveJMove(x, y); return; }
  if (d.kind === 'jointOrBranch') { for (const ce of list) d.pts.push({ x: ce.clientX, y: ce.clientY }); if (!d.moved && Math.hypot(x - d.x, y - d.y) > 8) { d.moved = true; st.stroke = { id: d.id, pts: d.pts, anchor: { b: d.b, i: d.i, P: d.P, mir: d.mir } }; st.drag = null; } needDraw = true; return; }
  if (d.kind === 'jsel') { if (!d.moving && Math.hypot(x - d.x, y - d.y) > 6) { d.moving = true; pushUndo(); } if (!d.moving) return; const P = unprojectOnPlane(x, y, d.P, planeN()); if (!P) return; if (d.mir) P.x = -P.x; const b = d.b; b.pts[d.i] = [P.x, P.y, P.z].map(r4); if (S.sym && isCenter(b)) b.pts[d.i][0] = AX(); syncChildren(b); if (d.i === 0) updOff(b); selJ = d.i; needRebuild = true; save(); return; }
  if (d.kind === 'tpt') { trajMovePt(d, x, y); return; }
  if (d.kind === 'ttick') { trajMoveTick(d, x, y); return; }
  if (d.kind === 'tcurve') return;
  if (d.kind === 'rot') { moveRot(e); keepCenter(d.cids); return; }
  if (d.kind === 'ik' || d.kind === 'rope') { moveIK(x, y); return; }
  if (d.kind === 'poseJ') { if (Math.hypot(x - d.x, y - d.y) < 6) return; st.stroke = { id: d.id, pts: [{ x: d.x, y: d.y }, { x, y }] }; st.drag = null; needDraw = true; return; } /* 関節から描く＝線に沿わせる */
  if (d.kind === 'pose') { const b = d.b, piv = ptsOf(b, d.mir)[d.i - 1], cur = ptsOf(b, d.mir)[d.i], tgt = unprojectOnPlane(x, y, cur, planeN()); if (!tgt) return;
    const v0 = cur.clone().sub(piv).normalize(), v1 = tgt.clone().sub(piv).normalize(); let q = new THREE.Quaternion().setFromUnitVectors(v0, v1), pv = piv.clone();
    if (d.mir) { pv.x = -pv.x; q = new THREE.Quaternion(q.x, -q.y, -q.z, q.w); } rotateFrom(b, d.i, q, pv); keepCenter(d.cids || []); needRebuild = true; save(); return; }
});
const up = e => {
  if (st.cam && e.pointerId === st.cam.id) { st.cam = null; return; }
  if (fingers.has(e.pointerId)) { fingers.delete(e.pointerId); if (fingers.size < 2) pinch = null; if (fingers.size === 0 && st.tap && performance.now() - st.tap.t < 400) { const t = st.tap; st.tap = null; tap(t.x, t.y, true); } return; }
  if (st.stroke && e.pointerId === st.stroke.id) { const stk = st.stroke; st.stroke = null; if(stk.detailInk){commitDetailInk(stk);needDraw=true;return;} if(stk.paintCut){let L=0;for(let i=1;i<stk.pts.length;i++)L+=Math.hypot(stk.pts[i].x-stk.pts[i-1].x,stk.pts[i].y-stk.pts[i-1].y);
      if(paintErase)eraseCuts(stk);else if(L<10)fillAt(stk.pts[0].x,stk.pts[0].y);else commitCutStroke(stk);needDraw=true;return;} if (stk.link) { if (stk.pts.length > 3) linkStroke(stk); needDraw = true; return; } let L = 0; for (let i = 1; i < stk.pts.length; i++) L += Math.hypot(stk.pts[i].x - stk.pts[i - 1].x, stk.pts[i].y - stk.pts[i - 1].y);
    if (stk.rclick && L < 14) { rSelect(stk.pts[0].x, stk.pts[0].y, stk.add); needDraw = true; return; }
    if (stk.rclick && stk.lasso) { const am = addMode; addMode = !!stk.add; lassoSelect(stk); addMode = am; needDraw = true; return; }
    if (stk.rclick && !stk.lasso) { needDraw = true; return; }
    if (stk.lasso) { lassoSelect(stk); needDraw = true; return; }
    if (L < 14) { if (stk.traj != null) { trajTap(stk); return; } tap(stk.pts[0].x, stk.pts[0].y); return; }
    if (mode === 'bone') { if (!finishBone(stk)) toast('もうちょい長く描いてな'); }
    else if (mode === 'pose' && stk.traj != null) trajStroke(stk);
    else if (mode === 'pose') { const ids = centerIds(); if (sel != null ? flowSel(stk) : actionLine(stk)) { keepCenter(ids); commitPose(); } }
    else if (mode === 'sil') { const bh = boneHit(stk.pts[0].x, stk.pts[0].y, 9999); stk.mir = bh && bh.b.id === sel ? bh.mir : false; finishSil(stk); }
    needDraw = true; return; }
  const d = st.drag; if (d && e.pointerId === d.id) { st.drag = null;
    if (d.kind === 'jointOrBranch' && !d.moved) tap(d.x, d.y, false, d);
    if (d.kind === 'grow') { if (d.moved) growFrom(d.jh, d.cx, d.cy); else if (lastPT !== 'mouse' && d.jh.b.id === sel) selJ = selJ === d.jh.i ? null : d.jh.i; else tap(d.x, d.y, false, d.jh); }
    if (d.kind === 'rpress') rSelect(d.x, d.y, d.add);
    if (d.kind === 'jmove' && d.pushed) { rebuild(); save(); }
    if (d.kind === 'rot' && d.pushed && mode === 'bone') { rebuild(); save(); }
    if (d.kind === 'tapsel') selectAt(d.x, d.y, false);
    if (d.kind === 'tapOnly') tap(d.x, d.y, false);
    if (d.kind === 'tcurve') trajTap(d);
    if (lastPT !== 'mouse' && d.kind === 'jsel' && !d.moving) { selJ = selJ === d.i ? null : d.i; }
    if (lastPT !== 'mouse' && d.kind === 'poseJ') { setSel([d.b.id, ...descIds(d.b.id)]); sel = d.b.id; if (selJ === d.i && selMir === !!d.mir) selJ = null; else { selJ = d.i; selMir = !!d.mir; } }
    if ((d.kind === 'pose' || d.kind === 'ik' || d.kind === 'rope' || (d.kind === 'rot' && d.pushed)) && mode === 'pose' && !ANIM.rec) commitPose();
    needRebuild = true; needDraw = true; }
};
over.addEventListener('pointerup', up); over.addEventListener('pointercancel', up);
over.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && !document.body.classList.contains('pc')) { document.body.classList.add('pc'); addMode = false; lassoMode = false; updBtns(); } }, true);
addEventListener('keydown', e => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); document.getElementById(e.shiftKey ? 'redo' : 'undo').click(); return; }
  if (mod && k === 'y') { e.preventDefault(); document.getElementById('redo').click(); return; }
  if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
  if (mod && k === 's') { e.preventDefault(); saveCurrent(false); return; }
  if (k === 'escape') { ANIM.linkMode = false; sel = null; SELB = []; selJ = null; VSEL = []; lassoMode = false; linkMode = false; axisMode = false; ANIM.tsel = null; addJMode=false; setDetailInkMode(false); st.stroke=null; st.drag=null; updBtns(); needDraw = true; return; }
  if (!mod && !e.altKey && 'qwer'.includes(k) && k.length === 1) { const m = { q: 'bone', w: 'sil', e: 'shape', r: 'pose' }[k]; document.querySelector('#modes [data-m="' + m + '"]').click(); return; }
  if (!mod && k === 'm') { document.getElementById('sym').click(); return; }
  if (!mod && k === 'g' && (mode === 'bone' || mode === 'pose')) { groundIt(); return; }
  if (mode === 'pose' && !mod) { if (k === ' ') { e.preventDefault(); document.getElementById('playBtn').click(); return; } if (k === 'k') { document.getElementById('keyAdd').click(); return; } if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); ANIM.playing = false; gotoFrame(ANIM.f + (k === 'arrowright' ? 1 : -1)); return; } }
  if (!mod && '12345'.includes(k) && k.length === 1) { const b = document.querySelectorAll('#views button')[+k - 1]; if (b) b.click(); return; }
  if ((k === 'delete' || k === 'backspace') && mode === 'pose' && keyAt(ANIM.f)) { e.preventDefault(); document.getElementById('keyDel').click(); return; } }); /* PC：Ctrl+Z戻す／Ctrl+Shift+Z・Ctrl+Yやり直す／Ctrl+S保存／Escで選択を外す／1〜5で視点／アニメの原画コマでDeleteは原画を消す */
addEventListener('keydown', e => { if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'bone' && sel != null && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); const b = boneById(sel); if (b && selJ != null) removeJoint(b, selJ); else document.getElementById('del').click(); } }); /* Delete／Backspaceで選んでる骨を消す */
over.addEventListener('wheel', e => { e.preventDefault(); orbit.dist = Math.max(0.4, Math.min(12, orbit.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
function pickBoneSelection(x,y){
  const hit=meshes.visible?meshHit(x,y):null;
  const b=hit?boneById(hit.object.userData.id):null;
  const joint=jointHit(x,y,16,b?b.id:null);
  return {joint,bone:b?{b,mir:!!hit.object.userData.mir}:joint?{b:joint.b,mir:joint.mir}:boneHit(x,y,18)};
}
function rSelect(x, y, add) { if (mode === 'pose' && ANIM.linkMode && !add) { const pk = pickBoneSelection(x, y).bone; if (pk) toggleLink(pk.b.id); return; } if(mode==='pose'&&ANIM.traj){const t=nearTrack(x,y,24);trajTap({x,y,k:t?t.k:null});return;} const picked=pickBoneSelection(x,y); const now = performance.now(), rdbl = now - lastR.t < 350 && Math.hypot(x - lastR.x, y - lastR.y) < 24; lastR = { t: now, x, y };
  if ((rdbl || addJMode) && mode === 'bone' && !add) { lastR.t = 0; addJMode = false; const h = picked.bone; if (h) { insertJointAt(h.b, x, y); return; } updBtns(); }
  if (mode === 'shape') { const am = addMode; addMode = !!add; selectAt(x, y, false); addMode = am; return; }
  if (add && !linkMode) { const h = picked.bone; if (!h) return; const id = h.b.id, cur = sel == null ? [] : [sel, ...SELB];
    setSel(editorInput.selection(cur,[id],true,v=>v)); selJ = null; updBtns(); return; } /* Shift＋右クリック＝足す／もう選んでたら外す */
  const jh = picked.joint;
  if (linkMode && mode === 'bone') { linkMode = false; updBtns(); if (jh && sel != null && jh.b.id !== sel) linkTo(sel, jh); else toast('つなぎたい先の「関節」を右クリックしてな'); return; }
  if (jh && (mode === 'pose' || (mode === 'bone' && jh.b.id === sel))) { const same = sel === jh.b.id && selJ === jh.i && selMir === !!jh.mir; sel = jh.b.id; SELB = []; selJ = same ? null : jh.i; selMir = !!jh.mir; updBtns(); return; } /* 選んでる骨の関節を右クリック＝その関節（アニメは回す輪が出る） */
  const bh = picked.bone;
  sel = bh ? bh.b.id : null; SELB = []; selJ = null; selMir = false; updBtns(); } /* 右クリック＝その骨1本だけ */
function selectAll() { if (mode === 'shape') { VSEL = allVerts().map(v => ({ id: v.id, mir: v.mir, r: v.r, k: v.k })); } else if (mode === 'bone' || mode === 'pose') { setSel(S.bones.map(b => b.id)); selJ = null; }
  updBtns(); needDraw = true; toast('全部えらんだ'); }
document.getElementById('allBtn').addEventListener('click', selectAll);
// ---- 地面に置く：何も選んでない＝体の一番下、骨を選んでる＝その骨の一番下、関節を選んでる＝その関節のあたりの一番下 を地面(高さ0)にぴったり ----
function groundTarget() { let minY = Infinity, what = '体の一番下'; const all = () => { for (const G of geomCache.values()) for (let i = 1; i < G.V.length; i += 3) minY = Math.min(minY, G.V[i]); };
  const b = sel != null && boneById(sel), G = b && geomCache.get(b.id);
  if (b && G && selJ != null && b.pts[selJ]) { const J = V3(b.pts[selJ]); let br = 0, bd = Infinity; G.path.forEach((p, r) => { const d = p.distanceTo(J); if (d < bd) { bd = d; br = r; } });
    for (let r = Math.max(0, br - 1); r <= Math.min(G.rings - 1, br + 1); r++) for (let k = 0; k < G.n; k++) minY = Math.min(minY, G.V[(r * G.n + k) * 3 + 1]); const capI = br === 0 ? G.rings * G.n : br === G.rings - 1 ? G.rings * G.n + 1 : -1; if (capI >= 0) minY = Math.min(minY, G.V[capI * 3 + 1]); what = 'この関節'; }
  else if (b && G) { for (let i = 1; i < G.V.length; i += 3) minY = Math.min(minY, G.V[i]); what = 'この骨'; } else all();
  return { minY, what }; }
function groundIt() { if(mode!=='pose'&&!skeletonEditable())return; if (!S.bones.length) return; rebuild(); const { minY, what } = groundTarget(); if (!isFinite(minY) || Math.abs(minY) < 1e-4) { toast(what + 'はもう地面に着いてる'); return; } pushUndo();
  for (const b of S.bones) b.pts = b.pts.map(p => [p[0], r4(p[1] - minY), p[2]]); markSynced(); rebuild(); if (mode === 'pose') commitPose(); save(); toast(what + 'を地面に着けた（体ごと上下）'); }
document.getElementById('groundBtn').addEventListener('click', groundIt);
try { new ResizeObserver(() => layout()).observe(document.getElementById('top')); new ResizeObserver(() => viewShift()).observe(document.getElementById('tl')); } catch (_) {}
// ---- 前後をひっくり返す（体の真ん中の縦の線を軸に180°）：左右対称はそのまま保つ ----
function flipFB() { if(!skeletonEditable())return false; const a2 = 2 * AX(), P = p => [r4(a2 - p[0]), p[1], r4(-p[2])], mp = o => { if (o) for (const id in o) if (Array.isArray(o[id])) o[id] = o[id].map(P); };
  const mpath = q => { if (!q) return q; if (Array.isArray(q)) return q.map(P); return { a: q.a.map(P), hi: q.hi.map(P), ho: q.ho.map(P) }; };
  const mAnim = A => { if (!A) return; (A.keys || []).forEach(k => mp(k.pose)); for (const f in A.seg || {}) { const g = A.seg[f]; for (const j in g.fix || {}) mp(g.fix[j]); for (const k in g.paths || {}) g.paths[k] = mpath(g.paths[k]); } };
  pushUndo();
  for (const b of S.bones) { const n = b.sides || 8, off = {}; b.pts = b.pts.map(P); const wp = b.wp; b.wp = b.wn; b.wn = wp; const dp = b.dp; b.dp = b.dn; b.dn = dp; if (b.atOff) b.atOff = [-b.atOff[0], b.atOff[1], -b.atOff[2]];
    for (const key in b.off || {}) { const [r, k] = key.split('_').map(Number), kx = mirK(b, k, n), kz = flipZK(b, kx, n), o = b.off[key]; off[r + '_' + kz] = [-o[0], -o[1], o[2]]; } b.off = off; }
  mAnim(S.anim); (S.acts || []).forEach(a => mAnim(a.anim)); mp(S.rest);
  markSynced(); rebuild(); save(); toast('前後をひっくり返した（左右対称はそのまま）'); }
document.getElementById('flipBtn').addEventListener('click', flipFB);
// ---- 関節を後から足す／抜く（アニメの原画・子の骨・反対側の骨も一緒に直す） ----
let addJMode = false, lastR = { t: 0, x: 0, y: 0 };
function poseStores() { const out = []; const addA = A => { if (!A) return; (A.keys || []).forEach(k => out.push(k.pose)); for (const f in A.seg || {}) for (const j in (A.seg[f].fix || {})) out.push(A.seg[f].fix[j]); }; addA(S.anim); (S.acts || []).forEach(a => addA(a.anim)); if (S.rest) out.push(S.rest); return out; }
function pathStores() { const out = []; const addA = A => { if (!A) return; for (const f in A.seg || {}) if (A.seg[f].paths) out.push(A.seg[f].paths); }; addA(S.anim); (S.acts || []).forEach(a => addA(a.anim)); return out; }
function reindexJoint(id, fn) { for (const c of S.bones) if (c.parent === id && c.at != null) c.at = fn(c.at); for (const ps of pathStores()) { const nw = {}; for (const k in ps) { const [bid, i] = k.split('_').map(Number); if (bid !== id) { nw[k] = ps[k]; continue; } const j = fn(i, true); if (j != null) nw[bid + '_' + j] = ps[k]; } for (const k in ps) delete ps[k]; Object.assign(ps, nw); } }
const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return a.map((_, k) => r4(0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3))); };
function insertJointAt(b, x, y) { if(!skeletonEditable())return false; const P = b.pts.map(p => proj(V3(p))); let bi = -1, bt = 0, bd = 24;
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], c = P[i + 1], dx = c.x - a.x, dy = c.y - a.y, t = Math.max(0.08, Math.min(0.92, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y); if (d < bd) { bd = d; bi = i; bt = t; } }
  if (bi < 0) { toast('骨の線の上でやってな'); return false; } pushUndo();
  const ins = (arr) => { const n = arr.length, p = i => arr[Math.max(0, Math.min(n - 1, i))]; arr.splice(bi + 1, 0, cr(p(bi - 1), p(bi), p(bi + 1), p(bi + 2), bt)); };
  for (const bb of [b, S.sym && b.twin != null ? boneById(b.twin) : null]) { if (!bb) continue; const n0 = bb.pts.length; ins(bb.pts); for (const st2 of poseStores()) if (st2[bb.id] && st2[bb.id].length === n0) ins(st2[bb.id]); reindexJoint(bb.id, i => i > bi ? i + 1 : i); }
  markSynced(); sel = b.id; SELB = []; selJ = bi + 1; trCache.key = ''; rebuild(); save(); updBtns(); toast('関節を足した（Deleteで抜ける）'); return true; }
function removeJoint(b, j) { if(!skeletonEditable())return false; if (j <= 0 || j >= b.pts.length - 1 || b.pts.length < 3) { toast('端っこの関節は抜けへん（骨ごと消すなら選び直してDelete）'); return; } pushUndo();
  for (const bb of [b, S.sym && b.twin != null ? boneById(b.twin) : null]) { if (!bb) continue; const n0 = bb.pts.length; bb.pts.splice(j, 1); for (const st2 of poseStores()) if (st2[bb.id] && st2[bb.id].length === n0) st2[bb.id].splice(j, 1); reindexJoint(bb.id, (i, isPath) => i === j ? (isPath ? null : j - 1) : i > j ? i - 1 : i); for (const c of S.bones) if (c.parent === bb.id) updOff(c); }
  markSynced(); selJ = null; trCache.key = ''; rebuild(); save(); updBtns(); toast('関節を抜いた'); }
document.getElementById('rootBtn').addEventListener('click', setRootHere);
document.getElementById('addJBtn').addEventListener('click', () => { if(!skeletonEditable())return; if (sel == null) return; addJMode = !addJMode; updBtns(); if (addJMode) toast('関節を足したい所を骨の上でタップ'); });
let lastTap = { t: 0, x: 0, y: 0 };
function tap(x, y, finger, jh) {
  if(mode==='paint'){if(finger)fillAt(x,y);return;}
  const now = performance.now(), dbl = now - lastTap.t < 330 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30; lastTap = { t: now, x, y };
  if (dbl) { lastTap.t = 0; const h = meshHit(x, y); if (h) { orbit.tx = h.point.x; orbit.ty = h.point.y; orbit.tz = h.point.z; } else { orbit.tx = 0; orbit.ty = 0.9; orbit.tz = 0; orbit.dist = 4.2; } return; }
  if (addJMode && mode === 'bone') { addJMode = false; const h = boneHit(x, y, finger ? 26 : 18); if (h) insertJointAt(h.b, x, y); else { toast('骨の線の上をタップしてな'); updBtns(); } return; }
  if (mode === 'shape') { if(lastPT!=='mouse')selectAt(x, y, finger); return; }
  if(lastPT==='mouse')return; /* マウス：左＝描く専用。選ぶのは右クリック（iPadのペン・指は今まで通りタップで選ぶ） */
  const bh = jh ? { b: jh.b } : (mode === 'sil' ? (() => { const h=meshHit(x,y); return h ? { b: boneById(h.object.userData.id) } : null; })() : null) || boneHit(x, y, 18) || (() => { const h = meshHit(x, y); return h ? { b: boneById(h.object.userData.id) } : null; })();
  const nid = bh ? bh.b.id : null;
  if (linkMode && mode === 'bone') { linkMode = false; updBtns(); if (!jh) jh = jointHit(x, y, finger ? 26 : 16); if (jh && sel != null && jh.b.id !== sel) linkTo(sel, jh); else toast('つなぎたい先の「関節」をタップしてな'); return; }
  if (mode === 'pose') { if (nid == null) { if (!addMode) { sel = null; SELB = []; selJ = null; } needDraw = true; return; } const grp = [nid, ...descIds(nid)];
    if (addMode && sel != null) { const all = new Set([sel, ...SELB]); for (const i of grp) all.add(i); setSel([...all]); } else setSel(grp); selJ = null; needDraw = true; return; } /* アニメ：その骨から先っぽまで */
  if (addMode && mode === 'bone' && nid != null && sel != null) { if (nid === sel) return; if (SELB.includes(nid)) SELB = SELB.filter(i => i !== nid); else SELB.push(nid); needDraw = true; return; } // 足して選ぶ
  if (nid !== sel) selJ = null; sel = nid; SELB = []; needDraw = true; }
// ---- 骨をつなぐ：選んでる骨の根元を、ほかの骨の関節にくっつける ----
function isDesc(x, b) { let c = x, g = 0; while (c && g++ < 99) { if (c.id === b.id) return true; c = c.parent != null ? boneById(c.parent) : null; } return false; }
function reverseBone(b) { if(!skeletonEditable())return false; const L = b.pts.length - 1, R = ringsOf(b); b.pts.reverse(); for (const k of ['wp', 'wn', 'dp', 'dn']) b[k] = b[k].map(p => ({ t: r4(1 - p.t), r: p.r })).reverse();
  const off = {}; for (const key in b.off || {}) { const [r, k] = key.split('_').map(Number); off[(R - 1 - r) + '_' + k] = b.off[key]; } b.off = off; for (const c of S.bones) if (c.parent === b.id && c.at != null) c.at = L - c.at; }
function attach(b, tgt, i) { if(!skeletonEditable())return false; const P = V3(tgt.pts[i]), d0 = V3(b.pts[0]).distanceTo(P), d1 = V3(b.pts[b.pts.length - 1]).distanceTo(P); if (d1 < d0) reverseBone(b); /* 近い方の端でつなぐ */
  b.parent = tgt.id; b.at = i; updOff(b); } /* 動かさずに関係だけ結ぶ */
function linkTo(id, jh) { if(!skeletonEditable())return false; const b = boneById(id); if (!b) return; const tgt = jh.b; if (tgt.id === b.id || isDesc(tgt, b)) { toast('自分の先っぽ側にはつなげへん'); return; }
  pushUndo(); attach(b, tgt, jh.i);
  if (S.sym && b.twin != null) { const t = boneById(b.twin), tt = tgt.twin != null && boneById(tgt.twin) ? boneById(tgt.twin) : tgt; if (t && t !== tt && !isDesc(tt, t)) attach(t, tt, jh.i); }
  rebuild(); save(); toast('つないだ（位置はそのまま）。親を動かすとついてくる'); }
const boneLen = b => { let L = 0; for (let i = 1; i < b.pts.length; i++) L += V3(b.pts[i]).distanceTo(V3(b.pts[i - 1])); return L; };
const mainRoot = () => { const R = S.bones.filter(b => b.parent == null); return R.length ? R.reduce((a, c) => boneLen(c) > boneLen(a) ? c : a) : null; };
function autoLink() { if(!skeletonEditable())return false; const main = mainRoot(); let n = 0, again = true;
  while (again) { again = false; for (const b of S.bones) { if (b.parent != null || b === main) continue; let best = null, bd = Math.max(0.06, 2.5 * profAt(b.wp, 0));
      for (const c of S.bones) { if (c === b || isDesc(c, b)) continue; c.pts.forEach((p, i) => { const d = V3(p).distanceTo(V3(b.pts[0])); if (d < bd) { bd = d; best = { c, i }; } }); } /* 根元だけ見る（逆向きにはしない） */
      if (best) { attach(b, best.c, best.i); n++; again = true; } } }
  return n; }
// ============ 描く ============
function draw() {
  og.clearRect(0, 0, W, H);
  if (mode === 'paint') { document.getElementById('panel').style.display = 'none'; document.body.classList.remove('panelOn'); return; }
  if ((S.sym || axisMode) && mode !== 'pose') { const a = AX(), seg = (p, q) => { const A = proj(new THREE.Vector3(...p)), B = proj(new THREE.Vector3(...q)); og.beginPath(); og.moveTo(A.x, A.y); og.lineTo(B.x, B.y); og.stroke(); };
    og.setLineDash([6, 6]); og.strokeStyle = axisMode ? 'rgba(138,79,208,.9)' : 'rgba(138,79,208,.35)'; og.lineWidth = axisMode ? 2 : 1.2; seg([a, 0, 0], [a, 2, 0]); seg([a, 0, -1], [a, 0, 1]); og.setLineDash([]); }
  { const a = AX(), G = (x, z) => proj(new THREE.Vector3(x, 0, z)), poly = (pts, fill) => { og.beginPath(); pts.forEach((q, i) => i ? og.lineTo(q.x, q.y) : og.moveTo(q.x, q.y)); og.closePath(); og.fillStyle = fill; og.fill(); };
    for (const sx of [-1, 1]) { const cx = a + sx * 0.1, pts = []; for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2, rz = Math.sin(t) > 0 ? 0.13 : 0.1; pts.push(G(cx + Math.cos(t) * (Math.sin(t) > 0 ? 0.05 : 0.042), Math.sin(t) * rz)); } poly(pts, 'rgba(43,42,39,.13)'); } /* 足跡（つま先が前） */
    og.strokeStyle = 'rgba(217,87,43,.55)'; og.lineWidth = 3; const s1 = G(a, 0.25), s2 = G(a, 0.62); og.beginPath(); og.moveTo(s1.x, s1.y); og.lineTo(s2.x, s2.y); og.stroke(); poly([G(a, 0.72), G(a - 0.07, 0.6), G(a + 0.07, 0.6)], 'rgba(217,87,43,.55)');
    og.font = '900 13px sans-serif'; og.textAlign = 'center'; og.fillStyle = 'rgba(217,87,43,.8)'; let q = G(a, 0.85); og.fillText('前', q.x, q.y);
    og.fillStyle = 'rgba(109,104,95,.75)'; og.font = '800 12px sans-serif'; for (const [x, z, t] of [[a, 2.1, '前'], [a, -2.1, '後ろ'], [a - 2.1, 0, 'キャラの右'], [a + 2.1, 0, 'キャラの左']]) { q = G(x, z); if (q.z < 1) og.fillText(t, q.x, q.y); }
    let cur = null; for (const k in PRE) { const p = PRE[k], dy = Math.atan2(Math.sin(p[0] - orbit.yaw), Math.cos(p[0] - orbit.yaw)); if (Math.abs(dy) < 0.06 && Math.abs(p[1] - orbit.pitch) < 0.06) cur = k; } if (k_vcur !== cur) { k_vcur = cur; document.querySelectorAll('#views button').forEach(x => x.classList.toggle('on', x.dataset.p === cur)); } }
  const MR = mainRoot(); if (mode !== 'shape') for (const c of S.bones) { const p = c.parent != null && boneById(c.parent); if (!p || !p.pts[c.at] || !c.atOff) continue; const a = proj(V3(c.pts[0])), q = proj(V3(p.pts[c.at])); og.setLineDash([3, 4]); og.strokeStyle = 'rgba(43,42,39,.55)'; og.lineWidth = 1.5; og.beginPath(); og.moveTo(a.x, a.y); og.lineTo(q.x, q.y); og.stroke(); og.setLineDash([]); }
  if (mode !== 'shape') for (const { b, mir } of allBones()) { const P = ptsOf(b, mir).map(proj), on = b.id === sel || SELB.includes(b.id), orphan = b.parent == null && b !== MR;
    og.strokeStyle = orphan ? 'rgba(220,30,30,.95)' : on ? 'rgba(217,87,43,.95)' : 'rgba(217,87,43,.45)'; if (orphan) og.setLineDash([6, 4]); og.lineWidth = on ? 3 : 2; og.lineCap = 'round'; og.beginPath(); P.forEach((p, i) => i ? og.lineTo(p.x, p.y) : og.moveTo(p.x, p.y)); og.stroke(); og.setLineDash([]);
    P.forEach((p, i) => { const js = on && !!mir === (mode === 'pose' && selMir) && selJ === i; og.fillStyle = js ? '#2b2a27' : on ? '#d9572b' : '#fff'; og.strokeStyle = '#d9572b'; og.lineWidth = 2; og.beginPath(); og.arc(p.x, p.y, js ? 8 : on ? 6 : 4, 0, 7); og.fill(); og.stroke(); }); }
  const b = boneById(sel);
  if (b && mode === 'sil') { const G = geomCache.get(b.id); if (G) for (const mir of [false]) {
    const mx = p => mir ? new THREE.Vector3(-p.x, p.y, p.z) : p, path = G.path.map(mx), mid = Math.floor(path.length / 2);
    if (facing(path)) { const F = { Wd: mx(G.F[mid].Wd.clone()), Dd: mx(G.F[mid].Dd.clone()) }; og.strokeStyle = 'rgba(47,111,208,.9)'; og.lineWidth = 2.5; og.beginPath(); for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), mr = k => Math.max(...b[k].map(p => p.r)), s = proj(path[mid].clone().addScaledVector(F.Wd, c * mr(c >= 0 ? 'wp' : 'wn')).addScaledVector(F.Dd, sn * mr(sn >= 0 ? 'dp' : 'dn'))); i ? og.lineTo(s.x, s.y) : og.moveTo(s.x, s.y); } og.stroke(); continue; }
    const s0 = proj(path[mid]), sw = proj(path[mid].clone().add(mx(G.F[mid].Wd.clone()))), sd = proj(path[mid].clone().add(mx(G.F[mid].Dd.clone()))), useW = Math.hypot(sw.x - s0.x, sw.y - s0.y) >= Math.hypot(sd.x - s0.x, sd.y - s0.y);
    for (const sg of [1, -1]) { og.strokeStyle = 'rgba(47,111,208,.9)'; og.lineWidth = 2.5; og.beginPath();
      path.forEach((p, i) => { const t = G.ts ? G.ts[i] : i / (path.length - 1), r = profAt(b[(useW ? 'w' : 'd') + (sg > 0 ? 'p' : 'n')], t), s = proj(p.clone().addScaledVector(mx(G.F[i][useW ? 'Wd' : 'Dd'].clone()), r * sg)); i ? og.lineTo(s.x, s.y) : og.moveTo(s.x, s.y); }); og.stroke(); } } }
  if (mode === 'shape') { // ローポリの線と点
    const AV = allVerts(), map = new Map(AV.map(v => [vKey(v), v])), selK = new Set(VSEL.map(vKey)); og.lineWidth = 1;
    for (const a of AV) { const G = geomCache.get(a.id); for (const [r2, k2] of [[a.r, (a.k + 1) % G.n], [a.r + 1, a.k]]) { const c = map.get(a.id + (a.mir ? 'm' : '') + ':' + r2 + '_' + k2); if (!c) continue; const on = selK.has(vKey(a)) && selK.has(vKey(c));
      og.strokeStyle = on ? 'rgba(217,87,43,.95)' : a.front && c.front ? 'rgba(47,111,208,.45)' : 'rgba(47,111,208,.07)'; og.lineWidth = on ? 3 : 1; og.beginPath(); og.moveTo(a.s.x, a.s.y); og.lineTo(c.s.x, c.s.y); og.stroke(); } }
    if (elm === 'v' || VSEL.length) for (const v of AV) { const on = selK.has(vKey(v)); if (!v.front && !on) continue; if (elm !== 'v' && !on) continue; og.fillStyle = on ? '#d9572b' : '#fff'; og.strokeStyle = on ? '#d9572b' : '#2f6fd0'; og.lineWidth = 1.5; og.beginPath(); og.arc(v.s.x, v.s.y, on ? 5 : 3, 0, 7); og.fill(); og.stroke(); } }
  const g = gizmoGeo(); if (g && !(st.drag && st.drag.kind === 'gizmo' && st.drag.axis.key === 'free')) { for (const a of g.axes) { if (st.drag && st.drag.kind === 'gizmo' && st.drag.axis.key !== a.key) continue;
      og.strokeStyle = a.col; og.fillStyle = a.col; og.lineWidth = 3; og.beginPath(); og.moveTo(g.sa.x, g.sa.y); og.lineTo(a.e.x, a.e.y); og.stroke(); const an = Math.atan2(a.e.y - g.sa.y, a.e.x - g.sa.x);
      og.beginPath(); og.moveTo(a.e.x + Math.cos(an) * 9, a.e.y + Math.sin(an) * 9); og.lineTo(a.e.x + Math.cos(an + 2.4) * 8, a.e.y + Math.sin(an + 2.4) * 8); og.lineTo(a.e.x + Math.cos(an - 2.4) * 8, a.e.y + Math.sin(an - 2.4) * 8); og.fill();
      og.font = '900 12px sans-serif'; og.textAlign = 'center'; og.fillText(a.label, a.e.x + Math.cos(an) * 20, a.e.y + Math.sin(an) * 20 + 4); }
    og.fillStyle = '#fff'; og.strokeStyle = '#2b2a27'; og.lineWidth = 2; og.beginPath(); og.arc(g.sa.x, g.sa.y, 7, 0, 7); og.fill(); og.stroke(); }
  const stk = st.stroke; if (stk && stk.pts.length > 1) { if (stk.lasso) og.setLineDash([7, 5]); og.strokeStyle = stk.paintCut ? (paintErase ? 'rgba(224,64,47,.45)' : 'rgba(43,42,39,.9)') : stk.lasso ? 'rgba(43,42,39,.85)' : stk.traj != null ? 'rgba(138,79,208,.95)' : mode === 'sil' ? 'rgba(47,111,208,.9)' : 'rgba(217,87,43,.9)'; og.lineWidth = stk.paintCut && paintErase ? 18 : 3; og.lineCap = 'round'; og.lineJoin = 'round'; og.beginPath(); stk.pts.forEach((p, i) => i ? og.lineTo(p.x, p.y) : og.moveTo(p.x, p.y)); if (stk.lasso) og.closePath(); og.stroke(); og.setLineDash([]); }
  if (mode === 'pose') { drawTraj(); drawPerf(); if (!ANIM.traj) drawRot(); } else if (mode === 'bone' && !S.tpl) drawRot();
  drawRoot();
  if (st.drag && st.drag.kind === 'grow' && st.drag.moved) { const a = proj(st.drag.jh.P); og.setLineDash([6, 5]); og.strokeStyle = 'rgba(217,87,43,.9)'; og.lineWidth = 3; og.beginPath(); og.moveTo(a.x, a.y); og.lineTo(st.drag.cx, st.drag.cy); og.stroke(); og.setLineDash([]); og.fillStyle = '#fff'; og.strokeStyle = '#d9572b'; og.lineWidth = 2; og.beginPath(); og.arc(st.drag.cx, st.drag.cy, 6, 0, 7); og.fill(); og.stroke(); }
  const pn = document.getElementById('panel'), showP = b && mode !== 'shape' && mode !== 'pose'; document.getElementById('silSizeWrap').style.display=mode==='sil'&&b?'flex':'none'; pn.style.display = showP ? 'flex' : 'none'; document.body.classList.toggle('panelOn', !!showP); /* パネルが出てる間はヒントを引っこめる（重なり防止） */
  document.getElementById('rootBtn').style.display = mode === 'bone' && selJ != null && !S.tpl ? '' : 'none';
  if (showP) { document.getElementById('sides').textContent = (b.sides || 8) + '角'; document.getElementById('pname').textContent = selJ != null && mode === 'bone' ? '関節' : SELB.length ? '骨×' + (SELB.length + 1) : '骨'; }
}
function drawRot() { const G = rotRings(); if (!G) return; const dr = st.drag && st.drag.kind === 'rot' ? st.drag.key : null;
  for (const r of G.rings) { if (dr && dr !== r.key) continue; og.strokeStyle = r.col; og.lineWidth = 3; og.beginPath(); r.pts.forEach((p, i) => i ? og.lineTo(p.s.x, p.s.y) : og.moveTo(p.s.x, p.s.y)); og.stroke(); }
  og.fillStyle = '#fff'; og.strokeStyle = '#2b2a27'; og.lineWidth = 2; og.beginPath(); og.arc(G.sa.x, G.sa.y, 7, 0, 7); og.fill(); og.stroke(); }
// ============ ボタン ============
const PCHINT = '左＝描く／右クリック＝選ぶ（Shift＋右で足す・外す／骨・アニメは右なぞりで投げ縄）／骨の途中を右ダブルクリック＝関節を足す・関節を選んでDelete＝抜く／Q W E R＝モード／中ボタン＝回す・Shift＋中ボタン＝平行移動／Esc＝選択を外す　｜　';
const HINT = { bone: '左ドラッグ＝骨を描く／関節を左でつかんで引っぱる＝そこから骨が生える（先っぽなら伸びる）／関節を右ドラッグ＝動かす（その先は形のまま付いてくる）／関節を右クリック→輪で回す（親を軸に振る）／「ここを腰に」＝根っこ。親子は腰から数える',
  sil: '右クリックで骨を選ぶ→左ドラッグで骨の横に輪郭を描く。左右対称ONなら反対側も連動（骨の向きに応じて幅・厚みを判定）／指で回す',
  shape: '細部：右クリックで見える点・線・面を選び、左で矢印を動かす。輪・縦で選択を広げる。「顔ライン」で目・口の線を描く。面の分割なし',
  pose: '先っぽを左で引っぱる＝IK（分かれ道まで・Shiftで腰まで）／関節を右クリック＝回す輪／● 録る＝再生しながら動かして記録→なめらか・コマ打ちで育てて決定（▼＝原画の候補）／脚：動きの元にする→右クリックでつなぐ・なぞると等間隔ずらし／「軌道」で間を直す',
  paint: 'ペンでなぞる＝線を引く（そこで面が割れる）／タップ＝囲まれた所をその色で塗る。線が閉じてないと全体が塗れる。指で回す・寄る。「線を消す」でなぞった線を消す' };

function paintPanelPosition() {
  const p=document.getElementById('paintPicker'), bar=document.getElementById('top2');
  if(p&&bar){const y=bar.getBoundingClientRect().bottom+9;p.style.top=y+'px';p.style.maxHeight=Math.max(120,innerHeight-y-10)+'px';}
}
const paintClamp=n=>Math.max(0,Math.min(1,n));
function paintHexToHSV(hex){
  const n=parseInt(hex.slice(1),16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  let h=0;if(d){switch(mx){case r:h=((g-b)/d)%6;break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h=(h*60+360)%360;}
  return {h,s:mx?d/mx:0,v:mx};
}
function paintHSVToHex(h,s,v){
  h=((h%360)+360)%360;s=paintClamp(s);v=paintClamp(v);
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  const a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+a.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
let paintHSV=paintHexToHSV(document.getElementById('paintColor').value);
function paintUpdateUI(){
  const sq=document.getElementById('paintSV'),hue=document.getElementById('paintHue');
  sq.style.backgroundColor='hsl('+paintHSV.h+',100%,50%)';
  const d=document.getElementById('paintDot');d.style.left=(paintHSV.s*100)+'%';d.style.top=((1-paintHSV.v)*100)+'%';
  hue.value=String(Math.round(paintHSV.h));
  const hex=paintHSVToHex(paintHSV.h,paintHSV.s,paintHSV.v);
  document.getElementById('paintColor').value=hex;hue.style.accentColor=hex;
  sq.setAttribute('aria-label','彩度'+Math.round(paintHSV.s*100)+'％・明るさ'+Math.round(paintHSV.v*100)+'％');
}
{
  const color=document.getElementById('paintColor'),sq=document.getElementById('paintSV'),hue=document.getElementById('paintHue');
  color.addEventListener('input',()=>{paintHSV=paintHexToHSV(color.value);paintUpdateUI();});
  hue.addEventListener('input',()=>{paintHSV.h=+hue.value;paintUpdateUI();});
  const drag=e=>{const r=sq.getBoundingClientRect();paintHSV.s=paintClamp((e.clientX-r.left)/r.width);paintHSV.v=1-paintClamp((e.clientY-r.top)/r.height);paintUpdateUI();};
  sq.addEventListener('pointerdown',e=>{e.preventDefault();sq.setPointerCapture(e.pointerId);drag(e);});
  sq.addEventListener('pointermove',e=>{if(sq.hasPointerCapture(e.pointerId))drag(e);});
  sq.addEventListener('keydown',e=>{
    const n=e.shiftKey?0.1:0.02;
    if(e.key==='ArrowLeft')paintHSV.s=paintClamp(paintHSV.s-n);
    else if(e.key==='ArrowRight')paintHSV.s=paintClamp(paintHSV.s+n);
    else if(e.key==='ArrowUp')paintHSV.v=paintClamp(paintHSV.v+n);
    else if(e.key==='ArrowDown')paintHSV.v=paintClamp(paintHSV.v-n);
    else return;
    e.preventDefault();paintUpdateUI();
  });
  paintUpdateUI();
}
function updBtns() { document.getElementById('paintPicker').style.display = mode === 'paint' ? 'flex' : 'none'; paintPanelPosition(); document.getElementById('undo').disabled = !undoS.length; document.getElementById('redo').disabled = !redoS.length; { const he = document.getElementById('hint'), ht = (document.body.classList.contains('pc') ? PCHINT : '') + HINT[mode]; if (he.textContent !== ht) { he.textContent = ht; he.classList.remove('dim'); clearTimeout(he._t); he._t = setTimeout(() => he.classList.add('dim'), 9000); } } /* ヒントは9秒で消える（モードを変えるとまた出る） */
  if (symBtn.dataset.arm !== '1') symBtn.textContent = mode === 'pose' ? '左右そろえる' : '左右対称'; symBtn.classList.toggle('on', mode === 'pose' ? !!S.animSym : !!S.sym); document.getElementById('look').textContent = smooth ? 'ローポリ' : 'なめらか';
  document.getElementById('autoLinkBtn').style.display = mode === 'bone' ? '' : 'none'; document.getElementById('flipBtn').style.display = mode === 'bone' ? '' : 'none'; document.getElementById('groundBtn').style.display = mode === 'bone' || mode === 'pose' ? '' : 'none'; for(const id of ['linkBtn','unlinkBtn','del','alignBtn','axisBtn','addJBtn','autoLinkBtn','flipBtn'])document.getElementById(id).disabled=!!S.tpl; const sh = mode === 'shape'; document.getElementById('elm').style.display = sh ? 'flex' : 'none'; document.getElementById('loopBtn').style.display = sh ? '' : 'none'; document.getElementById('stripBtn').style.display = sh ? '' : 'none'; document.getElementById('detailInkBtn').style.display=sh?'':'none';if(!sh&&detailInkMode)setDetailInkMode(false);
  const ab = document.getElementById('addBtn'); ab.style.display = sh || mode === 'bone' || mode === 'pose' ? '' : 'none'; document.getElementById('lassoBtn').style.display = mode === 'bone' || mode === 'pose' ? '' : 'none'; document.getElementById('lassoBtn').classList.toggle('on', lassoMode); ab.classList.toggle('on', addMode); document.getElementById('linkBtn').classList.toggle('on', linkMode); document.getElementById('addJBtn').classList.toggle('on', addJMode); document.getElementById('addJBtn').style.display = mode === 'bone' ? '' : 'none'; document.getElementById('axisBtn').classList.toggle('on', axisMode); }
document.querySelectorAll('#modes button').forEach(bt => bt.addEventListener('click', () => { st.stroke=null;st.drag=null;linkMode=false;addJMode=false;lassoMode=false;mode = bt.dataset.m; document.querySelectorAll('#modes button').forEach(x => x.classList.toggle('on', x === bt)); const was = document.body.classList.contains('anim'); if (mode !== 'bone') axisMode = false; if (mode !== 'bone') selJ = null; selMir = false; if (mode === 'pose' && !was) { document.body.classList.add('anim'); enterAnim(); tlLayout(); drawTL(); viewShift(); if (S.sym && S.bones.some(b => !isCenter(b))) toast('左右バラバラに動かすなら「左右対称」を切ってな（切っても消えへん）'); } else if (mode !== 'pose' && was) { document.body.classList.remove('anim'); exitAnim(); save(); viewShift(); } updBtns(); needDraw = true; }));
document.querySelectorAll('#elm button').forEach(bt => bt.addEventListener('click', () => { elm = bt.dataset.e; document.querySelectorAll('#elm button').forEach(x => x.classList.toggle('on', x === bt)); VSEL = []; needDraw = true; }));
document.getElementById('loopBtn').addEventListener('click', () => loopSelect('ring')); document.getElementById('stripBtn').addEventListener('click', () => loopSelect('strip'));
document.getElementById('linkBtn').addEventListener('click', () => { if(!skeletonEditable())return; if (sel == null) return; linkMode = !linkMode; updBtns(); if (linkMode) toast('つなぎ先の骨の「関節」をタップ'); });
document.getElementById('autoLinkBtn').addEventListener('click', () => { const before = clone(S), n = autoLink(); if (n) { undoS.push(before); redoS.length = 0; rebuild(); save(); updBtns(); toast(n + '本つないだ'); } else toast('つなげる骨はなかった（赤い点線の骨は、つなぎ先が遠い）'); });
document.getElementById('lassoBtn').addEventListener('click', () => { lassoMode = !lassoMode; updBtns(); if (lassoMode) toast('ペンで囲んだ骨をまとめて選ぶ'); });
function unlinkSelectedBone(){ if(!skeletonEditable())return false; const b = boneById(sel); if (!b || b.parent == null) { toast('この骨はどこにもつながってへん'); return; } pushUndo();
  for (const x of [b, S.sym && b.twin != null ? boneById(b.twin) : null]) if (x) { x.parent = null; delete x.at; delete x.atOff; } rebuild(); save(); toast('つながりを外した（赤い点線になる）'); }
document.getElementById('unlinkBtn').addEventListener('click',unlinkSelectedBone);
document.getElementById('addBtn').addEventListener('click', () => { addMode = !addMode; updBtns(); });
const PRE = { front: [0, 0], q: [0.7, 0.25], side: [Math.PI / 2, 0], top: [0, 1.45], back: [Math.PI, 0] };
document.querySelectorAll('#views button').forEach(bt => bt.addEventListener('click', () => { const p = PRE[bt.dataset.p]; let yaw = p[0]; if (bt.dataset.p === 'side') yaw = Math.sin(orbit.yaw) >= 0 ? Math.PI / 2 : -Math.PI / 2; /* 近い方の側面 */ orbit.goal = { yaw, pitch: p[1] }; }));
function afterLoad() { setDetailInkMode(false); migrate(); migrate6(); markSynced(); if (mode === 'pose') { enterAnim(); drawTL(); } else if (S.rest) { applyPose(S.rest); delete S.rest; } sel = null; selJ = null; VSEL = []; SELB = []; linkMode = false; rebuild(); save(); updBtns(); }
document.getElementById('undo').addEventListener('click', () => { if (!undoS.length) return; redoS.push(clone(S)); S = undoS.pop(); afterLoad(); });
document.getElementById('redo').addEventListener('click', () => { if (!redoS.length) return; undoS.push(clone(S)); S = redoS.pop(); afterLoad(); });
function mirrorBoneData(b, newId, idMap) { // 鏡の骨を本物にする（幅の±と、形のいじりの左右を入れかえる）
  const n = b.sides || 8, off = {}; for (const key in b.off || {}) { const [r, k] = key.split('_').map(Number), k2 = mirK(b, k, n), o = b.off[key]; off[r + '_' + k2] = [-o[0], o[1], o[2]]; }
  return { av: b.av ? 1 : undefined, id: newId, parent: b.parent == null ? null : (idMap.get(b.parent) || b.parent), at: b.at, pts: b.pts.map(p => [-p[0], p[1], p[2]]), wp: clone(b.wn), wn: clone(b.wp), dp: clone(b.dp), dn: clone(b.dn), off, sides: b.sides, rings: b.rings, twin: b.id }; }
const symBtn = document.getElementById('sym');
symBtn.addEventListener('click', () => { if (mode === 'pose') { pushUndo(); S.animSym = !S.animSym; markSynced(); toast(S.animSym ? 'アニメで左右そろえる：片方の脚を動かすと反対も同じ形になる' : 'アニメは左右バラバラ（歩きや走りはこっち）'); save(); updBtns(); return; } pushUndo(); S.sym = !S.sym; if(S.sym)alignSilhouetteSymmetryOnEnable(); markSynced(); rebuild(); toast(S.sym ? '左右対称オン：片方いじると反対側もついてくる' : '左右対称オフ：左右バラバラにいじれる（何も消えへん）'); save(); updBtns(); });
let axisMode = false;
document.getElementById('axisBtn').addEventListener('click', () => { if(!skeletonEditable())return; axisMode = !axisMode; if (axisMode) { sel = null; selJ = null; SELB = []; toast('赤い矢印で対称の軸をずらす（骨は動かへん）'); } updBtns(); needDraw = true; });
document.getElementById('alignBtn').addEventListener('click', () => { if(!skeletonEditable())return; const b = boneById(sel); if (!b) return; pushUndo();
  if (isCenter(b) || b.pts.every(p => Math.abs(p[0] - AX()) < 0.08)) { b.pts.forEach(p => { p[0] = AX(); }); b.wn = clone(b.wp); markSynced(); toast('真ん中の骨：軸にそろえて左右の幅も同じにした'); }
  else { const t = b.twin != null && boneById(b.twin); if (t) { mirrorInto(b, t); toast('反対側をこっちにそろえた'); } else { makeTwin(b); toast('反対側に骨を作ってそろえた'); } markSynced(); }
  rebuild(); save(); });
document.getElementById('look').addEventListener('click', () => { smooth = !smooth; rebuild(); updBtns(); });
document.getElementById('sides').addEventListener('click', () => { const b = boneById(sel); if (!b) return; pushUndo(); b.sides = { 6: 8, 8: 12, 12: 4, 4: 6 }[b.sides || 8] || 8; b.off = {}; rebuild(); save(); toast('角数を変えたので、形のいじりはリセット'); });
document.getElementById('resetShape').addEventListener('click', () => { const b = boneById(sel); if (!b) return; pushUndo(); b.off = {}; rebuild(); save(); });
function deleteSelectedBones(){ if(!skeletonEditable())return false; const b = boneById(sel); if (!b) return; pushUndo(); const kill = new Set(selBones()); if (S.sym) for (const id of [...kill]) { const x = boneById(id); if (x && x.twin != null) kill.add(x.twin); } let ch = true; while (ch) { ch = false; for (const c of S.bones) if (!kill.has(c.id) && kill.has(c.parent)) { kill.add(c.id); ch = true; } } S.bones = S.bones.filter(c => !kill.has(c.id)); for (const c of S.bones) if (kill.has(c.twin)) delete c.twin; sel = null; selJ = null; rebuild(); save(); }
document.getElementById('del').addEventListener('click',deleteSelectedBones);
// ---- 作品（このファイルの中に保存） ----
const WORKS_KEY = window.ProjectData.keys.works, CUR_KEY = window.ProjectData.keys.current;
const loadWorks = window.BoneStorage.loadWorks;
const saveWorks = window.BoneStorage.saveWorks;
let curWork = null; try { curWork = localStorage.getItem(CUR_KEY) || null; } catch (_) {}
function setCur(id) { curWork = id; try { id ? localStorage.setItem(CUR_KEY, id) : localStorage.removeItem(CUR_KEY); } catch (_) {} const w = loadWorks().find(x => x.id === curWork); document.getElementById('workName').textContent = w ? w.name : ''; }
function thumb() { camUpdate(); renderer.render(scene, cam); const c = document.createElement('canvas'); c.width = 200; c.height = 150; const g = c.getContext('2d'), src = renderer.domElement, sw = src.width, sh = src.height, ar = 4 / 3; let w = sw, h = sw / ar; if (h > sh) { h = sh; w = sh * ar; } g.drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, 200, 150); return c.toDataURL('image/jpeg', 0.75); }
function saveCurrent(asNew) { const l = loadWorks(), now = Date.now(); let w = !asNew && l.find(x => x.id === curWork); if (!w) { w = { id: 'w' + now, name: '作品' + (l.length + 1), created: now }; l.unshift(w); }
  w.data = clone(S); w.updated = now; if (!w.thumbFixed) w.thumb = thumb(); if (!saveWorks(l)) { toast('保存できへんかった（容量がいっぱいかも）'); return; } setCur(w.id); toast('「' + w.name + '」に保存した'); }
function renderWorks() { const box = document.getElementById('worksList'), l = loadWorks(); box.innerHTML = ''; if (!l.length) { box.innerHTML = '<div class="empty">まだ作品がない。「保存」を押すとここに並ぶ</div>'; return; }
  for (const w of l) { const card = document.createElement('div'); card.className = 'work' + (w.id === curWork ? ' cur' : ''); const d = new Date(w.updated || w.created);
    card.innerHTML = `<img alt=""><div class="nm"></div><div class="dt">${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}</div><div class="acts"><button data-a="open">開く</button><button data-a="pic">写真</button><button data-a="dup">複製</button><button data-a="ren">名前</button><button data-a="del">消す</button></div>`;
    card.querySelector('img').src = w.thumb || ''; card.querySelector('.nm').textContent = w.name;
    card.querySelector('[data-a=open]').onclick = () => { pushUndo(); S = clone(w.data); setCur(w.id); afterLoad(); closeWorks(); };
    card.querySelector('[data-a=pic]').onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const f = inp.files[0]; if (!f) return; const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'), s2 = Math.max(320 / img.width, 240 / img.height); g.drawImage(img, (320 - img.width * s2) / 2, (240 - img.height * s2) / 2, img.width * s2, img.height * s2);
      const l2 = loadWorks(), t = l2.find(x => x.id === w.id); if (t) { t.thumb = c.toDataURL('image/jpeg', 0.8); t.thumbFixed = true; saveWorks(l2); renderWorks(); toast('調査表の写真を変えた'); } URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); }; inp.click(); };
    card.querySelector('[data-a=dup]').onclick = () => { const l2 = loadWorks(), c2 = clone(w); c2.id = 'w' + Date.now(); c2.name = w.name + 'のコピー'; c2.created = c2.updated = Date.now(); l2.unshift(c2); saveWorks(l2); renderWorks(); };
    card.querySelector('[data-a=ren]').onclick = () => { const nm = card.querySelector('.nm'), inp = document.createElement('input'); inp.value = w.name; nm.replaceWith(inp); inp.focus(); inp.select(); const done = () => { const l2 = loadWorks(), t = l2.find(x => x.id === w.id); if (t && inp.value.trim()) { t.name = inp.value.trim(); saveWorks(l2); } renderWorks(); setCur(curWork); }; inp.onblur = done; inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); }; };
    const del = card.querySelector('[data-a=del]'); del.onclick = () => { if (del.dataset.arm !== '1') { del.dataset.arm = '1'; del.textContent = 'もう一度'; setTimeout(() => { del.dataset.arm = ''; del.textContent = '消す'; }, 2500); return; } saveWorks(loadWorks().filter(x => x.id !== w.id)); if (curWork === w.id) setCur(null); renderWorks(); };
    box.appendChild(card); } }
const closeWorks = () => document.getElementById('worksDlg').classList.remove('show');
document.getElementById('saveBtn').onclick = () => saveCurrent(false);
document.getElementById('worksBtn').onclick = () => { renderWorks(); document.getElementById('worksDlg').classList.add('show'); };
document.getElementById('closeWorks').onclick = closeWorks;
// ---- 作品の書き出し・読み込み（別の場所・iPadへ持っていく用） ----
const xf = document.getElementById('xfer'), xt = document.getElementById('xText'), xn = document.getElementById('xNote');
function xShow(mode) { xf.style.display = 'flex'; xf.dataset.mode = mode; document.getElementById('xCopy').style.display = mode === 'out' ? '' : 'none'; document.getElementById('xFile').style.display = document.getElementById('xLoad').style.display = mode === 'in' ? '' : 'none'; }
document.getElementById('xOut').onclick = () => { const L = loadWorks(); if (!L.length) { toast('まだ作品がない'); return; } const txt = JSON.stringify({ type: 'yuya_bone_works', v: 1, works: L }); xt.value = txt; xShow('out');
  xn.textContent = L.length + '作品を文字にした。コピーして、持っていきたい方の工房で「読み込む」→貼り付け。メモアプリやDriveに貼って保管もできる';
  try { navigator.clipboard.writeText(txt).then(() => toast('コピーした'), () => { xt.focus(); xt.select(); toast('選んだから Ctrl+C（iPadは長押し→コピー）'); }); } catch (_) { xt.focus(); xt.select(); } };
document.getElementById('xCopy').onclick = () => { try { navigator.clipboard.writeText(xt.value).then(() => toast('コピーした'), () => { xt.focus(); xt.select(); toast('選んだから Ctrl+C（iPadは長押し→コピー）'); }); } catch (_) { xt.focus(); xt.select(); } };
document.getElementById('xIn').onclick = () => { xt.value = ''; xShow('in'); xn.textContent = '「ファイルから」で保存したファイルを選ぶか、書き出した文字を貼り付けて「この中身を読み込む」。同じ作品は新しい方で上書き、無いのは足す'; xt.focus(); };
document.getElementById('xClose').onclick = () => { xf.style.display = 'none'; };
document.getElementById('xFile').onclick = () => document.getElementById('xFileIn').click();
document.getElementById('xFileIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { xt.value = r.result; doImport(); }; r.readAsText(f); e.target.value = ''; };
document.getElementById('xLoad').onclick = doImport;
function doImport() { let o = null; try { o = JSON.parse(xt.value.trim()); } catch (_) {} const inc = o && Array.isArray(o.works) ? o.works : o && o.bones ? [{ id: 'w' + Date.now(), name: '読み込んだ作品', created: Date.now(), updated: Date.now(), data: o }] : null;
  if (!inc) { toast('読めへんかった。書き出した文字を全部貼ってな'); return; } const L = loadWorks(); let add = 0, upd = 0;
  for (const w of inc) { if (!w || !w.data || !w.data.bones) continue; const i = L.findIndex(x => x.id === w.id); if (i < 0) { L.push(w); add++; } else if ((w.updated || 0) > (L[i].updated || 0)) { L[i] = w; upd++; } }
  L.sort((a, b) => (b.updated || 0) - (a.updated || 0)); if (!saveWorks(L)) { toast('保存できへんかった（容量がいっぱいかも）'); return; } renderWorks(); xf.style.display = 'none'; toast(add + '作品を足して、' + upd + '作品を新しくした'); }
document.getElementById('worksDlg').addEventListener('pointerdown', e => { if (e.target.id === 'worksDlg') closeWorks(); });
document.getElementById('saveAs').onclick = () => { saveCurrent(true); renderWorks(); };
// 種族の設計図から始める（試す用）：骨は種族の形で固定、形・アニメ・つなぎ・腰は自由
function startSpecies(k) { const D = TPL.data(k); if (!D) return; pushUndo(); const R0 = {}; for (const b of D.bones) R0[b.id] = clone(b.pts);
  const acts = TPL.slots(k).map(x => ({ name: x.name, slot: x.slot, anim: TPL.animFor(k, x.slot, R0, D.bones) })), ai = Math.max(0, acts.findIndex(a => a.slot === 'walk')); D.acts = acts; D.actI = ai; D.anim = acts[ai].anim; acts[ai].anim = null;
  S = D; setCur(null); afterLoad(); closeWorks(); { const P = S.bones.flatMap(b => b.pts), mn = [0, 1, 2].map(i => Math.min(...P.map(p => p[i]))), mx = [0, 1, 2].map(i => Math.max(...P.map(p => p[i]))); orbit.tx = (mn[0] + mx[0]) / 2; orbit.ty = (mn[1] + mx[1]) / 2; orbit.tz = (mn[2] + mx[2]) / 2; orbit.dist = Math.max(1.6, Math.min(4.2, Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) * 2.6)); } /* 体が画面の真ん中に来るように */ toast('「' + TPL.KINDS[k].name + '」から始めた。骨は種族の形（アニメ・形・色は自由）'); }
{ const box = document.createElement('div'); box.className = 'spRow'; box.innerHTML = '<span>種族から始める</span>'; const KS = window.BoneTemplates.KINDS; for (const k in KS) { const bt = document.createElement('button'); bt.className = 'btn'; bt.textContent = KS[k].name; bt.onclick = () => startSpecies(k); box.appendChild(bt); }
  const hd = document.querySelector('#worksDlg .hd'); hd.after(box); }
document.getElementById('newWork').onclick = () => { pushUndo(); S = newState(); setCur(null); afterLoad(); closeWorks(); toast('まっさら。ペンで骨を描こう'); };
// ============ ループ ============
addEventListener('resize', () => { if (mode === 'pose') { tlLayout(); drawTL(); } });
function loop() { const now=performance.now(); animTick(now); paceTrialTick(now); camUpdate(); if (needRebuild) { needRebuild = false; rebuild(); } renderer.render(scene, cam); draw(); requestAnimationFrame(loop); }
migrate6(); markSynced(); setCur(curWork); rebuild(); updBtns(); requestAnimationFrame(loop);
// 拾った設計図（種族）の骨は固定：数・つながり・長さ・大きさは変えられへん。形とアニメで自分の腕を出す
{ const bb = document.querySelector('#modes [data-m="bone"]');
  bb.addEventListener('click', e => { if (S && S.tpl) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  setInterval(() => { const lock = !!(S && S.tpl); bb.style.opacity = lock ? 0.35 : ''; bb.title = lock ? '設計図の骨は変えられへん（種族の骨格）' : '';
    if (lock && mode === 'bone') document.querySelector('#modes [data-m="shape"]').click(); }, 300); }

function paintAt(x,y){
  camUpdate();const h=meshHit(x,y);if(!h||!Number.isInteger(h.faceIndex))return;
  const b=boneById(h.object.userData.id);if(!b)return;
  const color=document.getElementById('paintColor').value;if(b.paint&&b.paint[h.faceIndex]===color)return;
  pushUndo();if(!b.paint)b.paint={};b.paint[h.faceIndex]=color;needRebuild=true;save();
}
const __bone = id => boneById(id);
window.__bt = { get S() { return S; }, orbit, proj, rebuild, setMode(m) { document.querySelector(`#modes [data-m="${m}"]`).click(); }, get sel() { return sel; }, set sel(v) { sel = v; }, get VSEL() { return VSEL; }, gizmoGeo, allVerts, vPos, saveCurrent, loadWorks, ANIM, poseAt, gotoFrame, commitPose, actionLine, rotRings, get selJ() { return selJ; }, finishSil, geomCache: () => geomCache, boneHit, jointHit, flowSel, setSel, lassoSelect, get SELB() { return SELB; }, autoLink, linkTo: (id, b, i) => linkTo(id, { b: __bone(b), i }), mainRoot, tracks, segOf, segInfo, trajTap, selBez, trajDown, AX, get axisMode() { return axisMode; } };
// <tpl_lib>
// ---- 設計図のテンプレ（動きのお手本）と、今の骨への当てはめ ----
// お手本は「拾った時の骨」で作ってある。骨の形・長さ・関節の数を変えても、各骨の「向きの変わり方」を写すので付いてくる。
const TPL = window.BoneTemplates;
// </tpl_lib>
// ---- お手本に戻す（この動き／この骨／全部） ----
function updTpl() { const k = TPL.detect(S), cur = S.acts && S.acts[S.actI], has = !!(k && cur && TPL.slots(k).some(x => x.slot === cur.slot)); const g = document.getElementById('tplGrp'); g.style.display = k ? 'inline-flex' : 'none';
  document.getElementById('tplAct').disabled = !has; document.getElementById('tplBone').disabled = !has; }
function tplAfter(msgTxt) { migrateAnim(); ANIM.f = Math.min(ANIM.f, S.anim.len); ANIM.tsel = null; applyPose(poseAt(ANIM.f)); trCache.key = ''; rebuild(); save(); drawTL(); updBtns(); updTpl(); toast(msgTxt); }
document.getElementById('tplAct').onclick = () => { const k = TPL.detect(S), cur = S.acts && S.acts[S.actI]; if (!k || !cur) return; const A = TPL.animFor(k, cur.slot, S.rest || snapshot(), S.bones); if (!A) { toast('この動きにはお手本がない'); return; }
  pushUndo(); S.anim = A; tplAfter('「' + cur.name + '」をお手本に戻した（戻すで戻せる）'); };
document.getElementById('tplBone').onclick = () => { const k = TPL.detect(S), cur = S.acts && S.acts[S.actI]; if (!k || !cur) return; if (sel == null) { toast('先に骨を選んでな'); return; } const T = TPL.animFor(k, cur.slot, S.rest || snapshot(), S.bones); if (!T) { toast('この動きにはお手本がない'); return; }
  pushUndo(); const b = boneById(sel), ids = [sel]; if (S.sym && b && b.twin != null) ids.push(b.twin); const A = S.anim;
  for (const tk of T.keys) if (tk.f <= A.len && !A.keys.some(x => x.f === tk.f)) { const P = clone(poseAt(tk.f)); A.keys.push({ f: tk.f, pose: P }); } A.keys.sort((x, y) => x.f - y.f); /* お手本の原画のコマが無ければ足す（他の骨は今の動きのまま） */
  for (const key of A.keys) for (const id of ids) { const v = TPL.sample(T, key.f, id); if (v && (!key.pose[id] || key.pose[id].length === v.length)) key.pose[id] = v; }
  for (const f in A.seg || {}) { const g = A.seg[f]; for (const pk in g.paths || {}) if (ids.includes(+pk.split('_')[0])) delete g.paths[pk]; for (const j in g.fix || {}) for (const id of ids) delete g.fix[j][id]; }
  tplAfter('この骨の動きをお手本に戻した'); };
{ const ab = document.getElementById('tplAll'); ab.onclick = () => { const k = TPL.detect(S); if (!k) return; if (ab.dataset.arm !== '1') { ab.dataset.arm = '1'; ab.textContent = 'もう一回で戻す'; ab.style.color = '#c0392b'; setTimeout(() => { ab.dataset.arm = ''; ab.textContent = '全部'; ab.style.color = ''; }, 2500); return; }
  ab.dataset.arm = ''; ab.textContent = '全部'; ab.style.color = ''; pushUndo(); const D = TPL.data(k), R0 = {}; for (const b of D.bones) R0[b.id] = clone(b.pts);
  const acts = TPL.slots(k).map(x => ({ name: x.name, slot: x.slot, anim: TPL.animFor(k, x.slot, R0, D.bones) })), cur = S.acts && S.acts[S.actI], ai = Math.max(0, acts.findIndex(a => a.slot === (cur ? cur.slot : 'attack')));
  S.bones = D.bones; S.sym = D.sym; S.axis = D.axis; S.tpl = D.tpl; if (D.root) S.root = D.root; else delete S.root; delete S.rest; S.acts = acts; S.actI = ai; S.anim = acts[ai].anim; acts[ai].anim = null; sel = null; selJ = null; $('actSel').dataset.sig = '';
  afterLoad(); if (mode === 'pose') { enterAnim(); drawActSel(); drawTL(); } save(); updTpl(); toast('拾った時の状態に戻した（戻すで戻せる）'); }; }

// <bone_sync>
// ---- 工房・狩り場の作品をクラウド（このページのdb）と同期する ----
// localStorage の作品リストを「作業用の手元コピー」として、db の works/<id> と3方向で突き合わせる。
// 下書き（今いじってる状態）は draft/current に新しい方勝ちで置く。
const boneCloud = window.BoneStorage.boneCloud;
// </bone_sync>
const capUse = n => { let C = window.claude; if (!C) { try { C = parent !== window ? parent.claude : null; } catch (_) { C = null; } } try { return C && C.use ? C.use(n).catch(() => null) : Promise.resolve(null); } catch (_) { return Promise.resolve(null); } };
const cloudSt = (t, warn) => { const e = document.getElementById('cloudSt'); e.textContent = t; e.style.color = warn ? '#c0392b' : ''; };
const worksOpen = () => document.getElementById('worksDlg').classList.contains('show');
let outerSync = false; try { outerSync = parent !== window && !!parent.__boneOuter; } catch (_) {}
if (window.claude && !outerSync) boneCloud({ use: n => { try { return window.claude.use(n).catch(() => null); } catch (_) { return Promise.resolve(null); } }, status: cloudSt,
  onWorks: () => { if (worksOpen()) renderWorks(); setCur(curWork); },
  onDraft: () => { try { const sv = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!sv || !sv.bones) return; S = sv; curWork = localStorage.getItem(CUR_KEY) || null; setCur(curWork); afterLoad(); toast('クラウドの続きを開いた'); } catch (_) {} } });
else addEventListener('storage', e => { if (e.key === WORKS_KEY) { if (worksOpen()) renderWorks(); setCur(curWork); } });
const stamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`; };
document.getElementById('fSave').onclick = async () => { const L = loadWorks(); if (!L.length) { toast('まだ作品がない'); return; } const txt = JSON.stringify({ type: 'yuya_bone_works', v: 1, works: L }); const dl = await capUse('downloads');
  const fb = () => { document.getElementById('xOut').click(); toast('ここではファイル保存できへんから、文字で出した'); };
  if (!dl) { fb(); return; } try { await dl.save({ filename: `工房の作品_${stamp()}.json`, data: txt }); toast(L.length + '作品をファイルに保存した'); } catch (e) { const c = e && e.code; if (c === 'declined') return; if (c === 'rate_limited') { toast('ちょっと待ってからもう一回'); return; } fb(); } };
window.__stressState = () => ({ mode, sel: sel == null ? null : String(sel && sel.id != null ? sel.id : sel), selJ: selJ == null ? null : String(selJ), bones: S && S.bones ? S.bones.length : 0, anim: S && S.anim ? { len: S.anim.len, keys: (S.anim.keys || []).length } : null, smooth }); /* 💢用 */
window.__workshopDebug = () => ({ S, ANIM, proj, V3, gotoFrame, mode, st, jointGraph }); /* 検証用 */
// 線で割る塗り：モードを変えたら線を出し直す／「線を消す」
function syncEraseBtn(){const b=document.getElementById('cutEraseBtn');if(b){b.classList.toggle('on',paintErase);b.style.background=paintErase?'#e0402f':'';b.style.color=paintErase?'#fff':'';}}
document.querySelectorAll('#modes button').forEach(bt=>bt.addEventListener('click',()=>{paintErase=false;cutHot=null;syncEraseBtn();drawCutLines();}));
document.getElementById('cutEraseBtn').addEventListener('click',()=>{paintErase=!paintErase;syncEraseBtn();if(paintErase)toast('消したい線の上をなぞってな（もう一回押すと戻る）');});
})();
