import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, BellRing, Flag, Play, Smartphone, Timer, TimerOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  useBorrarNotificaciones,
  useMarcarNotificacionesLeidas,
  useNotificaciones,
} from '@/lib/queries/notificaciones'
import type { Notificacion, TipoNotificacion } from '@/lib/database.types'

const ICONO: Record<TipoNotificacion, typeof Bell> = {
  clase_inicio: Play,
  clase_fin: Flag,
  codigo_inicio: Timer,
  codigo_fin: TimerOff,
  mismo_celular: Smartphone,
  prueba: BellRing,
}

/** Tipos que además aparecen como aviso flotante cuando llegan con la app abierta. */
const CON_TOAST: TipoNotificacion[] = ['clase_inicio', 'clase_fin', 'codigo_fin', 'mismo_celular', 'prueba']

export function NotificacionesBell() {
  const { data: notificaciones, isError } = useNotificaciones()
  const marcarLeidas = useMarcarNotificacionesLeidas()
  const borrar = useBorrarNotificaciones()
  const confirm = useConfirm()
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const vistas = useRef<Set<string> | null>(null)
  // Las que estaban sin leer al abrir: se siguen resaltando mientras el panel
  // está abierto, aunque ya se hayan marcado como leídas.
  const [resaltadas, setResaltadas] = useState<Set<string>>(new Set())

  const noLeidas = notificaciones?.filter((n) => !n.leida).length ?? 0

  // Al abrir el panel (o si llega una nueva con el panel abierto) se marcan como
  // leídas. Una sola vez por cada notificación: si falla no se reintenta en bucle.
  const marcarLeidasMutate = marcarLeidas.mutate
  const yaMarcadas = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!abierto || !notificaciones) return
    const ids = notificaciones.filter((n) => !n.leida && !yaMarcadas.current.has(n.id)).map((n) => n.id)
    if (ids.length === 0) return
    for (const id of ids) yaMarcadas.current.add(id)
    setResaltadas((prev) => new Set([...prev, ...ids]))
    marcarLeidasMutate()
  }, [abierto, notificaciones, marcarLeidasMutate])

  // Aviso flotante por cada notificación nueva (no por las que ya estaban al entrar).
  useEffect(() => {
    if (!notificaciones) return
    if (vistas.current === null) {
      vistas.current = new Set(notificaciones.map((n) => n.id))
      return
    }
    for (const n of [...notificaciones].reverse()) {
      if (vistas.current.has(n.id)) continue
      vistas.current.add(n.id)
      if (!CON_TOAST.includes(n.tipo)) continue
      const mostrar = n.tipo === 'mismo_celular' ? toast.warning : toast.info
      mostrar(n.titulo, { description: n.mensaje, duration: n.tipo === 'mismo_celular' ? 15000 : 6000 })
    }
  }, [notificaciones])

  // Cerrar al tocar afuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    function alTocar(e: PointerEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) cerrar()
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    function cerrar() {
      setAbierto(false)
      setResaltadas(new Set())
    }
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  // Si la tabla todavía no existe (SQL sin aplicar), no mostramos nada en vez de un error.
  if (isError) return null

  return (
    <div ref={contenedorRef} className="relative shrink-0">
      <button
        onClick={() => {
          if (abierto) setResaltadas(new Set())
          setAbierto((a) => !a)
        }}
        className={cn(
          'relative flex items-center rounded-xl p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white',
          abierto && 'bg-white/10 text-white',
        )}
        aria-label={noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'}
      >
        <Bell className="size-5" />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-bg-950/95 shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <p className="font-display text-sm font-semibold text-white">Notificaciones</p>
            <div className="flex items-center gap-1">
              {notificaciones && notificaciones.length > 0 && (
                <button
                  onClick={async () => {
                    if (await confirm('¿Borrar todas las notificaciones?')) borrar.mutate()
                  }}
                  className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-danger-500"
                  aria-label="Borrar todas"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
            {!notificaciones || notificaciones.length === 0 ? (
              <p className="p-8 text-center text-sm text-white/40">No hay notificaciones.</p>
            ) : (
              notificaciones.map((n) => (
                <FilaNotificacion key={n.id} notificacion={n} nueva={!n.leida || resaltadas.has(n.id)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FilaNotificacion({ notificacion: n, nueva }: { notificacion: Notificacion; nueva: boolean }) {
  const Icono = ICONO[n.tipo] ?? Bell
  const alerta = n.tipo === 'mismo_celular'

  return (
    <div
      className={cn(
        'flex gap-3 border-b border-white/5 px-4 py-3 last:border-0',
        nueva && 'bg-white/[0.04]',
        alerta && 'bg-warn-500/10',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl',
          alerta ? 'bg-warn-500/20 text-warn-500' : 'bg-white/5 text-white/50',
        )}
      >
        <Icono className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium', alerta ? 'text-warn-500' : 'text-white')}>{n.titulo}</p>
          {nueva && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-400" aria-label="Nueva" />}
        </div>
        <p className="mt-0.5 text-xs text-white/60">{n.mensaje}</p>
        <p className="mt-1 text-[11px] text-white/35">
          {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true, locale: es })}
        </p>
      </div>
    </div>
  )
}
