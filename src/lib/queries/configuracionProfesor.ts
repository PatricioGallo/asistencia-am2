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
