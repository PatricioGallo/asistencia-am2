import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'

/** Bucket público de Storage con los PDFs de los TPs (ver clases.pdf_path). */
const BUCKET = 'tps'
export const PDF_MAX_MB = 20

/** Devuelve un mensaje de error si el archivo no sirve, o null si está bien. */
export function validarPdf(file: File): string | null {
  if (file.type !== 'application/pdf') return 'El archivo tiene que ser un PDF'
  if (file.size > PDF_MAX_MB * 1024 * 1024) return `El PDF no puede pesar más de ${PDF_MAX_MB} MB`
  return null
}

/** URL pública que fuerza la descarga con un nombre de archivo legible. */
export function urlDescargaPdf(path: string, nombreClase: string) {
  const nombreArchivo = `${nombreClase.replace(/[\\/:*?"<>|]/g, '').trim() || 'TP'}.pdf`
  return supabase.storage.from(BUCKET).getPublicUrl(path, { download: nombreArchivo }).data.publicUrl
}

/** URL pública para abrir el PDF en el navegador (sin forzar descarga). */
export function urlVerPdf(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Sube el PDF a <profesor_id>/<clase_id>/<timestamp>.pdf, lo asocia a la clase
 * y borra el anterior si había. Cada subida usa un nombre nuevo para que
 * nadie se quede con una versión vieja cacheada.
 */
export async function subirPdfClase(profesorId: string, claseId: string, file: File, pathAnterior: string | null) {
  const path = `${profesorId}/${claseId}/${Date.now()}.pdf`
  const { error: errUpload } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf' })
  if (errUpload) throw errUpload

  const { error: errClase } = await supabase.from('clases').update({ pdf_path: path }).eq('id', claseId)
  if (errClase) {
    await supabase.storage.from(BUCKET).remove([path])
    throw errClase
  }

  if (pathAnterior) await supabase.storage.from(BUCKET).remove([pathAnterior])
  return path
}

export function useSubirPdfClase() {
  const { session } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { claseId: string; file: File; pathAnterior: string | null }) =>
      subirPdfClase(session!.user.id, input.claseId, input.file, input.pathAnterior),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sesiones'] })
      qc.invalidateQueries({ queryKey: ['clases'] })
    },
  })
}

export function useQuitarPdfClase() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { claseId: string; path: string }) => {
      const { error } = await supabase.from('clases').update({ pdf_path: null }).eq('id', input.claseId)
      if (error) throw error
      await supabase.storage.from(BUCKET).remove([input.path])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sesiones'] })
      qc.invalidateQueries({ queryKey: ['clases'] })
    },
  })
}
