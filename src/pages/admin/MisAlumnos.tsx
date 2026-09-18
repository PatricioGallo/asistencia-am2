import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useComisiones, useCrearComision } from '@/lib/queries/comisiones'
import {
  useActualizarAlumno,
  useAlumnos,
  useCrearAlumno,
  useEliminarAlumno,
  useImportarAlumnos,
  type AlumnoCsvRow,
} from '@/lib/queries/alumnos'
import type { Alumno } from '@/lib/database.types'

export function MisAlumnos() {
  const [busqueda, setBusqueda] = useState('')
  const [comisionId, setComisionId] = useState<string>('todas')
  const [modalAlumno, setModalAlumno] = useState<Alumno | 'nuevo' | null>(null)
  const [modalImport, setModalImport] = useState(false)

  const { data: comisiones } = useComisiones()
  const { data: alumnos, isLoading } = useAlumnos({ busqueda, comisionId })
  const eliminar = useEliminarAlumno()

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Mis alumnos</CardTitle>
            <CardSubtitle>{alumnos?.length ?? 0} alumnos encontrados</CardSubtitle>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModalImport(true)}>
              <Upload className="size-4" />
              Importar CSV
            </Button>
            <Button onClick={() => setModalAlumno('nuevo')}>
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              className="input-field pl-10"
              placeholder="Buscar por nombre, apellido o legajo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <select className="input-field sm:w-56" value={comisionId} onChange={(e) => setComisionId(e.target.value)}>
            <option value="todas">Todas las comisiones</option>
            {comisiones?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <p className="p-6 text-center text-white/40">Cargando…</p>
        ) : !alumnos || alumnos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Users className="size-8 text-white/20" />
            <p className="text-white/50">No hay alumnos para mostrar todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                  <th className="px-5 py-3 font-medium">Legajo</th>
                  <th className="px-5 py-3 font-medium">Apellido y nombre</th>
                  <th className="px-5 py-3 font-medium">Comisión</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-white/70">{a.legajo}</td>
                    <td className="px-5 py-3 text-white">
                      {a.apellido}, {a.nombre}
                    </td>
                    <td className="px-5 py-3 text-white/60">{a.comisiones?.nombre ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setModalAlumno(a)}
                          className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${a.nombre} ${a.apellido}?`)) eliminar.mutate(a.id)
                          }}
                          className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-danger-500"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalAlumno && <ModalAlumno alumno={modalAlumno} onClose={() => setModalAlumno(null)} />}
      {modalImport && <ModalImportarCsv onClose={() => setModalImport(false)} />}
    </div>
  )
}

function ModalAlumno({ alumno, onClose }: { alumno: Alumno | 'nuevo'; onClose: () => void }) {
  const esNuevo = alumno === 'nuevo'
  const { data: comisiones } = useComisiones()
  const crear = useCrearAlumno()
  const actualizar = useActualizarAlumno()

  const [legajo, setLegajo] = useState(esNuevo ? '' : alumno.legajo)
  const [nombre, setNombre] = useState(esNuevo ? '' : alumno.nombre)
  const [apellido, setApellido] = useState(esNuevo ? '' : alumno.apellido)
  const [comisionId, setComisionId] = useState(esNuevo ? '' : (alumno.comision_id ?? ''))

  const mutando = crear.isPending || actualizar.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!legajo.trim() || !nombre.trim() || !apellido.trim()) {
      toast.error('Completá legajo, nombre y apellido')
      return
    }

    const payload = {
      legajo: legajo.trim(),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      comision_id: comisionId || null,
    }

    if (esNuevo) {
      crear.mutate(payload, {
        onSuccess: () => {
          toast.success('Alumno agregado')
          onClose()
        },
        onError: () => toast.error('No se pudo agregar (¿legajo repetido?)'),
      })
    } else {
      actualizar.mutate(
        { id: alumno.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Alumno actualizado')
            onClose()
          },
          onError: () => toast.error('No se pudo actualizar'),
        },
      )
    }
  }

  return (
    <Modal open onClose={onClose} title={esNuevo ? 'Agregar alumno' : 'Editar alumno'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Legajo" value={legajo} onChange={(e) => setLegajo(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </div>
        <Select label="Comisión" value={comisionId} onChange={(e) => setComisionId(e.target.value)}>
          <option value="">Sin asignar</option>
          {comisiones?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Button type="submit" className="w-full" loading={mutando}>
          {esNuevo ? 'Agregar' : 'Guardar cambios'}
        </Button>
      </form>
    </Modal>
  )
}

function buscarValor(row: Record<string, string>, claves: string[]): string {
  const normalizado = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, ''),
      v,
    ]),
  )
  for (const clave of claves) {
    if (normalizado[clave] != null && normalizado[clave] !== '') return String(normalizado[clave]).trim()
  }
  return ''
}

function ModalImportarCsv({ onClose }: { onClose: () => void }) {
  const { data: comisiones } = useComisiones()
  const crearComision = useCrearComision()
  const importar = useImportarAlumnos()
  const fileRef = useRef<HTMLInputElement>(null)
  const [procesando, setProcesando] = useState(false)

  async function handleFile(file: File) {
    setProcesando(true)
    try {
      const { data: filas } = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        })
      })

      const comisionesPorNombre = new Map((comisiones ?? []).map((c) => [c.nombre.toLowerCase(), c.id]))
      const filasParseadas = filas.map((f) => ({
        legajo: buscarValor(f, ['legajo']),
        nombre: buscarValor(f, ['nombre']),
        apellido: buscarValor(f, ['apellido']),
        comisionNombre: buscarValor(f, ['comision', 'comisión']),
      }))

      const validas = filasParseadas.filter((f) => f.legajo && f.nombre && f.apellido)
      if (validas.length === 0) {
        toast.error('El CSV necesita columnas legajo, nombre y apellido')
        return
      }

      const nombresFaltantes = [...new Set(validas.map((f) => f.comisionNombre).filter(Boolean))].filter(
        (n) => !comisionesPorNombre.has(n.toLowerCase()),
      )

      for (const nombre of nombresFaltantes) {
        const nueva = await crearComision.mutateAsync(nombre)
        comisionesPorNombre.set(nueva.nombre.toLowerCase(), nueva.id)
      }

      const rows: AlumnoCsvRow[] = validas.map((f) => ({
        legajo: f.legajo,
        nombre: f.nombre,
        apellido: f.apellido,
        comision_id: f.comisionNombre ? (comisionesPorNombre.get(f.comisionNombre.toLowerCase()) ?? null) : null,
      }))

      await importar.mutateAsync(rows)
      toast.success(`${rows.length} alumnos importados`)
      onClose()
    } catch {
      toast.error('No pudimos leer ese archivo')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Importar alumnos por CSV">
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          El archivo tiene que tener columnas <code className="text-white/80">legajo</code>,{' '}
          <code className="text-white/80">nombre</code>, <code className="text-white/80">apellido</code> y{' '}
          <code className="text-white/80">comision</code> (opcional; si no existe, se crea sola).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          loading={procesando}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          Elegir archivo CSV
        </Button>
      </div>
    </Modal>
  )
}
