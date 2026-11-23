import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = (
  await readdir("docs", { recursive: true, withFileTypes: true })
).filter((f) => f.isFile() && f.name !== "sw.js" && !f.name.startsWith("."));
const paths = files
  .map((f) => (f.parentPath + "/" + f.name).replace(/^docs\//, ""))
  .sort();
const hash = createHash("sha256");
for (const p of paths) hash.update(p).update(await readFile("docs/" + p));
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  "docs/sw.js",
  `const prefix='apogee:'+self.registration.scope+':'
const name=prefix+'${version}'
const assets=${JSON.stringify(paths.map((p) => "./" + p))}
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
`,
);
await writeFile("docs/.nojekyll", "");
