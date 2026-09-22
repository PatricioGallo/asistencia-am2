import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { FileDown, GraduationCap, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { cn, esIosStandalone, formatNota, formatPorcentaje } from '@/lib/utils'
import {
  calcularEstadoNotas,
  formatNotaValor,
  parseNotaInput,
  RECU_LABEL,
  tipoRecuperatorio,
  type NotaValor,
  type TipoRecuperatorio,
} from '@/lib/notas'
import { useComisiones } from '@/lib/queries/comisiones'
import { useCargarNotas, useNotasComision, type AlumnoNotas } from '@/lib/queries/parciales'
import { useConfiguracionProfesor } from '@/lib/queries/configuracionProfesor'

export function Parciales() {
  const { data: comisiones } = useComisiones()
  const [comisionId, setComisionId] = useState<string>('')
  const [alumnoEditando, setAlumnoEditando] = useState<{ id: string } | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => {
    if (!comisionId && comisiones && comisiones.length > 0) setComisionId(comisiones[0].id)
  }, [comisiones, comisionId])

  const { data: notas, isLoading } = useNotasComision(comisionId || null)
  const { data: config } = useConfiguracionProfesor()
  const notaAprobacion = config?.nota_aprobacion ?? 4

  const comisionNombre = comisiones?.find((c) => c.id === comisionId)?.nombre

  function handleDescargarPdf() {
    if (esIosStandalone()) {
      toast.info('Safari no permite imprimir dentro de la app instalada. Te abrimos esta página en Safari: elegí de nuevo la comisión ahí y tocá Descargar PDF.')
      window.open(window.location.href, '_blank')
      return
    }
    window.print()
  }

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Parciales</CardTitle>
            <CardSubtitle>Se aprueba con nota mayor o igual a {formatNota(notaAprobacion)}</CardSubtitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="input-field w-auto" value={comisionId} onChange={(e) => setComisionId(e.target.value)}>
              {comisiones?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleDescargarPdf} disabled={!comisionId || !notas}>
              <FileDown className="size-4" />
              Descargar PDF
            </Button>
            <Button
              onClick={() => {
                setAlumnoEditando(null)
                setModalAbierto(true)
              }}
            >
              <Plus className="size-4" />
              Cargar notas
            </Button>
          </div>
        </div>
      </Card>

      <div className="print-area hidden print:block">
        <h1 className="text-xl font-bold">Parciales — {comisionNombre}</h1>
        <p className="text-sm">
          Se aprueba con nota mayor o igual a {formatNota(notaAprobacion)} · Generado el {format(new Date(), 'dd/MM/yyyy')}
        </p>
      </div>

      <Card className="print-area overflow-hidden p-0">
        {!comisionId ? (
          <p className="p-10 text-center text-white/40">Creá una comisión para empezar.</p>
        ) : isLoading ? (
          <p className="p-10 text-center text-white/40">Cargando…</p>
        ) : !notas || notas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <GraduationCap className="size-8 text-white/20" />
            <p className="text-white/50">Todavía no hay alumnos en {comisionNombre}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                  <th className="table-sticky-col px-5 py-3 font-medium">Alumno</th>
                  <th className="px-3 py-3 text-center font-medium">Asistencia</th>
                  <th className="px-3 py-3 text-center font-medium">Parcial 1</th>
                  <th className="px-3 py-3 text-center font-medium">Parcial 2</th>
                  <th className="px-3 py-3 text-center font-medium">Recuperatorio 1</th>
                  <th className="px-3 py-3 text-center font-medium">Recuperatorio 2</th>
                  <th className="px-5 py-3 text-center font-medium">Estado</th>
                  <th className="px-3 py-3 text-center font-medium print:hidden" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {notas.map((a) => {
                  const estado = calcularEstadoNotas(a.parcial_1, a.parcial_2, a.recuperatorio_1, a.recuperatorio_2, notaAprobacion)
                  return (
                    <tr key={a.alumno_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="table-sticky-col px-5 py-3 text-white">
                        <div className="font-medium">
                          {a.apellido}, {a.nombre}
                        </div>
                        <div className="text-xs text-white/40">{a.legajo}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex min-w-12 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold',
                            a.cumple_asistencia ? 'bg-ok-500/15 text-ok-500' : 'bg-danger-500/15 text-danger-500',
                          )}
                        >
                          {formatPorcentaje(a.porcentaje_asistencia)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <NotaChip nota={a.parcial_1} aprobado={estado.aprobado1} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <NotaChip nota={a.parcial_2} aprobado={estado.aprobado2} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <RecuCelda tipo={estado.recu1Tipo} nota={a.recuperatorio_1} minimo={notaAprobacion} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <RecuCelda tipo={estado.recu2Tipo} nota={a.recuperatorio_2} minimo={notaAprobacion} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge tone={estado.estado === 'aprobado' ? 'ok' : estado.estado === 'desaprobado' ? 'danger' : 'warn'}>
                          {estado.estado === 'aprobado' ? 'Aprobado' : estado.estado === 'desaprobado' ? 'Desaprobado' : 'Pendiente'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center print:hidden">
                        <button
                          title="Cargar notas de este alumno"
                          onClick={() => {
                            setAlumnoEditando({ id: a.alumno_id })
                            setModalAbierto(true)
                          }}
                          className="inline-flex size-7 items-center justify-center rounded-full text-white/30 hover:bg-white/10 hover:text-white"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalAbierto && (
        <ModalCargarNotas
          notas={notas ?? []}
          alumnoIdInicial={alumnoEditando?.id}
          notaAprobacion={notaAprobacion}
          onClose={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
}

/** Ausente va en naranja (warn): no es lo mismo que una nota realmente desaprobada (rojo). */
function notaChipClass(nota: NotaValor, aprobado: boolean | null) {
  if (nota === 'ausente') return 'bg-warn-500/15 text-warn-500'
  return aprobado ? 'bg-ok-500/15 text-ok-500' : 'bg-danger-500/15 text-danger-500'
}

function NotaChip({ nota, aprobado }: { nota: NotaValor; aprobado: boolean | null }) {
  if (nota == null) return <span className="text-white/20">—</span>
  return (
    <span
      className={cn(
        'inline-flex min-w-9 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold',
        notaChipClass(nota, aprobado),
      )}
    >
      {formatNotaValor(nota)}
    </span>
  )
}

function RecuCelda({ tipo, nota, minimo }: { tipo: TipoRecuperatorio; nota: NotaValor; minimo: number }) {
  if (!tipo) return <span className="text-white/20">—</span>
  const aprobado = nota == null ? null : nota === 'ausente' ? false : nota >= minimo
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-white/30">{RECU_LABEL[tipo]}</span>
      {nota == null ? (
        <span className="text-xs text-white/30">Pendiente</span>
      ) : (
        <span
          className={cn(
            'inline-flex min-w-9 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold',
            notaChipClass(nota, aprobado),
          )}
        >
          {formatNotaValor(nota)}
        </span>
      )}
    </div>
  )
}

function ModalCargarNotas({
  notas,
  alumnoIdInicial,
  notaAprobacion,
  onClose,
}: {
  notas: AlumnoNotas[]
  alumnoIdInicial?: string
  notaAprobacion: number
  onClose: () => void
}) {
  const cargar = useCargarNotas()
  const [alumnoId, setAlumnoId] = useState(alumnoIdInicial ?? '')
  const [parcial1, setParcial1] = useState('')
  const [parcial2, setParcial2] = useState('')
  const [recu1, setRecu1] = useState('')
  const [recu2, setRecu2] = useState('')

  useEffect(() => {
    const actual = notas.find((n) => n.alumno_id === alumnoId)
    setParcial1(actual?.parcial_1 != null ? formatNotaValor(actual.parcial_1) : '')
    setParcial2(actual?.parcial_2 != null ? formatNotaValor(actual.parcial_2) : '')
    setRecu1(actual?.recuperatorio_1 != null ? formatNotaValor(actual.recuperatorio_1) : '')
    setRecu2(actual?.recuperatorio_2 != null ? formatNotaValor(actual.recuperatorio_2) : '')
    // Solo queremos recargar el form cuando cambia el alumno seleccionado, no cuando cambian las notas en memoria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId])

  const p1preview = parseNotaInput(parcial1)
  const p2preview = parseNotaInput(parcial2)
  const tipoPreview = tipoRecuperatorio(
    p1preview === 'invalid' ? null : p1preview,
    p2preview === 'invalid' ? null : p2preview,
    notaAprobacion,
  )
  const labelRecu1 = tipoPreview ? `Recuperatorio 1 (${RECU_LABEL[tipoPreview]})` : 'Recuperatorio 1'
  const labelRecu2 = tipoPreview ? `Recuperatorio 2 (${RECU_LABEL[tipoPreview]})` : 'Recuperatorio 2'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!alumnoId) return toast.error('Elegí un alumno')

    const p1 = parseNotaInput(parcial1)
    const p2 = parseNotaInput(parcial2)
    const r1 = parseNotaInput(recu1)
    const r2 = parseNotaInput(recu2)
    if (p1 === 'invalid' || p2 === 'invalid' || r1 === 'invalid' || r2 === 'invalid') {
      return toast.error("Las notas tienen que ser un número entre 0 y 10, o 'A' para ausente")
    }

    cargar.mutate(
      { alumno_id: alumnoId, parcial_1: p1, parcial_2: p2, recuperatorio_1: r1, recuperatorio_2: r2 },
      {
        onSuccess: () => {
          toast.success('Notas guardadas')
          onClose()
        },
        onError: () => toast.error('No se pudieron guardar las notas'),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Cargar notas">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Alumno"
          value={alumnoId}
          onChange={(e) => setAlumnoId(e.target.value)}
          disabled={!!alumnoIdInicial}
        >
          <option value="">Elegir alumno…</option>
          {notas.map((a) => (
            <option key={a.alumno_id} value={a.alumno_id}>
              {a.apellido}, {a.nombre} ({a.legajo})
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Parcial 1" placeholder="0-10 o 'A'" value={parcial1} onChange={(e) => setParcial1(e.target.value)} />
          <Input label="Parcial 2" placeholder="0-10 o 'A'" value={parcial2} onChange={(e) => setParcial2(e.target.value)} />
          <Input label={labelRecu1} placeholder="0-10 o 'A'" value={recu1} onChange={(e) => setRecu1(e.target.value)} />
          <Input label={labelRecu2} placeholder="0-10 o 'A'" value={recu2} onChange={(e) => setRecu2(e.target.value)} />
        </div>
        <p className="text-xs text-white/40">
          Dejá un campo vacío si esa instancia todavía no se tomó, o poné "A" si el alumno estuvo ausente (cuenta como
          desaprobado y recupera igual que si hubiera rendido). Si desaprueba los dos parciales, las recuperaciones
          pasan a ser el integral.
        </p>
        <Button type="submit" className="w-full" loading={cargar.isPending}>
          Guardar notas
        </Button>
      </form>
    </Modal>
  )
}
