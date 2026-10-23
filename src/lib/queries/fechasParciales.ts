import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import type { FechaParcial } from '../database.types'

/** Sugerencias para el nombre al cargar una fecha (se puede escribir cualquier otro). */
export const NOMBRES_SUGERIDOS_PARCIAL = ['1er parcial', '2do parcial', '1ra recuperación', '2da recuperación']

function queryKey(profesorId: string | undefined) {
  return ['fechas-parciales', profesorId]
}

export function useFechasParciales() {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: queryKey(profesorId),
    enabled: !!profesorId,
    queryFn: async (): Promise<FechaParcial[]> => {
      const { data, error } = await supabase
        .from('fechas_parciales')
        .select('*')
        .eq('profesor_id', profesorId!)
        .order('fecha')
        .order('hora')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCrearFechaParcial() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async (input: { nombre: string; fecha: string; hora: string | null; aula: string | null }) => {
      const { error } = await supabase.from('fechas_parciales').insert({ ...input, profesor_id: profesorId! })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}

export function useEliminarFechaParcial() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fechas_parciales').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}
