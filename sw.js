// 讓行程表存在手機裡，離線也能打開。
// 之後更新 index.html 時，把下面的版本號 +1（例如 v6），大家連網打開就會更新。
const VERSION = 'kyoto-osaka-v6';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache:'reload' 確保抓的是 GitHub 上最新的檔案，不是瀏覽器暫存的舊檔
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // 行程表頁面：有網路就抓最新版（最多等 4 秒），沒網路才用手機裡存的版本
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const net = await Promise.race([
          fetch(req, { cache: 'no-cache' }),
          new Promise((_, rej) => setTimeout(() => rej('timeout'), 4000))
        ]);
        if (net && net.ok) { c.put('./index.html', net.clone()); return net; }
      } catch (err) {}
      return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
    })());
    return;
  }
  // 圖示等其他檔案：先用存好的，沒有再上網抓
  e.respondWith(caches.open(VERSION).then(async c =>
    (await c.match(req, { ignoreSearch: true })) ||
    fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; })
  ));
});
