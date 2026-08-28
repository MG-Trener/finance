import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const vendor=path.join(root,'vendor');
await mkdir(vendor,{recursive:true});

async function copyFirst(candidates,destination,label){
  for(const candidate of candidates){
    const source=path.join(root,candidate);
    try{await access(source);await copyFile(source,path.join(vendor,destination));return}catch(_){ }
  }
  throw new Error(`Не найден bundle ${label}`);
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

// Remove the final dormant Budget references from the offline engine.
const offlinePath=path.join(root,'src/js/core/offline-store.js');
let offline=await readFile(offlinePath,'utf8');
offline=offline.replace("'trashTransactions','budgets','recurring'","'trashTransactions','recurring'");
offline=offline.replace(/\n\s*budget:\{table:'budgets',stateKey:'budgets',label:'Бюджет'\},/,'');
offline=offline.replace("'transactions','trashTransactions','budgets','recurring'","'transactions','trashTransactions','recurring'");
if(/\bbudgets\b|\bbudget:\{/.test(offline))throw new Error('В offline-store.js остались ссылки на бывший Бюджет');
await writeFile(offlinePath,offline,'utf8');

console.log('Web vendor bundles prepared and obsolete Budget references removed.');
