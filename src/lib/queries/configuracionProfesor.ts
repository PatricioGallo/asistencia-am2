import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'

export interface ConfiguracionProfesor {
  mostrar_horarios: boolean
  duracion_codigo_segundos: number
  porcentaje_requerido: number
  nota_aprobacion: number
}

function queryKey(profesorId: string | undefined) {
  return ['configuracion-profesor', profesorId]
}

export function useConfiguracionProfesor() {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: queryKey(profesorId),
    enabled: !!profesorId,
    queryFn: async (): Promise<ConfiguracionProfesor> => {
      const { data, error } = await supabase
        .from('profesores')
        .select('mostrar_horarios, duracion_codigo_segundos, porcentaje_requerido, nota_aprobacion')
        .eq('id', profesorId!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useActualizarMostrarHorarios() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async (mostrar: boolean) => {
      const { error } = await supabase.from('profesores').update({ mostrar_horarios: mostrar }).eq('id', profesorId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}

export function useActualizarDuracionCodigo() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async (segundos: number) => {
      const { error } = await supabase.from('profesores').update({ duracion_codigo_segundos: segundos }).eq('id', profesorId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}

export function useActualizarPorcentajeRequerido() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async (porcentaje: number) => {
      const { error } = await supabase.from('profesores').update({ porcentaje_requerido: porcentaje }).eq('id', profesorId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}

export function useActualizarNotaAprobacion() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async (nota: number) => {
      const { error } = await supabase.from('profesores').update({ nota_aprobacion: nota }).eq('id', profesorId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}

export interface ConfiguracionParciales {
  mostrar_parciales: boolean
  dias_aviso_parciales: number
}

function parcialesQueryKey(profesorId: string | undefined) {
  return ['configuracion-parciales', profesorId]
}

/**
 * Va en una consulta aparte de useConfiguracionProfesor para que, si las
 * columnas no existen todavía en la base, falle solo lo de fechas de
 * parciales y no el resto de la configuración.
 */
export function useConfiguracionParciales() {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: parcialesQueryKey(profesorId),
    enabled: !!profesorId,
    queryFn: async (): Promise<ConfiguracionParciales> => {
      const { data, error } = await supabase
        .from('profesores')
        .select('mostrar_parciales, dias_aviso_parciales')
        .eq('id', profesorId!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useActualizarConfiguracionParciales() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async (cambios: Partial<ConfiguracionParciales>) => {
      const { error } = await supabase.from('profesores').update(cambios).eq('id', profesorId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: parcialesQueryKey(profesorId) }),
  })
}
