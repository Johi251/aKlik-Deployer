const CACHE="aklik-deployer-shell-v09";
const ASSETS=["/","/app.js","/workflow.js","/style.css","/landing.css","/favicon.svg","/fonts/manrope-latin.woff2","/manifest.webmanifest","/icon-192.png","/icon-512.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("aklik-deployer-shell-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{const u=new URL(event.request.url);if(event.request.method!=="GET"||u.origin!==self.location.origin||!ASSETS.includes(u.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(hit=>hit??new Response("Offline noch nicht verfügbar.",{status:503}))));
});
