const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html='';
const code=fs.readFileSync(__dirname+'/../workshop/app.js','utf8');
function expression(start){for(let end=start;end<code.length;end++){if(code[end]!=='}')continue;const s=code.slice(start,end+1);try{new vm.Script('('+s+')');return s;}catch{}}throw Error('cannot extract');}
function func(name){return expression(code.indexOf('function '+name+'('));}
let c={console,Map,Set,Math,JSON,toast:()=>{},clone:x=>JSON.parse(JSON.stringify(x)),r4:x=>Math.round(x*1e4)/1e4,mode:'sil',sel:2,SELB:[],selJ:null};
c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/../vendor/three.min.js','utf8'),c);
vm.runInContext(fs.readFileSync(__dirname+'/../shared/input.js','utf8'),c);c.editorInput=c.__editorInput;
for(const name of ['skeletonEditable','deleteSelectedBones','unlinkSelectedBone','attach','reverseBone','linkTo','autoLink','flipFB','insertJointAt','removeJoint','finishBone','makeTwin','moveBone','mirrorInto','pickBoneSelection','selectAt','rSelect','tap','paintAt'])vm.runInContext(func(name),c);
c.V3=p=>new c.THREE.Vector3(...p);c.AX=()=>0;c.boneById=id=>c.S.bones.find(b=>b.id===id);c.selBones=()=>[c.sel,...c.SELB];c.rebuild=()=>{};c.save=()=>{};c.markSynced=()=>{};c.updBtns=()=>{};c.pushUndo=()=>c.undo++;
function fresh(locked=true){c.S={sym:false,bones:[{id:1,parent:null,pts:[[0,0,0],[0,1,0]],wp:[{t:0,r:1}],wn:[{t:0,r:1}],dp:[],dn:[],off:{},sides:8},{id:2,parent:1,at:1,pts:[[0,1,0],[1,1,0]],wp:[],wn:[],dp:[],dn:[],off:{},sides:8}]};if(locked)c.S.tpl={kind:'tokage'};c.sel=2;c.SELB=[];c.undo=0;c.mode='sil';}
let count=0;function test(name,f){f();count++;console.log('PASS '+name);}
for(const [name,call] of Object.entries({delete:()=>c.deleteSelectedBones(),unlink:()=>c.unlinkSelectedBone(),attach:()=>c.attach(c.S.bones[1],c.S.bones[0],0),reverse:()=>c.reverseBone(c.S.bones[0]),link:()=>c.linkTo(2,{b:c.S.bones[0],i:0}),autoLink:()=>c.autoLink(),flip:()=>c.flipFB(),insertJoint:()=>c.insertJointAt(c.S.bones[0],0,0),removeJoint:()=>c.removeJoint(c.S.bones[0],1),drawBone:()=>c.finishBone({pts:[]}),makeTwin:()=>c.makeTwin(c.S.bones[0]),moveRestBone:()=>c.moveBone(c.S.bones[0],new c.THREE.Vector3(1,0,0))}))test('fixed species direct '+name+' blocked',()=>{fresh();const old=JSON.stringify(c.S);call();assert.equal(JSON.stringify(c.S),old);assert.equal(c.undo,0);});
test('free bone delete still works',()=>{fresh(false);c.deleteSelectedBones();assert.equal(c.S.bones.length,1);assert.equal(c.undo,1);});
test('free bone unlink still works',()=>{fresh(false);c.unlinkSelectedBone();assert.equal(c.S.bones[1].parent,null);assert.equal(c.undo,1);});
test('shape mirror preserves fixed rest joints',()=>{fresh();const b=c.S.bones[0],t=c.S.bones[1],p=JSON.stringify(t.pts);c.mirrorInto(b,t);assert.equal(JSON.stringify(t.pts),p);assert.equal(JSON.stringify(t.wn),JSON.stringify(b.wp));});
test('pose translation still allowed',()=>{fresh();c.mode='pose';c.moveBone(c.S.bones[1],new c.THREE.Vector3(0,1,0));assert.equal(c.S.bones[1].pts[0][1],2);});
for(const [button,altKey,want] of [[0,false,'primary'],[2,false,'select'],[1,false,'camera'],[0,true,'camera'],[3,false,'ignore']])test('input routing '+button+'/'+altKey,()=>assert.equal(c.editorInput.intent({button,altKey}),want));
test('shared add/remove',()=>assert.equal(JSON.stringify(c.editorInput.selection([1,2],[2,3],true,v=>v)),'[1,3]'));
test('vertex selection toggles off',()=>{c.elm='v';c.VSEL=[];c.vKey=v=>v.id+':'+v.r+'_'+v.k;c.allVerts=()=>[{id:1,r:0,k:0,front:true,s:{x:20,y:20}}];c.addMode=false;c.selectAt(20,20,false);assert.equal(c.VSEL.length,1);c.addMode=true;c.selectAt(20,20,false);assert.equal(c.VSEL.length,0);});
test('surface selection beats hidden joints',()=>{fresh();c.meshes={visible:true};c.meshHit=()=>({object:{userData:{id:2}}});let restricted;c.jointHit=(x,y,r,id)=>{restricted=id;return null;};c.boneHit=()=>({b:c.S.bones[0]});const p=c.pickBoneSelection(1,1);assert.equal(p.bone.b.id,2);assert.equal(restricted,2);});
test('PC silhouette tap does not change selection',()=>{fresh();c.lastPT='mouse';c.lastTap={t:0};c.performance={now:()=>10000};c.addJMode=false;c.sel=1;c.tap(20,20,false);assert.equal(c.sel,1);});
// Execute actual event handlers with controlled dependencies, rather than reproducing their logic.
function handler(marker){const p=code.indexOf(marker);assert(p>=0);return vm.runInContext('('+expression(code.indexOf('e =>',p))+')',c);}
const down=handler("over.addEventListener('pointerdown'");
c.document={body:{classList:{contains:()=>true}}};c.over={setPointerCapture:()=>{}};c.orbit={};c.st={};c.fingers=new Map();c.gizmoHit=()=>null;c.ANIM={};c.lassoMode=false;
const event=(o={})=>({button:0,pointerType:'mouse',pointerId:1,clientX:20,clientY:20,preventDefault(){},...o});
test('paint Alt-left goes to camera',()=>{c.mode='paint';c.st={};down(event({altKey:true}));assert.equal(c.st.cam.id,1);assert(!c.st.stroke);});
test('paint right goes to selection',()=>{c.mode='paint';c.st={};down(event({button:2}));assert(c.st.stroke.rclick);});
test('detail left never begins selection',()=>{c.mode='shape';c.detailInkMode=false;c.st={};c.jointHit=()=>null;down(event());assert.equal(c.st.drag,undefined);assert.equal(c.st.stroke,undefined);});
test('touch paint drag remains camera gesture',()=>{c.mode='paint';c.st={};c.fingers=new Map();down(event({pointerType:'touch'}));assert(c.fingers.has(1));assert(c.st.tap);});
const timeline=handler("tlc.addEventListener('pointerdown'");
test('timeline right cannot edit',()=>{c.tlc={setPointerCapture:()=>{throw Error('should not capture');}};timeline(event({button:2}));});
console.log('RESULT '+count+' checks passed');
