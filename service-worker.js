/* NoteSpace service worker: network-first (so design updates show up), cache fallback (so it works offline). */
const CACHE = 'notespace-v2';
const CORE = ['./', 'index.html', 'style.css', 'script.js', 'manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => { })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
    if (!sameOrigin && !fonts) return;

    e.respondWith(
        fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
        }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
    );
});
