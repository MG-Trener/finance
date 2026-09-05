import {access,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const activityPath=path.join(root,'android','app','src','main','java','kz','mgtrener','familyfinance','MainActivity.java');
const stylePaths=[
  path.join(root,'android','app','src','main','res','values','styles.xml'),
  path.join(root,'android','app','src','main','res','values-night','styles.xml')
];

async function patchStyles(file){
  try{await access(file)}catch{return}
  let text=await readFile(file,'utf8');
  const items=[
    ['android:statusBarColor','#050b12'],
    ['android:navigationBarColor','#050b12'],
    ['android:windowLightStatusBar','false'],
    ['android:windowLightNavigationBar','false']
  ];
  for(const [name,value] of items){
    const re=new RegExp(`<item\\s+name=["']${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["'][^>]*>[^<]*<\\/item>`,'g');
    const item=`<item name="${name}">${value}</item>`;
    if(re.test(text))text=text.replace(re,item);
    else text=text.replace(/<\/style>/,`    ${item}\n    </style>`);
  }
  await writeFile(file,text,'utf8');
}

for(const file of stylePaths)await patchStyles(file);

try{
  let java=await readFile(activityPath,'utf8');
  if(!java.includes('android.graphics.Color'))java=java.replace('package kz.mgtrener.familyfinance;','package kz.mgtrener.familyfinance;\n\nimport android.graphics.Color;\nimport android.os.Build;\nimport android.os.Bundle;');
  if(!java.includes('protected void onCreate(Bundle savedInstanceState)')){
    java=java.replace(/public class MainActivity extends BridgeActivity \{\s*\}/,`public class MainActivity extends BridgeActivity {\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        getWindow().setStatusBarColor(Color.parseColor("#050b12"));\n        getWindow().setNavigationBarColor(Color.parseColor("#050b12"));\n        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {\n            getWindow().setNavigationBarContrastEnforced(false);\n            getWindow().setStatusBarContrastEnforced(false);\n        }\n        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {\n            getWindow().getDecorView().setSystemUiVisibility(0);\n        }\n\n        // Android 15+ enforces edge-to-edge for apps targeting modern SDKs.\n        // Keep the WebView below the status bar so time, network and battery\n        // indicators never overlap the application header. Do not consume the\n        // bottom inset here: the web UI already handles the navigation bar.\n        if (Build.VERSION.SDK_INT >= 35) {\n            final android.view.View contentView = findViewById(android.R.id.content);\n            androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, insets) -> {\n                final androidx.core.graphics.Insets statusBarInsets =\n                    insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.statusBars());\n                view.setPadding(\n                    view.getPaddingLeft(),\n                    statusBarInsets.top,\n                    view.getPaddingRight(),\n                    view.getPaddingBottom()\n                );\n                return insets;\n            });\n            androidx.core.view.ViewCompat.requestApplyInsets(contentView);\n        }\n    }\n}`);
  }
  await writeFile(activityPath,java,'utf8');
}catch(error){
  throw new Error(`Не удалось настроить системные панели Android: ${error.message}`);
}

await import('./disable-android-splash.mjs');
console.log('Android system bars configured for the dark application theme.');
