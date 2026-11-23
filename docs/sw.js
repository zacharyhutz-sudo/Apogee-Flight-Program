const prefix='apogee:'+self.registration.scope+':'
const name=prefix+'16735dd3b89c2056'
const assets=["./THIRD-PARTY-NOTICES.txt","./art/canopy.png","./art/credits.png","./art/dusk.png","./art/propellant.png","./art/range.png","./art/site.png","./art/space.png","./art/tower.png","./art/upper.png","./art/vehicle.png","./assets/ibm-plex-mono-latin-500-normal-CB9ihrfo.woff","./assets/ibm-plex-mono-latin-500-normal-DSY6xOcd.woff2","./assets/index-OLEg7HB1.js","./assets/index-OmbjLcx0.css","./assets/phaser-Czz4FBZH.js","./icon-192.png","./icon-512.png","./index.html","./manifest.webmanifest"]
self.addEventListener('install',event=>{
  self.skipWaiting()
  event.waitUntil(caches.open(name).then(c=>c.addAll(assets)))
})
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const k of await caches.keys()) if(k.startsWith(prefix)&&k!==name)await caches.delete(k)
  await self.clients.claim()
})()))
self.addEventListener('fetch',event=>{
  const req=event.request
  if(req.method!=='GET'||!req.url.startsWith(self.registration.scope))return
  event.respondWith((async()=>{
    const cache=await caches.open(name)
    if(req.mode==='navigate'){
      try{
        const fresh=await fetch(req)
        if(fresh&&fresh.ok) cache.put(new URL('index.html',self.registration.scope),fresh.clone())
        return fresh
      }catch{}
    }
    const saved=await cache.match(req.mode==='navigate'?new URL('index.html',self.registration.scope):req)
    return saved || fetch(req)
  })())
})
