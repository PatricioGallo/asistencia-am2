import { NavLink, useNavigate } from 'react-router-dom'
import { CalendarDays, LogOut, ShieldCheck, Users, ClipboardList } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { LogoMark } from '@/components/LogoMark'

const adminTabs = [
  { to: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/admin/alumnos', label: 'Mis alumnos', icon: Users },
  { to: '/admin/asistencia', label: 'Asistencia', icon: ClipboardList },
]

export function NavBar() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <LogoMark />
          <span className="font-display text-base font-semibold text-white">Asistencia AM2</span>
        </NavLink>

        {session ? (
          <nav className="flex items-center gap-1 overflow-x-auto">
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
                <span className="hidden sm:inline">{tab.label}</span>
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="ml-1 flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </nav>
        ) : (
          <NavLink to="/admin/login" className="btn-secondary !px-4 !py-2 text-sm">
            <ShieldCheck className="size-4" />
            Docente
          </NavLink>
        )}
      </div>
    </header>
  )
}
