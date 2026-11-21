// Level Up: funziona anche offline. pubblica.py alza la versione della cache a ogni pubblicazione
// e tiene i ?v= qui sotto uguali a const VERSION di index.html (gli stessi indirizzi degli <script src> di Studio e Percorso).
const C = 'levelup-v8';
const SHELL = ['./', './index.html', './studio-engine.js?v=3.1', './studio-data.js?v=3.1', './studio-ui.js?v=3.1', './percorso-data.js?v=3.1', './percorso-ui.js?v=3.1', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
// Cancella solo le cache vecchie di Level Up: l'origine è condivisa con altri tool.
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('levelup-') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const root = new URL(self.registration.scope).pathname;
  if (!u.pathname.startsWith(root) || u.pathname.endsWith('.ics') || u.pathname.endsWith('version.json')) return;
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
  if (u.pathname.endsWith('.js')) {
    // Gli script (studio-*.js?v=VERSIONE): ogni versione ha il suo indirizzo, quindi la copia locale vale solo all'indirizzo esatto
    // (niente ignoreSearch). Un index.html nuovo chiede ?v= nuovo e non può ricevere uno studio-*.js vecchio; e con la rete
    // che non risponde non si aspetta una seconda volta: la pagina ha già aspettato i suoi 3 secondi.
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(C).then(c => c.put(r, cp))); }
      return res;
    })));
    return;
  }
  e.respondWith(caches.match(r, {ignoreSearch: true}).then(hit => hit || fetch(r).then(res => {
    if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(C).then(c => c.put(r, cp))); }
    return res;
  })));
});
