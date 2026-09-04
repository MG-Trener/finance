const CACHE='family-finance-shell-v10';
const PRECACHE=[
  './',
  './index.html',
  './privacy.html',
  './delete-account.html',
  './manifest.webmanifest',
  './vendor/supabase.js',
  './assets/app-icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/gerb-runtime.webp',
  './assets/piggy-chest.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(PRECACHE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('family-finance-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(!url.pathname.startsWith('/finance/'))return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(res=>{
          if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}
          return res;
        })
        .catch(async()=>await caches.match('./index.html')||caches.match('./'))
    );
    return;
  }

  if(['script','style','manifest'].includes(req.destination)){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(res=>{
          if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
          return res;
        })
        .catch(()=>caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>{
      const network=fetch(req).then(res=>{
        if(res.ok&&['image','audio'].includes(req.destination)){
          const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));
        }
        return res;
      }).catch(()=>cached);
      return cached||network;
    })
  );
});
