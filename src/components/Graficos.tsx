import { createContext, useContext, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FilaTooltip {
  color?: string
  valor: string
  etiqueta: string
}

interface DatosTooltip {
  titulo: string
  filas: FilaTooltip[]
  x: number
  y: number
}

const TooltipContext = createContext<(datos: DatosTooltip | null) => void>(() => {})

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatosTooltip | null>(null)

  return (
    <TooltipContext.Provider value={setDatos}>
      {children}
      {datos && (
        <div
          role="status"
          className="pointer-events-none fixed z-50 max-w-64 rounded-xl border border-white/10 bg-bg-950/95 px-3 py-2 text-xs shadow-2xl"
          style={{
            left: Math.min(datos.x + 14, window.innerWidth - 270),
            top: Math.max(datos.y - 12, 8),
          }}
        >
          <p className="mb-1 text-white/50">{datos.titulo}</p>
          {datos.filas.map((f) => (
            <p key={f.etiqueta} className="flex items-center gap-2">
              {f.color && <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />}
              <span className="font-semibold text-white">{f.valor}</span>
              <span className="text-white/60">{f.etiqueta}</span>
            </p>
          ))}
        </div>
      )}
    </TooltipContext.Provider>
  )
}

/** Lo que necesita una marca del gráfico para mostrar el tooltip con mouse, dedo o teclado. */
function useMarca(titulo: string, filas: FilaTooltip[]) {
  const mostrar = useContext(TooltipContext)
  const mover = (e: ReactPointerEvent) => mostrar({ titulo, filas, x: e.clientX, y: e.clientY })

  return {
    tabIndex: 0,
    'aria-label': `${titulo}: ${filas.map((f) => `${f.etiqueta} ${f.valor}`).join(', ')}`,
    onPointerDown: mover,
    onPointerMove: mover,
    // Con el dedo el puntero "sale" apenas se levanta: ahí el tooltip se cierra con onBlur.
    onPointerLeave: (e: ReactPointerEvent) => {
      if (e.pointerType !== 'touch') mostrar(null)
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      mostrar({ titulo, filas, x: r.left + r.width / 2, y: r.top })
    },
    onBlur: () => mostrar(null),
  }
}

export function porcentajeDe(parte: number, total: number) {
  return total > 0 ? (100 * parte) / total : 0
}

export function formatPct(n: number) {
  return `${Math.round(n)}%`
}

export interface Serie<K extends string> {
  clave: K
  etiqueta: string
  color: string
}

export function Leyenda<K extends string>({ series }: { series: Serie<K>[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
      {series.map((s) => (
        <li key={s.clave} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} />
          {s.etiqueta}
        </li>
      ))}
    </ul>
  )
}

export type ModoValor = 'cantidad' | 'porcentaje'

function Segmento({ titulo, etiqueta, color, valor, total, ancho }: {
  titulo: string
  etiqueta: string
  color: string
  valor: number
  total: number
  ancho: number
}) {
  const marca = useMarca(titulo, [{ color, valor: `${valor} · ${formatPct(porcentajeDe(valor, total))}`, etiqueta }])
  return <div {...marca} className="h-full rounded-[3px] outline-none hover:brightness-125 focus-visible:brightness-125" style={{ width: `${ancho}%`, backgroundColor: color }} />
}

/** Una sola barra partida en segmentos, para ponerla arriba de una lista con los números. */
export function BarraFina<K extends string>({ series, valores }: { series: Serie<K>[]; valores: Record<K, number> }) {
  const total = series.reduce((t, s) => t + valores[s.clave], 0)
  return (
    <div className="flex h-2 gap-0.5">
      {series
        .filter((s) => valores[s.clave] > 0)
        .map((s) => (
          <Segmento
            key={s.clave}
            titulo={s.etiqueta}
            etiqueta="alumnos"
            color={s.color}
            valor={valores[s.clave]}
            total={total}
            ancho={porcentajeDe(valores[s.clave], total)}
          />
        ))}
    </div>
  )
}

export interface FilaApilada<K extends string> {
  id: string
  etiqueta: string
  valores: Record<K, number>
  /** Texto al final de la barra: solo la serie que importa, el resto queda en el tooltip y la tabla. */
  nota: string
}

/** Una barra apilada por fila. En "cantidad" el largo muestra el tamaño de cada grupo; en "porcentaje" todas miden lo mismo. */
export function BarrasApiladas<K extends string>({
  filas,
  series,
  modo,
  resaltadaId,
}: {
  filas: FilaApilada<K>[]
  series: Serie<K>[]
  modo: ModoValor
  resaltadaId?: string
}) {
  const totalDe = (f: FilaApilada<K>) => series.reduce((t, s) => t + f.valores[s.clave], 0)
  const maximo = Math.max(1, ...filas.map(totalDe))

  return (
    <div className="space-y-2.5">
      {filas.map((f) => {
        const total = totalDe(f)
        const escala = modo === 'cantidad' ? total / maximo : 1
        return (
          <div key={f.id} className={cn('flex items-center gap-3 transition-opacity', resaltadaId && resaltadaId !== f.id && 'opacity-35')}>
            <span className="w-10 shrink-0 text-xs font-medium text-white/70">{f.etiqueta}</span>
            <div className="min-w-0 flex-1">
              <div className="flex h-4 gap-0.5" style={{ width: `${escala * 100}%` }}>
                {series
                  .filter((s) => f.valores[s.clave] > 0)
                  .map((s) => (
                    <Segmento
                      key={s.clave}
                      titulo={f.etiqueta}
                      etiqueta={s.etiqueta}
                      color={s.color}
                      valor={f.valores[s.clave]}
                      total={total}
                      ancho={porcentajeDe(f.valores[s.clave], total)}
                    />
                  ))}
              </div>
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-white/60">{f.nota}</span>
          </div>
        )
      })}
    </div>
  )
}

export interface FilaVs {
  id: string
  etiqueta: string
  detalle?: string
  valor: number
  total: number
  resaltada?: boolean
}

function BarraVs({ fila, modo, escala, color, etiquetaValor, etiquetaTotal, atenuada }: {
  fila: FilaVs
  modo: ModoValor
  escala: number
  color: string
  etiquetaValor: string
  etiquetaTotal: string
  atenuada: boolean
}) {
  const pct = porcentajeDe(fila.valor, fila.total)
  const marca = useMarca(fila.detalle ? `${fila.etiqueta} · ${fila.detalle}` : fila.etiqueta, [
    { color, valor: `${formatValor(fila.valor)} · ${formatPct(pct)}`, etiqueta: etiquetaValor },
    { valor: formatValor(fila.total), etiqueta: etiquetaTotal },
  ])

  return (
    <div className={cn('flex items-center gap-3 transition-opacity', atenuada && 'opacity-35')}>
      <div className={cn('shrink-0 text-xs', fila.detalle ? 'w-24 sm:w-36' : 'w-10')}>
        <p className="truncate font-medium text-white/70">{fila.etiqueta}</p>
        {fila.detalle && <p className="truncate text-white/40">{fila.detalle}</p>}
      </div>
      <div className="min-w-0 flex-1">
        <div {...marca} className="h-4 rounded-[3px] bg-white/10 outline-none hover:brightness-125 focus-visible:brightness-125" style={{ width: `${escala * 100}%` }}>
          <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-white/60">
        {modo === 'cantidad' ? `${formatValor(fila.valor)} de ${formatValor(fila.total)}` : formatPct(pct)}
      </span>
    </div>
  )
}

function formatValor(n: number) {
  return String(Math.round(n))
}

/** "Parte contra total": la pista es el total y el relleno, la parte. */
export function BarrasVs({
  filas,
  modo,
  color,
  etiquetaValor,
  etiquetaTotal,
}: {
  filas: FilaVs[]
  modo: ModoValor
  color: string
  etiquetaValor: string
  etiquetaTotal: string
}) {
  const maximo = Math.max(1, ...filas.map((f) => f.total))
  const hayResaltada = filas.some((f) => f.resaltada)

  return (
    <div className="space-y-2.5">
      {filas.map((f) => (
        <BarraVs
          key={f.id}
          fila={f}
          modo={modo}
          escala={modo === 'cantidad' ? f.total / maximo : 1}
          color={color}
          etiquetaValor={etiquetaValor}
          etiquetaTotal={etiquetaTotal}
          atenuada={hayResaltada && !f.resaltada}
        />
      ))}
    </div>
  )
}

export interface ItemColumna {
  etiqueta: string
  valor: number
  color: string
  /** Texto del tooltip para esta columna; por defecto, "alumnos". */
  nombre?: string
}

function Columna({ item, maximo, total }: { item: ItemColumna; maximo: number; total: number }) {
  const pct = formatPct(porcentajeDe(item.valor, total))
  const marca = useMarca(item.etiqueta, [{ color: item.color, valor: `${item.valor} · ${pct}`, etiqueta: item.nombre ?? 'alumnos' }])

  return (
    <div {...marca} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 outline-none">
      <span className="text-[11px] tabular-nums text-white/70">{item.valor}</span>
      <div
        className="w-full max-w-6 rounded-t-[4px] group-hover:brightness-125 group-focus-visible:brightness-125"
        style={{ height: `${(item.valor / maximo) * 78}%`, minHeight: item.valor > 0 ? 2 : 0, backgroundColor: item.color }}
      />
    </div>
  )
}

export function Columnas({ items }: { items: ItemColumna[] }) {
  const maximo = Math.max(1, ...items.map((i) => i.valor))
  const total = items.reduce((t, i) => t + i.valor, 0)

  return (
    <div>
      <div className="flex h-44 items-end gap-1.5 border-b border-white/15">
        {items.map((i) => (
          <Columna key={i.etiqueta} item={i} maximo={maximo} total={total} />
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {items.map((i) => (
          <span key={i.etiqueta} className="min-w-0 flex-1 text-center text-[11px] leading-tight tabular-nums text-white/50">
            {i.etiqueta}
          </span>
        ))}
      </div>
    </div>
  )
}

export interface PuntoLinea {
  x: string
  /** Texto completo para el tooltip. */
  titulo: string
}

export interface SerieLinea {
  clave: string
  etiqueta: string
  color: string
  /** Un valor de 0 a 100 por cada punto del eje X; null si en esa clase no aplica. */
  valores: (number | null)[]
  detalle: (string | null)[]
}

const ALTO = 240
const MARGEN = { arriba: 12, derecha: 40, abajo: 24, izquierda: 38 }

/** Líneas de 0 a 100% con cruz que busca el punto más cercano. */
export function GraficoLineas({ puntos, series }: { puntos: PuntoLinea[]; series: SerieLinea[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(640)
  const [activo, setActivo] = useState<number | null>(null)
  const mostrar = useContext(TooltipContext)

  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const observador = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  const anchoPlot = Math.max(1, ancho - MARGEN.izquierda - MARGEN.derecha)
  const altoPlot = ALTO - MARGEN.arriba - MARGEN.abajo
  const posX = (i: number) => MARGEN.izquierda + (puntos.length > 1 ? (i / (puntos.length - 1)) * anchoPlot : anchoPlot / 2)
  const posY = (v: number) => MARGEN.arriba + (1 - v / 100) * altoPlot
  // Se muestran solo las etiquetas del eje X que entran.
  const saltoEjeX = Math.max(1, Math.ceil(puntos.length / Math.max(1, Math.floor(anchoPlot / 42))))

  function alMover(e: ReactPointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const relativo = puntos.length > 1 ? (e.clientX - r.left - MARGEN.izquierda) / anchoPlot : 0
    const i = Math.min(puntos.length - 1, Math.max(0, Math.round(relativo * (puntos.length - 1))))
    setActivo(i)
    mostrar({
      titulo: puntos[i].titulo,
      x: e.clientX,
      y: e.clientY,
      filas: series.flatMap((s) => {
        const valor = s.valores[i]
        return valor == null ? [] : [{ color: s.color, valor: formatPct(valor), etiqueta: `${s.etiqueta}${s.detalle[i] ? ` (${s.detalle[i]})` : ''}` }]
      }),
    })
  }

  function alSalir() {
    setActivo(null)
    mostrar(null)
  }

  const ultimoDe = (s: SerieLinea) => {
    const conValor = s.valores.flatMap((v, i) => (v == null ? [] : [{ v, i }]))
    return conValor[conValor.length - 1]
  }
  // El valor final de la primera serie va siempre; el de las otras, solo si no se pisa con ese.
  const yFinalPrincipal = series[0] && ultimoDe(series[0]) ? posY(ultimoDe(series[0]).v) : null

  return (
    <div ref={contenedor}>
      <svg
        width={ancho}
        height={ALTO}
        role="img"
        aria-label={`Porcentaje de presentes en cada clase: ${series.map((s) => s.etiqueta).join(' y ')}. Los valores están en la tabla de abajo.`}
        className="block touch-pan-y"
        onPointerDown={alMover}
        onPointerMove={alMover}
        onPointerLeave={alSalir}
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={MARGEN.izquierda} x2={MARGEN.izquierda + anchoPlot} y1={posY(v)} y2={posY(v)} stroke="rgba(255,255,255,0.08)" />
            <text x={MARGEN.izquierda - 8} y={posY(v) + 4} textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.45)">
              {v}%
            </text>
          </g>
        ))}
        {puntos.map((p, i) =>
          i % saltoEjeX === 0 ? (
            <text key={p.x} x={posX(i)} y={ALTO - 6} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.45)">
              {p.x}
            </text>
          ) : null,
        )}
        {activo != null && (
          <line x1={posX(activo)} x2={posX(activo)} y1={MARGEN.arriba} y2={MARGEN.arriba + altoPlot} stroke="rgba(255,255,255,0.3)" />
        )}
        {series.map((s, indice) => {
          const conValor = s.valores.flatMap((v, i) => (v == null ? [] : [{ v, i }]))
          const ultimo = ultimoDe(s)
          const seEtiqueta = ultimo && (indice === 0 || yFinalPrincipal == null || Math.abs(posY(ultimo.v) - yFinalPrincipal) >= 14)
          return (
            <g key={s.clave}>
              <polyline
                points={conValor.map(({ v, i }) => `${posX(i)},${posY(v)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {activo != null && s.valores[activo] != null && (
                <circle cx={posX(activo)} cy={posY(s.valores[activo]!)} r={4} fill={s.color} stroke="#10131f" strokeWidth={2} />
              )}
              {seEtiqueta && (
                <text x={posX(ultimo.i) + 8} y={posY(ultimo.v) + 4} fontSize={11} fontWeight={600} fill="rgba(255,255,255,0.75)">
                  {formatPct(ultimo.v)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
