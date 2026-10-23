/**
 * Identificador al azar de este navegador, para detectar cuando un mismo
 * celular da presente a dos alumnos distintos en la misma clase.
 *
 * Una página web no puede leer un identificador real del teléfono: esto vive
 * en el navegador, así que modo incógnito, otro navegador o borrar los datos
 * del sitio generan uno nuevo. Se guarda en localStorage y en una cookie para
 * que no alcance con borrar solo uno de los dos.
 */
const CLAVE = 'am2-dispositivo'

function leerCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CLAVE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function leerLocal(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

function generar(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function obtenerDispositivoId(): string {
  const id = leerLocal() ?? leerCookie() ?? generar()
  try {
    localStorage.setItem(CLAVE, id)
  } catch {
    // Sin localStorage (modo privado estricto): queda la cookie.
  }
  document.cookie = `${CLAVE}=${encodeURIComponent(id)}; max-age=${60 * 60 * 24 * 400}; path=/; samesite=lax`
  return id
}
