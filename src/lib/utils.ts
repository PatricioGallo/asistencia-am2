import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin 0/O/1/I/L para evitar confusiones

export function generarCodigo(length = 6) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
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
