import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const resRoot=path.join(root,'android','app','src','main','res');
const drawableDir=path.join(resRoot,'drawable');
await mkdir(drawableDir,{recursive:true});
await writeFile(path.join(drawableDir,'empty_splash.xml'),`<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="@android:color/transparent" />
  <size android:width="1dp" android:height="1dp" />
</shape>
`,'utf8');

const styleFiles=[
  path.join(resRoot,'values','styles.xml'),
  path.join(resRoot,'values-night','styles.xml'),
  path.join(resRoot,'values-v31','styles.xml'),
  path.join(resRoot,'values-night-v31','styles.xml')
];

const replacement=`<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
  <item name="windowSplashScreenBackground">#050b12</item>
  <item name="windowSplashScreenAnimatedIcon">@drawable/empty_splash</item>
  <item name="windowSplashScreenAnimationDuration">0</item>
  <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
  <item name="android:windowBackground">#050b12</item>
</style>`;

for(const file of styleFiles){
  try{await access(file)}catch{continue}
  let text=await readFile(file,'utf8');
  const start=text.indexOf('<style name="AppTheme.NoActionBarLaunch"');
  if(start<0)continue;
  const end=text.indexOf('</style>',start);
  if(end<0)continue;
  text=text.slice(0,start)+replacement+text.slice(end+'</style>'.length);
  await writeFile(file,text,'utf8');
}

console.log('Visible Android launch splash disabled.');
