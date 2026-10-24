import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Cuánto hay que arrastrar (en px, ya amortiguado) para que se dispare la recarga. */
const UMBRAL = 64
const MAXIMO = 96

/**
 * "Deslizar hacia abajo para recargar" en pantallas táctiles (celular y app
 * instalada, donde iOS no trae el gesto nativo). Solo se activa si la página
 * está arriba de todo. Mientras está montado desactiva el gesto nativo del
 * navegador para que no se recargue dos veces.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [distancia, setDistancia] = useState(0)
  const [recargando, setRecargando] = useState(false)
  const inicioY = useRef<number | null>(null)
  const distanciaRef = useRef(0)
  const recargandoRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const anterior = document.body.style.overscrollBehaviorY
    document.body.style.overscrollBehaviorY = 'contain'

    function alEmpezar(e: TouchEvent) {
      if (recargandoRef.current || window.scrollY > 0 || e.touches.length !== 1) return
      inicioY.current = e.touches[0].clientY
    }

    function alMover(e: TouchEvent) {
      if (inicioY.current === null) return
      const dy = e.touches[0].clientY - inicioY.current
      if (dy <= 0 || window.scrollY > 0) {
        distanciaRef.current = 0
        setDistancia(0)
        return
      }
      // Resistencia: cuanto más se arrastra, menos avanza.
      const d = Math.min(MAXIMO, dy * 0.45)
      distanciaRef.current = d
      setDistancia(d)
    }

    async function alSoltar() {
      if (inicioY.current === null) return
      inicioY.current = null
      if (distanciaRef.current < UMBRAL) {
        distanciaRef.current = 0
        setDistancia(0)
        return
      }
      recargandoRef.current = true
      setRecargando(true)
      setDistancia(UMBRAL)
      try {
        // Un mínimo de tiempo para que se vea que recargó, aunque responda al instante.
        await Promise.all([onRefreshRef.current(), new Promise((r) => setTimeout(r, 600))])
      } finally {
        recargandoRef.current = false
        distanciaRef.current = 0
        setRecargando(false)
        setDistancia(0)
      }
    }

    window.addEventListener('touchstart', alEmpezar, { passive: true })
    window.addEventListener('touchmove', alMover, { passive: true })
    window.addEventListener('touchend', alSoltar)
    window.addEventListener('touchcancel', alSoltar)
    return () => {
      document.body.style.overscrollBehaviorY = anterior
      window.removeEventListener('touchstart', alEmpezar)
      window.removeEventListener('touchmove', alMover)
      window.removeEventListener('touchend', alSoltar)
      window.removeEventListener('touchcancel', alSoltar)
    }
  }, [])

  if (distancia === 0 && !recargando) return null

  const listo = distancia >= UMBRAL

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--header-pt)+4.5rem)] z-30 flex justify-center"
      style={{ transform: `translateY(${distancia - UMBRAL}px)`, opacity: Math.min(1, distancia / UMBRAL) }}
      aria-live="polite"
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-full border border-white/10 bg-bg-950/90 shadow-lg backdrop-blur',
          listo ? 'text-brand-400' : 'text-white/50',
        )}
      >
        <RefreshCw
          className={cn('size-4', recargando && 'animate-spin')}
          style={recargando ? undefined : { transform: `rotate(${distancia * 4}deg)` }}
        />
        <span className="sr-only">{recargando ? 'Recargando' : 'Soltá para recargar'}</span>
      </span>
    </div>
  )
}
