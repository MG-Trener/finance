import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const fail=[];
const assert=(condition,message)=>{if(!condition)fail.push(message)};
const exists=relative=>fs.existsSync(path.join(root,relative));

// Manifest must be valid JSON and every icon must exist.
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert(manifest.name==='Семейная казна','manifest: unexpected application name');
assert(manifest.start_url==='/finance/','manifest: start_url must match GitHub Pages path');
assert(manifest.scope==='/finance/','manifest: scope must match GitHub Pages path');
for(const icon of manifest.icons||[])assert(exists(icon.src),`manifest icon is missing: ${icon.src}`);

// Every local script/stylesheet/manifest/icon referenced by index.html must exist.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
for(const ref of refs){
  if(/^(?:https?:|data:|#)/.test(ref))continue;
  const local=ref.split('?')[0].replace(/^\.\//,'');
  assert(exists(local),`index.html references missing file: ${local}`);
}

// Check CSS import graph from the single application entrypoint.
const seen=new Set();
function checkCss(file){
  if(seen.has(file))return;
  seen.add(file);
  assert(exists(file),`missing CSS file: ${file}`);
  if(!exists(file))return;
  const css=fs.readFileSync(path.join(root,file),'utf8');
  const base=path.dirname(file);
  for(const match of css.matchAll(/@import\s+url\(['"]?([^)'"?]+)(?:\?[^)'" ]*)?['"]?\)/g)){
    const ref=match[1];
    if(/^(?:https?:|data:)/.test(ref))continue;
    const target=path.normalize(path.join(base,ref)).replaceAll('\\','/');
    checkCss(target);
  }
}
checkCss('src/css/app.css');

// Service-worker precache entries must point to real local resources.
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const precacheMatch=sw.match(/const PRECACHE=\[([\s\S]*?)\];/);
if(precacheMatch){
  for(const match of precacheMatch[1].matchAll(/['"](\.\/[^'"]+)['"]/g)){
    const ref=match[1];
    if(ref==='./')continue;
    assert(exists(ref.replace(/^\.\//,'')),`service worker precaches missing file: ${ref}`);
  }
}else fail.push('service worker: PRECACHE list not found');

// Legacy refactor artifacts must not return to the active graph.
const forbidden=[
  'phase2-fix.js','phase3.js','phase4.js','phase5.js','phase6.js','phase8.js','phase10.js','phase11.js',
  'src/js/ui/pirate-assets.js','src/js/core/transaction-form.js','src/css/components/pirate-assets.css'
];
for(const item of forbidden)assert(!html.includes(item),`index.html still references legacy artifact: ${item}`);

if(fail.length){
  console.error(`Static integrity check failed (${fail.length}):`);
  for(const message of fail)console.error(` - ${message}`);
  process.exit(1);
}
console.log(`Static integrity OK: ${seen.size} CSS files checked, ${refs.length} index references checked.`);
