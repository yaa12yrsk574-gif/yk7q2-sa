const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),path=require('path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ctx={console:{warn(){}},Math,JSON};ctx.window=ctx;vm.createContext(ctx);
for(const p of ['vendor/three.min.js','shared/project-data.js','shared/templates.js','shared/bones.js'])vm.runInContext(read(p),ctx,{filename:p});
let S=null;const core=ctx.BoneCore.create(ctx.THREE,()=>S,v=>{S=v;});
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function collect(api){
 const result={};
 for(const kind of Object.keys(ctx.BoneTemplates.KINDS)){
  S=ctx.BoneTemplates.data(kind);const rest=Object.fromEntries(S.bones.map(b=>[b.id,b.pts]));
  result[kind+'/data']=hash(S);
  result[kind+'/geometry']=hash(S.bones.map(b=>api.boneGeom(b)));
  for(const {slot} of ctx.BoneTemplates.slots(kind)){
   S.anim=ctx.BoneTemplates.animFor(kind,slot,rest,S.bones);
   const state=S,anim=S.anim;
   result[kind+'/'+slot]=hash(Array.from({length:anim.len+1},(_,f)=>api.poseAt(f)));
   result[kind+'/'+slot+'/gait']=hash(api.measureGaitQuality(S,anim,slot));
   assert.equal(S,state);assert.equal(S.anim,anim);
  }
 }
 // Old free-form work, including offsets, non-default sides, paths and inbetween corrections.
 S={bones:[{id:1,pts:[[0,0,0],[.2,.7,.1],[0,1,0]],wp:[{t:0,r:.1},{t:1,r:.2}],wn:[{t:0,r:.08}],dp:[{t:0,r:.12}],dn:[{t:0,r:.09}],off:{'1_0':[.02,.01,.03]},sides:6}],anim:{len:8,loop:false,keys:[],seg:{}}};
 const A={1:S.bones[0].pts},B={1:[[0,0,0],[.5,.5,.1],[.6,.8,0]]};S.anim.keys=[{f:0,pose:A},{f:8,pose:B}];
 S.anim.seg[0]={n:3,bias:.4,paths:{'1_2':[[0,1,0],[.4,1.1,.2],[.6,.8,0]]},fix:{2:A}};
 result.free=hash({geometry:api.boneGeom(S.bones[0]),poses:Array.from({length:9},(_,f)=>api.poseAt(f))});
 return result;
}
module.exports={ctx,core,collect,getState:()=>S,setState:v=>{S=v;},read,hash};
if(require.main===module){
 const expected=JSON.parse(read('tests/core-baseline.json'));
 assert.deepEqual(collect(core),expected);
 const second=ctx.BoneCore.create(ctx.THREE,()=>({bones:[],anim:{keys:[]}}),()=>{});
 assert.equal(second.topoBones().length,0);assert.equal(core.topoBones().length,1);
 const disk=new Map();ctx.localStorage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)};
 vm.runInContext(read('shared/storage.js'),ctx);
 const works=[{id:'legacy',name:'old work',data:{bones:[],custom:{kept:true}}}];
 assert.equal(ctx.BoneStorage.saveWorks(works),true);assert.equal(JSON.stringify(ctx.BoneStorage.loadWorks()),JSON.stringify(works));
 ctx.BoneStorage.saveDraft(works[0].data);assert.equal(disk.get('yuya_bone_lowpoly_v1'),JSON.stringify(works[0].data));
 for(const file of ['index.html','workshop.html','hunting.html'])for(const m of read(file).matchAll(/(?:src|href)="([^"]+)"/g))assert(fs.existsSync(path.join(root,m[1].split('?')[0])),file+' missing '+m[1]);
 for(const dir of ['shared','workshop','hunting'])for(const f of fs.readdirSync(path.join(root,dir)))if(f.endsWith('.js'))new vm.Script(read(dir+'/'+f));
 // Enemy spawning reads works before the companion UI section initializes.
 const hunting=read('hunting/app.js'),loadWorks=hunting.match(/function loadWorks\(\) \{[^\n]+\}/)[0];
 assert.equal(vm.runInContext('JSON.stringify(loadWorks());'+loadWorks,ctx),JSON.stringify(works));
 console.log('PASS '+Object.keys(expected).length+' legacy calculation snapshots; startup storage access, isolated state, storage compatibility, script syntax and resource paths');
}

