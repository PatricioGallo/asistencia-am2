import { AlertTriangle } from 'lucide-react'

export function SetupRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-950 p-6 text-white">
      <div className="glass-panel max-w-md p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-warn-500/15">
            <AlertTriangle className="size-5 text-warn-500" />
          </span>
          <h1 className="font-display text-lg font-semibold">Falta configurar Supabase</h1>
        </div>
        <p className="text-sm text-white/60">
          No encontramos las variables de entorno de Supabase. Para levantar la app:
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-white/70">
          <li>
            Copiá <code className="text-white">.env.local.example</code> a{' '}
            <code className="text-white">.env.local</code>
          </li>
          <li>Completá con la URL y la anon key de tu proyecto en supabase.com</li>
          <li>Reiniciá el servidor (npm run dev)</li>
        </ol>
        <p className="mt-3 text-xs text-white/40">Ver README.md para la guía completa de configuración.</p>
      </div>
    </div>
  )
}
