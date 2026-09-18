import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ComisionChips } from '@/components/ComisionChips'
import { DIAS_SEMANA, formatHora } from '@/lib/utils'
import { useComisiones, useCrearComision, useEliminarComision } from '@/lib/queries/comisiones'
import {
  useActualizarMostrarHorarios,
  useCrearHorario,
  useEliminarHorario,
  useHorarios,
  useMostrarHorarios,
} from '@/lib/queries/horarios'

export function Configuracion() {
  return (
    <div className="space-y-6">
      <ComisionesPanel />
      <MostrarHorariosToggle />
      <HorariosPanel />
    </div>
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

function MostrarHorariosToggle() {
  const { data: mostrar, isLoading } = useMostrarHorarios()
  const actualizar = useActualizarMostrarHorarios()
  const checked = mostrar ?? false

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
  const { data: mostrar } = useMostrarHorarios()
  if (!mostrar) return null

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
            onClick={() => {
              if (confirm('¿Eliminar este horario?')) eliminar.mutate(h.id)
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
