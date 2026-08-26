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
assert(manifest.orientation==='portrait-primary','manifest: installed app must remain portrait-only');
for(const icon of manifest.icons||[])assert(exists(icon.src),`manifest icon is missing: ${icon.src}`);

// Android builds must also enforce portrait orientation at the native Activity level.
const androidWorkflow=fs.readFileSync(path.join(root,'.github/workflows/android-apk.yml'),'utf8');
assert(androidWorkflow.includes('Lock Android to portrait orientation'),'android workflow: portrait lock step is missing');
assert(androidWorkflow.includes('android:screenOrientation="portrait"'),'android workflow: MainActivity portrait lock is missing');

// The optimized artwork is the production background; the legacy PNG is only a tiny compatibility fallback.
assert(exists('assets/backgrounds/site-bg.webp'),'optimized application background is missing');
const hotfix=fs.readFileSync(path.join(root,'hotfix.css'),'utf8');
assert(hotfix.includes("assets/backgrounds/site-bg.webp"),'hotfix.css must use the optimized WebP background');

// Every local script/stylesheet/manifest/icon referenced by index.html must exist.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
for(const ref of refs){
  if(/^(?:https?:|data:|#)/.test(ref))continue;
  const local=ref.split('?')[0].replace(/^\.\//,'');
  assert(exists(local),`index.html references missing file: ${local}`);
}

// Check the CSS import graph and every local url(...) asset used by active CSS.
const seen=new Set();
function resolveCssRef(base,ref){return path.normalize(path.join(base,ref.split('?')[0].split('#')[0])).replaceAll('\\','/')}
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
    checkCss(resolveCssRef(base,ref));
  }

  for(const match of css.matchAll(/url\(['"]?([^)'" ]+)['"]?\)/g)){
    const ref=match[1];
    if(/^(?:https?:|data:|#)/.test(ref))continue;
    const target=resolveCssRef(base,ref);
    assert(exists(target),`${file} references missing asset: ${target}`);
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
