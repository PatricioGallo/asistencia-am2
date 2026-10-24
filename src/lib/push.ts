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

/**
 * Al cerrar sesión las notificaciones se pausan en el dispositivo (no le llegan
 * a nadie) y se anota para qué docente estaban activas; al volver a entrar con
 * esa misma cuenta se reactivan solas.
 */
const CLAVE_PAUSADO = 'am2-push-pausado'

function leerPausado(): string | null {
  try {
    return localStorage.getItem(CLAVE_PAUSADO)
  } catch {
    return null
  }
}

function guardarPausado(profesorId: string | null) {
  try {
    if (profesorId) localStorage.setItem(CLAVE_PAUSADO, profesorId)
    else localStorage.removeItem(CLAVE_PAUSADO)
  } catch {
    // Sin localStorage: no se recuerda, habrá que reactivarlas a mano.
  }
}

async function guardarSuscripcion(profesorId: string, suscripcion: PushSubscription) {
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
  if (error) throw error
}

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
  // Pausadas (alguien cerró sesión y todavía no volvió a entrar con esa cuenta): no le llegan a nadie.
  if (leerPausado()) return 'inactivo'
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

  try {
    await guardarSuscripcion(profesorId, suscripcion)
  } catch (error) {
    await suscripcion.unsubscribe()
    throw error
  }
  guardarPausado(null)
  return 'activo'
}

/** Apagado a propósito desde Configuración: no se reactiva al volver a entrar. */
export async function desactivarPush(): Promise<EstadoPush> {
  guardarPausado(null)
  const registro = await registroServiceWorker()
  const suscripcion = await registro?.pushManager.getSubscription()
  if (suscripcion) {
    await supabase.from('push_suscripciones').delete().eq('endpoint', suscripcion.endpoint)
    await suscripcion.unsubscribe()
  }
  return 'inactivo'
}

/**
 * Al cerrar sesión: este dispositivo deja de recibir avisos (se borra la
 * suscripción de la base) pero se recuerda que estaban activas. La suscripción
 * del navegador y el permiso quedan, así se pueden reactivar sin volver a preguntar.
 */
export async function pausarPush(profesorId: string) {
  const registro = await registroServiceWorker()
  const suscripcion = await registro?.pushManager.getSubscription()
  if (!suscripcion) return
  guardarPausado(profesorId)
  await supabase.from('push_suscripciones').delete().eq('endpoint', suscripcion.endpoint)
}

/** Al iniciar sesión: si estaban activas para este mismo docente antes de salir, se reactivan. */
export async function reanudarPush(profesorId: string) {
  if (leerPausado() !== profesorId) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const registro = await registroServiceWorker()
  const suscripcion = await registro?.pushManager.getSubscription()
  if (!suscripcion) return
  await guardarSuscripcion(profesorId, suscripcion)
  guardarPausado(null)
}
