import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import type { Notificacion } from '../database.types'

function queryKey(profesorId: string | undefined) {
  return ['notificaciones', profesorId]
}

/**
 * Últimas notificaciones del docente. Se actualiza en vivo (Realtime) y, de
 * respaldo, cada 30 segundos.
 */
export function useNotificaciones() {
  const { session } = useAuth()
  const profesorId = session?.user.id
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKey(profesorId),
    enabled: !!profesorId,
    refetchInterval: 30_000,
    retry: false,
    queryFn: async (): Promise<Notificacion[]> => {
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('profesor_id', profesorId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (!profesorId) return
    const channel = supabase
      .channel(`notificaciones-${profesorId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `profesor_id=eq.${profesorId}` },
        () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [profesorId, qc])

  return query
}

export function useMarcarNotificacionesLeidas() {
  const { session } = useAuth()
  const profesorId = session?.user.id
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('profesor_id', profesorId!)
        .eq('leida', false)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}

export function useBorrarNotificaciones() {
  const { session } = useAuth()
  const profesorId = session?.user.id
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notificaciones').delete().eq('profesor_id', profesorId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(profesorId) }),
  })
}

/** Crea una notificación de prueba (llega a la campanita y, si está activado, al celular). */
export function useNotificacionDePrueba() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('notificacion_de_prueba')
      if (error) throw error
    },
  })
}
