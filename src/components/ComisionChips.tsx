import { cn } from '@/lib/utils'

export function ComisionChips({
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
