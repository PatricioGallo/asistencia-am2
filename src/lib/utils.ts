import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Palabras de AM2 en vez de códigos al azar: más fáciles de decir en voz alta y anotar en el pizarrón.
const PALABRAS_CODIGO = [
  'INTEGRAL', 'DERIVADA', 'LIMITE', 'VECTOR', 'MATRIZ', 'SERIE', 'TEOREMA', 'GRADIENTE',
  'DIVERGE', 'CONVERGE', 'ROTOR', 'JACOBIANO', 'TAYLOR', 'FOURIER', 'LAPLACE', 'CONTINUA',
  'DOMINIO', 'EXTREMO', 'MAXIMO', 'MINIMO', 'SILLA', 'CURVA', 'ESFERA', 'CILINDRO',
  'PARABOLA', 'ELIPSE', 'POLAR', 'CAMPO', 'ESCALAR', 'GREEN', 'STOKES', 'GAUSS',
  'FLUJO', 'PLANO', 'NORMAL', 'TANGENTE', 'ANGULO', 'RADIO', 'VOLUMEN',
]

/** Código de asistencia: una palabra relacionada con la materia, no una cadena al azar. */
export function generarCodigo() {
  return PALABRAS_CODIGO[Math.floor(Math.random() * PALABRAS_CODIGO.length)]
}

export function formatFecha(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${iso}T00:00:00`),
  )
}

export function formatHora(hhmmss: string) {
  return hhmmss.slice(0, 5)
}

export function formatPorcentaje(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`
}

/** 6.50 -> "6.5", 4.00 -> "4" */
export function formatNota(n: number) {
  return String(parseFloat(n.toFixed(2)))
}

/** dia_semana 1..7 (lunes a domingo), como en la grilla del calendario. */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/**
 * iOS ignora window.print() en silencio cuando la web está instalada como
 * PWA (display: standalone / "Agregar a inicio"): no tira error, simplemente
 * no pasa nada. En Safari normal sí funciona. Android no tiene este problema.
 */
export function esIosStandalone() {
  const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const esStandalone = (navigator as { standalone?: boolean }).standalone === true
  return esIos && esStandalone
}
