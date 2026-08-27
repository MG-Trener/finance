import {access,copyFile,cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'www');
const buildNumber=Number(process.env.FINANCE_BUILD_NUMBER||0);
let pushConfigured=false;
try{await access(path.join(root,'mobile-assets','google-services.json'));pushConfigured=true}catch(_){ }

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const entry of ['src','assets']){
  await cp(path.join(root,entry),path.join(out,entry),{recursive:true});
}
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

let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/,'<script src="vendor/supabase.js"></script>');
html=html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/g,'');
html=html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/g,'');
html=html.replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]+>/g,'');
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

console.log(`Android web assets prepared in www/; embedded build ${buildNumber}; push ${pushConfigured?'configured':'not configured'}`);
