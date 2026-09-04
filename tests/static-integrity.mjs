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

// Goal funding must remain one atomic accounting action: contribution + linked transaction.
const goalMigration='supabase/migrations/20260826_006_link_goal_contributions_to_expenses.sql';
const goalProtectionMigration='supabase/migrations/20260826_007_protect_linked_goal_transactions.sql';
assert(exists(goalMigration),'goal accounting migration is missing');
assert(exists(goalProtectionMigration),'goal transaction protection migration is missing');
if(exists(goalMigration)){
  const sql=fs.readFileSync(path.join(root,goalMigration),'utf8');
  assert(sql.includes('function public.contribute_to_goal'),'goal migration: contribute_to_goal RPC is missing');
  assert(sql.includes("'Цели и накопления'"),'goal migration: accounting category is missing');
  assert(sql.includes('transaction_id'),'goal migration: contribution/transaction link is missing');
  assert(sql.includes('person_id'),'goal migration: contributor person link is missing');
}
const goalsJs=fs.readFileSync(path.join(root,'src/js/features/goals.js'),'utf8');
assert(goalsJs.includes("sb.rpc('contribute_to_goal'"),'goals UI must use atomic contribute_to_goal RPC');
assert(goalsJs.includes('linked_user_id===state.user?.id'),'goals UI must attribute funding to the signed-in family member');

// The optimized artwork is the production background; the legacy PNG is only a tiny compatibility fallback.
assert(exists('assets/backgrounds/site-bg.webp'),'optimized application background is missing');
const hotfix=fs.readFileSync(path.join(root,'hotfix.css'),'utf8');
assert(hotfix.includes("assets/backgrounds/site-bg.webp"),'hotfix.css must use the optimized WebP background');

// App startup must not show the former custom splash scene. Keep only the empty
// boot host so auth/offline startup messages can still be rendered when needed.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(!html.includes('treasury-splash'),'custom startup splash must remain removed');
assert(!html.includes('src/js/ui/splash.js'),'splash animation script must not be loaded');
assert(!html.includes('assets/splash-title-pirate.png'),'splash title artwork must not be loaded at startup');
assert(html.includes('<div id="app"><div class="boot"></div></div>'),'startup must use the empty boot host');

// Piggy Bank must remain a first-class third Plan section with four supported currencies.
const piggyMigration='supabase/migrations/20260904_019_piggy_bank_balances.sql';
const piggyIndexMigration='supabase/migrations/20260904_020_piggy_bank_actor_indexes.sql';
assert(exists(piggyMigration),'piggy bank migration is missing');
assert(exists(piggyIndexMigration),'piggy bank actor index migration is missing');
assert(exists('src/js/features/piggy-bank.js'),'piggy bank UI module is missing');
assert(exists('src/css/pages/piggy-bank.css'),'piggy bank styles are missing');
assert(exists('assets/piggy-chest.svg'),'piggy bank treasure chest artwork is missing');
assert(html.includes('src/js/features/piggy-bank.js'),'piggy bank UI module is not loaded');
const piggyJs=fs.readFileSync(path.join(root,'src/js/features/piggy-bank.js'),'utf8');
for(const code of ['KZT','RUB','USD','CNY'])assert(piggyJs.includes(code),`piggy bank currency is missing: ${code}`);
assert(piggyJs.includes('Копилка'),'Plan third tab must be labelled Копилка');
assert(piggyJs.includes("uiSound(edit?'success':'income')"),'piggy bank add action must use the coin sound');
if(exists(piggyMigration)){
  const sql=fs.readFileSync(path.join(root,piggyMigration),'utf8');
  assert(sql.includes('create table if not exists public.piggy_bank_balances'),'piggy bank table is missing');
  assert(sql.includes('function public.add_piggy_bank_amount'),'piggy bank additive RPC is missing');
  assert(sql.includes('security invoker'),'piggy bank RPC must preserve caller RLS');
}

// Every local script/stylesheet/manifest/icon referenced by index.html must exist.
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
for(const ref of refs){
  if(/^(?:https?:|data:|#)/.test(ref))continue;
  const local=ref.split('?')[0].replace(/^\.\//,'');
  assert(exists(local),`index.html references missing file: ${local}`);
}

// Website runtime libraries must be local, not dependent on a third-party JS CDN.
for(const vendor of ['vendor/supabase.js','vendor/chart.umd.js','vendor/xlsx.full.min.js'])assert(exists(vendor),`local vendor bundle is missing: ${vendor}`);
assert(html.includes('src="vendor/supabase.js'),'index.html must load Supabase from local vendor');
assert(!html.includes('cdn.jsdelivr.net/npm/@supabase'),'index.html must not load Supabase from CDN');
const exportJs=fs.readFileSync(path.join(root,'src/js/features/export.js'),'utf8');
const transfersJs=fs.readFileSync(path.join(root,'src/js/features/transfers.js'),'utf8');
assert(exportJs.includes("vendor/xlsx.full.min.js"),'Excel export must use local XLSX vendor');
assert(transfersJs.includes("vendor/chart.umd.js"),'analytics must use local Chart.js vendor');

// Neutral transfers must be first-class accounting records but never family income/expense.
const transferMigration='supabase/migrations/20260828_013_family_transfer_transactions.sql';
assert(exists('supabase/migrations/20260828_012_add_transfer_transaction_type.sql'),'transfer enum migration is missing');
assert(exists(transferMigration),'transfer schema migration is missing');
if(exists(transferMigration)){
  const sql=fs.readFileSync(path.join(root,transferMigration),'utf8');
  assert(sql.includes('create_family_transfer'),'transfer RPC is missing');
  assert(sql.includes('transfer_to_person_id'),'transfer target column is missing');
}
assert(exists('src/js/features/transfers.js'),'transfer UI module is missing');
assert(html.includes('src/js/features/transfers.js'),'transfer UI module is not loaded');
const runtimeJs=fs.readFileSync(path.join(root,'src/js/core/runtime.js'),'utf8');
assert(runtimeJs.includes("x.type==='transfer'"),'personal balances do not account for transfers');
assert(transfersJs.includes("type:'transfer'"),'transfer UI does not create neutral transfer records');

// Removed Budget feature must not remain in runtime, realtime or offline state.
const offlineJs=fs.readFileSync(path.join(root,'src/js/core/offline-store.js'),'utf8');
const realtimeJs=fs.readFileSync(path.join(root,'src/js/core/realtime.js'),'utf8');
for(const [label,source] of [['runtime',runtimeJs],['offline',offlineJs],['realtime',realtimeJs]])assert(!/\bbudgets\b|\bbudget:\s*\{/.test(source),`${label}: obsolete Budget feature reference remains`);

// Primary navigation requirements.
const shellJs=fs.readFileSync(path.join(root,'src/js/ui/app-shell.js'),'utf8');
assert(shellJs.includes("view:'recurring',label:'План'"),'recurring navigation must be labelled План');
assert(shellJs.includes('scrollOverviewTop'),'Overview navigation must restore scroll to top');

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

// Income confirmation and Piggy Bank deposits use the licensed, mobile-bundled coin sample and keep it short.
const incomeSound='assets/sounds/income-coins.wav';
assert(exists(incomeSound),'income coin sound is missing');
if(exists(incomeSound)){
  const wav=fs.readFileSync(path.join(root,incomeSound));
  assert(wav.toString('ascii',0,4)==='RIFF'&&wav.toString('ascii',8,12)==='WAVE','income coin sound must be a RIFF/WAVE file');
  if(wav.length>=44){
    const byteRate=wav.readUInt32LE(28),dataBytes=wav.readUInt32LE(40),duration=byteRate?dataBytes/byteRate:0;
    assert(duration>=.5&&duration<=2,`income coin sound duration must be between 0.5 and 2 seconds, got ${duration.toFixed(3)}`);
  }
}
const soundsJs=fs.readFileSync(path.join(root,'src/js/ui/sounds.js'),'utf8');
assert(soundsJs.includes("assets/sounds/income-coins.wav"),'income coin sound is not loaded by the UI');
assert(soundsJs.includes("kind==='income'"),'income sound route is missing');

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
