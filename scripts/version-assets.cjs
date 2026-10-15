// Stamp local asset URLs so cached old scripts cannot mix with a new release.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..');
const version=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex').slice(0,12);
function html(file){const full=path.join(root,file);let s=fs.readFileSync(full,'utf8');s=s.replace(/(src|href)="([^"?]+)(?:\?v=[^"]+)?"/g,(m,a,p)=>/^(https?:|#)/.test(p)?m:a+'="'+p+'?v='+version(p)+'"');fs.writeFileSync(full,s);}
html('workshop.html');html('hunting.html');
const shell=path.join(root,'shell.js');fs.writeFileSync(shell,fs.readFileSync(shell,'utf8').replace(/'(workshop|hunting)\.html(?:\?v=[^']+)?'/g,(_,name)=>"'"+name+'.html?v='+version(name+'.html')+"'"));
html('index.html');
console.log('Asset versions updated');
