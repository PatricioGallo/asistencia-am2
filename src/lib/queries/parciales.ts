import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import type { NotaValor } from '../notas'

export interface AlumnoNotas {
  alumno_id: string
  legajo: string
  nombre: string
  apellido: string
  porcentaje_asistencia: number
  cumple_asistencia: boolean
  parcial_1: NotaValor
  parcial_2: NotaValor
  recuperatorio_1: NotaValor
  recuperatorio_2: NotaValor
}

function combinarNota(valor: number | null, ausente: boolean): NotaValor {
  return ausente ? 'ausente' : valor
}

export function useNotasComision(comisionId: string | null) {
  const { session } = useAuth()
  const profesorId = session?.user.id

  return useQuery({
    queryKey: ['notas-comision', profesorId, comisionId],
    enabled: !!profesorId && !!comisionId,
    queryFn: async (): Promise<AlumnoNotas[]> => {
      // Misma fuente que la pantalla de Asistencia: mismos alumnos, mismo
      // orden, y de paso trae el % de asistencia ya calculado.
      const { data: alumnos, error: errAlumnos } = await supabase
        .from('vista_asistencia_alumno')
        .select('alumno_id, legajo, nombre, apellido, porcentaje, cumple_minimo')
        .eq('comision_id', comisionId!)
        .order('apellido')
      if (errAlumnos) throw errAlumnos

      const alumnoIds = (alumnos ?? []).map((a) => a.alumno_id)
      const notasPorAlumno: Record<
        string,
        Pick<
          AlumnoNotas,
          'parcial_1' | 'parcial_2' | 'recuperatorio_1' | 'recuperatorio_2'
        >
      > = {}

      if (alumnoIds.length > 0) {
        const { data: notas, error: errNotas } = await supabase
          .from('notas_parciales')
          .select(
            'alumno_id, parcial_1, parcial_1_ausente, parcial_2, parcial_2_ausente, recuperatorio_1, recuperatorio_1_ausente, recuperatorio_2, recuperatorio_2_ausente',
          )
          .in('alumno_id', alumnoIds)
        if (errNotas) throw errNotas
        for (const n of notas ?? []) {
          notasPorAlumno[n.alumno_id] = {
            parcial_1: combinarNota(n.parcial_1, n.parcial_1_ausente),
            parcial_2: combinarNota(n.parcial_2, n.parcial_2_ausente),
            recuperatorio_1: combinarNota(n.recuperatorio_1, n.recuperatorio_1_ausente),
            recuperatorio_2: combinarNota(n.recuperatorio_2, n.recuperatorio_2_ausente),
          }
        }
      }

      return (alumnos ?? []).map((a) => {
        const n = notasPorAlumno[a.alumno_id]
        return {
          alumno_id: a.alumno_id,
          legajo: a.legajo,
          nombre: a.nombre,
          apellido: a.apellido,
          porcentaje_asistencia: a.porcentaje,
          cumple_asistencia: a.cumple_minimo,
          parcial_1: n?.parcial_1 ?? null,
          parcial_2: n?.parcial_2 ?? null,
          recuperatorio_1: n?.recuperatorio_1 ?? null,
          recuperatorio_2: n?.recuperatorio_2 ?? null,
        }
      })
    },
  })
}

export interface CargarNotasInput {
  alumno_id: string
  parcial_1: NotaValor
  parcial_2: NotaValor
  recuperatorio_1: NotaValor
  recuperatorio_2: NotaValor
}

function paraGuardar(nota: NotaValor): { valor: number | null; ausente: boolean } {
  return nota === 'ausente' ? { valor: null, ausente: true } : { valor: nota, ausente: false }
}

export function useCargarNotas() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CargarNotasInput) => {
      const p1 = paraGuardar(input.parcial_1)
      const p2 = paraGuardar(input.parcial_2)
      const r1 = paraGuardar(input.recuperatorio_1)
      const r2 = paraGuardar(input.recuperatorio_2)

      const { error } = await supabase.from('notas_parciales').upsert(
        {
          alumno_id: input.alumno_id,
          profesor_id: session!.user.id,
          parcial_1: p1.valor,
          parcial_1_ausente: p1.ausente,
          parcial_2: p2.valor,
          parcial_2_ausente: p2.ausente,
          recuperatorio_1: r1.valor,
          recuperatorio_1_ausente: r1.ausente,
          recuperatorio_2: r2.valor,
          recuperatorio_2_ausente: r2.ausente,
          actualizado_at: new Date().toISOString(),
        },
        { onConflict: 'alumno_id' },
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-comision'] }),
  })
}
