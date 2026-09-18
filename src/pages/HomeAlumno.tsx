import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, GraduationCap, KeyRound, Loader2, Search, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CountdownRing } from '@/components/ui/CountdownRing'
import { Badge } from '@/components/ui/Badge'
import { cn, formatHora, formatPorcentaje } from '@/lib/utils'
import { useAlumnoStats, useRegistrarAsistencia, useSesionActiva } from '@/lib/queries/alumnoPublico'
import type { AlumnoStatsRow, RegistrarAsistenciaRow, SesionActivaRow } from '@/lib/database.types'

export function HomeAlumno() {
  const { data: sesiones, isLoading } = useSesionActiva()
  const [sesionId, setSesionId] = useState<string | null>(null)

  const sesionActiva = useMemo(
    () => sesiones?.find((s) => s.sesion_id === sesionId) ?? sesiones?.[0] ?? null,
    [sesiones, sesionId],
  )

  useEffect(() => {
    if (sesiones && sesiones.length > 0 && !sesiones.some((s) => s.sesion_id === sesionId)) {
      setSesionId(sesiones[0].sesion_id)
    }
    if (sesiones && sesiones.length === 0) setSesionId(null)
  }, [sesiones, sesionId])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/50">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!sesiones || sesiones.length === 0) {
    return <SinClase />
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {sesiones.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {sesiones.map((s) => (
            <button
              key={s.sesion_id}
              onClick={() => setSesionId(s.sesion_id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                s.sesion_id === sesionActiva?.sesion_id
                  ? 'border-brand-400/60 bg-brand-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
              )}
            >
              {s.clase_nombre} · {s.comision_nombre}
            </button>
          ))}
        </div>
      )}

      {sesionActiva && <ClaseEnCurso sesion={sesionActiva} />}
    </div>
  )
}

function SinClase() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
      <span className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-white/5">
        <GraduationCap className="size-8 text-white/30" />
      </span>
      <h1 className="font-display text-xl font-semibold text-white">No hay ninguna clase en curso</h1>
      <p className="mt-2 max-w-xs text-sm text-white/45">
        Volvé a esta página cuando empiece la clase para marcar tu asistencia.
      </p>
    </div>
  )
}

function ClaseEnCurso({ sesion }: { sesion: SesionActivaRow }) {
  return (
    <>
      <Card className="text-center">
        <Badge tone="brand" className="mb-3">
          <Sparkles className="size-3" />
          Clase en curso
        </Badge>
        <h1 className="font-display text-2xl font-bold text-white">{sesion.clase_nombre}</h1>
        <p className="mt-1 text-sm text-white/50">
          Comisión {sesion.comision_nombre} · {formatHora(sesion.hora_inicio)} a {formatHora(sesion.hora_fin)}
        </p>
      </Card>

      {sesion.codigo_activo && sesion.expira_at ? (
        <FormularioAsistencia expiraAt={sesion.expira_at} />
      ) : (
        <Card className="flex flex-col items-center gap-3 text-center">
          <Clock className="size-8 animate-pulse text-white/30" />
          <div>
            <p className="font-medium text-white/80">Esperando el código del profesor</p>
            <p className="mt-1 text-sm text-white/45">Cuando lo compartan, vas a tener 60 segundos para cargarlo.</p>
          </div>
        </Card>
      )}
    </>
  )
}

function FormularioAsistencia({ expiraAt }: { expiraAt: string }) {
  const [legajo, setLegajo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [stats, setStats] = useState<AlumnoStatsRow | null>(null)
  const [resultado, setResultado] = useState<RegistrarAsistenciaRow | null>(null)
  const [expirado, setExpirado] = useState(false)

  const buscarStats = useAlumnoStats()
  const registrar = useRegistrarAsistencia()

  useEffect(() => {
    const legajoTrim = legajo.trim()
    if (legajoTrim.length < 2) {
      setStats(null)
      return
    }
    const id = setTimeout(() => {
      buscarStats.mutate(legajoTrim, { onSuccess: setStats })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legajo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!legajo.trim() || !codigo.trim() || expirado) return
    registrar.mutate(
      { legajo: legajo.trim(), codigo: codigo.trim() },
      { onSuccess: setResultado },
    )
  }

  if (resultado?.ok) {
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-12 text-ok-500" />
        <div>
          <p className="font-display text-lg font-semibold text-white">
            ¡Listo, {resultado.nombre}!
          </p>
          <p className="mt-1 text-sm text-white/50">{resultado.mensaje}</p>
        </div>
        {resultado.presentes != null && (
          <div className="mt-2 flex gap-6 text-center">
            <Stat label="Presentes" value={`${resultado.presentes}/${resultado.total_clases}`} />
            <Stat label="Asistencia" value={formatPorcentaje(resultado.porcentaje ?? 0)} />
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-center">
        <CountdownRing expiraAt={expiraAt} onExpire={() => setExpirado(true)} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/70">Tu legajo</label>
          <div className="relative">
            <input
              className="input-field pr-10"
              value={legajo}
              onChange={(e) => {
                setLegajo(e.target.value)
                setStats(null)
              }}
              placeholder="Ej: 123456"
              inputMode="numeric"
              autoComplete="off"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
              {buscarStats.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </span>
          </div>

          {stats && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              {stats.ok ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">
                      {stats.nombre} {stats.apellido}
                    </p>
                    <p className="text-xs text-white/45">{stats.comision_nombre}</p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <Stat compact label="Presentes" value={`${stats.presentes}/${stats.total_clases}`} />
                    <Stat compact label="%" value={formatPorcentaje(stats.porcentaje ?? 0)} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-danger-500">{stats.mensaje}</p>
              )}
            </motion.div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/70">Código de la clase</label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              className="input-field pl-10 text-center font-display text-lg tracking-[0.3em] uppercase"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
            />
          </div>
        </div>

        {resultado && !resultado.ok && <p className="text-center text-sm text-danger-500">{resultado.mensaje}</p>}
        {expirado && <p className="text-center text-sm text-warn-500">El código expiró. Esperá el próximo.</p>}

        <Button
          type="submit"
          className="w-full"
          loading={registrar.isPending}
          disabled={expirado || !stats?.ok || !codigo.trim()}
        >
          Confirmar asistencia
        </Button>
      </form>
    </Card>
  )
}

function Stat({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <p className={cn('font-display font-bold text-white', compact ? 'text-base' : 'text-2xl')}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  )
}
