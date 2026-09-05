import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const resRoot=path.join(root,'android','app','src','main','res');
const drawableDir=path.join(resRoot,'drawable');
const drawableNoDpiDir=path.join(resRoot,'drawable-nodpi');
const sourceSplash=path.join(root,'assets','splash-family-treasury.webp');

await access(sourceSplash);
await mkdir(drawableDir,{recursive:true});
await mkdir(drawableNoDpiDir,{recursive:true});
await copyFile(sourceSplash,path.join(drawableNoDpiDir,'family_treasury_splash.webp'));

await writeFile(path.join(drawableDir,'family_treasury_launch.xml'),`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <shape android:shape="rectangle">
      <solid android:color="#050b12" />
    </shape>
  </item>
  <item>
    <bitmap
      android:src="@drawable/family_treasury_splash"
      android:gravity="fill"
      android:filter="true" />
  </item>
</layer-list>
`,'utf8');

const styleFiles=[
  path.join(resRoot,'values','styles.xml'),
  path.join(resRoot,'values-night','styles.xml'),
  path.join(resRoot,'values-v31','styles.xml'),
  path.join(resRoot,'values-night-v31','styles.xml')
];

const launchStyle=`<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
  <item name="windowSplashScreenBackground">#050b12</item>
  <item name="windowSplashScreenAnimatedIcon">@drawable/family_treasury_splash</item>
  <item name="windowSplashScreenAnimationDuration">0</item>
  <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
  <item name="android:windowBackground">@drawable/family_treasury_launch</item>
</style>`;

function replaceStyle(text,name,replacement){
  const marker=`<style name="${name}"`;
  const start=text.indexOf(marker);
  if(start<0)return text;
  const end=text.indexOf('</style>',start);
  if(end<0)return text;
  return text.slice(0,start)+replacement+text.slice(end+'</style>'.length);
}

function ensureWindowBackground(text){
  const marker='<style name="AppTheme.NoActionBar"';
  const start=text.indexOf(marker);
  if(start<0)return text;
  const end=text.indexOf('</style>',start);
  if(end<0)return text;
  const block=text.slice(start,end+'</style>'.length);
  const item='<item name="android:windowBackground">@drawable/family_treasury_launch</item>';
  const backgroundRe=/<item\s+name=["']android:windowBackground["'][^>]*>[^<]*<\/item>/g;
  const patched=backgroundRe.test(block)
    ?block.replace(backgroundRe,item)
    :block.replace('</style>',`  ${item}\n</style>`);
  return text.slice(0,start)+patched+text.slice(end+'</style>'.length);
}

for(const file of styleFiles){
  try{await access(file)}catch{continue}
  let text=await readFile(file,'utf8');
  text=replaceStyle(text,'AppTheme.NoActionBarLaunch',launchStyle);
  text=ensureWindowBackground(text);
  await writeFile(file,text,'utf8');
}

console.log('Premium Android launch splash configured from assets/splash-family-treasury.webp.');
