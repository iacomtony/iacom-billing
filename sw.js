// Service worker mínimo do IACOM Billing.
// Estratégia segura: HTML sempre da rede (sem cache velho após deploy),
// assets com hash em cache-first, e NADA de Supabase/APIs é cacheado.
const CACHE = 'iacom-billing-v1'
const APP_SHELL = ['./', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {})),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Só lida com mesma origem. Supabase, Google Fonts, etc. passam direto.
  if (url.origin !== self.location.origin) return

  // Navegações (HTML): rede primeiro, cai pro cache se offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./').then((r) => r || caches.match(request))),
    )
    return
  }

  // Assets com hash (immutable): cache primeiro.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        }),
    ),
  )
})
