// 線で割って、バケツで塗る：閉じた線で島が分かれる／開いた線は分けない／割っても面は元の平面の上／動かしても付いてくる
const assert=require('assert/strict');
const {ctx,core,read}=require('./core.cjs');
const vm=require('vm');vm.runInContext(read('shared/paint-cut.js'),ctx,{filename:'paint-cut.js'});
const PC=ctx.PaintCut,THREE=ctx.THREE;
const bone=()=>({id:1,pts:[[0,0,0],[0,1,0]],wp:[{t:0,r:.2}],wn:[{t:0,r:.2}],dp:[{t:0,r:.2}],dn:[{t:0,r:.2}],off:{},sides:8,av:1,rings:12});
const colorsOf=g=>{const c=g.attributes.color.array,s=new Set();for(let i=0;i<c.length;i+=3)s.add(c[i].toFixed(3)+','+c[i+1].toFixed(3)+','+c[i+2].toFixed(3));return s;};
const red=new THREE.Color('#ff0000'),key=c=>c.r.toFixed(3)+','+c.g.toFixed(3)+','+c.b.toFixed(3);
const surfArea=g=>{const p=g.attributes.position.array;let A=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<p.length;i+=9){a.fromArray(p,i);b.fromArray(p,i+3);c.fromArray(p,i+6);A+=b.sub(a).cross(c.sub(a)).length()/2;}return A;};

// 1) 線なし・塗りなし＝今まで通りの三角
{const b=bone(),G=core.boneGeom(b);const g=PC.build(THREE,G,b,0xd9c6ad);assert.equal(g.attributes.position.count,G.I.length);}

// 2) 胴の真ん中をぐるっと一周する閉じた線 → 上と下で別の島。上だけ赤
{const b=bone(),G=core.boneGeom(b);const ring=[];for(let i=0;i<=16;i++)ring.push([0.5,(i/16)%1]);b.pc={cuts:[ring],fills:[{t:0.8,kf:0.1,c:'#ff0000'}]};
 const g=PC.build(THREE,G,b,0xd9c6ad),cs=colorsOf(g);assert(cs.has(key(red)),'赤が塗れてる');assert.equal(cs.size,2,'赤と元の色の2色');
 // 赤い所は全部、輪より上（y>0.5付近）
 const p=g.attributes.position.array,c=g.attributes.color.array;for(let i=0;i<p.length;i+=3)if(Math.abs(c[i]-1)<1e-3&&c[i+1]<1e-3)assert(p[i+1]>0.45,'赤が線の下にはみ出してない');
 // 割っても表面の面積は変わらない（平らな三角の上で切ってるだけ）
 const g0=PC.build(THREE,G,{...b,pc:null},0xd9c6ad);assert(Math.abs(surfArea(g)-surfArea(g0))<1e-6,'面積が同じ');}

// 3) 開いた線（一周してない）は島を分けない → 全体が赤
{const b=bone(),G=core.boneGeom(b);b.pc={cuts:[[[0.5,0],[0.5,0.25]]],fills:[{t:0.8,kf:0.1,c:'#ff0000'}]};
 const g=PC.build(THREE,G,b,0xd9c6ad),cs=colorsOf(g);assert.equal(cs.size,1);assert(cs.has(key(red)));}

// 4) 小さい閉じた丸（目）→ 丸の中だけ赤
{const b=bone(),G=core.boneGeom(b);const eye=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI*2;eye.push([0.5+0.05*Math.cos(a),0.25+0.05*Math.sin(a)]);}
 b.pc={cuts:[eye],fills:[{t:0.5,kf:0.25,c:'#ff0000'}]};const g=PC.build(THREE,G,b,0xd9c6ad),cs=colorsOf(g);assert.equal(cs.size,2);
 const p=g.attributes.position.array,c=g.attributes.color.array;let n=0;for(let i=0;i<p.length;i+=3)if(Math.abs(c[i]-1)<1e-3&&c[i+1]<1e-3){n++;assert(Math.abs(p[i+1]-0.5)<0.12,'目の外に出てない');}assert(n>0);}

// 5) 継ぎ目（角0=1）をまたぐ線でも島が分かれる
{const b=bone(),G=core.boneGeom(b);const ring=[];for(let i=0;i<=16;i++)ring.push([0.3,(0.5+i/16)%1]);b.pc={cuts:[ring],fills:[{t:0.1,kf:0.9,c:'#ff0000'}]};
 const cs=colorsOf(PC.build(THREE,G,b,0xd9c6ad));assert.equal(cs.size,2);}

// 6) 動かしても割った面が付いてくる（狩り場の update）
{const b=bone();const ring=[];for(let i=0;i<=16;i++)ring.push([0.5,(i/16)%1]);b.pc={cuts:[ring],fills:[{t:0.8,kf:0.1,c:'#ff0000'}]};
 const g=PC.build(THREE,core.boneGeom(b),b,0xd9c6ad);const b2={...b,pts:[[0,0,0],[0.6,0.8,0]]},G2=core.boneGeom(b2);PC.update(g,G2);const fresh=PC.build(THREE,G2,b2,0xd9c6ad);
 const a=g.attributes.position.array,f=fresh.attributes.position.array;assert.equal(a.length,f.length);for(let i=0;i<a.length;i++)assert(Math.abs(a[i]-f[i])<1e-5);}

// 7) 当たり → (t,kf) → 当たり が往復する
{const b=bone(),G=core.boneGeom(b);const q=PC.hitToTK(G,(5*8+3)*2,[0.2,0.3,0.5]);assert(q.t>0&&q.t<1&&q.kf>=0&&q.kf<=1);assert(Math.abs(PC.tToR(G.ts,q.t)-q.r)<1e-9);}
console.log('paint-cut ok');
