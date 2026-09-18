import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CountdownRingProps {
  expiraAt: string
  totalSeconds?: number
  size?: number
  onExpire?: () => void
  className?: string
}

function colorFor(fraction: number) {
  if (fraction > 0.5) return 'var(--color-ok-500)'
  if (fraction > 0.2) return 'var(--color-warn-500)'
  return 'var(--color-danger-500)'
}

export function CountdownRing({ expiraAt, totalSeconds = 60, size = 160, onExpire, className }: CountdownRingProps) {
  const expiraMs = new Date(expiraAt).getTime()
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, expiraMs - Date.now()))
  const firedExpireRef = useRef(false)

  useEffect(() => {
    firedExpireRef.current = false
    const tick = () => setRemainingMs(Math.max(0, expiraMs - Date.now()))
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [expiraMs])

  useEffect(() => {
    if (remainingMs === 0 && !firedExpireRef.current) {
      firedExpireRef.current = true
      onExpire?.()
    }
  }, [remainingMs, onExpire])

  const seconds = Math.ceil(remainingMs / 1000)
  const fraction = Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000)))
  const stroke = size * 0.07
  const r = size / 2 - stroke
  const circumference = 2 * Math.PI * r
  const color = colorFor(fraction)

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 200ms linear, stroke 300ms ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="font-display text-4xl font-bold tabular-nums text-white"
          style={{ animation: seconds <= 10 && seconds > 0 ? 'countdown-pulse 1s ease-in-out infinite' : undefined }}
        >
          {seconds}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">segundos</span>
      </div>
    </div>
  )
}
