import {access,copyFile,cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'www');

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const entry of ['src','assets']){
  await cp(path.join(root,entry),path.join(out,entry),{recursive:true});
}
for(const file of ['styles.css','hotfix.css','manifest.webmanifest','sw.js']){
  try{await copyFile(path.join(root,file),path.join(out,file))}catch(error){if(error?.code!=='ENOENT')throw error}
}

await mkdir(path.join(out,'vendor'),{recursive:true});
const supabaseCandidates=[
  'node_modules/@supabase/supabase-js/dist/umd/supabase.js',
  'node_modules/@supabase/supabase-js/dist/umd/supabase.min.js'
];
let supabaseSource='';
for(const candidate of supabaseCandidates){
  try{await access(path.join(root,candidate));supabaseSource=path.join(root,candidate);break}catch(_){ }
}
if(!supabaseSource)throw new Error('Не найден UMD bundle @supabase/supabase-js');
await copyFile(supabaseSource,path.join(out,'vendor','supabase.js'));

let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/,'<script src="vendor/supabase.js"></script>');
html=html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/g,'');
html=html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/g,'');
html=html.replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]+>/g,'');
html=html.replace('<body>','<body class="native-app">\n  <script>window.__FINANCE_NATIVE__=true;</script>');
await writeFile(path.join(out,'index.html'),html,'utf8');

console.log('Android web assets prepared in www/');
