const CACHE_VERSION = 'spotters-spain-v1.0.9';
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './radar_trafico.html',
  './p_spotting.html',
  './meteorologia.html',
  './noticias.html',
  './aerolineas.html',
  './simulacion_fotos.html',
  './info_aeropu.html',
  './frecuencias.html',
  './alert.html',
  './colaboracion.html',
  './acerca.html',
  './enlaces.html',

  // Font Awesome
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',

  // Tailwind
  'https://cdn.tailwindcss.com',

  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Orbitron:wght@600;800;900&display=swap'
];


// =====================================================
// RECURSOS EXTERNOS ESTÁTICOS
// =====================================================

function isExternalStaticAsset(request) {

  const url = new URL(request.url);

  // Font Awesome + sus fuentes
  if (
    url.hostname === 'cdnjs.cloudflare.com'
  ) {
    return true;
  }

  // Google Fonts CSS
  if (
    url.hostname === 'fonts.googleapis.com'
  ) {
    return true;
  }

  // Archivos de fuentes de Google
  if (
    url.hostname === 'fonts.gstatic.com'
  ) {
    return true;
  }

  // Tailwind CDN
  if (
    url.hostname === 'cdn.tailwindcss.com'
  ) {
    return true;
  }

  return false;
}


// =====================================================
// COMPROBAR SI ES UN RECURSO ESTÁTICO
// =====================================================

function isStaticAsset(request) {

  const url = new URL(request.url);

  const isExplicitAsset = STATIC_ASSETS.some((asset) => {

    try {

      const assetUrl = new URL(
        asset,
        self.location.origin
      );

      return assetUrl.href === url.href;

    } catch (e) {

      return false;

    }

  });

  if (isExplicitAsset) {
    return true;
  }


  // Recursos estáticos externos conocidos

  if (isExternalStaticAsset(request)) {
    return true;
  }


  // Recursos estáticos del propio dominio

  if (url.origin === self.location.origin) {

    const staticExtensions = [
      '.css',
      '.js',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.webp',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot',
      '.otf'
    ];

    const pathname =
      url.pathname.toLowerCase();

    if (
      staticExtensions.some(
        ext => pathname.endsWith(ext)
      )
    ) {

      return true;

    }

  }


  // Recursos estáticos solicitados
  // desde el propio dominio

  const staticDestinations = [
    'style',
    'script',
    'image',
    'font'
  ];

  if (
    staticDestinations.includes(
      request.destination
    ) &&
    url.origin === self.location.origin
  ) {

    return true;

  }

  return false;

}


// =====================================================
// INSTALACIÓN
// =====================================================

self.addEventListener(
  'install',
  (event) => {

    event.waitUntil(

      caches
        .open(STATIC_CACHE_NAME)
        .then((cache) => {

          return Promise.allSettled(

            STATIC_ASSETS.map(
              (asset) => {

                return cache
                  .add(asset)
                  .catch(() => {});

              }
            )

          );

        }

      )

    );

    self.skipWaiting();

  }
);


// =====================================================
// ACTIVACIÓN
// =====================================================

self.addEventListener(
  'activate',
  (event) => {

    event.waitUntil(

      caches
        .keys()
        .then((cacheNames) => {

          return Promise.all(

            cacheNames.map(
              (cacheName) => {

                if (
                  cacheName.startsWith('static-') &&
                  cacheName !== STATIC_CACHE_NAME
                ) {

                  return caches.delete(
                    cacheName
                  );

                }

                return Promise.resolve();

              }
            )

          );

        })
        .then(() =>
          self.clients.claim()
        )

    );

  }
);


// =====================================================
// ACTUALIZAR RECURSO ESTÁTICO EN SEGUNDO PLANO
// =====================================================

async function updateCache(request) {

  try {

    const networkResponse =
      await fetch(request, {
        cache: 'no-store'
      });

    if (
      networkResponse &&
      networkResponse.ok
    ) {

      const cache =
        await caches.open(
          STATIC_CACHE_NAME
        );

      await cache.put(
        request,
        networkResponse.clone()
      );

    }

  } catch (error) {

    // Sin conexión.
    // Conservamos la versión almacenada.

  }

}


// =====================================================
// FETCH
// =====================================================

self.addEventListener(
  'fetch',
  (event) => {

    const request = event.request;

    if (
      request.method !== 'GET' ||
      !request.url.startsWith('http')
    ) {

      return;

    }

    const url =
      new URL(request.url);


    // =================================================
    // OPEN-METEO
    // =================================================
    // SIEMPRE INTERNET.
    // NUNCA CACHÉ.
    // =================================================

    if (
      url.origin ===
      'https://api.open-meteo.com'
    ) {

      event.respondWith(

        fetch(request, {
          cache: 'no-store'
        })

      );

      return;

    }


    // =================================================
    // VERSION.JSON
    // =================================================
    // SIEMPRE INTERNET.
    // NUNCA CACHÉ.
    // =================================================

    const isVersionJSON =
      url.origin === self.location.origin &&
      url.pathname.endsWith(
        '/version.json'
      );

    if (isVersionJSON) {

      event.respondWith(

        fetch(request, {
          cache: 'no-store'
        })

      );

      return;

    }


    // =================================================
    // INDEX.HTML
    // =================================================

    const isIndexHTML =
      url.origin === self.location.origin &&
      (
        url.pathname.endsWith(
          '/index.html'
        ) ||
        url.pathname === '/'
      );

    if (isIndexHTML) {

      event.respondWith(

        caches
          .match('./index.html')
          .then((cachedResponse) => {

            event.waitUntil(
              updateCache(request)
            );

            if (cachedResponse) {

              return cachedResponse;

            }

            return fetch(request, {
              cache: 'no-store'
            });

          })

      );

      return;

    }


    // =================================================
    // RECURSOS ESTÁTICOS
    // =================================================

    if (isStaticAsset(request)) {

      event.respondWith(

        caches
          .match(request)
          .then((cachedResponse) => {

            if (cachedResponse) {

              // Actualiza en segundo plano
              // sin impedir que la app funcione offline.

              event.waitUntil(
                updateCache(request)
              );

              return cachedResponse;

            }


            // No existe en caché.
            // Descargar y guardar.

            return fetch(request)
              .then((networkResponse) => {

                if (
                  networkResponse &&
                  (
                    networkResponse.ok ||
                    networkResponse.type === 'opaque'
                  )
                ) {

                  event.waitUntil(

                    caches
                      .open(
                        STATIC_CACHE_NAME
                      )
                      .then((cache) => {

                        return cache.put(
                          request,
                          networkResponse.clone()
                        );

                      })

                  );

                }

                return networkResponse;

              });

          })

      );

      return;

    }


    // =================================================
    // TODO LO DEMÁS
    // =================================================
    //
    // APIs
    // tráfico
    // vuelos
    // noticias
    // meteorología
    // etc.
    //
    // NO SE GUARDA NADA EN CACHÉ.
    // =================================================

    if (
      url.origin !== self.location.origin
    ) {

      // Peticiones externas dinámicas:
      // pasan directamente a Internet.

      return;

    }


    // =================================================
    // PETICIONES DINÁMICAS DEL PROPIO DOMINIO
    // =================================================

    event.respondWith(

      fetch(request, {
        cache: 'no-store'
      })

      .catch(() => {

        return new Response(

          JSON.stringify({

            error: true,

            offline: true,

            message:
              'Sin conexión a Internet. Los datos en tiempo real no están disponibles.'

          }),

          {
            status: 503,

            headers: {
              'Content-Type':
                'application/json; charset=utf-8'
            }

          }

        );

      })

    );

  }
);