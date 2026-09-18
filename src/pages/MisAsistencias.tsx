import { useState } from 'react'
import { CheckCircle2, Loader2, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { formatFecha, formatHora, formatPorcentaje } from '@/lib/utils'
import { useMisAsistencias } from '@/lib/queries/alumnoPublico'
import type { MisAsistenciasRow } from '@/lib/database.types'

export function MisAsistencias() {
  const [legajo, setLegajo] = useState('')
  const [resultados, setResultados] = useState<MisAsistenciasRow[] | null>(null)
  const buscar = useMisAsistencias()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const legajoTrim = legajo.trim()
    if (!legajoTrim) return
    buscar.mutate(legajoTrim, { onSuccess: setResultados })
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Card>
        <label className="mb-1.5 block text-sm font-medium text-white/70">Tu legajo</label>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="input-field pr-10"
              value={legajo}
              onChange={(e) => {
                setLegajo(e.target.value)
                setResultados(null)
              }}
              placeholder="Ej: 123456"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
              {buscar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </span>
          </div>
          <Button type="submit" loading={buscar.isPending} disabled={!legajo.trim()}>
            Buscar
          </Button>
        </form>
      </Card>

      {resultados && resultados.length === 0 && (
        <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-white/40">
          No encontramos ningún alumno con ese legajo.
        </p>
      )}

      {resultados?.map((r) => (
        <ResultadoAsistencias key={r.alumno_id} resultado={r} />
      ))}
    </div>
  )
}

function ResultadoAsistencias({ resultado }: { resultado: MisAsistenciasRow }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-white">
            {resultado.nombre} {resultado.apellido}
          </p>
          <p className="text-xs text-white/45">
            Legajo {resultado.legajo}
            {resultado.comision_nombre ? ` · ${resultado.comision_nombre}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-4 text-right">
          <Stat compact label="Presentes" value={`${resultado.presentes}/${resultado.total_clases}`} />
          <Stat compact label="%" value={formatPorcentaje(resultado.porcentaje)} />
        </div>
      </div>

      {resultado.clases.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/5 p-4 text-center text-sm text-white/40">
          Todavía no registraste ninguna asistencia.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {resultado.clases.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{c.clase_nombre}</p>
                <p className="text-xs text-white/45">
                  {formatFecha(c.fecha)} · {formatHora(c.hora_inicio)} a {formatHora(c.hora_fin)}
                </p>
              </div>
              <CheckCircle2 className="size-4 shrink-0 text-ok-500" />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
