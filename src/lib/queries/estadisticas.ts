import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import {
  calcularResumenes,
  type AsistenciaEstadistica,
  type DatosEstadisticas,
  type SesionEstadistica,
  type Situacion,
} from '../estadisticas'
import { useConfiguracionProfesor } from './configuracionProfesor'
import { combinarNota } from './parciales'

const TAMANO_PAGINA = 1000

/** PostgREST corta cada respuesta en 1000 filas: las tablas grandes se traen de a páginas. */
async function traerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const filas: T[] = []
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await pagina(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw error
    filas.push(...(data ?? []))
    if ((data?.length ?? 0) < TAMANO_PAGINA) return filas
  }
}

type SesionRow = {
  id: string
  clase_id: string
  fecha: string
  hora_inicio: string
  clases: { nombre: string } | null
  sesion_comisiones: { comision_id: string }[]
}

export function useDatosEstadisticas() {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['estadisticas', profesorId],
    enabled: !!profesorId,
    // Las asistencias y notas se cargan desde otras pantallas: al volver acá siempre se recalcula.
    refetchOnMount: 'always',
    queryFn: async (): Promise<DatosEstadisticas> => {
      const [alumnos, notas, sesiones, codigos, asistencias] = await Promise.all([
        traerTodo((desde, hasta) =>
          supabase
            .from('vista_asistencia_alumno')
            .select('alumno_id, comision_id, presentes, total_clases, porcentaje, cumple_minimo')
            .eq('profesor_id', profesorId!)
            .order('alumno_id')
            .range(desde, hasta),
        ),
        traerTodo((desde, hasta) =>
          supabase
            .from('notas_parciales')
            .select(
              'alumno_id, parcial_1, parcial_1_ausente, parcial_2, parcial_2_ausente, recuperatorio_1, recuperatorio_1_ausente, recuperatorio_2, recuperatorio_2_ausente',
            )
            .eq('profesor_id', profesorId!)
            .order('alumno_id')
            .range(desde, hasta),
        ),
        traerTodo((desde, hasta) =>
          supabase
            .from('sesiones')
            .select('id, clase_id, fecha, hora_inicio, clases(nombre), sesion_comisiones(comision_id)')
            .eq('profesor_id', profesorId!)
            .order('id')
            .range(desde, hasta),
        ) as unknown as Promise<SesionRow[]>,
        traerTodo((desde, hasta) =>
          supabase.from('codigos').select('sesion_id').eq('profesor_id', profesorId!).order('id').range(desde, hasta),
        ),
        traerTodo<AsistenciaEstadistica>((desde, hasta) =>
          supabase
            .from('asistencias')
            .select('alumno_id, sesion_id, clase_id, metodo')
            .eq('profesor_id', profesorId!)
            .order('id')
            .range(desde, hasta),
        ),
      ])

      const notasPorAlumno = new Map(notas.map((n) => [n.alumno_id, n]))
      const sesionesDadas = new Set([...codigos.map((c) => c.sesion_id), ...asistencias.map((a) => a.sesion_id)])

      return {
        alumnos: alumnos.map((a) => {
          const n = notasPorAlumno.get(a.alumno_id)
          return {
            ...a,
            parcial_1: n ? combinarNota(n.parcial_1, n.parcial_1_ausente) : null,
            parcial_2: n ? combinarNota(n.parcial_2, n.parcial_2_ausente) : null,
            recuperatorio_1: n ? combinarNota(n.recuperatorio_1, n.recuperatorio_1_ausente) : null,
            recuperatorio_2: n ? combinarNota(n.recuperatorio_2, n.recuperatorio_2_ausente) : null,
          }
        }),
        sesiones: sesiones.map(
          (s): SesionEstadistica => ({
            id: s.id,
            clase_id: s.clase_id,
            clase_nombre: s.clases?.nombre ?? '—',
            fecha: s.fecha,
            hora_inicio: s.hora_inicio,
            comision_ids: s.sesion_comisiones.map((sc) => sc.comision_id),
            dada: sesionesDadas.has(s.id),
          }),
        ),
        asistencias,
      }
    },
  })
}

/** Situación de cada alumno, por id: el mismo cálculo que la página de estadísticas. */
export function useSituaciones() {
  const { data: datos, isError } = useDatosEstadisticas()
  const { data: config } = useConfiguracionProfesor()
  const porcentajeRequerido = config?.porcentaje_requerido ?? 75
  const notaAprobacion = config?.nota_aprobacion ?? 4
  const hoy = format(new Date(), 'yyyy-MM-dd')

  const situaciones = useMemo(() => {
    if (!datos) return null
    const { situacionDe } = calcularResumenes(datos, porcentajeRequerido, notaAprobacion, hoy)
    return new Map<string, Situacion>(datos.alumnos.map((a) => [a.alumno_id, situacionDe(a)]))
  }, [datos, porcentajeRequerido, notaAprobacion, hoy])

  return { situaciones, isError }
}
