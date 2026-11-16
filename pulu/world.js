(function(){
"use strict";
const T=window.THREE;
if(!T){document.body.insertAdjacentHTML("beforeend","<p>3Dの読み込みに失敗しました。再読み込みしてください。</p>");return}
const mats={land:new T.MeshLambertMaterial({color:0x7fb58a}),sand:new T.MeshLambertMaterial({color:0xe5d3a4}),top:new T.MeshLambertMaterial({color:0x91bc86}),rock:new T.MeshLambertMaterial({color:0x938f7a}),rockDark:new T.MeshLambertMaterial({color:0x666f64}),trunk:new T.MeshLambertMaterial({color:0x8b6950}),leaf:new T.MeshLambertMaterial({color:0x509777}),leaf2:new T.MeshLambertMaterial({color:0x77ae85}),wood:new T.MeshLambertMaterial({color:0xa17d56}),tile:new T.MeshLambertMaterial({color:0x466d63}),sea:new T.MeshLambertMaterial({color:0x4f9da7,transparent:true,opacity:.86}),white:new T.MeshLambertMaterial({color:0xf1ecd8}),dark:new T.MeshLambertMaterial({color:0x304947}),gold:new T.MeshLambertMaterial({color:0xc59c57})};
const box=(x,y,z,mat)=>new T.Mesh(new T.BoxGeometry(x,y,z),mat);
const ball=(r,mat,segments=12)=>new T.Mesh(new T.SphereGeometry(r,segments,10),mat);
const cyl=(rt,rb,h,mat,n=9)=>new T.Mesh(new T.CylinderGeometry(rt,rb,h,n),mat);
function meshTo(parent,m,x,y,z){m.position.set(x,y,z);parent.add(m);return m}
function ground(parent,w,d,y,z,mat,x=0){const p=new T.Mesh(new T.PlaneGeometry(w,d),mat);p.rotation.x=-Math.PI/2;p.position.set(x,y,z);parent.add(p);return p}
function tree(parent,x,z,scale=1){const g=new T.Group();g.position.set(x,0,z);meshTo(g,cyl(.22*scale,.36*scale,2.7*scale,mats.trunk),0,1.3*scale,0);for(const [dx,dy,dz,sz] of [[0,3,0,1.5],[-.5,2.6,.2,1],[.6,2.7,-.1,.95]]){const m=ball(sz*scale,(dx>0?mats.leaf2:mats.leaf));meshTo(g,m,dx*scale,dy*scale,dz*scale)}parent.add(g)}
function flower(parent,x,z,y=0){const p=meshTo(parent,ball(.12,mats.white,8),x,y+.13,z);meshTo(p,ball(.05,mats.gold,7),0,.08,0)}
function rock(parent,x,z,r=.7,y=0){const m=ball(r,mats.rockDark,7);m.scale.set(1,.7,1.3);meshTo(parent,m,x,y+r*.4,z)}
function createWorld(host){
 const scene=new T.Scene();scene.background=new T.Color(0xa6cfc9);scene.fog=new T.Fog(0xa6cfc9,52,110);
 const camera=new T.PerspectiveCamera(45,1,.1,250);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.setSize(host.clientWidth,host.clientHeight);renderer.setClearColor(0xa6cfc9);host.appendChild(renderer.domElement);
 scene.add(new T.HemisphereLight(0xeefff5,0x446753,1.5));
 const sun=new T.DirectionalLight(0xffefc8,1.15);sun.position.set(-12,23,10);scene.add(sun);
 const island=new T.Group();scene.add(island);
 ground(island,250,250,-.46,42,mats.sea);
 ground(island,24,104,-.12,38,mats.land);
 ground(island,24,19,-.1,3,mats.sand);
 ground(island,20,23,-.07,19,mats.top);
 const plateau=meshTo(island,box(24,1.75,55,mats.rock),0,.78,56);ground(island,24,55,1.67,56,mats.top);
 const face=meshTo(island,box(24,1.7,1.25,mats.rockDark),0,.76,28.6);
 // winding path and beach rocks
 ground(island,3,36,-.055,11,new T.MeshLambertMaterial({color:0xd5c79d,transparent:true,opacity:.6}));
 ground(island,3.7,32,1.687,48,new T.MeshLambertMaterial({color:0xb8c89c,transparent:true,opacity:.7}));
 for(const [x,z,s] of [[-10,17,1],[9,21,.95],[-9,24,1.1],[10,37,1.25],[-8,49,1],[-9,62,1.2],[9,67,1.1],[8,80,1],[-10,82,1.15]]){tree(island,x,z,s)}
 for(const [x,z,r] of [[-7,-3,.7],[7,1,.9],[-4,18,.8],[8,27,.5],[7,36,.75],[-7,69,.85]])rock(island,x,z,r,z>29?1.7:0);
 for(let i=0;i<42;i++){const x=(i%2?1:-1)*(4+(i*3)%7),z=6+(i*13)%78;flower(island,x,z,z>29?1.72:0)}
 // mechanics workshop house
 const workshop=new T.Group();workshop.position.set(-7,0,9);island.add(workshop);
 meshTo(workshop,box(5,2.8,4,mats.wood),0,1.4,0);
 const roof=meshTo(workshop,box(5.8,.45,4.7,mats.tile),0,3.05,0);roof.rotation.z=.08;
 meshTo(workshop,box(1.2,2.05,.18,mats.dark),1,1.06,2.1);
 meshTo(workshop,box(1.8,.75,.14,mats.white),-1,1.85,2.1);
 meshTo(workshop,box(2.5,.6,1,mats.trunk||mats.wood),-1.9,.5,3.4);
 meshTo(workshop,cyl(.5,.5,.2,mats.gold,12),-2,.91,3.4);
 for(const x of [-2.8,2.8])meshTo(workshop,cyl(.28,.28,2,mats.rockDark),x,1.2,2.4);
 // crab (creature to observe)
 const crab=new T.Group();crab.position.set(3.5,.24,15);island.add(crab);
 meshTo(crab,ball(.65,new T.MeshLambertMaterial({color:0xc5745d})),0,.25,0);
 for(const sign of [-1,1])for(let i=0;i<3;i++){const leg=meshTo(crab,cyl(.10,.08,1.1,new T.MeshLambertMaterial({color:0xaa6b53}),5),sign*(.9+i*.12),.1,(i-1)*.4);leg.rotation.z=sign*.75}
 for(const x of [-.27,.27])meshTo(crab,ball(.095,mats.dark),x,.75,.44);
 // bird
 const bird=new T.Group();bird.position.set(-5,3.75,63);island.add(bird);
 meshTo(island,cyl(.6,.78,3.4,mats.trunk),-5,2.8,63);
 meshTo(bird,ball(.55,mats.white),0,0,0);meshTo(bird,ball(.24,mats.gold),0,.05,.45);
 const wings=[];for(const v of [-1,1]){const wing=meshTo(bird,box(1.35,.12,.55,mats.white),v*.84,.02,0);wing.rotation.z=v*.15;wings.push(wing)}
 // giant sumo arena
 const ring=new T.Group();ring.position.set(0,1.70,46);island.add(ring);
 const disk=meshTo(ring,cyl(5.4,5.4,.18,mats.sand,32),0,.1,0);
 const border=meshTo(ring,new T.Mesh(new T.TorusGeometry(4.6,.15,7,44),mats.wood),0,.25,0);border.rotation.x=Math.PI/2;
 const giant=new T.Group();giant.position.set(0,1.85,48.5);island.add(giant);
 const gm=new T.MeshLambertMaterial({color:0x8a9a82});const torso=meshTo(giant,ball(1.85,gm,14),0,1.5,0);torso.scale.set(1.3,1.0,1.2);
 for(const x of [-1,1]){meshTo(giant,ball(.55,gm),x*.95,.45,.1);meshTo(giant,ball(.16,mats.dark),x*.48,2.0,-1.55)}
 // stone arch above arena
 for(const x of [-6.5,6.5])meshTo(island,box(1.1,3.9,1.5,mats.rockDark),x,3.5,42);
 meshTo(island,box(14.2,1.3,1.9,mats.rockDark),0,5.8,42);
 // platform markers
 const markers=[{id:"crab",name:"カニ",at:new T.Vector3(3.5,0,15)},{id:"workshop",name:"工房",at:new T.Vector3(-7,0,10.4)},{id:"sumo",name:"相撲",at:new T.Vector3(0,1.7,46)},{id:"bird",name:"鳥",at:new T.Vector3(-5,1.7,63)}];
 function resize(){const w=host.clientWidth||window.innerWidth,h=host.clientHeight||window.innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
 window.addEventListener("resize",resize);resize();
 function update(time,px,py,pz,push=0){
  camera.position.lerp(new T.Vector3(px+12,py+13,pz-15),.045);
  const target=new T.Vector3(px,py+1,pz+6);camera.lookAt(target);
  crab.rotation.y=Math.sin(time*2)*.17;bird.position.y=3.75+Math.sin(time*4)*.09;wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*(.22+.25*Math.sin(time*8)));
  giant.position.z=48.5+push*.85;giant.rotation.y=.08*Math.sin(time*1.5);
  renderer.render(scene,camera);
 }
 return {scene,camera,renderer,markers,workshop,crab,bird,giant,update,resize};
}
function createPulu(scene){
 const group=new T.Group();scene.add(group);
 const gelMat=new T.MeshPhongMaterial({color:0x9cf4d2,transparent:true,opacity:.79,shininess:95,depthWrite:false});
 const gel=meshTo(group,ball(.83,gelMat,26),0,.86,0);
 const heart=meshTo(group,ball(.18,new T.MeshPhongMaterial({color:0xedffef,transparent:true,opacity:.85})),0,.96,.10);
 const eyes=[];for(const x of [-.25,.25])eyes.push(meshTo(group,ball(.09,mats.dark,10),x,1.02,-.69));
 const mouth=meshTo(group,ball(.07,mats.dark,9),0,.79,-.76);mouth.scale.set(1,.4,.35);
 const legs=[];for(const side of [-1,1]){const leg=meshTo(group,cyl(.13,.15,.8,mats.rockDark,9),side*.4,.40,0);const foot=meshTo(group,ball(.25,mats.white),side*.45,.15,-.12);legs.push({leg,foot,side})}
 const wings=[];for(const side of [-1,1]){const wing=meshTo(group,ball(.44,new T.MeshLambertMaterial({color:0xd6f7e6,transparent:true,opacity:.85})),side*.86,1.12,.08);wing.scale.set(1.1,.22,.5);wings.push(wing)}
 function update(design,pose,t,y){
  group.position.y=y;
  const squish=1-.27*pose*design.crouch;
  gel.scale.set(design.size*(1+.20*pose),Math.max(.4,design.size*squish*(1+.35*(1-pose)*design.extend)),design.size);
  gel.position.y=.86*design.size-(pose*.12);
  heart.position.y=.96*design.size-pose*.1;
  eyes.forEach((eye,i)=>{eye.position.y=1.01*design.size-pose*.1;eye.position.x=(i?1:-1)*.25*design.size;eye.position.z=-.69*design.size});
  mouth.position.y=.8*design.size-pose*.12;mouth.position.z=-.78*design.size;
  for(const l of legs){l.leg.visible=l.foot.visible=design.rig==="legs";l.leg.scale.y=design.leg*(1-.3*pose);l.leg.position.y=.42*design.leg*(1-.3*pose);l.leg.rotation.z=l.side*.21*Math.sin(t*8);l.foot.position.y=.12; l.foot.position.x=l.side*.43*design.leg}
  wings.forEach((w,i)=>{w.visible=design.wings;w.rotation.z=(i?1:-1)*(.28+.12*Math.sin(t*8))});
  const colors={mint:0x9cf4d2,pink:0xf8b5cb,blue:0x9acff9,gold:0xf8da99};gelMat.color.setHex(colors[design.color]||colors.mint);
  group.scale.setScalar(1);
 }
 return {group,update};
}
function createOldMan(scene){
 const g=new T.Group();scene.add(g);
 const coat=new T.MeshLambertMaterial({color:0x7b6854}),skin=new T.MeshLambertMaterial({color:0xd3b58d}),hat=new T.MeshLambertMaterial({color:0x525e54});
 meshTo(g,cyl(.35,.46,1.25,coat,8),0,1.15,0);
 meshTo(g,ball(.36,skin),0,2.01,0);meshTo(g,cyl(.43,.46,.26,hat),0,2.32,0);
 meshTo(g,cyl(.69,.69,.08,hat),0,2.23,0);
 for(const s of [-1,1]){const l=meshTo(g,cyl(.13,.16,.9,mats.dark),s*.2,.45,0);l.rotation.z=s*.08;meshTo(g,ball(.07,mats.dark),s*.14,2.06,-.28)}
 return g;
}
window.PuluWorld={createWorld,createPulu,createOldMan};
})();