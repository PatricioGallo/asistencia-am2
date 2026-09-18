// Tipos escritos a mano, reflejando supabase/schema.sql.
// Si el esquema cambia, actualizar acá (o generar con `supabase gen types typescript`).

export type Metodo = 'codigo' | 'manual'

export interface Profesor {
  id: string
  email: string
  nombre: string | null
  mostrar_horarios: boolean
  duracion_codigo_segundos: number
  porcentaje_requerido: number
  created_at: string
}

export interface Comision {
  id: string
  profesor_id: string
  nombre: string
  created_at: string
}

export interface Alumno {
  id: string
  profesor_id: string
  legajo: string
  nombre: string
  apellido: string
  comision_id: string | null
  created_at: string
}

export interface Clase {
  id: string
  profesor_id: string
  nombre: string
  created_at: string
}

export interface Sesion {
  id: string
  profesor_id: string
  clase_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  created_at: string
}

export interface SesionComision {
  sesion_id: string
  comision_id: string
}

export interface Horario {
  id: string
  profesor_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  aula: string | null
  created_at: string
}

export interface HorarioComision {
  horario_id: string
  comision_id: string
}

export interface Codigo {
  id: string
  profesor_id: string
  sesion_id: string
  codigo: string
  creado_at: string
  expira_at: string
}

export interface Asistencia {
  id: string
  profesor_id: string
  alumno_id: string
  sesion_id: string
  clase_id: string
  metodo: Metodo
  creado_at: string
  creado_por: string | null
}

export interface VistaAsistenciaAlumno {
  alumno_id: string
  profesor_id: string
  legajo: string
  nombre: string
  apellido: string
  comision_id: string | null
  comision_nombre: string | null
  total_clases: number
  presentes: number
  porcentaje: number
  cumple_minimo: boolean
}

export interface SesionActivaRow {
  sesion_id: string
  clase_nombre: string
  comision_nombre: string
  hora_inicio: string
  hora_fin: string
  codigo_activo: boolean
  expira_at: string | null
  duracion_codigo_segundos: number
}

export interface BuscarAlumnosRow {
  alumno_id: string
  legajo: string
  nombre: string
  apellido: string
  comision_nombre: string | null
  presentes: number
  total_clases: number
  porcentaje: number
}

export interface HorarioPublicoRow {
  comision_nombre: string | null
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  aula: string | null
}

export interface ClaseAsistidaJson {
  clase_nombre: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  metodo: Metodo
}

export interface MisAsistenciasRow {
  alumno_id: string
  legajo: string
  nombre: string
  apellido: string
  comision_nombre: string | null
  presentes: number
  total_clases: number
  porcentaje: number
  clases: ClaseAsistidaJson[]
}

export interface RegistrarAsistenciaRow {
  ok: boolean
  mensaje: string
  nombre: string | null
  apellido: string | null
  presentes: number | null
  total_clases: number | null
  porcentaje: number | null
}

export interface Database {
  public: {
    Tables: {
      profesores: {
        Row: Profesor
        Insert: Partial<Profesor> & { id: string; email: string }
        Update: Partial<Profesor>
        Relationships: []
      }
      comisiones: {
        Row: Comision
        Insert: Partial<Comision> & { profesor_id: string; nombre: string }
        Update: Partial<Comision>
        Relationships: []
      }
      alumnos: {
        Row: Alumno
        Insert: Partial<Alumno> & {
          profesor_id: string
          legajo: string
          nombre: string
          apellido: string
        }
        Update: Partial<Alumno>
        Relationships: []
      }
      clases: {
        Row: Clase
        Insert: Partial<Clase> & { profesor_id: string; nombre: string }
        Update: Partial<Clase>
        Relationships: []
      }
      sesiones: {
        Row: Sesion
        Insert: Partial<Sesion> & {
          profesor_id: string
          clase_id: string
          fecha: string
          hora_inicio: string
          hora_fin: string
        }
        Update: Partial<Sesion>
        Relationships: []
      }
      sesion_comisiones: {
        Row: SesionComision
        Insert: SesionComision
        Update: Partial<SesionComision>
        Relationships: []
      }
      horarios: {
        Row: Horario
        Insert: Partial<Horario> & {
          profesor_id: string
          dia_semana: number
          hora_inicio: string
          hora_fin: string
        }
        Update: Partial<Horario>
        Relationships: []
      }
      horario_comisiones: {
        Row: HorarioComision
        Insert: HorarioComision
        Update: Partial<HorarioComision>
        Relationships: []
      }
      codigos: {
        Row: Codigo
        Insert: Partial<Codigo> & { profesor_id: string; sesion_id: string; codigo: string }
        Update: Partial<Codigo>
        Relationships: []
      }
      asistencias: {
        Row: Asistencia
        Insert: Partial<Asistencia> & {
          profesor_id: string
          alumno_id: string
          sesion_id: string
          clase_id: string
          metodo: Metodo
        }
        Update: Partial<Asistencia>
        Relationships: []
      }
    }
    Views: {
      vista_asistencia_alumno: {
        Row: VistaAsistenciaAlumno
        Relationships: []
      }
    }
    Functions: {
      sesion_activa: {
        Args: Record<PropertyKey, never>
        Returns: SesionActivaRow[]
      }
      buscar_alumnos: {
        Args: { p_query: string }
        Returns: BuscarAlumnosRow[]
      }
      horarios_publicos: {
        Args: Record<PropertyKey, never>
        Returns: HorarioPublicoRow[]
      }
      registrar_asistencia: {
        Args: { p_legajo: string; p_codigo: string }
        Returns: RegistrarAsistenciaRow[]
      }
      mis_asistencias: {
        Args: { p_legajo: string }
        Returns: MisAsistenciasRow[]
      }
    }
  }
}
