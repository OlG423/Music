const CACHE = 'reproductor-v24';
const ARCHIVOS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Guarda los archivos de la app para que abra sin internet
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(ARCHIVOS))
            .then(() => self.skipWaiting())
    );
});

// Borra cachés de versiones anteriores
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(claves => Promise.all(
                claves.filter(c => c !== CACHE).map(c => caches.delete(c))
            ))
            .then(() => self.clients.claim())
    );
});

// Primero usa la copia guardada; si no existe, va a la red
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.origin !== location.origin) return;

    e.respondWith(
        caches.match(e.request).then(respuesta => respuesta || fetch(e.request))
    );
});