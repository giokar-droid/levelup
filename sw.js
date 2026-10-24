// Level Up: funziona anche offline. pubblica.py alza la versione a ogni pubblicazione.
const C = 'levelup-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
// Cancella solo le cache vecchie di Level Up: l'origine è condivisa con altri tool.
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('levelup-') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const root = new URL(self.registration.scope).pathname;
  if (!u.pathname.startsWith(root) || u.pathname.endsWith('.ics')) return;
  if (r.mode === 'navigate') {
    if (u.pathname !== root && u.pathname !== root + 'index.html') return;
    // Rete prima, ma dopo 3 secondi risponde la copia locale; in cache va solo una pagina HTML valida.
    const net = fetch(r).then(res => {
      if (res.type === 'opaqueredirect') return res;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if ((res.headers.get('content-type') || '').includes('text/html')) { const cp = res.clone(); e.waitUntil(caches.open(C).then(c => c.put('./index.html', cp))); }
      return res;
    });
    e.respondWith(new Promise(resolve => {
      let sent = false; const send = x => { if (x && !sent) { sent = true; resolve(x); } };
      const t = setTimeout(() => caches.match('./index.html').then(send), 3000);
      net.then(res => { clearTimeout(t); send(res); })
         .catch(() => { clearTimeout(t); caches.match('./index.html').then(h => send(h || Response.error())); });
    }));
    return;
  }
  e.respondWith(caches.match(r, {ignoreSearch: true}).then(hit => hit || fetch(r).then(res => {
    if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(C).then(c => c.put(r, cp))); }
    return res;
  })));
});
