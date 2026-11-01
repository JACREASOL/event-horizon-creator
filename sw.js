// Network-first: updates arrive on next online open; cache is the offline fallback.
const CACHE='eh-creator-v5';
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','party.js','map.js','account.js','firebase-config.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))));
});
