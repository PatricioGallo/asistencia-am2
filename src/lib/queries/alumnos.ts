import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import type { Alumno } from '../database.types'

export interface AlumnoFiltros {
  busqueda?: string
  comisionId?: string | 'todas'
}

export function useAlumnos(filtros: AlumnoFiltros = {}) {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['alumnos', profesorId, filtros],
    enabled: !!profesorId,
    queryFn: async () => {
      let query = supabase
        .from('alumnos')
        .select('*, comisiones(nombre)')
        .eq('profesor_id', profesorId!)
        .order('apellido')

      if (filtros.comisionId && filtros.comisionId !== 'todas') {
        query = query.eq('comision_id', filtros.comisionId)
      }
      if (filtros.busqueda?.trim()) {
        const term = filtros.busqueda.trim()
        query = query.or(`nombre.ilike.%${term}%,apellido.ilike.%${term}%,legajo.ilike.%${term}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (Alumno & { comisiones: { nombre: string } | null })[]
    },
  })
}

export function useCrearAlumno() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { legajo: string; nombre: string; apellido: string; comision_id: string | null }) => {
      const { data, error } = await supabase
        .from('alumnos')
        .insert({ ...input, profesor_id: session!.user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alumnos'] }),
  })
}

export interface AlumnoCsvRow {
  legajo: string
  nombre: string
  apellido: string
  comision_id: string | null
}

export function useImportarAlumnos() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (rows: AlumnoCsvRow[]) => {
      const payload = rows.map((r) => ({ ...r, profesor_id: session!.user.id }))
      const { data, error } = await supabase
        .from('alumnos')
        .upsert(payload, { onConflict: 'profesor_id,legajo' })
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alumnos'] }),
  })
}

export function useActualizarAlumno() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...changes }: Partial<Alumno> & { id: string }) => {
      const { error } = await supabase.from('alumnos').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alumnos'] }),
  })
}

export function useEliminarAlumno() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alumnos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alumnos'] }),
  })
}
