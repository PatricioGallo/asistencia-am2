import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import './index.css'
import { SetupRequired } from './SetupRequired.tsx'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'

const root = createRoot(document.getElementById('root')!)
const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

if (!hasSupabaseConfig) {
  // No importamos App acá: transitivamente carga supabaseClient, que tira si
  // faltan las env vars, y eso dejaría la pantalla en blanco en vez de esto.
  root.render(
    <StrictMode>
      <SetupRequired />
    </StrictMode>,
  )
} else {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
  })

  Promise.all([import('./App.tsx'), import('@/lib/auth')]).then(([{ default: App }, { AuthProvider }]) => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <ConfirmProvider>
                <App />
                <Toaster theme="dark" position="top-center" richColors closeButton />
              </ConfirmProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </StrictMode>,
    )
  })
}
