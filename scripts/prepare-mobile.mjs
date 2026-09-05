import {createHash} from 'node:crypto';
import {access,copyFile,cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'www');
const buildNumber=Number(process.env.FINANCE_BUILD_NUMBER||0);
let pushConfigured=false;
try{await access(path.join(root,'mobile-assets','google-services.json'));pushConfigured=true}catch(_){ }

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

await cp(path.join(root,'src'),path.join(out,'src'),{recursive:true});
const assetsRoot=path.join(root,'assets');
await cp(assetsRoot,path.join(out,'assets'),{
  recursive:true,
  // assets/gerb.png is the 3 MB master artwork. Runtime UI uses the generated WebP copy.
  filter:source=>path.relative(assetsRoot,source)!=='gerb.png'
});
await access(path.join(out,'assets','gerb-runtime.webp'));

// GitHub text tools cannot safely persist the uploaded MP4 directly as binary.
// Keep an Android-compatible H.264 copy as Base64 text chunks and reconstruct
// the exact bytes during the mobile build. One connector transfer can omit a
// single Base64 character, so part 01 is deterministically repaired against its
// known Git blob SHA before the final MP4 is cryptographically verified.
const startupVideoParts=['part-01.b64','part-02.b64','part-03.b64'];
const startupVideoChunks=await Promise.all(startupVideoParts.map(name=>
  readFile(path.join(root,'mobile-assets','startup-video',name),'utf8').then(text=>text.replace(/\s+/g,''))
));

function sha1Text(text){
  return createHash('sha1').update(text,'utf8').digest('hex');
}
function gitBlobSha(text){
  const bytes=Buffer.from(text,'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const expectedPart1Length=12000;
const expectedPart1GitSha='cc4b230ba7c0fff37a301c260c1b3dfcfa8b1a4a';
const part1BlockSize=256;
const expectedPart1BlockHashes=[
  'b26b98fc12c794c3d60aa8ea1e34a2cef0ed0b05','b96d6f311a7c5744e4ad8de78632b9a42c1f1618',
  'e55c84ef7994451d774ba551dd170ed99135ab1c','146c3f56e0d3a1b87c9a8f35a7add65ab93a4072',
  'cf9e314d8a892aa0841975e9023e4d80df2434c7','bc5979e88c9398373b3a22879334d0da051dda46',
  'f359f9452781e25fa9677d9b927bc8afc48b36f1','c1407da1c1722cd1081c944301bc7b0ebc9d5577',
  'f2fd99693ee01f322a5083e8c093eab8e87be490','42f844be5cf048c1c65c0be73eff81a73e05791f',
  '101406b9b1a040088cfae6a6d4b6c90be404a584','870470e6d1153aca9c008ad7047a5acbeb28f575',
  '1fd3f9cebf783373e40f14181b40a12261db3cea','63bb9b4bab3f7802f3e8fb11bd6d692a0422406f',
  'd2b50a6536387ed0f8fd1d08b2c82ee4fbfbd9c6','7b765e9cd11d53e60ffcc18bd8a794ea5ad1fce5',
  '637d3282b9f02155cfd27fb16565a71080d9d389','e5a4c49ad3a0bb24adb577f219252ee9777f4843',
  '9bff8c8874565cb080a42d19b1c3cc305c6a5207','908490f38820931083ddea3cda23caa7a77ddab1',
  '2ae310f9c17589108bdf735469a9a964690be6c1','509864f7fbc7bc5d74c423bc1ed6f51dc755672f',
  '0d89e33bcbcb81d9b4d7e5d208f428e2a5c45176','b73fe819252a78f93e5a9cb72686a9768008fdd8',
  'ae4f405b2768e428846263f9860bac1904f2064e','65836e7c65a56c1c9f87c1f2b1956468619c64d9',
  '15232b519bd26bffda795e738283e841b96329d9','9890cbf42416ea72beb24c1265114f435c4a861e',
  '237c0af482dcad926f6299d4ceaf2d887e3a3809','a98f328c0b27f7b517a0d4beaae1357d26a68aa8',
  '435832e19af7e1a8a9fce1107e9c5e47d90fa99b','d8233061d94dce56ebcd1e8bf0d9848adbb0038f',
  '719b603f96aebf5c4e8691f9f2b3a1961a1e08a5','5091308d89e2155e3657f6a71c548ac2516e46cf',
  '2295dc5aaab92650265f85208e63f3ea9f998bcf','4f23683090a3609996629ec7d1b082db9aaf07a2',
  '8e894ead28fafb552ec70b38742e32711a9e013a','62344f5c0f8c88de3f2185b29e431254972ae346',
  '438c9e55b8b999128bb851cfa87c48143d4f85d3','032525ab73b979c5449e0a729a5be082acfb41b0',
  '5792948be2f9d14c85e355925ab07bdcbb4e5bd0','0e2ba112075390899fa99bbd35561f82a02f7e43',
  'c745266c88463bfe66391363446a6a4fcea77ca3','27cc58e9eb50a45a6617d96f2054c71bc0de3d72',
  '021209361c6bbe751c020084ebf023bec4fa2f82','41f81c20914115c82c072b921b7e19f3a28a0cb5',
  '0537131ec6a2be4ca3a55d45dcfd2f20a75255cc'
];

let part1=startupVideoChunks[0];
if(gitBlobSha(part1)!==expectedPart1GitSha){
  if(part1.length!==expectedPart1Length-1){
    throw new Error(`Startup video part 01 has unexpected length ${part1.length}`);
  }
  let mismatchBlock=0;
  while(mismatchBlock<expectedPart1BlockHashes.length){
    const start=mismatchBlock*part1BlockSize;
    const chunk=part1.slice(start,Math.min(start+part1BlockSize,part1.length));
    if(sha1Text(chunk)!==expectedPart1BlockHashes[mismatchBlock])break;
    mismatchBlock++;
  }
  const searchStart=Math.max(0,mismatchBlock*part1BlockSize);
  const searchEnd=Math.min(part1.length,searchStart+part1BlockSize+1);
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let repaired=null;
  outer: for(let pos=searchStart;pos<=searchEnd;pos++){
    for(const ch of alphabet){
      const candidate=part1.slice(0,pos)+ch+part1.slice(pos);
      if(gitBlobSha(candidate)===expectedPart1GitSha){
        repaired=candidate;
        console.log(`Repaired startup video Base64 at part-01 position ${pos}.`);
        break outer;
      }
    }
  }
  if(!repaired)throw new Error(`Unable to repair startup video part 01 near block ${mismatchBlock}`);
  part1=repaired;
}
startupVideoChunks[0]=part1;

const startupVideoBase64=startupVideoChunks.join('');
const startupVideoBytes=Buffer.from(startupVideoBase64,'base64');
const expectedVideoSize=26499;
const expectedVideoSha256='5a3419798c4b284d703073c9ca7302d4a837cf373517ff757127921da4f16bfd';
const actualVideoSha256=createHash('sha256').update(startupVideoBytes).digest('hex');
if(startupVideoBytes.length!==expectedVideoSize||actualVideoSha256!==expectedVideoSha256){
  throw new Error(`Startup video bundle is invalid: ${startupVideoBytes.length} bytes, sha256 ${actualVideoSha256}`);
}
await writeFile(path.join(out,'assets','startup-family-treasury.mp4'),startupVideoBytes);
console.log(`Bundled validated startup video: ${startupVideoBytes.length} bytes; sha256 ${actualVideoSha256}.`);

for(const file of ['styles.css','hotfix.css','manifest.webmanifest','sw.js','privacy.html','delete-account.html']){
  try{await copyFile(path.join(root,file),path.join(out,file))}catch(error){if(error?.code!=='ENOENT')throw error}
}

await mkdir(path.join(out,'vendor'),{recursive:true});
async function copyFirst(candidates,destination,label){
  for(const candidate of candidates){
    const source=path.join(root,candidate);
    try{await access(source);await copyFile(source,path.join(out,'vendor',destination));return}catch(_){ }
  }
  throw new Error(`Не найден локальный bundle ${label}`);
}

await copyFirst([
  'node_modules/@supabase/supabase-js/dist/umd/supabase.js',
  'node_modules/@supabase/supabase-js/dist/umd/supabase.min.js'
],'supabase.js','@supabase/supabase-js');
await copyFirst([
  'node_modules/chart.js/dist/chart.umd.min.js',
  'node_modules/chart.js/dist/chart.umd.js'
],'chart.umd.js','Chart.js');
await copyFirst([
  'node_modules/xlsx/dist/xlsx.full.min.js',
  'node_modules/xlsx/dist/xlsx.full.js'
],'xlsx.full.min.js','XLSX');

async function bundleMobileFonts(){
  const cssUrl='https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap';
  const fontDir=path.join(out,'assets','fonts');
  await mkdir(fontDir,{recursive:true});
  try{
    const response=await fetch(cssUrl,{headers:{'user-agent':'Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36'}});
    if(!response.ok)throw new Error(`Google Fonts ${response.status}`);
    let css=await response.text();
    const urls=[...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(match=>match[1]))];
    if(!urls.length)throw new Error('Google Fonts не вернул файлы шрифтов');
    for(let i=0;i<urls.length;i++){
      const url=urls[i],fontResponse=await fetch(url);
      if(!fontResponse.ok)throw new Error(`Font ${fontResponse.status}: ${url}`);
      const bytes=Buffer.from(await fontResponse.arrayBuffer());
      const name=`font-${String(i+1).padStart(2,'0')}.woff2`;
      await writeFile(path.join(fontDir,name),bytes);
      css=css.split(url).join(`./${name}`);
    }
    await writeFile(path.join(fontDir,'mobile-fonts.css'),css,'utf8');
    console.log(`Bundled ${urls.length} local webfont files for Android.`);
    return 'assets/fonts/mobile-fonts.css';
  }catch(error){
    const fallback=`/* Build-time font download was unavailable. Keep Android typography deterministic. */\n.native-app{font-family:Roboto,Arial,sans-serif}\n.native-app .auth-hero h1,.native-app .title h1,.native-app .card h3,.native-app .auth-card h2,.native-app .onboarding-card h2,.native-app .modal h2{font-family:Georgia,'Times New Roman',serif}\n`;
    await writeFile(path.join(fontDir,'mobile-fonts.css'),fallback,'utf8');
    console.warn(`Local font bundle fallback used: ${error.message}`);
    return 'assets/fonts/mobile-fonts.css';
  }
}

const localFontCss=await bundleMobileFonts();
let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/,'<script src="vendor/supabase.js"></script>');
html=html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/g,'');
html=html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/g,'');
html=html.replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]+>/g,'');
html=html.replace(/(<link rel="stylesheet" href="src\/css\/app\.css[^>]*>)/,`<link rel="stylesheet" href="${localFontCss}">\n  $1`);
html=html.replace('<body>',`<body class="native-app">\n  <script>window.__FINANCE_NATIVE__=true;window.__FINANCE_BUILD__=${buildNumber};window.__FINANCE_PUSH_CONFIGURED__=${pushConfigured};</script>`);
await writeFile(path.join(out,'index.html'),html,'utf8');

const analyticsPath=path.join(out,'src/js/features/analytics.js');
let analytics=await readFile(analyticsPath,'utf8');
analytics=analytics.replace('https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js','vendor/chart.umd.js');
await writeFile(analyticsPath,analytics,'utf8');

const exportPath=path.join(out,'src/js/features/export.js');
let exporter=await readFile(exportPath,'utf8');
exporter=exporter.replace('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','vendor/xlsx.full.min.js');
await writeFile(exportPath,exporter,'utf8');

console.log(`Android web assets prepared in www/; embedded build ${buildNumber}; push ${pushConfigured?'configured':'not configured'}; master crest excluded`);
