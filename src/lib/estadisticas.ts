import type { Metodo } from './database.types'
import { calcularEstadoNotas, type NotaValor } from './notas'

/**
 * Situación de un alumno en la cursada. Cada alumno está en una sola:
 * - libre: ni yendo a todas las clases que quedan llega al % de asistencia requerido.
 * - desaprobado: agotó las instancias de parcial sin aprobar (y no está libre).
 * - regular: aprobó los parciales y cumple la asistencia.
 * - cursando: todo el resto; todavía se le puede dar vuelta para cualquier lado.
 * La asistencia pesa primero: un libre que además desaprobó cuenta como libre.
 */
export type Situacion = 'regular' | 'cursando' | 'desaprobado' | 'libre'

export type ResultadoParcial = 'aprobo' | 'desaprobo' | 'ausente' | 'sinNota'

export interface AlumnoEstadistica {
  alumno_id: string
  comision_id: string | null
  presentes: number
  total_clases: number
  porcentaje: number
  cumple_minimo: boolean
  parcial_1: NotaValor
  parcial_2: NotaValor
  recuperatorio_1: NotaValor
  recuperatorio_2: NotaValor
}

export interface SesionEstadistica {
  id: string
  clase_id: string
  clase_nombre: string
  fecha: string
  hora_inicio: string
  comision_ids: string[]
  /** Se generó código o hay asistencias cargadas: la misma regla que la vista de asistencia. */
  dada: boolean
}

export interface AsistenciaEstadistica {
  alumno_id: string
  sesion_id: string
  clase_id: string
  metodo: Metodo
}

export interface HorarioEstadistica {
  id: string
  dia_semana: number
  hora_inicio: string
  aula: string | null
  comisiones: { id: string; nombre: string }[]
}

export interface DatosEstadisticas {
  alumnos: AlumnoEstadistica[]
  sesiones: SesionEstadistica[]
  asistencias: AsistenciaEstadistica[]
}

export interface PuntoClase {
  clase_id: string
  nombre: string
  fecha: string
  presentes: number
  inscriptos: number
  /** Ningún presente se registró con código: se cargó todo a mano. */
  soloManual: boolean
}

export interface ResumenParcial {
  conteo: Record<ResultadoParcial, number>
  /** Cuántos sacaron cada nota, redondeada para abajo: el índice es la nota (0 a 10). */
  histograma: number[]
  promedio: number | null
}

export interface Resumen {
  alumnos: number
  /** Dieron presente al menos una vez. */
  activos: number
  asistenciaPromedio: number
  presentesPromedio: number
  inscriptosPromedio: number
  cumplen: number
  /** Están cursando por debajo del mínimo, pero todavía pueden llegar. */
  enRiesgo: number
  clasesProgramadas: number
  clasesDadas: number
  clasesRestantes: number
  clasesSinDar: number
  situacion: Record<Situacion, number>
  bandasAsistencia: number[]
  parcial1: ResumenParcial
  parcial2: ResumenParcial
  serie: PuntoClase[]
}

export interface ResumenHorario {
  id: string
  dia_semana: number
  hora_inicio: string
  aula: string | null
  comisiones: { id: string; nombre: string }[]
  clases: number
  presentesPromedio: number
  inscriptos: number
}

export const BANDAS_ASISTENCIA = ['0%', '1–24%', '25–49%', '50–74%', '75–100%']

function indiceBanda(porcentaje: number) {
  if (porcentaje <= 0) return 0
  if (porcentaje < 25) return 1
  if (porcentaje < 50) return 2
  if (porcentaje < 75) return 3
  return 4
}

export function calcularSituacion(
  a: AlumnoEstadistica,
  clasesRestantes: number,
  porcentajeRequerido: number,
  notaAprobacion: number,
): Situacion {
  const totalPosible = a.total_clases + clasesRestantes
  const mejorPorcentaje = totalPosible === 0 ? 100 : (100 * (a.presentes + clasesRestantes)) / totalPosible
  if (mejorPorcentaje < porcentajeRequerido) return 'libre'

  const { estado } = calcularEstadoNotas(a.parcial_1, a.parcial_2, a.recuperatorio_1, a.recuperatorio_2, notaAprobacion)
  if (estado === 'desaprobado') return 'desaprobado'
  if (estado === 'aprobado' && a.cumple_minimo) return 'regular'
  return 'cursando'
}

function resumirParcial(notas: NotaValor[], notaAprobacion: number): ResumenParcial {
  const conteo: Record<ResultadoParcial, number> = { aprobo: 0, desaprobo: 0, ausente: 0, sinNota: 0 }
  const histograma = Array.from({ length: 11 }, () => 0)
  let suma = 0
  let rindieron = 0

  for (const nota of notas) {
    if (nota == null) conteo.sinNota++
    else if (nota === 'ausente') conteo.ausente++
    else {
      conteo[nota >= notaAprobacion ? 'aprobo' : 'desaprobo']++
      histograma[Math.floor(nota)]++
      suma += nota
      rindieron++
    }
  }

  return { conteo, histograma, promedio: rindieron > 0 ? suma / rindieron : null }
}

/**
 * Prepara las consultas que se repiten para cada alumno: qué clases se dieron
 * en cada comisión, cuáles quedan por dar y a cuáles fue cada alumno.
 */
function indexar({ sesiones, asistencias }: DatosEstadisticas, hoy: string) {
  const clases = new Map<
    string,
    { nombre: string; fecha: string; fechaEn: Map<string, string>; comisiones: Set<string>; dadaEn: Set<string>; algunaFutura: Set<string> }
  >()

  for (const s of [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    let clase = clases.get(s.clase_id)
    if (!clase) {
      clase = { nombre: s.clase_nombre, fecha: s.fecha, fechaEn: new Map(), comisiones: new Set(), dadaEn: new Set(), algunaFutura: new Set() }
      clases.set(s.clase_id, clase)
    }
    for (const c of s.comision_ids) {
      clase.comisiones.add(c)
      if (!clase.fechaEn.has(c)) clase.fechaEn.set(c, s.fecha)
      if (s.dada) clase.dadaEn.add(c)
      else if (s.fecha >= hoy) clase.algunaFutura.add(c)
    }
  }

  const asistio = new Map<string, Set<string>>()
  const asistioConCodigo = new Set<string>()
  for (const a of asistencias) {
    if (!asistio.has(a.alumno_id)) asistio.set(a.alumno_id, new Set())
    asistio.get(a.alumno_id)!.add(a.clase_id)
    if (a.metodo === 'codigo') asistioConCodigo.add(`${a.alumno_id}:${a.clase_id}`)
  }

  return { clases, asistio, asistioConCodigo }
}

export function calcularResumenes(
  datos: DatosEstadisticas,
  porcentajeRequerido: number,
  notaAprobacion: number,
  hoy: string,
) {
  const { clases, asistio, asistioConCodigo } = indexar(datos, hoy)

  /** Igual que la vista: un alumno sin comisión cuenta las clases de todas. */
  const incluye = (conjunto: Set<string>, comisionId: string | null) => (comisionId ? conjunto.has(comisionId) : conjunto.size > 0)

  function restantesDe(a: AlumnoEstadistica) {
    let n = 0
    for (const [claseId, clase] of clases) {
      if (incluye(clase.algunaFutura, a.comision_id) && !incluye(clase.dadaEn, a.comision_id) && !asistio.get(a.alumno_id)?.has(claseId)) n++
    }
    return n
  }

  function resumir(alumnos: AlumnoEstadistica[], comisionId: string | null): Resumen {
    const situacion: Record<Situacion, number> = { regular: 0, cursando: 0, desaprobado: 0, libre: 0 }
    const bandasAsistencia = BANDAS_ASISTENCIA.map(() => 0)
    let enRiesgo = 0

    for (const a of alumnos) {
      const s = calcularSituacion(a, restantesDe(a), porcentajeRequerido, notaAprobacion)
      situacion[s]++
      if (s === 'cursando' && !a.cumple_minimo) enRiesgo++
      bandasAsistencia[indiceBanda(a.porcentaje)]++
    }

    const serie: PuntoClase[] = []
    let clasesProgramadas = 0
    let clasesRestantes = 0
    let clasesSinDar = 0

    for (const [claseId, clase] of clases) {
      if (comisionId && !clase.comisiones.has(comisionId)) continue
      clasesProgramadas++

      let inscriptos = 0
      let presentes = 0
      let conCodigo = false
      for (const a of alumnos) {
        if (!incluye(clase.dadaEn, a.comision_id)) continue
        inscriptos++
        if (asistio.get(a.alumno_id)?.has(claseId)) presentes++
        if (asistioConCodigo.has(`${a.alumno_id}:${claseId}`)) conCodigo = true
      }

      if (inscriptos > 0) {
        const fecha = (comisionId && clase.fechaEn.get(comisionId)) || clase.fecha
        serie.push({ clase_id: claseId, nombre: clase.nombre, fecha, presentes, inscriptos, soloManual: !conCodigo })
      }
      else if (incluye(clase.algunaFutura, comisionId)) clasesRestantes++
      else clasesSinDar++
    }

    const sumar = (f: (p: PuntoClase) => number) => serie.reduce((t, p) => t + f(p), 0)

    return {
      alumnos: alumnos.length,
      activos: alumnos.filter((a) => a.presentes > 0).length,
      asistenciaPromedio: alumnos.length > 0 ? alumnos.reduce((t, a) => t + a.porcentaje, 0) / alumnos.length : 0,
      presentesPromedio: serie.length > 0 ? sumar((p) => p.presentes) / serie.length : 0,
      inscriptosPromedio: serie.length > 0 ? sumar((p) => p.inscriptos) / serie.length : 0,
      cumplen: alumnos.filter((a) => a.cumple_minimo).length,
      enRiesgo,
      clasesProgramadas,
      clasesDadas: serie.length,
      clasesRestantes,
      clasesSinDar,
      situacion,
      bandasAsistencia,
      parcial1: resumirParcial(alumnos.map((a) => a.parcial_1), notaAprobacion),
      parcial2: resumirParcial(alumnos.map((a) => a.parcial_2), notaAprobacion),
      serie,
    }
  }

  return { resumir }
}

/**
 * Presentes por horario: cuenta a todos los que fueron a esa sesión, sean de la
 * comisión que sean. Las sesiones se asocian al horario igual que la concurrencia
 * del home: mismo día, misma hora y alguna comisión en común.
 */
export function calcularHorarios(datos: DatosEstadisticas, horarios: HorarioEstadistica[], hoy: string): ResumenHorario[] {
  const presentesPorSesion = new Map<string, number>()
  for (const a of datos.asistencias) presentesPorSesion.set(a.sesion_id, (presentesPorSesion.get(a.sesion_id) ?? 0) + 1)

  const alumnosPorComision = new Map<string, number>()
  for (const a of datos.alumnos) {
    if (a.comision_id) alumnosPorComision.set(a.comision_id, (alumnosPorComision.get(a.comision_id) ?? 0) + 1)
  }

  return horarios.map((h) => {
    const comisionIds = new Set(h.comisiones.map((c) => c.id))
    const sesiones = datos.sesiones.filter(
      (s) =>
        s.dada &&
        s.fecha <= hoy &&
        diaSemanaIso(s.fecha) === h.dia_semana &&
        s.hora_inicio === h.hora_inicio &&
        s.comision_ids.some((c) => comisionIds.has(c)),
    )
    const totalPresentes = sesiones.reduce((t, s) => t + (presentesPorSesion.get(s.id) ?? 0), 0)

    return {
      id: h.id,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      aula: h.aula,
      comisiones: h.comisiones,
      clases: sesiones.length,
      presentesPromedio: sesiones.length > 0 ? totalPresentes / sesiones.length : 0,
      inscriptos: h.comisiones.reduce((t, c) => t + (alumnosPorComision.get(c.id) ?? 0), 0),
    }
  })
}

function diaSemanaIso(fecha: string) {
  return new Date(`${fecha}T00:00:00`).getDay() || 7
}
