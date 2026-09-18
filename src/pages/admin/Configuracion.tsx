import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useComisiones, useCrearComision, useEliminarComision } from '@/lib/queries/comisiones'

export function Configuracion() {
  return (
    <div className="space-y-6">
      <ComisionesPanel />
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
