import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const MiB=1024*1024;
const KiB=1024;
const defaultLimit=Math.round(1.5*MiB);
const explicitLimits=new Map([
  ['assets/gerb.png',4*MiB],
  ['assets/gerb-runtime.webp',512*KiB],
  ['vendor/xlsx.full.min.js',1*MiB]
]);
const skippedDirs=new Set(['.git','node_modules','www','android','test-results','playwright-report']);
const failures=[];
let checked=0,total=0;

async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.isDirectory()&&skippedDirs.has(entry.name))continue;
    const absolute=path.join(dir,entry.name);
    if(entry.isDirectory()){
      await walk(absolute);
      continue;
    }
    if(!entry.isFile())continue;
    const info=await stat(absolute);
    const relative=path.relative(root,absolute).split(path.sep).join('/');
    const limit=explicitLimits.get(relative)??defaultLimit;
    checked+=1;total+=info.size;
    if(info.size>limit)failures.push({relative,size:info.size,limit});
  }
}

await walk(root);

for(const required of ['assets/gerb.png','assets/gerb-runtime.webp']){
  try{await stat(path.join(root,required))}catch{failures.push({relative:required,size:0,limit:explicitLimits.get(required)??defaultLimit,missing:true})}
}

if(failures.length){
  console.error('Repository size budget failed:');
  for(const item of failures){
    if(item.missing)console.error(`- missing required asset: ${item.relative}`);
    else console.error(`- ${item.relative}: ${(item.size/KiB).toFixed(1)} KiB > ${(item.limit/KiB).toFixed(1)} KiB`);
  }
  process.exit(1);
}

console.log(`Repository size budget OK: ${checked} files, ${(total/MiB).toFixed(2)} MiB working tree (generated/build directories excluded).`);
