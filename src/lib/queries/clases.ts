import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'

export function useClases() {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['clases', profesorId],
    enabled: !!profesorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clases')
        .select('*')
        .eq('profesor_id', profesorId!)
        .order('nombre')
      if (error) throw error
      return data
    },
  })
}

export interface NuevaSesionInput {
  comision_ids: string[]
  fecha: string
  hora_inicio: string
  hora_fin: string
}

export interface NuevaClaseInput {
  nombre: string
  sesiones: NuevaSesionInput[]
}

/**
 * Crea (o reutiliza) una clase por nombre y agrega una sesión por cada fila
 * indicada. Cada sesión puede tener una o varias comisiones (clase conjunta):
 * comparten la misma sesión, el mismo código y el mismo horario.
 */
export function useCrearClaseConSesiones() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const profesorId = session?.user.id

  return useMutation({
    mutationFn: async ({ nombre, sesiones }: NuevaClaseInput) => {
      const nombreTrim = nombre.trim()

      let claseId: string
      const { data: existente } = await supabase
        .from('clases')
        .select('id')
        .eq('profesor_id', profesorId!)
        .eq('nombre', nombreTrim)
        .maybeSingle()

      if (existente) {
        claseId = existente.id
      } else {
        const { data: nueva, error: errClase } = await supabase
          .from('clases')
          .insert({ profesor_id: profesorId!, nombre: nombreTrim })
          .select('id')
          .single()
        if (errClase) throw errClase
        claseId = nueva.id
      }

      for (const s of sesiones) {
        const { data: nuevaSesion, error: errSesion } = await supabase
          .from('sesiones')
          .insert({
            profesor_id: profesorId!,
            clase_id: claseId,
            fecha: s.fecha,
            hora_inicio: s.hora_inicio,
            hora_fin: s.hora_fin,
          })
          .select('id')
          .single()
        if (errSesion) throw errSesion

        const { error: errVinculo } = await supabase
          .from('sesion_comisiones')
          .insert(s.comision_ids.map((comision_id) => ({ sesion_id: nuevaSesion.id, comision_id })))
        if (errVinculo) throw errVinculo
      }

      return claseId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clases'] })
      qc.invalidateQueries({ queryKey: ['sesiones'] })
    },
  })
}
