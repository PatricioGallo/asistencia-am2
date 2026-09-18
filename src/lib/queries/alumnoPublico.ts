import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import type { SesionActivaRow } from '../database.types'

const SESION_ACTIVA_KEY = ['sesion-activa']

/** Clases en curso ahora mismo. Poll de respaldo + realtime cuando el docente genera un código. */
export function useSesionActiva() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: SESION_ACTIVA_KEY,
    refetchInterval: 5000,
    queryFn: async (): Promise<SesionActivaRow[]> => {
      const { data, error } = await supabase.rpc('sesion_activa')
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('codigos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'codigos' }, () => {
        qc.invalidateQueries({ queryKey: SESION_ACTIVA_KEY })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  return query
}

export function useAlumnoStats() {
  return useMutation({
    mutationFn: async (legajo: string) => {
      const { data, error } = await supabase.rpc('alumno_stats', { p_legajo: legajo })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

export function useRegistrarAsistencia() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { legajo: string; codigo: string }) => {
      const { data, error } = await supabase.rpc('registrar_asistencia', {
        p_legajo: input.legajo,
        p_codigo: input.codigo,
      })
      if (error) throw error
      return data?.[0] ?? null
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SESION_ACTIVA_KEY }),
  })
}
