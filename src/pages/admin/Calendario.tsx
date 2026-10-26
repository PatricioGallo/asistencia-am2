import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, FileText, GraduationCap, KeyRound, Pencil, Plus, Smartphone, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { ComisionChips } from '@/components/ComisionChips'
import { CountdownRing } from '@/components/ui/CountdownRing'
import { cn, formatHora } from '@/lib/utils'
import { useComisiones } from '@/lib/queries/comisiones'
import {
  useActualizarSesion,
  useCodigoActivo,
  useEliminarSesion,
  useGenerarCodigo,
  useSesionesEnRango,
  type SesionConNombres,
} from '@/lib/queries/sesiones'
import { useClases, useCrearClaseConSesiones, type NuevaSesionInput } from '@/lib/queries/clases'
import { useEliminarAsistencia, usePresentesSesion, type PresenteSesion } from '@/lib/queries/asistencias'
import { useConfiguracionProfesor } from '@/lib/queries/configuracionProfesor'
import { PDF_MAX_MB, urlVerPdf, useQuitarPdfClase, useSubirPdfClase, validarPdf } from '@/lib/queries/pdfTps'
import { useFechasParciales } from '@/lib/queries/fechasParciales'
import type { FechaParcial } from '@/lib/database.types'

export function Calendario() {
  const [mesActual, setMesActual] = useState(() => startOfMonth(new Date()))
  const [modalNuevaClase, setModalNuevaClase] = useState<string | null>(null) // fecha ISO precargada
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionConNombres | null>(null)
  const [sesionAEditar, setSesionAEditar] = useState<SesionConNombres | null>(null)

  const inicioGrilla = startOfWeek(mesActual, { weekStartsOn: 1 })
  const finGrilla = endOfWeek(endOfMonth(mesActual), { weekStartsOn: 1 })

  const dias = useMemo(() => {
    const out: Date[] = []
    let d = inicioGrilla
    while (d <= finGrilla) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [inicioGrilla, finGrilla])

  const { data: sesiones } = useSesionesEnRango(format(inicioGrilla, 'yyyy-MM-dd'), format(finGrilla, 'yyyy-MM-dd'))

  const sesionesPorDia = useMemo(() => {
    const map = new Map<string, SesionConNombres[]>()
    for (const s of sesiones ?? []) {
      const arr = map.get(s.fecha) ?? []
      arr.push(s)
      map.set(s.fecha, arr)
    }
    return map
  }, [sesiones])

  // Parciales y recuperatorios (se cargan en Configuración): aparecen en su fecha.
  const navigate = useNavigate()
  const { data: fechasParciales } = useFechasParciales()
  const parcialesPorDia = useMemo(() => {
    const map = new Map<string, FechaParcial[]>()
    for (const f of fechasParciales ?? []) {
      const arr = map.get(f.fecha) ?? []
      arr.push(f)
      map.set(f.fecha, arr)
    }
    return map
  }, [fechasParciales])
  const irAParciales = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate('/admin/configuracion')
  }

  return (
    <div className="space-y-6">
      <ClasesEnCursoBanner onSeleccionar={setSesionSeleccionada} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle className="capitalize">{format(mesActual, 'MMMM yyyy', { locale: es })}</CardTitle>
            <CardSubtitle>Tocá un día para programar una clase</CardSubtitle>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMesActual((m) => subMonths(m, 1))}
              className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => setMesActual((m) => addMonths(m, 1))}
              className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="hidden grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-white/35 sm:grid">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="hidden grid-cols-7 gap-1 sm:grid">
          {dias.map((dia) => {
            const iso = format(dia, 'yyyy-MM-dd')
            const eventos = sesionesPorDia.get(iso) ?? []
            const parciales = parcialesPorDia.get(iso) ?? []
            const lugares = Math.max(0, 3 - parciales.length)
            const enMes = isSameMonth(dia, mesActual)
            return (
              <button
                key={iso}
                onClick={() => setModalNuevaClase(iso)}
                className={cn(
                  'group flex min-h-24 flex-col items-start gap-1 rounded-xl border border-white/5 p-1.5 text-left transition-colors hover:border-brand-400/40 hover:bg-white/5',
                  !enMes && 'opacity-30',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs font-medium text-white/60',
                    isToday(dia) && 'bg-gradient-to-br from-brand-500 to-accent-400 text-white',
                  )}
                >
                  {format(dia, 'd')}
                </span>
                <div className="flex w-full flex-col gap-1">
                  {parciales.map((f) => (
                    <span
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      onClick={irAParciales}
                      title={`${f.nombre}${f.hora ? ` · ${formatHora(f.hora)}` : ''}${f.aula ? ` · Aula ${f.aula}` : ''} (se edita en Configuración)`}
                      className="flex items-center gap-1 truncate rounded-lg bg-warn-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-warn-500 hover:bg-warn-500/25"
                    >
                      <GraduationCap className="size-3 shrink-0" />
                      <span className="truncate">{f.nombre}</span>
                    </span>
                  ))}
                  {eventos.slice(0, lugares).map((ev) => (
                    <span
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSesionSeleccionada(ev)
                      }}
                      className="truncate rounded-lg bg-brand-500/15 px-1.5 py-0.5 text-[11px] font-medium text-brand-400 hover:bg-brand-500/25"
                    >
                      {ev.clases?.nombre} · {ev.comisiones.map((c) => c.nombre).join(' + ')}
                    </span>
                  ))}
                  {eventos.length > lugares && (
                    <span className="text-[10px] text-white/30">+{eventos.length - lugares} más</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* En pantallas chicas la grilla de 7 columnas queda ilegible (nombre de
            clase truncado en una celda de ~40px), así que el mes se muestra como
            una agenda vertical: un renglón por día, con las clases completas. */}
        <div className="flex flex-col divide-y divide-white/5 sm:hidden">
          {dias
            .filter((dia) => isSameMonth(dia, mesActual))
            .map((dia) => {
              const iso = format(dia, 'yyyy-MM-dd')
              const eventos = sesionesPorDia.get(iso) ?? []
              const parciales = parcialesPorDia.get(iso) ?? []
              return (
                <button
                  key={iso}
                  onClick={() => setModalNuevaClase(iso)}
                  className={cn(
                    'flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-white/5',
                    isToday(dia) && 'bg-white/[0.03]',
                  )}
                >
                  <div className="flex w-11 shrink-0 flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white/60',
                        isToday(dia) && 'bg-gradient-to-br from-brand-500 to-accent-400 text-white',
                      )}
                    >
                      {format(dia, 'd')}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-white/30">
                      {format(dia, 'EEE', { locale: es })}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5">
                    {parciales.map((f) => (
                      <span
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        onClick={irAParciales}
                        className="flex items-center gap-1.5 rounded-lg bg-warn-500/15 px-2.5 py-1.5 text-sm font-semibold text-warn-500 hover:bg-warn-500/25"
                      >
                        <GraduationCap className="size-4 shrink-0" />
                        <span>
                          {f.nombre}
                          {f.hora ? ` · ${formatHora(f.hora)}` : ''}
                          {f.aula ? ` · Aula ${f.aula}` : ''}
                        </span>
                      </span>
                    ))}
                    {eventos.length === 0 && parciales.length === 0 ? (
                      <span className="text-sm text-white/25">Sin clases</span>
                    ) : eventos.length === 0 ? null : (
                      eventos.map((ev) => (
                        <span
                          key={ev.id}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSesionSeleccionada(ev)
                          }}
                          className="rounded-lg bg-brand-500/15 px-2.5 py-1.5 text-sm font-medium text-brand-400 hover:bg-brand-500/25"
                        >
                          {ev.clases?.nombre} · {ev.comisiones.map((c) => c.nombre).join(' + ')} ·{' '}
                          {formatHora(ev.hora_inicio)}
                        </span>
                      ))
                    )}
                  </div>
                </button>
              )
            })}
        </div>
      </Card>

      {modalNuevaClase && (
        <ModalNuevaClase
          fechaInicial={modalNuevaClase}
          onClose={() => setModalNuevaClase(null)}
        />
      )}

      {sesionSeleccionada && (
        <ModalSesion
          sesion={sesionSeleccionada}
          onClose={() => setSesionSeleccionada(null)}
          onEditar={() => {
            setSesionAEditar(sesionSeleccionada)
            setSesionSeleccionada(null)
          }}
        />
      )}

      {sesionAEditar && <ModalEditarSesion sesion={sesionAEditar} onClose={() => setSesionAEditar(null)} />}
    </div>
  )
}

function ClasesEnCursoBanner({ onSeleccionar }: { onSeleccionar: (s: SesionConNombres) => void }) {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const { data: sesionesHoy } = useSesionesEnRango(hoy, hoy)
  const [horaActual, setHoraActual] = useState(() => format(new Date(), 'HH:mm:ss'))

  useEffect(() => {
    const id = setInterval(() => setHoraActual(format(new Date(), 'HH:mm:ss')), 15000)
    return () => clearInterval(id)
  }, [])

  const activas = (sesionesHoy ?? []).filter((s) => horaActual >= s.hora_inicio && horaActual <= s.hora_fin)

  if (activas.length === 0) return null

  return (
    <div className="space-y-4">
      {activas.map((s) => (
        <Card
          key={s.id}
          role="button"
          tabIndex={0}
          onClick={() => onSeleccionar(s)}
          className="cursor-pointer border-brand-400/30 bg-gradient-to-br from-brand-500/10 to-accent-400/10 transition-colors hover:border-brand-400/50"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge tone="brand" className="mb-2">
                <Sparkles className="size-3" />
                Clase en curso
              </Badge>
              <h2 className="font-display text-xl font-bold text-white">{s.clases?.nombre}</h2>
              <p className="text-sm text-white/60">
                {s.comisiones.map((c) => c.nombre).join(' + ')} · {formatHora(s.hora_inicio)} a {formatHora(s.hora_fin)}
              </p>
              <p className="mt-1 text-xs text-white/35">Tocá la tarjeta para ver presentes, editar o generar el código</p>
              <AlertaMismoCelular sesionId={s.id} />
            </div>
            <div className="w-full sm:w-64" onClick={(e) => e.stopPropagation()}>
              <GeneradorCodigo sesionId={s.id} enHorario />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function GeneradorCodigo({ sesionId, enHorario }: { sesionId: string; enHorario: boolean }) {
  const { data: codigoActivo } = useCodigoActivo(sesionId)
  const { data: config } = useConfiguracionProfesor()
  const generar = useGenerarCodigo()
  const duracionSegundos = config?.duracion_codigo_segundos ?? 60

  if (codigoActivo) {
    return (
      <div className="flex flex-col items-center gap-3 py-1">
        <CountdownRing expiraAt={codigoActivo.expira_at} totalSeconds={duracionSegundos} size={110} />
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-white/40">Código para compartir</p>
          <p className="font-display text-2xl font-bold tracking-[0.3em] text-white">{codigoActivo.codigo}</p>
        </div>
      </div>
    )
  }

  if (enHorario) {
    return (
      <Button
        className="w-full"
        loading={generar.isPending}
        onClick={() => generar.mutate({ sesionId, duracionSegundos })}
      >
        <KeyRound className="size-4" />
        Generar código ({duracionSegundos}s)
      </Button>
    )
  }

  return (
    <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-white/50">
      El botón para generar el código aparece durante el horario programado de esta clase.
    </p>
  )
}

function ListaPresentes({ sesionId }: { sesionId: string }) {
  const { data: presentes, isLoading } = usePresentesSesion(sesionId)
  const eliminar = useEliminarAsistencia()
  const confirm = useConfirm()

  const sospechosos = presentes?.filter((p) => p.mismoCelularQue.length > 0) ?? []

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-white/70">Presentes {presentes ? `(${presentes.length})` : ''}</p>
      {sospechosos.length > 0 && (
        <p className="mb-2 flex items-start gap-2 rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-xs text-warn-500">
          <Smartphone className="mt-0.5 size-3.5 shrink-0" />
          {sospechosos.length} alumnos dieron presente desde el mismo celular que otro compañero. Están marcados en amarillo.
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-white/40">Cargando…</p>
      ) : !presentes || presentes.length === 0 ? (
        <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-white/40">Todavía no hay nadie presente.</p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
          {presentes.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 hover:bg-white/5',
                p.mismoCelularQue.length > 0 && 'bg-warn-500/10',
              )}
            >
              <div>
                <p className={cn('text-sm', p.mismoCelularQue.length > 0 ? 'font-medium text-warn-500' : 'text-white')}>
                  {p.apellido}, {p.nombre}
                </p>
                <p className="text-xs text-white/40">
                  Legajo {p.legajo}
                  {p.comision_nombre ? ` · ${p.comision_nombre}` : ''}
                  {p.metodo === 'manual' ? ' · manual' : ''}
                </p>
                {p.mismoCelularQue.length > 0 && (
                  <p className="text-xs text-warn-500/80">Mismo celular que {p.mismoCelularQue.join(' y ')}</p>
                )}
              </div>
              <button
                onClick={async () => {
                  if (await confirm('¿Quitar esta asistencia?')) eliminar.mutate(p.id)
                }}
                className="rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-danger-500"
                aria-label="Quitar asistencia"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalNuevaClase({ fechaInicial, onClose }: { fechaInicial: string; onClose: () => void }) {
  const { data: comisiones } = useComisiones()
  const { data: clases } = useClases()
  const crearClase = useCrearClaseConSesiones()
  const [nombre, setNombre] = useState('')
  const [pdf, setPdf] = useState<File | null>(null)
  const claseExistente = clases?.find((c) => c.nombre === nombre.trim())
  const [filas, setFilas] = useState<NuevaSesionInput[]>([
    { comision_ids: [], fecha: fechaInicial, hora_inicio: '18:00', hora_fin: '20:00' },
  ])

  function actualizarFila(i: number, cambios: Partial<NuevaSesionInput>) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)))
  }

  function toggleComision(i: number, comisionId: string) {
    setFilas((prev) =>
      prev.map((f, idx) => {
        if (idx !== i) return f
        const yaEsta = f.comision_ids.includes(comisionId)
        return { ...f, comision_ids: yaEsta ? f.comision_ids.filter((id) => id !== comisionId) : [...f.comision_ids, comisionId] }
      }),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Ponele un nombre a la clase')
    if (filas.some((f) => f.comision_ids.length === 0)) return toast.error('Elegí al menos una comisión en cada fila')

    crearClase.mutate(
      { nombre, sesiones: filas, pdf },
      {
        onSuccess: ({ pdfFallo }) => {
          if (pdfFallo) {
            toast.warning('La clase se programó, pero no se pudo subir el PDF. Probá de nuevo desde la clase en el calendario.')
          } else {
            toast.success('Clase programada')
          }
          onClose()
        },
        onError: () => toast.error('No se pudo programar la clase'),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Programar clase" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Nombre de la clase"
          placeholder="Ej: TP12"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          list="clases-existentes"
        />
        <datalist id="clases-existentes">
          {clases?.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-white/70">PDF del TP (opcional)</span>
          <SelectorPdf archivo={pdf} onChange={setPdf} />
          <p className="mt-1.5 text-xs text-white/40">
            {claseExistente?.pdf_path
              ? 'Este TP ya tiene un PDF cargado. Si elegís otro, lo reemplaza.'
              : 'Los alumnos lo van a poder descargar desde la página principal mientras la clase está en curso.'}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-white/70">Horarios</p>
          <p className="text-xs text-white/40">
            Si dos comisiones dan la clase juntas (mismo horario, misma clase conjunta), marcalas las dos en la misma fila:
            comparten sesión y código. Si la dan en horarios distintos, van en filas separadas.
          </p>
          {filas.map((fila, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-white/10 p-3">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-white/70">Comisiones</span>
                <ComisionChips comisiones={comisiones} seleccionadas={fila.comision_ids} onToggle={(id) => toggleComision(i, id)} />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  label="Fecha"
                  type="date"
                  value={fila.fecha}
                  onChange={(e) => actualizarFila(i, { fecha: e.target.value })}
                />
                <Input
                  label="Desde"
                  type="time"
                  value={fila.hora_inicio}
                  onChange={(e) => actualizarFila(i, { hora_inicio: e.target.value })}
                />
                <div className="flex items-end gap-1">
                  <Input
                    label="Hasta"
                    type="time"
                    value={fila.hora_fin}
                    onChange={(e) => actualizarFila(i, { hora_fin: e.target.value })}
                    className="flex-1"
                  />
                  {filas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}
                      className="mb-0.5 rounded-xl p-2.5 text-white/40 hover:bg-white/10 hover:text-danger-500"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setFilas((prev) => [...prev, { comision_ids: [], fecha: fechaInicial, hora_inicio: '18:00', hora_fin: '20:00' }])
            }
          >
            <Plus className="size-4" />
            Agregar otro horario
          </Button>
        </div>

        <Button type="submit" className="w-full" loading={crearClase.isPending}>
          Programar clase
        </Button>
      </form>
    </Modal>
  )
}

function ModalSesion({
  sesion,
  onClose,
  onEditar,
}: {
  sesion: SesionConNombres
  onClose: () => void
  onEditar: () => void
}) {
  const eliminar = useEliminarSesion()
  const confirm = useConfirm()

  const ahora = new Date()
  const hoyIso = format(ahora, 'yyyy-MM-dd')
  const horaActual = format(ahora, 'HH:mm:ss')
  const enHorario = sesion.fecha === hoyIso && horaActual >= sesion.hora_inicio && horaActual <= sesion.hora_fin

  return (
    <Modal open onClose={onClose} title={sesion.clases?.nombre ?? 'Clase'}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
          {sesion.comisiones.map((c) => (
            <Badge key={c.id} tone="brand">
              {c.nombre}
            </Badge>
          ))}
          <span>{sesion.fecha}</span>
          <span>
            {formatHora(sesion.hora_inicio)} - {formatHora(sesion.hora_fin)}
          </span>
        </div>

        <GeneradorCodigo sesionId={sesion.id} enHorario={enHorario} />

        <PdfDeLaClase claseId={sesion.clase_id} pdfPath={sesion.clases?.pdf_path ?? null} />

        <ListaPresentes sesionId={sesion.id} />

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onEditar}>
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (await confirm('¿Eliminar esta sesión? También se borran las asistencias cargadas para ella.')) {
                eliminar.mutate(sesion.id, { onSuccess: onClose })
              }
            }}
          >
            <Trash2 className="size-4" />
            Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ModalEditarSesion({ sesion, onClose }: { sesion: SesionConNombres; onClose: () => void }) {
  const { data: comisiones } = useComisiones()
  const actualizar = useActualizarSesion()

  const [nombre, setNombre] = useState(sesion.clases?.nombre ?? '')
  const [comisionIds, setComisionIds] = useState<string[]>(sesion.comisiones.map((c) => c.id))
  const [fecha, setFecha] = useState(sesion.fecha)
  const [horaInicio, setHoraInicio] = useState(sesion.hora_inicio.slice(0, 5))
  const [horaFin, setHoraFin] = useState(sesion.hora_fin.slice(0, 5))

  function toggleComision(id: string) {
    setComisionIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Ponele un nombre a la clase')
    if (comisionIds.length === 0) return toast.error('Elegí al menos una comisión')

    actualizar.mutate(
      {
        sesionId: sesion.id,
        claseId: sesion.clase_id,
        nombre,
        comisionIds,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
      },
      {
        onSuccess: () => {
          toast.success('Clase actualizada')
          onClose()
        },
        onError: () => toast.error('No se pudo actualizar la clase'),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Editar clase">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input label="Nombre de la clase" value={nombre} onChange={(e) => setNombre(e.target.value)} />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-white/70">Comisiones</span>
          <ComisionChips comisiones={comisiones} seleccionadas={comisionIds} onToggle={toggleComision} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Input label="Desde" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          <Input label="Hasta" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
        </div>

        <Button type="submit" className="w-full" loading={actualizar.isPending}>
          Guardar cambios
        </Button>
      </form>
    </Modal>
  )
}

/** Botón para elegir un PDF del disco (sin subirlo todavía). */
function SelectorPdf({ archivo, onChange }: { archivo: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return
    const error = validarPdf(file)
    if (error) return toast.error(error)
    onChange(file)
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
      {archivo ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm text-white">
            <FileText className="size-4 shrink-0 text-brand-400" />
            <span className="truncate">{archivo.name}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-danger-500"
            aria-label="Quitar PDF"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" />
          Elegir PDF (máx. {PDF_MAX_MB} MB)
        </Button>
      )}
    </div>
  )
}

/** PDF del TP de una sesión: verlo, reemplazarlo o quitarlo. Es el mismo para todas las sesiones de ese TP. */
function PdfDeLaClase({ claseId, pdfPath: pdfPathInicial }: { claseId: string; pdfPath: string | null }) {
  // Estado local: el modal recibe una copia de la sesión tomada al abrirlo.
  const [pdfPath, setPdfPath] = useState(pdfPathInicial)
  const subir = useSubirPdfClase()
  const quitar = useQuitarPdfClase()
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return
    const error = validarPdf(file)
    if (error) return toast.error(error)
    subir.mutate(
      { claseId, file, pathAnterior: pdfPath },
      {
        onSuccess: (nuevoPath) => {
          setPdfPath(nuevoPath)
          toast.success('PDF cargado')
        },
        onError: () => toast.error('No se pudo subir el PDF'),
      },
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 p-3">
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-white/70">
          <FileText className="size-4 text-white/40" />
          {pdfPath ? 'PDF del TP cargado' : 'Sin PDF del TP'}
        </span>
        <div className="flex flex-wrap gap-2">
          {pdfPath && (
            <a
              href={urlVerPdf(pdfPath)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl px-3 py-1.5 text-sm text-brand-400 hover:bg-white/5"
            >
              Ver
            </a>
          )}
          <Button
            type="button"
            variant="secondary"
            loading={subir.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {pdfPath ? 'Reemplazar' : 'Subir PDF'}
          </Button>
          {pdfPath && (
            <Button
              type="button"
              variant="ghost"
              loading={quitar.isPending}
              onClick={async () => {
                if (await confirm('¿Quitar el PDF de este TP? Deja de aparecerles a los alumnos en todas las comisiones.')) {
                  quitar.mutate(
                    { claseId, path: pdfPath },
                    { onSuccess: () => setPdfPath(null), onError: () => toast.error('No se pudo quitar el PDF') },
                  )
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Pares de alumnos que dieron presente desde el mismo celular, sin repetir (A-B y B-A son el mismo). */
function paresMismoCelular(presentes: PresenteSesion[]) {
  const pares = new Map<string, string>()
  for (const p of presentes) {
    if (!p.dispositivo_id) continue
    for (const o of presentes) {
      if (o.dispositivo_id !== p.dispositivo_id || o.alumno_id <= p.alumno_id) continue
      pares.set(`${p.alumno_id}:${o.alumno_id}`, `${p.apellido}, ${p.nombre} y ${o.apellido}, ${o.nombre}`)
    }
  }
  return pares
}

/**
 * Alerta en vivo en la tarjeta de clase en curso: cuando un mismo celular dio
 * presente a dos alumnos distintos. El aviso flotante lo da la campanita de
 * notificaciones (NotificacionesBell), para no duplicarlo.
 */
function AlertaMismoCelular({ sesionId }: { sesionId: string }) {
  const { data: presentes } = usePresentesSesion(sesionId)
  const pares = useMemo(() => paresMismoCelular(presentes ?? []), [presentes])

  if (pares.size === 0) return null

  return (
    <div className="mt-3 space-y-1 rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-xs text-warn-500">
      <p className="flex items-center gap-1.5 font-medium">
        <Smartphone className="size-3.5" />
        Presentes desde el mismo celular
      </p>
      {[...pares.values()].map((nombres) => (
        <p key={nombres}>{nombres}</p>
      ))}
    </div>
  )
}
