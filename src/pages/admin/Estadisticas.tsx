import { useMemo, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { BarChart3 } from 'lucide-react'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import {
  BarraFina,
  BarrasApiladas,
  BarrasVs,
  Columnas,
  formatPct,
  GraficoLineas,
  Leyenda,
  porcentajeDe,
  TooltipProvider,
  type ModoValor,
  type Serie,
} from '@/components/Graficos'
import { cn, DIAS_SEMANA, formatFecha, formatHora, formatNota } from '@/lib/utils'
import {
  BANDAS_ASISTENCIA,
  calcularHorarios,
  calcularResumenes,
  type ResultadoParcial,
  type Resumen,
  type ResumenParcial,
  type Situacion,
} from '@/lib/estadisticas'
import { useComisiones } from '@/lib/queries/comisiones'
import { useConfiguracionProfesor } from '@/lib/queries/configuracionProfesor'
import { useDatosEstadisticas } from '@/lib/queries/estadisticas'
import { useHorarios } from '@/lib/queries/horarios'

// Paleta validada contra la superficie de la app (contraste y daltonismo), en este orden.
// Ámbar = problema de asistencia, rojo = problema de notas, en todos los gráficos.
const SERIES_SITUACION: Serie<Situacion>[] = [
  { clave: 'regular', etiqueta: 'Regulares', color: '#0ca30c' },
  { clave: 'cursando', etiqueta: 'Siguen cursando', color: '#6366f1' },
  { clave: 'desaprobado', etiqueta: 'Desaprobados', color: '#d03b3b' },
  { clave: 'libre', etiqueta: 'Libres', color: '#c98500' },
]

const SERIES_PARCIAL: Serie<ResultadoParcial>[] = [
  { clave: 'aprobo', etiqueta: 'Aprobaron', color: '#0891b2' },
  { clave: 'desaprobo', etiqueta: 'Desaprobaron', color: '#d03b3b' },
  { clave: 'ausente', etiqueta: 'Ausentes', color: '#c98500' },
  { clave: 'sinNota', etiqueta: 'Sin nota', color: 'rgba(255,255,255,0.14)' },
]

const COLOR_PRINCIPAL = '#6366f1'
const COLOR_CONTEXTO = '#7d8299'

function nombreCorto(nombreClase: string) {
  return nombreClase.includes(':') ? nombreClase.split(':')[0].trim() : nombreClase
}

export function Estadisticas() {
  const { data: comisiones } = useComisiones()
  const { data: config } = useConfiguracionProfesor()
  const { data: horarios } = useHorarios()
  const { data: datos, isLoading, isError } = useDatosEstadisticas()

  const [comisionId, setComisionId] = useState('todas')
  const [modo, setModo] = useState<ModoValor>('cantidad')

  const porcentajeRequerido = config?.porcentaje_requerido ?? 75
  const notaAprobacion = config?.nota_aprobacion ?? 4
  const hoy = format(new Date(), 'yyyy-MM-dd')

  const calculo = useMemo(() => {
    if (!datos) return null
    const { resumir } = calcularResumenes(datos, porcentajeRequerido, notaAprobacion, hoy)
    return {
      general: resumir(datos.alumnos, null),
      porComision: (comisiones ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        resumen: resumir(datos.alumnos.filter((a) => a.comision_id === c.id), c.id),
      })),
      horarios: calcularHorarios(datos, horarios ?? [], hoy),
    }
  }, [datos, comisiones, horarios, porcentajeRequerido, notaAprobacion, hoy])

  const seleccionada = calculo?.porComision.find((c) => c.id === comisionId)
  const resumen = seleccionada?.resumen ?? calculo?.general
  const resaltadaId = seleccionada?.id

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Estadísticas</CardTitle>
              <CardSubtitle>
                {seleccionada ? `Comisión ${seleccionada.nombre}` : 'Todas las comisiones'} · Datos al {formatFecha(hoy)}
              </CardSubtitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input-field w-auto" value={comisionId} onChange={(e) => setComisionId(e.target.value)}>
                <option value="todas">Todas las comisiones</option>
                {comisiones?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <div className="flex rounded-2xl border border-white/10 bg-white/[0.04] p-1" role="group" aria-label="Ver los gráficos en">
                {(
                  [
                    ['cantidad', 'Cantidad'],
                    ['porcentaje', 'Porcentaje'],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    onClick={() => setModo(valor)}
                    aria-pressed={modo === valor}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white',
                      modo === valor && 'bg-white/10 text-white',
                    )}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card>
            <p className="p-4 text-center text-white/40">Cargando…</p>
          </Card>
        ) : isError ? (
          <Card>
            <p className="p-4 text-center text-white/50">No pudimos cargar las estadísticas. Probá de nuevo en un rato.</p>
          </Card>
        ) : !calculo || !resumen || resumen.alumnos === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <BarChart3 className="size-8 text-white/20" />
              <p className="text-white/50">Todavía no hay alumnos para mostrar.</p>
            </div>
          </Card>
        ) : (
          <>
            <Indicadores resumen={resumen} porcentajeRequerido={porcentajeRequerido} />
            <SituacionGeneral resumen={resumen} porcentajeRequerido={porcentajeRequerido} />

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel titulo="Situación por comisión" subtitulo="A la derecha, los libres de cada comisión.">
                <BarrasApiladas
                  series={SERIES_SITUACION}
                  modo={modo}
                  resaltadaId={resaltadaId}
                  filas={calculo.porComision.map((c) => ({
                    id: c.id,
                    etiqueta: c.nombre,
                    valores: c.resumen.situacion,
                    nota: notaValor(c.resumen.situacion.libre, c.resumen.alumnos, modo),
                  }))}
                />
                <div className="mt-4">
                  <Leyenda series={SERIES_SITUACION} />
                </div>
              </Panel>

              <Panel titulo="Alumnos vs presentes por comisión" subtitulo="Presentes en promedio por clase dada, sobre los alumnos de la comisión.">
                <BarrasVs
                  modo={modo}
                  color={COLOR_PRINCIPAL}
                  etiquetaValor="presentes por clase"
                  etiquetaTotal="alumnos"
                  filas={calculo.porComision.map((c) => ({
                    id: c.id,
                    etiqueta: c.nombre,
                    valor: c.resumen.presentesPromedio,
                    total: c.resumen.alumnos,
                    resaltada: c.id === resaltadaId,
                  }))}
                />
              </Panel>

              <Panel titulo="Parcial 1 por comisión" subtitulo="Nota del parcial, sin contar recuperatorios. A la derecha, los que aprobaron.">
                <BarrasParcial porComision={calculo.porComision} parcial="parcial1" modo={modo} resaltadaId={resaltadaId} />
              </Panel>

              {calculo.general.parcial2.conteo.sinNota < calculo.general.alumnos ? (
                <Panel titulo="Parcial 2 por comisión" subtitulo="Nota del parcial, sin contar recuperatorios. A la derecha, los que aprobaron.">
                  <BarrasParcial porComision={calculo.porComision} parcial="parcial2" modo={modo} resaltadaId={resaltadaId} />
                </Panel>
              ) : null}

              <Panel titulo="Alumnos vs presentes por horario" subtitulo="Cuánta gente va a cada horario, contando a los que vienen de otra comisión.">
                <BarrasVs
                  modo={modo}
                  color={COLOR_PRINCIPAL}
                  etiquetaValor="presentes por clase"
                  etiquetaTotal="alumnos en las comisiones del horario"
                  filas={calculo.horarios.map((h) => ({
                    id: h.id,
                    etiqueta: `${DIAS_SEMANA[h.dia_semana - 1]} ${formatHora(h.hora_inicio)}`,
                    detalle: `${h.comisiones.map((c) => c.nombre).join(' + ')}${h.aula ? ` · Aula ${h.aula}` : ''}`,
                    valor: h.presentesPromedio,
                    total: h.inscriptos,
                    resaltada: h.comisiones.some((c) => c.id === resaltadaId),
                  }))}
                />
              </Panel>
            </div>

            <Evolucion
              resumen={resumen}
              general={calculo.general}
              nombreSeleccionada={seleccionada?.nombre}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel titulo="Distribución de la asistencia" subtitulo={`Alumnos según su porcentaje de asistencia. Se necesita ${porcentajeRequerido}%.`}>
                <Columnas items={BANDAS_ASISTENCIA.map((b, i) => ({ etiqueta: b, valor: resumen.bandasAsistencia[i], color: COLOR_PRINCIPAL }))} />
              </Panel>
              <PanelNotas parcial={resumen.parcial1} titulo="Notas del Parcial 1" notaAprobacion={notaAprobacion} />
              {resumen.parcial2.promedio != null && <PanelNotas parcial={resumen.parcial2} titulo="Notas del Parcial 2" notaAprobacion={notaAprobacion} />}
            </div>

            <TablaComisiones general={calculo.general} porComision={calculo.porComision} resaltadaId={resaltadaId} />
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

function notaValor(valor: number, total: number, modo: ModoValor) {
  return modo === 'cantidad' ? String(valor) : formatPct(porcentajeDe(valor, total))
}

function conPorcentaje(valor: number, total: number) {
  return `${valor} · ${formatPct(porcentajeDe(valor, total))}`
}

function Panel({ titulo, subtitulo, children, className }: { titulo: string; subtitulo?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <h3 className="font-display text-base font-semibold text-white">{titulo}</h3>
      {subtitulo && <p className="mt-1 text-xs text-white/50">{subtitulo}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  )
}

function Indicadores({ resumen, porcentajeRequerido }: { resumen: Resumen; porcentajeRequerido: number }) {
  const { alumnos, activos, asistenciaPromedio, presentesPromedio, inscriptosPromedio, cumplen, clasesDadas, clasesProgramadas, clasesRestantes, clasesSinDar } = resumen

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Card className="p-4">
        <Stat label="Alumnos" value={String(alumnos)} detalle="En la lista" />
      </Card>
      <Card className="p-4">
        <Stat label="Vinieron alguna vez" value={String(activos)} detalle={`${formatPct(porcentajeDe(activos, alumnos))} · ${alumnos - activos} nunca`} />
      </Card>
      <Card className="p-4">
        <Stat label="Asistencia promedio" value={formatPct(asistenciaPromedio)} detalle={`Se necesita ${porcentajeRequerido}%`} />
      </Card>
      <Card className="p-4">
        <Stat
          label="Presentes por clase"
          value={String(Math.round(presentesPromedio))}
          detalle={`${formatPct(porcentajeDe(presentesPromedio, inscriptosPromedio))} de los alumnos`}
        />
      </Card>
      <Card className="p-4">
        <Stat label={`Cumplen el ${porcentajeRequerido}%`} value={String(cumplen)} detalle={`${formatPct(porcentajeDe(cumplen, alumnos))} de los alumnos`} />
      </Card>
      <Card className="p-4">
        <Stat
          label="Clases dadas"
          value={`${clasesDadas} de ${clasesProgramadas}`}
          detalle={`${clasesRestantes} por dar${clasesSinDar > 0 ? ` · ${clasesSinDar} sin clase` : ''}`}
        />
      </Card>
    </div>
  )
}

const DESCRIPCION_SITUACION: Record<Situacion, (porcentaje: number) => string> = {
  regular: (p) => `Aprobaron los parciales y tienen ${p}% de asistencia.`,
  cursando: () => 'Todavía pueden terminar como regulares.',
  desaprobado: () => 'Agotaron los parciales y recuperatorios sin aprobar.',
  libre: (p) => `Aunque vengan a todas las clases que quedan, no llegan al ${p}%.`,
}

function SituacionGeneral({ resumen, porcentajeRequerido }: { resumen: Resumen; porcentajeRequerido: number }) {
  const sinDefinir = resumen.situacion.regular + resumen.situacion.desaprobado === 0

  return (
    <Panel titulo="Situación de los alumnos">
      <BarraFina series={SERIES_SITUACION} valores={resumen.situacion} />
      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SERIES_SITUACION.map((s) => (
          <li key={s.clave}>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} />
              {s.etiqueta}
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-white">
              {resumen.situacion[s.clave]}
              <span className="ml-2 text-base font-medium text-white/50">{formatPct(porcentajeDe(resumen.situacion[s.clave], resumen.alumnos))}</span>
            </p>
            <p className="mt-1 text-xs text-white/50">
              {DESCRIPCION_SITUACION[s.clave](porcentajeRequerido)}
              {s.clave === 'cursando' && resumen.enRiesgo > 0 && ` ${resumen.enRiesgo} están hoy por debajo del ${porcentajeRequerido}%.`}
            </p>
          </li>
        ))}
      </ul>
      {sinDefinir && (
        <p className="mt-5 border-t border-white/10 pt-4 text-xs text-white/50">
          Todavía no hay regulares ni desaprobados: esas situaciones se definen cuando están cargadas las notas de los dos
          parciales y sus recuperatorios.
        </p>
      )}
    </Panel>
  )
}

function BarrasParcial({
  porComision,
  parcial,
  modo,
  resaltadaId,
}: {
  porComision: { id: string; nombre: string; resumen: Resumen }[]
  parcial: 'parcial1' | 'parcial2'
  modo: ModoValor
  resaltadaId?: string
}) {
  return (
    <>
      <BarrasApiladas
        series={SERIES_PARCIAL}
        modo={modo}
        resaltadaId={resaltadaId}
        filas={porComision.map((c) => ({
          id: c.id,
          etiqueta: c.nombre,
          valores: c.resumen[parcial].conteo,
          nota: notaValor(c.resumen[parcial].conteo.aprobo, c.resumen.alumnos, modo),
        }))}
      />
      <div className="mt-4">
        <Leyenda series={SERIES_PARCIAL} />
      </div>
    </>
  )
}

function PanelNotas({ parcial, titulo, notaAprobacion }: { parcial: ResumenParcial; titulo: string; notaAprobacion: number }) {
  const rindieron = parcial.conteo.aprobo + parcial.conteo.desaprobo
  const aprobacion = SERIES_PARCIAL[0]
  const desaprobacion = SERIES_PARCIAL[1]

  return (
    <Panel
      titulo={titulo}
      subtitulo={
        parcial.promedio == null
          ? 'Todavía no hay notas cargadas.'
          : `${rindieron} rindieron · ${formatPct(porcentajeDe(parcial.conteo.aprobo, rindieron))} aprobó · Promedio ${formatNota(parcial.promedio)} · ${parcial.conteo.ausente} ausentes`
      }
    >
      <Columnas
        items={parcial.histograma.map((valor, nota) => {
          const serie = nota >= Math.floor(notaAprobacion) ? aprobacion : desaprobacion
          return { etiqueta: String(nota), valor, color: serie.color, nombre: serie.etiqueta.toLowerCase() }
        })}
      />
      <div className="mt-4">
        <Leyenda series={[aprobacion, desaprobacion]} />
      </div>
    </Panel>
  )
}

function Evolucion({ resumen, general, nombreSeleccionada }: { resumen: Resumen; general: Resumen; nombreSeleccionada?: string }) {
  // El eje X son todas las clases dadas: una comisión puede no haber tenido alguna (paro, feriado).
  const puntos = general.serie.map((p) => ({ x: nombreCorto(p.nombre), titulo: p.nombre, clase_id: p.clase_id }))

  function armarSerie(clave: string, etiqueta: string, color: string, r: Resumen) {
    const porClase = new Map(r.serie.map((p) => [p.clase_id, p]))
    return {
      clave,
      etiqueta,
      color,
      valores: puntos.map((x) => {
        const p = porClase.get(x.clase_id)
        return p ? porcentajeDe(p.presentes, p.inscriptos) : null
      }),
      detalle: puntos.map((x) => {
        const p = porClase.get(x.clase_id)
        return p ? `${p.presentes} de ${p.inscriptos}` : null
      }),
    }
  }

  const series = nombreSeleccionada
    ? [armarSerie('comision', nombreSeleccionada, COLOR_PRINCIPAL, resumen), armarSerie('todas', 'Todas las comisiones', COLOR_CONTEXTO, general)]
    : [armarSerie('todas', 'Todas las comisiones', COLOR_PRINCIPAL, general)]

  const clasesManuales = resumen.serie.filter((p) => p.soloManual).length

  return (
    <Panel titulo="Evolución de la asistencia" subtitulo="Porcentaje de alumnos presentes en cada clase, en orden de cursada.">
      {puntos.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">Todavía no se dio ninguna clase.</p>
      ) : (
        <>
          <GraficoLineas puntos={puntos} series={series} />
          {series.length > 1 && (
            <div className="mt-3">
              <Leyenda series={series} />
            </div>
          )}
          {clasesManuales > 0 && (
            <p className="mt-3 text-xs text-white/50">
              {clasesManuales} de {resumen.serie.length} clases se cargaron enteras a mano. Si esa carga se hizo en bloque, sus
              presentes no muestran quién fue cada día, y pesan en el promedio de presentes por clase.
            </p>
          )}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-xs text-white/50 hover:text-white/80">Ver los números de cada clase</summary>
            <div className="mt-3 max-h-72 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 uppercase tracking-wide text-white/40">
                    <th className="py-2 pr-4 font-medium">Clase</th>
                    <th className="py-2 pr-4 font-medium">Fecha</th>
                    <th className="py-2 pr-4 font-medium">Carga</th>
                    <th className="py-2 pr-4 text-right font-medium">Presentes</th>
                    <th className="py-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.serie.map((p) => (
                    <tr key={p.clase_id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-4 text-white/80">{p.nombre}</td>
                      <td className="py-2 pr-4 text-white/50">{formatFecha(p.fecha)}</td>
                      <td className="py-2 pr-4 text-white/50">{p.soloManual ? 'A mano' : 'Con código'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-white/70">
                        {p.presentes} de {p.inscriptos}
                      </td>
                      <td className="py-2 text-right tabular-nums text-white">{formatPct(porcentajeDe(p.presentes, p.inscriptos))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Panel>
  )
}

const COLUMNAS_TABLA: { titulo: string; valor: (r: Resumen) => string }[] = [
  { titulo: 'Alumnos', valor: (r) => String(r.alumnos) },
  { titulo: 'Libres', valor: (r) => conPorcentaje(r.situacion.libre, r.alumnos) },
  { titulo: 'Cursando', valor: (r) => conPorcentaje(r.situacion.cursando, r.alumnos) },
  { titulo: 'Regulares', valor: (r) => conPorcentaje(r.situacion.regular, r.alumnos) },
  { titulo: 'Desaprob.', valor: (r) => conPorcentaje(r.situacion.desaprobado, r.alumnos) },
  { titulo: 'Vinieron alguna vez', valor: (r) => conPorcentaje(r.activos, r.alumnos) },
  { titulo: 'Presentes por clase', valor: (r) => `${Math.round(r.presentesPromedio)} · ${formatPct(porcentajeDe(r.presentesPromedio, r.inscriptosPromedio))}` },
  { titulo: 'Asist. promedio', valor: (r) => formatPct(r.asistenciaPromedio) },
  { titulo: 'Aprobaron P1', valor: (r) => conPorcentaje(r.parcial1.conteo.aprobo, r.alumnos) },
  { titulo: 'Promedio P1', valor: (r) => (r.parcial1.promedio == null ? '—' : formatNota(r.parcial1.promedio)) },
]

function TablaComisiones({
  general,
  porComision,
  resaltadaId,
}: {
  general: Resumen
  porComision: { id: string; nombre: string; resumen: Resumen }[]
  resaltadaId?: string
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="p-6 pb-4">
        <h3 className="font-display text-base font-semibold text-white">Todos los números por comisión</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
              <th className="table-sticky-col px-5 py-3 font-medium">Comisión</th>
              {COLUMNAS_TABLA.map((c) => (
                <th key={c.titulo} className="px-3 py-3 text-right align-bottom font-medium">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {porComision.map((c) => (
              <tr key={c.id} className={cn('border-b border-white/5 hover:bg-white/[0.02]', c.id === resaltadaId && 'bg-white/[0.06]')}>
                <td className="table-sticky-col px-5 py-3 font-medium text-white">{c.nombre}</td>
                {COLUMNAS_TABLA.map((col) => (
                  <td key={col.titulo} className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-white/70">
                    {col.valor(c.resumen)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/15">
              <td className="table-sticky-col px-5 py-3 font-semibold text-white">Total</td>
              {COLUMNAS_TABLA.map((col) => (
                <td key={col.titulo} className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-white">
                  {col.valor(general)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
