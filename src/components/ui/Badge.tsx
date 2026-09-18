import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'ok' | 'warn' | 'danger' | 'neutral' | 'brand'

const toneClass: Record<Tone, string> = {
  ok: 'bg-ok-500/15 text-ok-500 border-ok-500/30',
  warn: 'bg-warn-500/15 text-warn-500 border-warn-500/30',
  danger: 'bg-danger-500/15 text-danger-500 border-danger-500/30',
  neutral: 'bg-white/10 text-white/60 border-white/10',
  brand: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        toneClass[tone],
        className,
      )}
      {...props}
    />
  )
}
