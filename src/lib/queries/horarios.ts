import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import type { Horario } from '../database.types'

export type HorarioConComisiones = Horario & { comisiones: { id: string; nombre: string }[] }

type HorarioRow = Horario & { horario_comisiones: { comisiones: { id: string; nombre: string } | null }[] }

export function useHorarios() {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['horarios', profesorId],
    enabled: !!profesorId,
    queryFn: async (): Promise<HorarioConComisiones[]> => {
      const { data, error } = await supabase
        .from('horarios')
        .select('*, horario_comisiones(comisiones(id, nombre))')
        .eq('profesor_id', profesorId!)
        .order('dia_semana')
        .order('hora_inicio')
      if (error) throw error
      return (data as HorarioRow[]).map(({ horario_comisiones, ...h }) => ({
        ...h,
        comisiones: horario_comisiones
          .map((hc) => hc.comisiones)
          .filter((c): c is { id: string; nombre: string } => c != null),
      }))
    },
  })
}

export interface NuevoHorarioInput {
  comision_ids: string[]
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  aula: string | null
}

/** Crea un horario y lo vincula a una o más comisiones (clase conjunta = mismo horario para varias). */
export function useCrearHorario() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ comision_ids, ...input }: NuevoHorarioInput) => {
      const { data: horario, error } = await supabase
        .from('horarios')
        .insert({ profesor_id: session!.user.id, ...input })
        .select('id')
        .single()
      if (error) throw error

      const { error: errVinculo } = await supabase
        .from('horario_comisiones')
        .insert(comision_ids.map((comision_id) => ({ horario_id: horario.id, comision_id })))
      if (errVinculo) throw errVinculo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['horarios'] }),
  })
}

export function useEliminarHorario() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('horarios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['horarios'] }),
  })
}

