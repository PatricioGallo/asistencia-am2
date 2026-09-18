import { cn } from '@/lib/utils'

const INTEGRAL_PATH = 'M 26,18 C 19,16 15,18 16,23 C 17,27 20,29 22,33 L 30,58 C 32,63 33,67 30,70 C 28,73 24,74 18,72'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-400',
        className,
      )}
    >
      <svg viewBox="0 0 100 100" className="size-5" aria-hidden="true">
        <g transform="translate(50,50) scale(1.15) translate(-35,-45)">
          <path d={INTEGRAL_PATH} stroke="white" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d={INTEGRAL_PATH}
            stroke="white"
            strokeWidth={3.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(22,0)"
          />
        </g>
      </svg>
    </span>
  )
}
