import { useEffect, useMemo, useState } from 'react'
import { format, subYears, addYears } from 'date-fns'
import { Check, ClipboardList, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { cn, formatFecha, formatPorcentaje } from '@/lib/utils'
import { useComisiones } from '@/lib/queries/comisiones'
import { useAlumnos } from '@/lib/queries/alumnos'
import { useSesionesEnRango } from '@/lib/queries/sesiones'
import { useAsistenciaComision, useCargarAsistenciaManual, useEliminarAsistencia } from '@/lib/queries/asistencias'

export function Asistencia() {
  const { data: comisiones } = useComisiones()
  const [comisionId, setComisionId] = useState<string>('')
  const [modalManual, setModalManual] = useState(false)

  useEffect(() => {
    if (!comisionId && comisiones && comisiones.length > 0) setComisionId(comisiones[0].id)
  }, [comisiones, comisionId])

  const { data, isLoading } = useAsistenciaComision(comisionId || null)
  const eliminar = useEliminarAsistencia()

  const comisionNombre = comisiones?.find((c) => c.id === comisionId)?.nombre

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Asistencia</CardTitle>
            <CardSubtitle>Se necesita 75% de presencia para aprobar la cursada</CardSubtitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="input-field w-auto" value={comisionId} onChange={(e) => setComisionId(e.target.value)}>
              {comisiones?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <Button onClick={() => setModalManual(true)}>
              <Plus className="size-4" />
              Carga manual
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0">
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
                    <th key={`${col.sesion_id}`} className="whitespace-nowrap px-3 py-3 text-center font-medium">
                      <div>{col.clase_nombre}</div>
                      <div className="font-normal normal-case text-white/30">{formatFecha(col.fecha)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium">Presentes</th>
                  <th className="px-3 py-3 text-center font-medium">%</th>
                  <th className="px-5 py-3 text-center font-medium">75%</th>
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
                          {celda?.presente ? (
                            <button
                              title={
                                celda.comisionAsistida
                                  ? `Asistió por ${celda.comisionAsistida}`
                                  : celda.metodo === 'manual'
                                    ? 'Cargado manualmente'
                                    : 'Presente'
                              }
                              onClick={() => {
                                if (confirm('¿Quitar esta asistencia?')) eliminar.mutate(celda.id)
                              }}
                              className={cn(
                                'inline-flex size-6 items-center justify-center rounded-full bg-ok-500/15 text-ok-500 hover:bg-danger-500/20 hover:text-danger-500',
                              )}
                            >
                              <Check className="size-3.5" />
                            </button>
                          ) : (
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-white/5 text-white/20">
                              <X className="size-3.5" />
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-center text-white/70">
                      {a.presentes}/{a.total_clases}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-white">{formatPorcentaje(a.porcentaje)}</td>
                    <td className="px-5 py-3 text-center">
                      <Badge tone={a.cumple_75 ? 'ok' : 'danger'}>{a.cumple_75 ? 'Cumple' : 'No cumple'}</Badge>
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
