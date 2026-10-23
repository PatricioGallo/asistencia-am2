// Se suma al service worker que genera vite-plugin-pwa (workbox.importScripts).
// Muestra las notificaciones push del docente y, al tocarlas, abre la app.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Asistencia AM2', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/admin/calendario' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.location.origin))
      if (abierta) {
        return abierta.focus().then((v) => (v && 'navigate' in v ? v.navigate(url) : undefined)).catch(() => undefined)
      }
      return self.clients.openWindow(url)
    }),
  )
})
