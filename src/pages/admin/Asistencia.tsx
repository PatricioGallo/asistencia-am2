import { useEffect, useMemo, useState } from 'react'
import { format, subYears, addYears } from 'date-fns'
import { Check, ClipboardList, FileDown, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { cn, formatFecha, formatPorcentaje } from '@/lib/utils'
import { useComisiones } from '@/lib/queries/comisiones'
import { useAlumnos } from '@/lib/queries/alumnos'
import { useSesionesEnRango } from '@/lib/queries/sesiones'
import { useAsistenciaComision, useCargarAsistenciaManual, useEliminarAsistencia } from '@/lib/queries/asistencias'
import { useConfiguracionProfesor } from '@/lib/queries/configuracionProfesor'

export function Asistencia() {
  const { data: comisiones } = useComisiones()
  const [comisionId, setComisionId] = useState<string>('')
  const [modalManual, setModalManual] = useState(false)

  useEffect(() => {
    if (!comisionId && comisiones && comisiones.length > 0) setComisionId(comisiones[0].id)
  }, [comisiones, comisionId])

  const { data, isLoading } = useAsistenciaComision(comisionId || null)
  const { data: config } = useConfiguracionProfesor()
  const eliminar = useEliminarAsistencia()
  const cargar = useCargarAsistenciaManual()
  const confirm = useConfirm()

  const comisionNombre = comisiones?.find((c) => c.id === comisionId)?.nombre
  const porcentajeRequerido = config?.porcentaje_requerido ?? 75

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Asistencia</CardTitle>
            <CardSubtitle>Se necesita {porcentajeRequerido}% de presencia para aprobar la cursada</CardSubtitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="input-field w-auto" value={comisionId} onChange={(e) => setComisionId(e.target.value)}>
              {comisiones?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => window.print()} disabled={!comisionId || !data}>
              <FileDown className="size-4" />
              Descargar PDF
            </Button>
            <Button onClick={() => setModalManual(true)}>
              <Plus className="size-4" />
              Carga manual
            </Button>
          </div>
        </div>
      </Card>

      <div className="print-area hidden print:block">
        <h1 className="text-xl font-bold">Asistencia — {comisionNombre}</h1>
        <p className="text-sm">
          Se necesita {porcentajeRequerido}% de presencia para aprobar la cursada · Generado el{' '}
          {format(new Date(), 'dd/MM/yyyy')}
        </p>
      </div>

      <Card className="print-area p-0">
        {!comisionId ? (
          <p className="p-10 text-center text-white/40">Creá una comisión para empezar.</p>
        ) : isLoading ? (
          <p className="p-10 text-center text-white/40">Cargando…</p>
        ) : !data || data.alumnos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <ClipboardList className="size-8 text-white/20" />
            <p className="text-white/50">Todavía no hay alumnos en {comisionNombre}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                  <th className="sticky left-0 bg-surface-800 px-5 py-3 font-medium">Alumno</th>
                  {data.columnas.map((col) => (
                    <th
                      key={`${col.sesion_id}`}
                      className={cn('max-w-20 px-3 py-3 text-center font-medium', !col.dada && 'opacity-40')}
                    >
                      <div
                        className="truncate"
                        title={col.dada ? col.clase_nombre : `${col.clase_nombre} · no se tomó asistencia, no cuenta`}
                      >
                        {col.clase_nombre.includes(':') ? col.clase_nombre.split(':')[0].trim() : col.clase_nombre}
                      </div>
                      <div className="font-normal normal-case text-white/30">{formatFecha(col.fecha)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium">Presentes</th>
                  <th className="px-3 py-3 text-center font-medium">%</th>
                  <th className="px-5 py-3 text-center font-medium">{porcentajeRequerido}%</th>
                </tr>
              </thead>
              <tbody>
                {data.alumnos.map((a) => (
                  <tr key={a.alumno_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="sticky left-0 bg-bg-900 px-5 py-3 text-white">
                      <div className="font-medium">
                        {a.apellido}, {a.nombre}
                      </div>
                      <div className="text-xs text-white/40">{a.legajo}</div>
                    </td>
                    {data.columnas.map((col) => {
                      const celda = data.celdas[`${a.alumno_id}:${col.clase_id}`]
                      return (
                        <td key={col.sesion_id} className="px-3 py-3 text-center">
                          {!celda?.presente && !col.dada ? (
                            <span
                              title="No se tomó asistencia en esta clase (no cuenta para el porcentaje)"
                              className="inline-flex size-6 items-center justify-center text-white/20"
                            >
                              —
                            </span>
                          ) : celda?.presente ? (
                            <button
                              title={
                                celda.comisionAsistida
                                  ? `Asistió por ${celda.comisionAsistida}`
                                  : celda.metodo === 'manual'
                                    ? 'Cargado manualmente'
                                    : 'Presente'
                              }
                              onClick={async () => {
                                if (await confirm('¿Quitar esta asistencia?')) eliminar.mutate(celda.id)
                              }}
                              className={cn(
                                'inline-flex size-6 items-center justify-center rounded-full bg-ok-500/15 text-ok-500 hover:bg-danger-500/20 hover:text-danger-500',
                              )}
                            >
                              <Check className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              title="Marcar presente"
                              disabled={cargar.isPending}
                              onClick={() =>
                                cargar.mutate(
                                  { alumno_id: a.alumno_id, sesion_id: col.sesion_id, clase_id: col.clase_id },
                                  { onError: () => toast.error('No se pudo marcar presente') },
                                )
                              }
                              className="inline-flex size-6 items-center justify-center rounded-full bg-white/5 text-white/20 hover:bg-ok-500/20 hover:text-ok-500 disabled:pointer-events-none disabled:opacity-50"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-center text-white/70">
                      {a.presentes}/{a.total_clases}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-white">{formatPorcentaje(a.porcentaje)}</td>
                    <td className="px-5 py-3 text-center">
                      <Badge tone={a.cumple_minimo ? 'ok' : 'danger'}>{a.cumple_minimo ? 'Cumple' : 'No cumple'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalManual && <ModalCargaManual onClose={() => setModalManual(false)} />}
    </div>
  )
}

function ModalCargaManual({ onClose }: { onClose: () => void }) {
  const { data: alumnos } = useAlumnos()
  const desde = format(subYears(new Date(), 1), 'yyyy-MM-dd')
  const hasta = format(addYears(new Date(), 1), 'yyyy-MM-dd')
  const { data: sesiones } = useSesionesEnRango(desde, hasta)
  const cargar = useCargarAsistenciaManual()

  const [alumnoId, setAlumnoId] = useState('')
  const [sesionId, setSesionId] = useState('')

  const sesionesOrdenadas = useMemo(
    () => [...(sesiones ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [sesiones],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const sesion = sesionesOrdenadas.find((s) => s.id === sesionId)
    if (!alumnoId || !sesion) {
      toast.error('Elegí alumno y clase')
      return
    }
    cargar.mutate(
      { alumno_id: alumnoId, sesion_id: sesion.id, clase_id: sesion.clase_id },
      {
        onSuccess: () => {
          toast.success('Asistencia cargada')
          onClose()
        },
        onError: () => toast.error('No se pudo cargar (¿ya tenía asistencia a esa clase?)'),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Cargar asistencia manual">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Alumno" value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)}>
          <option value="">Elegir alumno…</option>
          {alumnos?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.apellido}, {a.nombre} ({a.legajo})
            </option>
          ))}
        </Select>
        <Select label="Clase" value={sesionId} onChange={(e) => setSesionId(e.target.value)}>
          <option value="">Elegir clase…</option>
          {sesionesOrdenadas.map((s) => (
            <option key={s.id} value={s.id}>
              {formatFecha(s.fecha)} · {s.clases?.nombre} · {s.comisiones.map((c) => c.nombre).join(' + ')}
            </option>
          ))}
        </Select>
        <p className="text-xs text-white/40">
          Podés elegir una clase de cualquier comisión: si el alumno asistió a una comisión distinta de la suya, igual
          cuenta como presente para esa clase.
        </p>
        <Button type="submit" className="w-full" loading={cargar.isPending}>
          Cargar asistencia
        </Button>
      </form>
    </Modal>
  )
}
