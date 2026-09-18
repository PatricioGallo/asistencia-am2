import { useEffect, useMemo, useState } from 'react'
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
import { ChevronLeft, ChevronRight, KeyRound, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { CountdownRing } from '@/components/ui/CountdownRing'
import { cn, formatHora } from '@/lib/utils'
import { useComisiones, useCrearComision, useEliminarComision } from '@/lib/queries/comisiones'
import {
  useActualizarSesion,
  useCodigoActivo,
  useEliminarSesion,
  useGenerarCodigo,
  useSesionesEnRango,
  type SesionConNombres,
} from '@/lib/queries/sesiones'
import { useClases, useCrearClaseConSesiones, type NuevaSesionInput } from '@/lib/queries/clases'

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

  return (
    <div className="space-y-6">
      <ClasesEnCursoBanner />

      <ComisionesPanel />

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

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-white/35">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dias.map((dia) => {
            const iso = format(dia, 'yyyy-MM-dd')
            const eventos = sesionesPorDia.get(iso) ?? []
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
                  {eventos.slice(0, 3).map((ev) => (
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
                  {eventos.length > 3 && <span className="text-[10px] text-white/30">+{eventos.length - 3} más</span>}
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

function ClasesEnCursoBanner() {
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
        <Card key={s.id} className="border-brand-400/30 bg-gradient-to-br from-brand-500/10 to-accent-400/10">
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
            </div>
            <div className="w-full sm:w-64">
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
  const generar = useGenerarCodigo()

  if (codigoActivo) {
    return (
      <div className="flex flex-col items-center gap-3 py-1">
        <CountdownRing expiraAt={codigoActivo.expira_at} size={110} />
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-white/40">Código para compartir</p>
          <p className="font-display text-2xl font-bold tracking-[0.3em] text-white">{codigoActivo.codigo}</p>
        </div>
      </div>
    )
  }

  if (enHorario) {
    return (
      <Button className="w-full" loading={generar.isPending} onClick={() => generar.mutate(sesionId)}>
        <KeyRound className="size-4" />
        Generar código (60s)
      </Button>
    )
  }

  return (
    <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-white/50">
      El botón para generar el código aparece durante el horario programado de esta clase.
    </p>
  )
}

function ComisionesPanel() {
  const { data: comisiones } = useComisiones()
  const crear = useCrearComision()
  const eliminar = useEliminarComision()
  const [nombre, setNombre] = useState('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    crear.mutate(nombre, {
      onSuccess: () => setNombre(''),
      onError: () => toast.error('No se pudo crear la comisión (¿ya existe?)'),
    })
  }

  return (
    <Card>
      <CardTitle>Comisiones</CardTitle>
      <CardSubtitle>Ej: 2S1, 2S2, 2Q1…</CardSubtitle>
      <form onSubmit={handleAdd} className="mt-4 flex gap-2">
        <input
          className="input-field"
          placeholder="Nombre de la comisión"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Button type="submit" loading={crear.isPending}>
          <Plus className="size-4" />
        </Button>
      </form>
      {comisiones && comisiones.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {comisiones.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1.5 text-sm text-white/80"
            >
              {c.nombre}
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar la comisión ${c.nombre}? Los alumnos quedan sin comisión asignada.`)) {
                    eliminar.mutate(c.id)
                  }
                }}
                className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-danger-500"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function ComisionChips({
  comisiones,
  seleccionadas,
  onToggle,
}: {
  comisiones: { id: string; nombre: string }[] | undefined
  seleccionadas: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {comisiones?.map((c) => {
        const activa = seleccionadas.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              activa
                ? 'border-brand-400/60 bg-brand-500/20 text-white'
                : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
            )}
          >
            {c.nombre}
          </button>
        )
      })}
      {(!comisiones || comisiones.length === 0) && (
        <span className="text-xs text-white/40">Creá una comisión arriba primero.</span>
      )}
    </div>
  )
}

function ModalNuevaClase({ fechaInicial, onClose }: { fechaInicial: string; onClose: () => void }) {
  const { data: comisiones } = useComisiones()
  const { data: clases } = useClases()
  const crearClase = useCrearClaseConSesiones()
  const [nombre, setNombre] = useState('')
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
      { nombre, sesiones: filas },
      {
        onSuccess: () => {
          toast.success('Clase programada')
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

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onEditar}>
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              if (confirm('¿Eliminar esta sesión? También se borran las asistencias cargadas para ella.')) {
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
