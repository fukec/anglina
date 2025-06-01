// Verze cache
const CACHE_NAME = 'anglina-cache-v1';

// Soubory, které budou vždy uloženy v cache při instalaci service workeru
const CACHE_STATIC_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js'
];

// Instalace Service Workeru
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instaluji...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Otevírám cache...');
        return cache.addAll(CACHE_STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Všechny soubory byly uloženy do cache');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Chyba při instalaci:', error);
      })
  );
});

// Aktivace Service Workeru
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Aktivuji...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Mažu starou cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Nyní je aktivní');
      return self.clients.claim(); // Převzít kontrolu nad nepřímo řízenými stránkami
    })
  );
});

// Zachycení fetch událostí - cache first, pak síť
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Vrátit z cache, pokud je dostupné
        if (cachedResponse) {
          return cachedResponse;
        }

        // Jinak zkusit stáhnout ze sítě
        return fetch(event.request)
          .then(response => {
            // Zkontrolovat, zda je odpověď validní
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Klonovat odpověď, protože tělo odpovědi může být přečteno pouze jednou
            const responseToCache = response.clone();

            // Přidat odpověď do cache pro budoucí použití
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('Service Worker: Fetch selhal:', error);

            // Pokud se jedná o HTML stránku a fetch selhal, vrátíme offline stránku
            if (event.request.headers.get('Accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Zachycení push událostí pro notifikace
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body || 'Nová notifikace z aplikace Anglina',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Anglina', options)
  );
});

// Kliknutí na notifikaci
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
