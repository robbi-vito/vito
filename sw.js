/* The Vito Protocol — offline shell.

   index.html is fetched network-first, so uploading a new one to GitHub is
   picked up on the next launch with a signal, and the cached copy is only
   used when there isn't one. Icons and fonts are cache-first, because they
   do not change. Bump CACHE if the file list below changes. */

const CACHE = 'vito-v1';
const SHELL = ['./', './index.html', './manifest.json',
  './favicon.png', './icon-180.png', './icon-192.png', './icon-512.png'];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(SHELL) })
      .then(function(){ return self.skipWaiting() })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE })
                             .map(function(k){ return caches.delete(k) }));
    }).then(function(){ return self.clients.claim() })
  );
});

function keep(req, res){
  const copy = res.clone();
  caches.open(CACHE).then(function(c){ c.put(req, copy) }).catch(function(){});
  return res;
}

self.addEventListener('fetch', function(e){
  const req = e.request;
  if (req.method !== 'GET') return;

  /* typography survives a dead signal once it has been seen online */
  if (FONTS.test(req.url)) {
    e.respondWith(caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){ return keep(req, res) })
                              .catch(function(){ return hit });
    }));
    return;
  }

  /* the weather API and YouTube are network-only; never serve them stale */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isDoc = req.mode === 'navigate' ||
                url.pathname.endsWith('/') ||
                url.pathname.endsWith('index.html');

  if (isDoc) {
    e.respondWith(
      fetch(req).then(function(res){ return keep(req, res) })
                .catch(function(){
                  return caches.match(req).then(function(hit){
                    return hit || caches.match('./index.html');
                  });
                })
    );
    return;
  }

  e.respondWith(caches.match(req).then(function(hit){
    return hit || fetch(req).then(function(res){ return keep(req, res) });
  }));
});
