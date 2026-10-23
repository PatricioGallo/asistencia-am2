// Edge Function: reenvía cada notificación nueva a los celulares del docente
// suscriptos a push (tabla push_suscripciones). La llama el trigger
// enviar_push_notificacion (pg_net) con el secreto compartido en x-push-secret.
//
// Secretos de la función: PUSH_WEBHOOK_SECRET, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// los pone Supabase solo.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SECRETO = Deno.env.get('PUSH_WEBHOOK_SECRET')
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !SECRETO || req.headers.get('x-push-secret') !== SECRETO) {
    return new Response('No autorizado', { status: 401 })
  }

  const { notificacion_id } = await req.json()
  const { data: notificacion } = await supabase
    .from('notificaciones')
    .select('id, profesor_id, tipo, titulo, mensaje')
    .eq('id', notificacion_id)
    .maybeSingle()
  if (!notificacion) return new Response('No existe', { status: 404 })

  const { data: suscripciones } = await supabase
    .from('push_suscripciones')
    .select('id, endpoint, p256dh, auth')
    .eq('profesor_id', notificacion.profesor_id)

  const payload = JSON.stringify({
    title: notificacion.titulo,
    body: notificacion.mensaje,
    tag: notificacion.id,
    url: '/admin/calendario',
  })

  const resultados = await Promise.allSettled(
    (suscripciones ?? []).map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 60 * 60,
        urgency: notificacion.tipo === 'mismo_celular' ? 'high' : 'normal',
      }),
    ),
  )

  // Suscripciones vencidas (el celular desinstaló la app o revocó el permiso): se borran.
  const vencidas = (suscripciones ?? []).filter((_, i) => {
    const r = resultados[i]
    return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
  })
  if (vencidas.length > 0) {
    await supabase.from('push_suscripciones').delete().in('id', vencidas.map((s) => s.id))
  }

  return Response.json({
    enviados: resultados.filter((r) => r.status === 'fulfilled').length,
    fallidos: resultados.filter((r) => r.status === 'rejected').length,
    borrados: vencidas.length,
  })
})
