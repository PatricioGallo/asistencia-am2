import { formatNota } from './utils'

/** Nota de un parcial/recuperatorio: un número 0-10, 'ausente' (no rindió), o null (todavía no se cargó). */
export type NotaValor = number | 'ausente' | null

export type TipoRecuperatorio = 'parcial_1' | 'parcial_2' | 'integral' | null

export interface EstadoNotas {
  aprobado1: boolean | null
  aprobado2: boolean | null
  recu1Tipo: TipoRecuperatorio
  recu2Tipo: TipoRecuperatorio
  estado: 'aprobado' | 'desaprobado' | 'pendiente'
}

export const RECU_LABEL: Record<Exclude<TipoRecuperatorio, null>, string> = {
  parcial_1: 'Recup. Parcial 1',
  parcial_2: 'Recup. Parcial 2',
  integral: 'Integral',
}

/** null = todavía no rindió esa instancia. 'ausente' cuenta como desaprobado (igual que una nota baja). */
function aprobo(nota: NotaValor, minimo: number): boolean | null {
  if (nota == null) return null
  if (nota === 'ausente') return false
  return nota >= minimo
}

/**
 * Qué recupera la recuperación (la 1 y la 2 recuperan siempre lo mismo, ver
 * calcularEstadoNotas): si desaprobó (o estuvo ausente en) un solo parcial,
 * ese; si desaprobó los dos, el integral. null si todavía falta alguna nota
 * de parcial, o si ya aprobó los dos directamente y no necesita recuperar
 * nada.
 */
export function tipoRecuperatorio(p1: NotaValor, p2: NotaValor, minimo: number): TipoRecuperatorio {
  if (p1 == null || p2 == null) return null
  const ap1 = aprobo(p1, minimo)
  const ap2 = aprobo(p2, minimo)
  if (ap1 && ap2) return null
  if (!ap1 && !ap2) return 'integral'
  return ap1 ? 'parcial_2' : 'parcial_1'
}

export function calcularEstadoNotas(p1: NotaValor, p2: NotaValor, r1: NotaValor, r2: NotaValor, minimo: number): EstadoNotas {
  if (p1 == null || p2 == null) {
    return { aprobado1: aprobo(p1, minimo), aprobado2: aprobo(p2, minimo), recu1Tipo: null, recu2Tipo: null, estado: 'pendiente' }
  }

  let aprobado1 = aprobo(p1, minimo)!
  let aprobado2 = aprobo(p2, minimo)!
  const tipo = tipoRecuperatorio(p1, p2, minimo)

  if (!tipo) {
    return { aprobado1, aprobado2, recu1Tipo: null, recu2Tipo: null, estado: 'aprobado' }
  }

  function aplicar(nota: NotaValor) {
    if (!aprobo(nota, minimo)) return
    if (tipo === 'integral') {
      aprobado1 = true
      aprobado2 = true
    } else if (tipo === 'parcial_1') {
      aprobado1 = true
    } else {
      aprobado2 = true
    }
  }

  if (r1 == null) {
    return { aprobado1, aprobado2, recu1Tipo: tipo, recu2Tipo: null, estado: 'pendiente' }
  }
  aplicar(r1)
  if (aprobado1 && aprobado2) {
    return { aprobado1, aprobado2, recu1Tipo: tipo, recu2Tipo: null, estado: 'aprobado' }
  }

  if (r2 == null) {
    return { aprobado1, aprobado2, recu1Tipo: tipo, recu2Tipo: tipo, estado: 'pendiente' }
  }
  aplicar(r2)
  return {
    aprobado1,
    aprobado2,
    recu1Tipo: tipo,
    recu2Tipo: tipo,
    estado: aprobado1 && aprobado2 ? 'aprobado' : 'desaprobado',
  }
}

/** '' -> null, 'a'/'ausente' -> 'ausente', número 0-10 -> ese número, cualquier otra cosa -> 'invalid'. */
export function parseNotaInput(valor: string): NotaValor | 'invalid' {
  const trimmed = valor.trim()
  if (!trimmed) return null
  if (/^a(usente)?$/i.test(trimmed)) return 'ausente'
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 10) return 'invalid'
  return n
}

export function formatNotaValor(nota: NotaValor): string {
  if (nota == null) return '—'
  if (nota === 'ausente') return 'A'
  return formatNota(nota)
}
