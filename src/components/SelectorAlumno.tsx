import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

export interface OpcionAlumno {
  id: string
  apellido: string
  nombre: string
  legajo: string
}

function etiqueta(a: OpcionAlumno) {
  return `${a.apellido}, ${a.nombre} (${a.legajo})`
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Cada palabra escrita tiene que aparecer: sirve "perez juan", "juan perez" o el legajo, con o sin tildes. */
function filtrarAlumnos(alumnos: OpcionAlumno[], texto: string) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)
  return alumnos.filter((a) => {
    const donde = normalizar(etiqueta(a))
    return palabras.every((p) => donde.includes(p))
  })
}

interface SelectorAlumnoProps {
  alumnos: OpcionAlumno[]
  value: string
  onChange: (alumnoId: string) => void
  disabled?: boolean
}

/**
 * Campo de texto con sugerencias. La lista va dentro del formulario y no flotando para que el scroll del modal no la
 * recorte, y no se cierra al perder el foco: cambiaría el alto del modal entre apretar y soltar, y el click caería en
 * el fondo, que lo cierra.
 */
export function SelectorAlumno({ alumnos, value, onChange, disabled }: SelectorAlumnoProps) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)

  const seleccionado = alumnos.find((a) => a.id === value)
  const sugerencias = filtrarAlumnos(alumnos, texto)
  const mostrarLista = abierto && !seleccionado && texto.trim() !== ''

  function elegir(a: OpcionAlumno) {
    onChange(a.id)
    setTexto('')
    setAbierto(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setAbierto(false)
    if (!mostrarLista) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (sugerencias.length === 0) return
      const paso = e.key === 'ArrowDown' ? 1 : -1
      setActivo((activo + paso + sugerencias.length) % sugerencias.length)
    } else if (e.key === 'Enter') {
      // Enter elige la sugerencia; no tiene que enviar el formulario todavía.
      e.preventDefault()
      if (sugerencias[activo]) elegir(sugerencias[activo])
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/70">
        Alumno
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={mostrarLista && sugerencias[activo] ? `${id}-${sugerencias[activo].id}` : undefined}
        autoComplete="off"
        className="input-field disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="Escribí apellido, nombre o legajo…"
        disabled={disabled}
        value={seleccionado ? etiqueta(seleccionado) : texto}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          if (seleccionado) onChange('')
          setTexto(e.target.value)
          setActivo(0)
          setAbierto(true)
        }}
      />
      {mostrarLista && (
        <div
          id={`${id}-lista`}
          role="listbox"
          aria-label="Sugerencias de alumnos"
          className="mt-2 max-h-56 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-surface-800 p-1"
        >
          {sugerencias.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-white/40">No hay alumnos con ese nombre o legajo.</p>
          ) : (
            sugerencias.map((a, i) => (
              <div
                key={a.id}
                id={`${id}-${a.id}`}
                role="option"
                aria-selected={i === activo}
                ref={i === activo ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                // Mantiene el foco en el campo: en el celular, si se cierra el teclado, la lista se mueve bajo el dedo.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(a)}
                className={cn(
                  'cursor-pointer rounded-xl px-3 py-2.5 text-sm hover:bg-white/10',
                  i === activo && 'bg-white/10',
                )}
              >
                <span className="font-medium text-white">
                  {a.apellido}, {a.nombre}
                </span>{' '}
                <span className="text-white/40">{a.legajo}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
