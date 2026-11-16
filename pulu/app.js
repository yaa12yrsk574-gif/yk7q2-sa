(function(){
"use strict";
if(!window.PuluWorld||!window.PuluControls){document.body.insertAdjacentHTML("beforeend","<p style='position:fixed;inset:45% 10%;background:#233;color:white;padding:20px'>起動に失敗しました。ページを更新してください。</p>");return}
const $=id=>document.getElementById(id);
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const safeJSON=(k)=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const KEY="pulu-island-slice-v1";
const defaultDesign=()=>({rig:"blob",size:1,spring:1,crouch:1,extend:1,leg:1,wings:false,color:"mint"});
const defaultStory=()=>({crab:false,cliff:false,bird:false,sumo:false});
let loaded=safeJSON(KEY)||{};
let design=Object.assign(defaultDesign(),loaded.design||{});
let story=Object.assign(defaultStory(),loaded.story||{});
const s={x:0,z:3,y:0,vx:0,vz:0,vy:0,onGround:true,charge:0,armed:false,peak:0,burst:0,jumpNo:0,ringPush:0,ringActive:false,lastHit:0,t:0};
const world=window.PuluWorld.createWorld($("stage"));
const pulu=window.PuluWorld.createPulu(world.scene);
const old=window.PuluWorld.createOldMan(world.scene);
const controls=window.PuluControls.createControls();
const ctx={};
function persist(){try{localStorage.setItem(KEY,JSON.stringify({design,story}))}catch(e){}}
function applyDesign(){
 document.querySelectorAll("[data-rig]").forEach(b=>b.classList.toggle("chosen",b.dataset.rig===design.rig));
 for(const id of ["size","spring","crouch","extend","leg"]){
  const el=document.querySelector('[data-design="'+id+'"]');if(el)el.value=design[id];
  $(id+"Out").value=Number(design[id]).toFixed(2);
 }
 $("color").value=design.color;$("wings").checked=!!design.wings;persist();
}
applyDesign();
let speechEnd=performance.now()+9000,action=null,paused=false;
function say(text,ms=6500){$("line").textContent=text;$("speech").style.opacity="1";speechEnd=performance.now()+ms}
function openWorkshop(){
 paused=true;controls.clear();$("panel").classList.remove("hidden");
 say("ぼ、僕、どんな姿にもなってみたいです……！");
}
function closeWorkshop(){
 $("panel").classList.add("hidden");paused=false;controls.clear();say("えへへ……どうでしょう？ ちょっと試してきます！");
}
$("openWorkshop").onclick=openWorkshop;
$("closeWorkshop").onclick=closeWorkshop;$("closeWorkshop2").onclick=closeWorkshop;
for(const b of document.querySelectorAll("[data-rig]"))b.onclick=()=>{design.rig=b.dataset.rig;applyDesign();$("craftHint").textContent=design.rig==="legs"?"関節を付けてみた！ 走り方と踏み切りを比べてみよう。":"関節なしでも、縮んだり弾んだりできるよ。"};
for(const el of document.querySelectorAll("[data-design]"))el.addEventListener("input",()=>{design[el.dataset.design]=Number(el.value);applyDesign()});
$("wings").onchange=()=>{design.wings=$("wings").checked;applyDesign();$("craftHint").textContent="羽はまだ飾りだけ。飛ぶ機能はこれから作るよ。"};
$("color").onchange=()=>{design.color=$("color").value;applyDesign()};
$("resetDesign").onclick=()=>{design=defaultDesign();applyDesign();$("craftHint").textContent="元のプルプルに戻った！"};
$("helpBtn").onclick=()=>{paused=true;controls.clear();$("help").classList.remove("hidden")};
$("closeHelp").onclick=()=>{paused=false;controls.clear();$("help").classList.add("hidden")};
const floorAt=z=>z>=29&&z<=84?1.7:0;
function setGoal(){
 let title="出会い",goal="カニのところへ行こう";
 if(story.crab){title="憧れ";goal="工房で身体を作り、崖を登ってみよう"}
 if(story.cliff){title="やってみたい！";goal="崖の上の大きい子と相撲してみよう"}
 if(story.sumo){title="自由な島";goal="鳥を見たり、工房で違う身体を試そう"}
 if(story.bird&&story.sumo){title="この子とどこまでも";goal="好きな姿で島を歩こう。ゲームは続きます"}
 $("chapter").textContent=title;$("goal").textContent=goal;
}
setGoal();
function doAction(){
 if(!action)return;
 const a=action;
 if(a==="crab"){
  if(!story.crab){story.crab=true;persist();say("あ、あの脚！ すごい……ぼ、僕にもできるでしょうか……！？",10000);setGoal()}
  else say("うわぁ、何回見てもすごい……。カニさん、横に歩くんだ！",6200);
 }else if(a==="workshop")openWorkshop();
 else if(a==="bird"){
  if(!story.bird){story.bird=true;persist();say("……！ は、羽です！ あんなふうに飛べたら……！",8500);setGoal()}
  else say("ぼ、僕もいつか羽ばたいてみたいです……。",6500);
 }else if(a==="sumo"){
  s.ringActive=true;s.ringPush=0;s.lastHit=0;s.x=0;s.z=43.4;s.y=1.7;s.vy=0;s.onGround=true;controls.clear();
  say("あ、あんなに大きい子と……！ ぼ、僕もやってみたいです！！",8500);
 }
}
$("interact").onclick=doAction;
window.addEventListener("keydown",e=>{if(e.code==="KeyE"&&!paused)doAction()});
function nearest(){
 let best=null,dist=1e9;
 const candidates=world.markers.map(m=>({id:m.id,dist:Math.hypot(s.x-m.at.x,s.z-m.at.z)}));
 for(const c of candidates)if(c.dist<dist){dist=c.dist;best=c.id}
 if(dist>4.4){action=null;$("event").hidden=true;return}
 action=best;$("event").hidden=false;
 $("interact").textContent=({crab:"カニを見る ✨",workshop:"工房へ ⚒",sumo:"デカブツと相撲！",bird:"鳥を見る ✨"})[action];
}
function physics(dt){
 const i=controls.state;
 const target=design.rig==="legs"?4.2:3.6,lerp=Math.min(1,dt*(s.onGround?6.5:2.0));
 s.vx+=(i.x*target-s.vx)*lerp;s.vz+=(i.z*target-s.vz)*lerp;
 const prevZ=s.z;s.x=clamp(s.x+s.vx*dt,-10.8,10.8);s.z=clamp(s.z+s.vz*dt,-6,82);
 if(prevZ<28.5&&s.z>=28.5&&s.y<1.62){s.z=28.35;s.vz=0}
 if(s.onGround){
  // Body's bottom stays on its support surface.
  if(s.y>floorAt(s.z)+.08){s.onGround=false;s.vy=0}
  if(i.pose>.7){s.armed=true;s.charge=clamp(s.charge+dt*(.56+.38*design.crouch))}
  if(s.armed&&i.pose<.24&&i.speed<-.4&&s.charge>.07){
    const flick=clamp(-i.speed/3.5),form=(.90+.10*design.extend),mass=1/Math.sqrt(.75+.25*design.size);
    const velocity=(2.8+4.9*s.charge*(.72+.28*flick))*design.spring*form*mass*(design.rig==="legs"?1.02:1);
    s.vy=Math.min(11.7,velocity);s.onGround=false;s.armed=false;s.charge=0;s.jumpNo++;s.burst=.45;
    if(s.ringActive)say("いっけー！",850);
  }
  if(!s.armed&&i.pose<.4)s.charge=Math.max(0,s.charge-dt);
 }else{
  s.vy-=15.5*dt;s.y+=s.vy*dt;s.peak=Math.max(s.peak,s.y);
  const floor=floorAt(s.z);
  if(s.y<=floor&&s.vy<=0){s.y=floor;s.vy=0;s.onGround=true;s.armed=false}
 }
 s.burst=Math.max(0,s.burst-dt);
 if(!story.cliff&&s.z>31&&s.y>1.6){story.cliff=true;persist();setGoal();say("の、登れた……！ お、おじさん！ ぼ、僕、登れました！！",9500)}
 if(s.ringActive&&s.burst>.05&&!s.onGround&&performance.now()-s.lastHit>800){
  const zTarget=48.5+s.ringPush*.85,near=Math.hypot(s.x,s.z-zTarget);
  if(near<3.0&&s.vz>.05){
   s.lastHit=performance.now();s.ringPush++;s.burst=0;
   if(s.ringPush>=3){
    s.ringActive=false;story.sumo=true;persist();setGoal();
    say("や、やった……！ ぼ、僕、あんな大きい子と相撲できました！！",12000);
   }else say("お、おした！ あと"+(3-s.ringPush)+"回……！",2200);
  }
 }
}
function moveOld(dt){
 // Old man follows, but is not the protagonist of the exploration.
 const px=s.x-1.8,pz=s.z-2.2;
 old.position.x+=(px-old.position.x)*Math.min(1,dt*2.7);
 old.position.z+=(pz-old.position.z)*Math.min(1,dt*2.7);
 old.position.y=floorAt(old.position.z);
 old.rotation.y=Math.sin(s.t*2)*.06;
}
let last=performance.now(),acc=0;
function tick(now){
 const dt=clamp((now-last)/1000,0,.032);last=now;s.t+=dt;
 if(!paused){controls.update(dt);physics(dt);moveOld(dt);nearest()}
 pulu.group.position.set(s.x,0,s.z);pulu.update(design,controls.state.pose,s.t,s.y);
 world.update(s.t,s.x,s.y,s.z,s.ringPush);
 acc+=dt;if(acc>.10){
  acc=0;$("height").textContent=Math.max(0,s.y-floorAt(s.z)).toFixed(1);
  $("charge").textContent=Math.round(s.charge*100);
  if(now>speechEnd)$("speech").style.opacity="0";
 }
 requestAnimationFrame(tick);
}
say("あ、あの……は、初めましてっ……！ （ぷるんっ）",9000);
requestAnimationFrame(tick);
window.PuluDebug={state:s,design,story,openWorkshop,closeWorkshop,say};
})();