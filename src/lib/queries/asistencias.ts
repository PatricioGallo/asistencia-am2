import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import type { VistaAsistenciaAlumno } from '../database.types'

export interface ColumnaClase {
  clase_id: string
  clase_nombre: string
  fecha: string
  sesion_id: string
  /** false = el profesor nunca generó código ni cargó asistencia para esta sesión (feriado, paro, etc.): no cuenta para el porcentaje. */
  dada: boolean
}

export interface CeldaAsistencia {
  id: string
  presente: boolean
  metodo?: 'codigo' | 'manual'
  comisionAsistida?: string | null
}

export interface AsistenciaComisionData {
  alumnos: VistaAsistenciaAlumno[]
  columnas: ColumnaClase[]
  // clave: `${alumno_id}:${clase_id}`
  celdas: Record<string, CeldaAsistencia>
}

export function useAsistenciaComision(comisionId: string | null) {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['asistencia-comision', profesorId, comisionId],
    enabled: !!profesorId && !!comisionId,
    queryFn: async (): Promise<AsistenciaComisionData> => {
      const [{ data: alumnos, error: errAlumnos }, { data: sesionesComision, error: errSesiones }] = await Promise.all([
        supabase.from('vista_asistencia_alumno').select('*').eq('comision_id', comisionId!).order('apellido'),
        supabase
          .from('sesion_comisiones')
          .select('sesiones(id, fecha, clase_id, clases(nombre))')
          .eq('comision_id', comisionId!),
      ])
      if (errAlumnos) throw errAlumnos
      if (errSesiones) throw errSesiones

      const sesionesBase = (sesionesComision ?? [])
        .map((sc) => sc.sesiones as unknown as { id: string; fecha: string; clase_id: string; clases: { nombre: string } | null })
        .filter((s): s is NonNullable<typeof s> => s != null)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))

      const sesionIds = sesionesBase.map((s) => s.id)
      const sesionesDadas = new Set<string>()

      if (sesionIds.length > 0) {
        // Una sesión "cuenta" si se generó un código para ella o si hay alguna
        // asistencia cargada (de cualquier alumno, aunque sea de otra comisión
        // en una clase conjunta). Si no pasó ninguna de las dos, el profesor
        // nunca la dio (feriado, paro, etc.) y se muestra con un guion.
        const [{ data: codigosRows, error: errCodigos }, { data: asistSesionRows, error: errAsistSesion }] = await Promise.all([
          supabase.from('codigos').select('sesion_id').in('sesion_id', sesionIds),
          supabase.from('asistencias').select('sesion_id').in('sesion_id', sesionIds),
        ])
        if (errCodigos) throw errCodigos
        if (errAsistSesion) throw errAsistSesion
        for (const c of codigosRows ?? []) sesionesDadas.add(c.sesion_id)
        for (const a of asistSesionRows ?? []) sesionesDadas.add(a.sesion_id)
      }

      const columnas: ColumnaClase[] = sesionesBase.map((s) => ({
        clase_id: s.clase_id,
        clase_nombre: s.clases?.nombre ?? '—',
        fecha: s.fecha,
        sesion_id: s.id,
        dada: sesionesDadas.has(s.id),
      }))

      const alumnoIds = (alumnos ?? []).map((a) => a.alumno_id)
      const celdas: Record<string, CeldaAsistencia> = {}

      if (alumnoIds.length > 0) {
        const { data: asistencias, error: errAsist } = await supabase
          .from('asistencias')
          .select('id, alumno_id, clase_id, metodo, sesiones(sesion_comisiones(comision_id, comisiones(nombre)))')
          .in('alumno_id', alumnoIds)
        if (errAsist) throw errAsist

        for (const a of asistencias ?? []) {
          const sesionInfo = a.sesiones as unknown as {
            sesion_comisiones: { comision_id: string; comisiones: { nombre: string } | null }[]
          } | null
          const comisionesAsistidas = sesionInfo?.sesion_comisiones ?? []
          const incluyeEstaComision = comisionesAsistidas.some((sc) => sc.comision_id === comisionId)

          celdas[`${a.alumno_id}:${a.clase_id}`] = {
            id: a.id,
            presente: true,
            metodo: a.metodo as 'codigo' | 'manual',
            comisionAsistida: incluyeEstaComision
              ? null
              : comisionesAsistidas.map((sc) => sc.comisiones?.nombre).filter(Boolean).join(' + '),
          }
        }
      }

      return { alumnos: alumnos ?? [], columnas, celdas }
    },
  })
}

export interface PresenteSesion {
  id: string
  alumno_id: string
  legajo: string
  nombre: string
  apellido: string
  comision_nombre: string | null
  metodo: 'codigo' | 'manual'
}

/** Alumnos presentes en una sesión puntual (pueden ser de cualquier comisión). */
export function usePresentesSesion(sesionId: string | null) {
  return useQuery({
    queryKey: ['presentes-sesion', sesionId],
    enabled: !!sesionId,
    queryFn: async (): Promise<PresenteSesion[]> => {
      const { data, error } = await supabase
        .from('asistencias')
        .select('id, alumno_id, metodo, creado_at, alumnos(legajo, nombre, apellido, comisiones(nombre))')
        .eq('sesion_id', sesionId!)
        .order('creado_at')
      if (error) throw error

      return (data ?? []).map((a) => {
        const al = a.alumnos as unknown as {
          legajo: string
          nombre: string
          apellido: string
          comisiones: { nombre: string } | null
        } | null
        return {
          id: a.id,
          alumno_id: a.alumno_id,
          legajo: al?.legajo ?? '',
          nombre: al?.nombre ?? '',
          apellido: al?.apellido ?? '',
          comision_nombre: al?.comisiones?.nombre ?? null,
          metodo: a.metodo as 'codigo' | 'manual',
        }
      })
    },
  })
}

export function useCargarAsistenciaManual() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { alumno_id: string; sesion_id: string; clase_id: string }) => {
      const { error } = await supabase.from('asistencias').insert({
        ...input,
        profesor_id: session!.user.id,
        creado_por: session!.user.id,
        metodo: 'manual',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistencia-comision'] })
      qc.invalidateQueries({ queryKey: ['presentes-sesion'] })
    },
  })
}

export function useEliminarAsistencia() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('asistencias').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistencia-comision'] })
      qc.invalidateQueries({ queryKey: ['presentes-sesion'] })
    },
  })
}
