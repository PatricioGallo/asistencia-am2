import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  KeyRound,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { LogoMark } from '@/components/LogoMark'
import { NotificacionesBell } from '@/components/NotificacionesBell'

const adminTabs = [
  { to: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/admin/alumnos', label: 'Mis alumnos', icon: Users },
  { to: '/admin/asistencia', label: 'Asistencia', icon: ClipboardList },
  { to: '/admin/parciales', label: 'Parciales', icon: GraduationCap },
  { to: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

const alumnoTabs = [
  { to: '/', label: 'Asistencia', icon: KeyRound, end: true },
  { to: '/mis-asistencias', label: 'Mis asistencias', icon: ClipboardList, end: false },
]

export function NavBar() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg-950/80 pt-[var(--header-pt)] backdrop-blur-xl print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <LogoMark />
          <span className="font-display text-base font-semibold text-white">Asistencia AM2</span>
        </NavLink>

        {session ? (
          <div className="flex min-w-0 items-center gap-1">
            {/* Computadora: pestañas a la vista. Celular y app instalada: menú desplegable (MenuDocente). */}
            <nav className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex standalone:hidden">
              {adminTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white',
                      isActive && 'bg-white/10 text-white',
                    )
                  }
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </NavLink>
              ))}
              <button
                onClick={handleSignOut}
                className="ml-1 flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <LogOut className="size-4" />
                Salir
              </button>
            </nav>
            {/* Fuera del <nav> con overflow para que el desplegable no quede recortado. */}
            <NotificacionesBell />
            <div className="md:hidden standalone:block">
              <MenuDocente />
            </div>
          </div>
        ) : (
          <nav className="flex items-center gap-1 overflow-x-auto">
            {alumnoTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white',
                    isActive && 'bg-white/10 text-white',
                  )
                }
              >
                <tab.icon className="size-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </NavLink>
            ))}
            <NavLink to="/admin/login" className="btn-secondary !px-4 !py-2 text-sm ml-1 shrink-0">
              <ShieldCheck className="size-4" />
              <span className="hidden sm:inline">Docente</span>
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  )
}

/** Secciones del docente agrupadas en un menú desplegable. */
function MenuDocente() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)

  const actual = adminTabs.find((t) => pathname.startsWith(t.to))
  const IconoActual = actual?.icon ?? Menu

  // Cerrar al navegar, al tocar afuera o con Escape.
  useEffect(() => {
    setAbierto(false)
  }, [pathname])

  useEffect(() => {
    if (!abierto) return
    function alTocar(e: PointerEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false)
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  async function handleSignOut() {
    setAbierto(false)
    await signOut()
    navigate('/')
  }

  return (
    <div ref={contenedorRef} className="relative shrink-0">
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white',
          abierto && 'bg-white/10 text-white',
        )}
      >
        <Menu className="size-4 sm:hidden" />
        <IconoActual className="hidden size-4 sm:block" />
        <span className="hidden sm:inline">{actual?.label ?? 'Menú'}</span>
        <ChevronDown className={cn('hidden size-3.5 text-white/40 transition-transform sm:block', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div
          role="menu"
          className="fixed inset-x-3 top-[calc(var(--header-pt)+4rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-bg-950/95 p-1.5 shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56"
        >
          {adminTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              role="menuitem"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white',
                  isActive && 'bg-white/10 text-white',
                )
              }
            >
              <tab.icon className="size-4" />
              {tab.label}
            </NavLink>
          ))}
          <div className="my-1.5 border-t border-white/10" />
          <button
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-danger-500"
          >
            <LogOut className="size-4" />
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
