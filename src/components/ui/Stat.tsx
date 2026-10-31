import { cn } from '@/lib/utils'

export function Stat({ label, value, detalle, compact }: { label: string; value: string; detalle?: string; compact?: boolean }) {
  return (
    <div>
      <p className={cn('font-display font-bold text-white', compact ? 'text-base' : 'text-2xl')}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
      {detalle && <p className="mt-1 text-xs text-white/50">{detalle}</p>}
    </div>
  )
}
