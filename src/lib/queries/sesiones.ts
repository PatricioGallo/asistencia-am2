import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import { generarCodigo } from '../utils'
import type { Sesion } from '../database.types'

export type SesionConNombres = Sesion & {
  clases: { nombre: string } | null
  comisiones: { id: string; nombre: string }[]
}

type SesionRow = Sesion & {
  clases: { nombre: string } | null
  sesion_comisiones: { comisiones: { id: string; nombre: string } | null }[]
}

export function useSesionesEnRango(desde: string, hasta: string) {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['sesiones', profesorId, desde, hasta],
    enabled: !!profesorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sesiones')
        .select('*, clases(nombre), sesion_comisiones(comisiones(id, nombre))')
        .eq('profesor_id', profesorId!)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha')
        .order('hora_inicio')
      if (error) throw error
      return (data as SesionRow[]).map(({ sesion_comisiones, ...s }) => ({
        ...s,
        comisiones: sesion_comisiones.map((sc) => sc.comisiones).filter((c): c is { id: string; nombre: string } => c != null),
      })) as SesionConNombres[]
    },
  })
}

export interface ActualizarSesionInput {
  sesionId: string
  claseId: string
  nombre: string
  comisionIds: string[]
  fecha: string
  hora_inicio: string
  hora_fin: string
}

/** Renombra la clase, actualiza fecha/horario de la sesión y reemplaza sus comisiones. */
export function useActualizarSesion() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: ActualizarSesionInput) => {
      const { error: errClase } = await supabase.from('clases').update({ nombre: input.nombre.trim() }).eq('id', input.claseId)
      if (errClase) throw errClase

      const { error: errSesion } = await supabase
        .from('sesiones')
        .update({ fecha: input.fecha, hora_inicio: input.hora_inicio, hora_fin: input.hora_fin })
        .eq('id', input.sesionId)
      if (errSesion) throw errSesion

      const { error: errDelete } = await supabase.from('sesion_comisiones').delete().eq('sesion_id', input.sesionId)
      if (errDelete) throw errDelete

      const { error: errInsert } = await supabase
        .from('sesion_comisiones')
        .insert(input.comisionIds.map((comision_id) => ({ sesion_id: input.sesionId, comision_id })))
      if (errInsert) throw errInsert
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sesiones'] })
      qc.invalidateQueries({ queryKey: ['clases'] })
    },
  })
}

export function useEliminarSesion() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sesiones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sesiones'] }),
  })
}

/** Código vigente (si lo hay) para una sesión puntual. Se usa para pintar el anillo de 60s. */
export function useCodigoActivo(sesionId: string | null) {
  return useQuery({
    queryKey: ['codigo-activo', sesionId],
    enabled: !!sesionId,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('codigos')
        .select('*')
        .eq('sesion_id', sesionId!)
        .gt('expira_at', new Date().toISOString())
        .order('creado_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useGenerarCodigo() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ sesionId, duracionSegundos }: { sesionId: string; duracionSegundos: number }) => {
      const expiraAt = new Date(Date.now() + duracionSegundos * 1000).toISOString()
      const { data, error } = await supabase
        .from('codigos')
        .insert({ profesor_id: session!.user.id, sesion_id: sesionId, codigo: generarCodigo(), expira_at: expiraAt })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { sesionId }) => {
      qc.invalidateQueries({ queryKey: ['codigo-activo', sesionId] })
    },
  })
}
