import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays } from 'date-fns'
import { CalendarClock, CalendarDays, CheckCircle2, Download, ChevronLeft, Clock, GraduationCap, KeyRound, Loader2, Search, Sparkles, User } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CountdownRing } from '@/components/ui/CountdownRing'
import { Badge } from '@/components/ui/Badge'
import { PullToRefresh } from '@/components/PullToRefresh'
import { Stat } from '@/components/ui/Stat'
import { cn, DIAS_SEMANA, formatHora, formatPorcentaje } from '@/lib/utils'
import {
  useBuscarAlumnos,
  useHorariosPublicos,
  useProximosParciales,
  useRegistrarAsistencia,
  useSesionActiva,
} from '@/lib/queries/alumnoPublico'
import { urlDescargaPdf } from '@/lib/queries/pdfTps'
import type {
  BuscarAlumnosRow,
  HorarioPublicoRow,
  ProximoParcialRow,
  RegistrarAsistenciaRow,
  SesionActivaRow,
} from '@/lib/database.types'

export function HomeAlumno() {
  const { data: sesiones, isLoading } = useSesionActiva()
  const [sesionId, setSesionId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const sesionActiva = useMemo(
    () => sesiones?.find((s) => s.sesion_id === sesionId) ?? sesiones?.[0] ?? null,
    [sesiones, sesionId],
  )

  useEffect(() => {
    if (sesiones && sesiones.length > 0 && !sesiones.some((s) => s.sesion_id === sesionId)) {
      setSesionId(sesiones[0].sesion_id)
    }
    if (sesiones && sesiones.length === 0) setSesionId(null)
  }, [sesiones, sesionId])

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Deslizar hacia abajo: vuelve a pedir todo lo del home (clase en curso, exámenes, horarios). */}
      <PullToRefresh onRefresh={() => queryClient.refetchQueries({ type: 'active' })} />
      <ProximosParciales />

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-white/50">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : !sesiones || sesiones.length === 0 ? (
        <SinClase />
      ) : (
        <>
          {sesiones.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {sesiones.map((s) => (
                <button
                  key={s.sesion_id}
                  onClick={() => setSesionId(s.sesion_id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    s.sesion_id === sesionActiva?.sesion_id
                      ? 'border-brand-400/60 bg-brand-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
                  )}
                >
                  {s.clase_nombre} · {s.comision_nombre}
                </button>
              ))}
            </div>
          )}

          {sesionActiva && <ClaseEnCurso sesion={sesionActiva} />}
        </>
      )}

      <HorariosPublicos />
    </div>
  )
}

function ProximosParciales() {
  const { data: parciales } = useProximosParciales()
  if (!parciales || parciales.length === 0) return null

  return (
    <Card className="border-warn-500/30 bg-warn-500/[0.06]">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-warn-500" />
        <CardTitle className="text-base">{parciales.length === 1 ? 'Próximo examen' : 'Próximos exámenes'}</CardTitle>
      </div>
      <div className="mt-3 space-y-2">
        {parciales.map((p) => (
          <FilaProximoParcial key={p.id} parcial={p} />
        ))}
      </div>
    </Card>
  )
}

function FilaProximoParcial({ parcial }: { parcial: ProximoParcialRow }) {
  const fecha = new Date(`${parcial.fecha}T00:00:00`)
  const dias = differenceInCalendarDays(fecha, new Date())
  const cuando = dias <= 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `Faltan ${dias} días`
  const diaTexto = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(fecha)

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-white">{parcial.nombre}</p>
        <p className="text-xs text-white/50 first-letter:uppercase">
          {diaTexto}
          {parcial.hora ? ` · ${formatHora(parcial.hora)}` : ''}
          {parcial.aula ? ` · Aula ${parcial.aula}` : ''}
        </p>
      </div>
      <Badge tone={dias <= 1 ? 'danger' : 'warn'} className="shrink-0">
        {cuando}
      </Badge>
    </div>
  )
}

function SinClase() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
      <span className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-white/5">
        <GraduationCap className="size-8 text-white/30" />
      </span>
      <h1 className="font-display text-xl font-semibold text-white">No hay ninguna clase en curso</h1>
      <p className="mt-2 max-w-xs text-sm text-white/45">
        Volvé a esta página cuando empiece la clase para marcar tu asistencia.
      </p>
    </div>
  )
}

function HorariosPublicos() {
  const { data: horarios } = useHorariosPublicos()
  if (!horarios || horarios.length === 0) return null

  const porDia = new Map<number, HorarioPublicoRow[]>()
  for (const h of horarios) {
    const arr = porDia.get(h.dia_semana) ?? []
    arr.push(h)
    porDia.set(h.dia_semana, arr)
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-white/40" />
        <CardTitle className="text-base">Horarios de cursada</CardTitle>
      </div>

      <div className="mt-4 space-y-4">
        {[...porDia.entries()].map(([dia, items]) => (
          <div key={dia}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-400/80">{DIAS_SEMANA[dia - 1]}</p>
            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {items.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{h.comision_nombre ?? 'General'}</p>
                    <p className="text-xs text-white/45">
                      {formatHora(h.hora_inicio)} a {formatHora(h.hora_fin)}
                    </p>
                    {h.concurrencia != null && <Concurrencia nivel={h.concurrencia} />}
                  </div>
                  {h.aula && (
                    <Badge tone="brand" className="shrink-0">
                      Aula {h.aula}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ClaseEnCurso({ sesion }: { sesion: SesionActivaRow }) {
  return (
    <>
      <Card className="text-center">
        <Badge tone="brand" className="mb-3">
          <Sparkles className="size-3" />
          Clase en curso
        </Badge>
        <h1 className="font-display text-2xl font-bold text-white">{sesion.clase_nombre}</h1>
        <p className="mt-1 text-sm text-white/50">
          Comisión {sesion.comision_nombre} · {formatHora(sesion.hora_inicio)} a {formatHora(sesion.hora_fin)}
        </p>
        {sesion.clase_pdf_path && (
          <a
            href={urlDescargaPdf(sesion.clase_pdf_path, sesion.clase_nombre)}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-brand-400/40 bg-brand-500/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500/20"
          >
            <Download className="size-4 text-brand-400" />
            Descargar TP (PDF)
          </a>
        )}
      </Card>

      {sesion.codigo_activo && sesion.expira_at ? (
        <FormularioAsistencia expiraAt={sesion.expira_at} duracionSegundos={sesion.duracion_codigo_segundos} />
      ) : (
        <Card className="flex flex-col items-center gap-3 text-center">
          <Clock className="size-8 animate-pulse text-white/30" />
          <div>
            <p className="font-medium text-white/80">Esperando el código del profesor</p>
            <p className="mt-1 text-sm text-white/45">
              Cuando lo compartan, vas a tener {sesion.duracion_codigo_segundos} segundos para cargarlo.
            </p>
          </div>
        </Card>
      )}
    </>
  )
}

function FormularioAsistencia({ expiraAt, duracionSegundos }: { expiraAt: string; duracionSegundos: number }) {
  const [legajo, setLegajo] = useState('')
  const [candidatos, setCandidatos] = useState<BuscarAlumnosRow[]>([])
  const [buscado, setBuscado] = useState(false)
  const [seleccionado, setSeleccionado] = useState<BuscarAlumnosRow | null>(null)
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState<RegistrarAsistenciaRow | null>(null)
  const [expirado, setExpirado] = useState(false)
  const codigoRef = useRef<HTMLInputElement>(null)
  // Al confirmar, la tarjeta de "¡Listo!" ocupa el mismo alto que tenía el
  // formulario: si la página se achica de golpe mientras se cierra el teclado,
  // el celular la deja desplazada y la pantalla "salta".
  const tarjetaRef = useRef<HTMLDivElement>(null)
  const [altoFormulario, setAltoFormulario] = useState<number | null>(null)

  const buscar = useBuscarAlumnos()
  const registrar = useRegistrarAsistencia()

  useEffect(() => {
    const legajoTrim = legajo.trim()
    if (legajoTrim.length < 3) {
      setCandidatos([])
      setBuscado(false)
      return
    }
    const id = setTimeout(() => {
      buscar.mutate(legajoTrim, {
        onSuccess: (rows) => {
          setCandidatos(rows)
          setBuscado(true)
        },
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legajo])

  function elegirAlumno(a: BuscarAlumnosRow) {
    // Pasar el foco al código dentro del mismo toque: así el teclado del
    // celular no se cierra al desaparecer el input del legajo (eso hacía
    // saltar la pantalla) y el alumno ya puede escribir el código.
    codigoRef.current?.focus()
    setSeleccionado(a)
    setCandidatos([])
  }

  function cambiarAlumno() {
    setSeleccionado(null)
    setLegajo('')
    setCandidatos([])
    setBuscado(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!seleccionado || !codigo.trim() || expirado) return
    // Cerrar el teclado ya, antes de que cambie la pantalla, para que el celular
    // no reacomode la vista después de mostrar el resultado.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    registrar.mutate(
      { legajo: seleccionado.legajo, codigo: codigo.trim() },
      {
        onSuccess: (r) => {
          if (r?.ok && tarjetaRef.current) setAltoFormulario(tarjetaRef.current.offsetHeight)
          setResultado(r)
        },
      },
    )
  }

  // Si igual la tarjeta de "¡Listo!" quedó fuera de la pantalla, desplazar lo mínimo para mostrarla.
  useEffect(() => {
    if (!resultado?.ok || !tarjetaRef.current) return
    const { top, bottom } = tarjetaRef.current.getBoundingClientRect()
    if (top < 0 || bottom > window.innerHeight) tarjetaRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [resultado])

  if (resultado?.ok) {
    return (
      <Card
        ref={tarjetaRef}
        className="flex flex-col items-center justify-center gap-3 text-center"
        style={altoFormulario ? { minHeight: altoFormulario } : undefined}
      >
        <CheckCircle2 className="size-12 text-ok-500" />
        <div>
          <p className="font-display text-lg font-semibold text-white">
            ¡Listo, {resultado.nombre}!
          </p>
          <p className="mt-1 text-sm text-white/50">{resultado.mensaje}</p>
        </div>
        {resultado.presentes != null && (
          <div className="mt-2 flex gap-6 text-center">
            <Stat label="Presentes" value={`${resultado.presentes}/${resultado.total_clases}`} />
            <Stat label="Asistencia" value={formatPorcentaje(resultado.porcentaje ?? 0)} />
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card ref={tarjetaRef}>
      <div className="mb-4 flex items-center justify-center">
        <CountdownRing expiraAt={expiraAt} totalSeconds={duracionSegundos} onExpire={() => setExpirado(true)} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/70">Tu legajo</label>

          {seleccionado ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-400/40 bg-brand-500/10 p-3">
              <div>
                <p className="font-medium text-white">
                  {seleccionado.nombre} {seleccionado.apellido}
                </p>
                <p className="text-xs text-white/45">
                  Legajo {seleccionado.legajo} · {seleccionado.comision_nombre}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-4 text-right">
                  <Stat compact label="Presentes" value={`${seleccionado.presentes}/${seleccionado.total_clases}`} />
                  <Stat compact label="%" value={formatPorcentaje(seleccionado.porcentaje)} />
                </div>
                <button
                  type="button"
                  onClick={cambiarAlumno}
                  className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                  aria-label="No soy yo, cambiar"
                  title="No soy yo"
                >
                  <ChevronLeft className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  className="input-field pr-10"
                  value={legajo}
                  onChange={(e) => setLegajo(e.target.value)}
                  placeholder="Ej: 123456"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                  {buscar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </span>
              </div>

              {candidatos.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  {candidatos.map((a) => (
                    <button
                      key={a.alumno_id}
                      type="button"
                      onClick={() => elegirAlumno(a)}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {a.nombre} {a.apellido}
                        </p>
                        <p className="text-xs text-white/45">Legajo {a.legajo}</p>
                      </div>
                      <span className="text-xs text-white/40">Soy yo →</span>
                    </button>
                  ))}
                </motion.div>
              )}

              {buscado && !buscar.isPending && candidatos.length === 0 && legajo.trim().length >= 3 && (
                <p className="mt-2 text-sm text-danger-500">No encontramos ningún alumno con ese legajo.</p>
              )}
            </>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/70">Código de la clase</label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              ref={codigoRef}
              className="input-field pl-10 text-center font-display text-lg tracking-widest uppercase"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="INTEGRAL"
              maxLength={12}
              autoComplete="off"
            />
          </div>
        </div>

        {resultado && !resultado.ok && <p className="text-center text-sm text-danger-500">{resultado.mensaje}</p>}
        {expirado && <p className="text-center text-sm text-warn-500">El código expiró. Esperá el próximo.</p>}

        <Button
          type="submit"
          className="w-full"
          loading={registrar.isPending}
          disabled={expirado || !seleccionado || !codigo.trim()}
        >
          Confirmar asistencia
        </Button>
      </form>
    </Card>
  )
}

const CONCURRENCIA_TEXTO = ['Muy tranquila', 'Tranquila', 'Moderada', 'Concurrida', 'Muy concurrida']
const CONCURRENCIA_COLOR = ['text-ok-500', 'text-ok-500', 'text-warn-500', 'text-danger-500', 'text-danger-500']

/** 1 a 5 personitas: qué tan llena suele estar la clase (promedio de las últimas clases). */
function Concurrencia({ nivel }: { nivel: number }) {
  const n = Math.min(5, Math.max(1, nivel))
  const texto = CONCURRENCIA_TEXTO[n - 1]

  return (
    <div className="mt-1.5 flex items-center gap-1.5" title={texto} aria-label={`Concurrencia: ${texto}`} role="img">
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <User
            key={i}
            className={cn('-mx-px size-3.5', i <= n ? CONCURRENCIA_COLOR[n - 1] : 'text-white/15')}
            fill={i <= n ? 'currentColor' : 'none'}
            strokeWidth={i <= n ? 0 : 2}
          />
        ))}
      </span>
      <span className="text-[11px] text-white/40">{texto}</span>
    </div>
  )
}
