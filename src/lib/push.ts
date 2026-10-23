import { supabase } from './supabaseClient'

/**
 * Clave pública VAPID de las notificaciones push (no es secreta: la privada
 * vive solo como secreto de la Edge Function "push-notificaciones").
 */
const VAPID_PUBLIC_KEY = 'BBE-6Gr8BmIGjGJ_chD5Ux5Z4285P8n85s3w9AwX5nw0CG73mz_NjVGT-cAfT3IVCWWhcGFxN7jcIlLNNxVh2mU'

export type EstadoPush =
  | 'no-soportado' // navegador sin push
  | 'ios-sin-instalar' // iPhone: solo funciona con la app agregada a la pantalla de inicio
  | 'sin-service-worker' // localhost / desarrollo: el service worker solo existe en la versión publicada
  | 'bloqueado' // el usuario rechazó el permiso
  | 'activo'
  | 'inactivo'

function esIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function esStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function base64UrlABytes(base64Url: string) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/** El service worker registrado, o null si no hay (en desarrollo no se registra). */
async function registroServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const registro = await navigator.serviceWorker.getRegistration()
  if (!registro) return null
  return navigator.serviceWorker.ready
}

export async function estadoPush(): Promise<EstadoPush> {
  if (esIos() && !esStandalone()) return 'ios-sin-instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado'
  const registro = await registroServiceWorker()
  if (!registro) return 'sin-service-worker'
  if (Notification.permission === 'denied') return 'bloqueado'
  const suscripcion = await registro.pushManager.getSubscription()
  return suscripcion && Notification.permission === 'granted' ? 'activo' : 'inactivo'
}

/** Pide permiso, suscribe este dispositivo y lo guarda en push_suscripciones. Llamar desde un toque del usuario. */
export async function activarPush(profesorId: string): Promise<EstadoPush> {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'inactivo'

  const registro = await registroServiceWorker()
  if (!registro) return 'sin-service-worker'

  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlABytes(VAPID_PUBLIC_KEY),
    }))

  const json = suscripcion.toJSON()
  const { error } = await supabase.from('push_suscripciones').upsert(
    {
      profesor_id: profesorId,
      endpoint: suscripcion.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    await suscripcion.unsubscribe()
    throw error
  }
  return 'activo'
}

export async function desactivarPush(): Promise<EstadoPush> {
  const registro = await registroServiceWorker()
  const suscripcion = await registro?.pushManager.getSubscription()
  if (suscripcion) {
    await supabase.from('push_suscripciones').delete().eq('endpoint', suscripcion.endpoint)
    await suscripcion.unsubscribe()
  }
  return 'inactivo'
}
