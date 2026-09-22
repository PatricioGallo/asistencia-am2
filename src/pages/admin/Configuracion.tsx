import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { ComisionChips } from '@/components/ComisionChips'
import { DIAS_SEMANA, formatHora } from '@/lib/utils'
import { useComisiones, useCrearComision, useEliminarComision } from '@/lib/queries/comisiones'
import { useCrearHorario, useEliminarHorario, useHorarios } from '@/lib/queries/horarios'
import {
  useActualizarDuracionCodigo,
  useActualizarMostrarHorarios,
  useActualizarNotaAprobacion,
  useActualizarPorcentajeRequerido,
  useConfiguracionProfesor,
} from '@/lib/queries/configuracionProfesor'
import { formatNota } from '@/lib/utils'

const DURACION_MIN = 10
const DURACION_MAX = 600
const PORCENTAJE_MIN = 1
const PORCENTAJE_MAX = 100
const NOTA_MIN = 1
const NOTA_MAX = 10

export function Configuracion() {
  return (
    <div className="space-y-6">
      <ComisionesPanel />
      <DuracionCodigoPanel />
      <PorcentajeRequeridoPanel />
      <NotaAprobacionPanel />
      <MostrarHorariosToggle />
      <HorariosPanel />
    </div>
  )
}

function ComisionesPanel() {
  const { data: comisiones } = useComisiones()
  const crear = useCrearComision()
  const eliminar = useEliminarComision()
  const confirm = useConfirm()
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
                onClick={async () => {
                  if (await confirm(`¿Eliminar la comisión ${c.nombre}? Los alumnos quedan sin comisión asignada.`)) {
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

function DuracionCodigoPanel() {
  const { data: config, isLoading } = useConfiguracionProfesor()
  const actualizar = useActualizarDuracionCodigo()
  const [segundos, setSegundos] = useState('')

  useEffect(() => {
    if (config) setSegundos(String(config.duracion_codigo_segundos))
  }, [config])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valor = Math.trunc(Number(segundos))
    if (!Number.isFinite(valor) || valor < DURACION_MIN || valor > DURACION_MAX) {
      return toast.error(`Elegí un valor entre ${DURACION_MIN} y ${DURACION_MAX} segundos`)
    }
    actualizar.mutate(valor, {
      onSuccess: () => toast.success('Duración actualizada'),
      onError: () => toast.error('No se pudo guardar'),
    })
  }

  return (
    <Card>
      <CardTitle>Duración del código</CardTitle>
      <CardSubtitle>Cuánto tiempo tienen los alumnos para cargar el código antes de que expire.</CardSubtitle>
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
        <Input
          label="Segundos"
          type="number"
          min={DURACION_MIN}
          max={DURACION_MAX}
          value={segundos}
          disabled={isLoading}
          onChange={(e) => setSegundos(e.target.value)}
          className="max-w-32"
        />
        <Button type="submit" loading={actualizar.isPending} className="mb-0.5">
          Guardar
        </Button>
      </form>
    </Card>
  )
}

function PorcentajeRequeridoPanel() {
  const { data: config, isLoading } = useConfiguracionProfesor()
  const actualizar = useActualizarPorcentajeRequerido()
  const [porcentaje, setPorcentaje] = useState('')

  useEffect(() => {
    if (config) setPorcentaje(String(config.porcentaje_requerido))
  }, [config])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valor = Math.trunc(Number(porcentaje))
    if (!Number.isFinite(valor) || valor < PORCENTAJE_MIN || valor > PORCENTAJE_MAX) {
      return toast.error(`Elegí un valor entre ${PORCENTAJE_MIN} y ${PORCENTAJE_MAX}`)
    }
    actualizar.mutate(valor, {
      onSuccess: () => toast.success('Porcentaje actualizado'),
      onError: () => toast.error('No se pudo guardar'),
    })
  }

  return (
    <Card>
      <CardTitle>Asistencia requerida</CardTitle>
      <CardSubtitle>Porcentaje mínimo de presencia para aprobar la cursada.</CardSubtitle>
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
        <Input
          label="Porcentaje"
          type="number"
          min={PORCENTAJE_MIN}
          max={PORCENTAJE_MAX}
          value={porcentaje}
          disabled={isLoading}
          onChange={(e) => setPorcentaje(e.target.value)}
          className="max-w-32"
        />
        <Button type="submit" loading={actualizar.isPending} className="mb-0.5">
          Guardar
        </Button>
      </form>
    </Card>
  )
}

function NotaAprobacionPanel() {
  const { data: config, isLoading } = useConfiguracionProfesor()
  const actualizar = useActualizarNotaAprobacion()
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (config) setNota(formatNota(config.nota_aprobacion))
  }, [config])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valor = Number(nota.replace(',', '.'))
    if (!Number.isFinite(valor) || valor < NOTA_MIN || valor > NOTA_MAX) {
      return toast.error(`Elegí un valor entre ${NOTA_MIN} y ${NOTA_MAX}`)
    }
    actualizar.mutate(valor, {
      onSuccess: () => toast.success('Nota de aprobación actualizada'),
      onError: () => toast.error('No se pudo guardar'),
    })
  }

  return (
    <Card>
      <CardTitle>Parciales</CardTitle>
      <CardSubtitle>Nota mínima para aprobar un parcial, una recuperación o el integral.</CardSubtitle>
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
        <Input
          label="Nota de aprobación"
          type="number"
          min={NOTA_MIN}
          max={NOTA_MAX}
          step={0.5}
          value={nota}
          disabled={isLoading}
          onChange={(e) => setNota(e.target.value)}
          className="max-w-32"
        />
        <Button type="submit" loading={actualizar.isPending} className="mb-0.5">
          Guardar
        </Button>
      </form>
    </Card>
  )
}

function MostrarHorariosToggle() {
  const { data: config, isLoading } = useConfiguracionProfesor()
  const actualizar = useActualizarMostrarHorarios()
  const checked = config?.mostrar_horarios ?? false

  return (
    <Card>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <div>
          <CardTitle>Mostrar mis cursos en la página principal</CardTitle>
          <CardSubtitle>
            Los alumnos van a ver día, horario, comisión y aula de tus clases, incluso cuando no haya ninguna en curso.
          </CardSubtitle>
        </div>
        <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={isLoading || actualizar.isPending}
            onChange={(e) =>
              actualizar.mutate(e.target.checked, {
                onError: () => toast.error('No se pudo guardar. ¿Corriste el SQL de horarios en Supabase?'),
              })
            }
          />
          <span className="absolute inset-0 rounded-full bg-white/15 transition-colors peer-checked:bg-brand-500 peer-disabled:opacity-50" />
          <span className="absolute left-1 size-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    </Card>
  )
}

function HorariosPanel() {
  const { data: config } = useConfiguracionProfesor()
  if (!config?.mostrar_horarios) return null

  return (
    <Card>
      <CardTitle>Mis cursos</CardTitle>
      <CardSubtitle>Día, horario, comisión y aula de cada clase. Esto es lo que ven los alumnos.</CardSubtitle>
      <FormNuevoHorario />
      <ListaHorarios />
    </Card>
  )
}

function FormNuevoHorario() {
  const { data: comisiones } = useComisiones()
  const crear = useCrearHorario()
  const [diaSemana, setDiaSemana] = useState('1')
  const [horaInicio, setHoraInicio] = useState('18:00')
  const [horaFin, setHoraFin] = useState('20:00')
  const [comisionIds, setComisionIds] = useState<string[]>([])
  const [aula, setAula] = useState('')

  if (!comisiones || comisiones.length === 0) {
    return <p className="mt-4 text-xs text-white/40">Creá una comisión arriba primero para poder cargar horarios.</p>
  }

  function toggleComision(id: string) {
    setComisionIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (comisionIds.length === 0) return toast.error('Elegí al menos una comisión')
    crear.mutate(
      {
        comision_ids: comisionIds,
        dia_semana: Number(diaSemana),
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        aula: aula.trim() || null,
      },
      {
        onSuccess: () => {
          setComisionIds([])
          setAula('')
        },
        onError: () => toast.error('No se pudo agregar el horario'),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-white/10 p-3">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-white/70">Comisiones</span>
        <p className="mb-1.5 text-xs text-white/40">Si dos comisiones dan la clase juntas, marcalas las dos.</p>
        <ComisionChips comisiones={comisiones} seleccionadas={comisionIds} onToggle={toggleComision} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select label="Día" value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)}>
          {DIAS_SEMANA.map((d, i) => (
            <option key={d} value={i + 1}>
              {d}
            </option>
          ))}
        </Select>
        <Input label="Desde" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        <Input label="Hasta" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
        <Input label="Aula" placeholder="Ej: 302" value={aula} onChange={(e) => setAula(e.target.value)} />
      </div>
      <Button type="submit" loading={crear.isPending}>
        <Plus className="size-4" />
        Agregar horario
      </Button>
    </form>
  )
}

function ListaHorarios() {
  const { data: horarios } = useHorarios()
  const eliminar = useEliminarHorario()
  const confirm = useConfirm()

  if (!horarios || horarios.length === 0) {
    return (
      <p className="mt-4 rounded-2xl bg-white/5 p-4 text-center text-sm text-white/40">
        Todavía no cargaste ningún horario.
      </p>
    )
  }

  return (
    <div className="mt-4 space-y-1.5">
      {horarios.map((h) => (
        <div
          key={h.id}
          className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
        >
          <p className="text-sm text-white">
            <span className="font-medium">{DIAS_SEMANA[h.dia_semana - 1]}</span>{' '}
            <span className="text-white/60">
              {formatHora(h.hora_inicio)} a {formatHora(h.hora_fin)} · {h.comisiones.map((c) => c.nombre).join(' + ')}
              {h.aula ? ` · Aula ${h.aula}` : ''}
            </span>
          </p>
          <button
            onClick={async () => {
              if (await confirm('¿Eliminar este horario?')) eliminar.mutate(h.id)
            }}
            className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-danger-500"
            aria-label="Eliminar horario"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
