import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void }

const ConfirmContext = createContext<((options: ConfirmOptions | string) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }))
  }, [])

  function close(ok: boolean) {
    state?.resolve(ok)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? 'Confirmar'} maxWidth="max-w-sm">
        <div className="space-y-5">
          <p className="text-sm text-white/70">{state?.message}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
              {state?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

/** Reemplazo de `window.confirm` con el modal propio de la app: `if (await confirm('¿Eliminar?')) ...` */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider')
  return ctx
}
