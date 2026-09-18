import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'

export function useComisiones() {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['comisiones', profesorId],
    enabled: !!profesorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comisiones')
        .select('*')
        .eq('profesor_id', profesorId!)
        .order('nombre')
      if (error) throw error
      return data
    },
  })
}

export function useCrearComision() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (nombre: string) => {
      const { data, error } = await supabase
        .from('comisiones')
        .insert({ profesor_id: session!.user.id, nombre: nombre.trim() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comisiones'] }),
  })
}

export function useEliminarComision() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('comisiones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comisiones'] })
      qc.invalidateQueries({ queryKey: ['alumnos'] })
    },
  })
}
