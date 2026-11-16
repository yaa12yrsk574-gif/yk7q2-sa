(function(){
"use strict";
function createControls(){
 const $=id=>document.getElementById(id);
 const pad=$("movePad"),ring=$("moveRing"),knob=$("moveKnob");
 const posePad=$("posePad"),rail=posePad.querySelector(".pose-track"),poseKnob=$("poseKnob");
 const state={x:0,z:0,pose:.4,speed:0},keys=new Set();
 let moveId=null,poseId=null,last=performance.now(),stillTimer=null;
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 function setMove(e){
  const r=ring.getBoundingClientRect(),dx=(e.clientX-(r.left+r.width/2))/(r.width*.36),dz=((r.top+r.height/2)-e.clientY)/(r.height*.36);
  const l=Math.max(1,Math.hypot(dx,dz));state.x=clamp(dx/l,-1,1);state.z=clamp(dz/l,-1,1);
  knob.style.left=50+state.x*30+"%";knob.style.top=50-state.z*30+"%";
 }
 function setPose(e){
  const r=rail.getBoundingClientRect(),p=clamp((e.clientY-r.top)/r.height),now=performance.now();
  state.speed=(p-state.pose)/Math.max(.012,(now-last)/1000);state.pose=p;last=now;
  poseKnob.style.top=(p*100)+"%";clearTimeout(stillTimer);stillTimer=setTimeout(()=>state.speed=0,100);
 }
 pad.addEventListener("pointerdown",e=>{if(moveId!==null)return;moveId=e.pointerId;pad.setPointerCapture(e.pointerId);setMove(e);e.preventDefault()});
 pad.addEventListener("pointermove",e=>{if(moveId===e.pointerId){setMove(e);e.preventDefault()}});
 posePad.addEventListener("pointerdown",e=>{if(poseId!==null)return;poseId=e.pointerId;posePad.setPointerCapture(e.pointerId);last=performance.now();setPose(e);e.preventDefault()});
 posePad.addEventListener("pointermove",e=>{if(poseId===e.pointerId){setPose(e);e.preventDefault()}});
 for(const ev of ["pointerup","pointercancel","lostpointercapture"]){
  pad.addEventListener(ev,e=>{if(moveId===e.pointerId){moveId=null;state.x=0;state.z=0;knob.style.left="50%";knob.style.top="50%"}});
  posePad.addEventListener(ev,e=>{if(poseId===e.pointerId){poseId=null;state.speed=0}});
 }
 window.addEventListener("keydown",e=>{
  if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
  if(["KeyW","KeyS","KeyA","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyE"].includes(e.code))e.preventDefault();
  keys.add(e.code);
 });
 window.addEventListener("keyup",e=>keys.delete(e.code));
 window.addEventListener("blur",()=>{keys.clear();state.x=0;state.z=0;state.speed=0});
 function update(dt){
  if(moveId===null){state.x=Number(keys.has("KeyD")||keys.has("ArrowRight"))-Number(keys.has("KeyA")||keys.has("ArrowLeft"));state.z=Number(keys.has("KeyW"))-Number(keys.has("KeyS"))}
  if(poseId===null){
   const dir=Number(keys.has("ArrowDown"))-Number(keys.has("ArrowUp"));
   if(dir){state.speed=dir*2.7;state.pose=clamp(state.pose+state.speed*dt);poseKnob.style.top=state.pose*100+"%"}
   else state.speed=0;
  }
 }
 function clear(){state.x=0;state.z=0;state.speed=0;moveId=null;poseId=null;knob.style.left="50%";knob.style.top="50%"}
 return {state,update,clear,keys};
}
window.PuluControls={createControls};
})();