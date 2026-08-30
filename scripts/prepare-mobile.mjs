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
  const cssUrl='https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@400;500;600;700;800&family=Pirata+One&display=swap';
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
    const fallback=`/* Build-time font download was unavailable. Keep Android typography deterministic. */\n.native-app{font-family:Roboto,Arial,sans-serif}\n.native-app .auth-hero h1,.native-app .title h1,.native-app .card h3,.native-app .auth-card h2,.native-app .onboarding-card h2,.native-app .modal h2,.native-app .treasury-splash-title h1{font-family:Georgia,'Times New Roman',serif}\n`;
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
