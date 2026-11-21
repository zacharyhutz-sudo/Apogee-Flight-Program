const prefix='apogee:'+self.registration.scope+':'
const name=prefix+'e9d3648a109ee464'
const assets=["./THIRD-PARTY-NOTICES.txt","./art/dusk.png","./art/range.png","./art/space.png","./art/tower.png","./art/upper.png","./art/vehicle.png","./assets/barlow-latin-500-normal-BPAOfeC8.woff2","./assets/barlow-latin-500-normal-C1h8hMer.woff","./assets/barlow-latin-600-normal-CNwfPWQD.woff","./assets/barlow-latin-600-normal-DILqtrty.woff2","./assets/barlow-latin-700-normal-A9pxMQ4z.woff2","./assets/barlow-latin-700-normal-__SGTsZ1.woff","./assets/ibm-plex-mono-latin-500-normal-CB9ihrfo.woff","./assets/ibm-plex-mono-latin-500-normal-DSY6xOcd.woff2","./assets/index-Baww-2g4.css","./assets/index-Ch5_V69O.js","./assets/phaser-Czz4FBZH.js","./icon-192.png","./icon-512.png","./index.html","./manifest.webmanifest"]
self.addEventListener('install',event=>event.waitUntil(caches.open(name).then(c=>c.addAll(assets))))
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const k of await caches.keys()) if(k.startsWith(prefix)&&k!==name)await caches.delete(k)
  await self.clients.claim()
})()))
self.addEventListener('fetch',event=>{
  const req=event.request
  if(req.method!=='GET'||!req.url.startsWith(self.registration.scope))return
  event.respondWith((async()=>{
    const cache=await caches.open(name)
    const saved=await cache.match(req.mode==='navigate'?new URL('index.html',self.registration.scope):req)
    return saved || fetch(req)
  })())
})
