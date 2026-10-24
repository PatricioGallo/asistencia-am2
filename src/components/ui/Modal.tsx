import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
}

// Modales abiertos a la vez (por ejemplo un "¿Quitar asistencia?" encima del de la clase).
let modalesAbiertos = 0
let scrollGuardado = 0

/**
 * Mientras haya un modal abierto la página de fondo no se puede desplazar. En
 * iPhone no alcanza con overflow: hidden (el gesto igual mueve el fondo), así
 * que se fija el body en su posición y al cerrar se vuelve al mismo lugar.
 */
function useBloquearScroll(activo: boolean) {
  useEffect(() => {
    if (!activo) return
    if (modalesAbiertos === 0) {
      scrollGuardado = window.scrollY
      const b = document.body.style
      b.position = 'fixed'
      b.top = `-${scrollGuardado}px`
      b.left = '0'
      b.right = '0'
      b.width = '100%'
      b.overflow = 'hidden'
    }
    modalesAbiertos++
    return () => {
      modalesAbiertos--
      if (modalesAbiertos > 0) return
      const b = document.body.style
      b.position = ''
      b.top = ''
      b.left = ''
      b.right = ''
      b.width = ''
      b.overflow = ''
      window.scrollTo(0, scrollGuardado)
    }
  }, [activo])
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useBloquearScroll(open)

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`glass-panel w-full ${maxWidth} max-h-[85dvh] overflow-y-auto overscroll-contain p-6`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
