import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { NavBar } from '@/components/layout/NavBar'
import { ProtectedRoute } from '@/lib/auth'
import { HomeAlumno } from '@/pages/HomeAlumno'

const LoginAdmin = lazy(() => import('@/pages/LoginAdmin').then((m) => ({ default: m.LoginAdmin })))
const Calendario = lazy(() => import('@/pages/admin/Calendario').then((m) => ({ default: m.Calendario })))
const MisAlumnos = lazy(() => import('@/pages/admin/MisAlumnos').then((m) => ({ default: m.MisAlumnos })))
const Asistencia = lazy(() => import('@/pages/admin/Asistencia').then((m) => ({ default: m.Asistencia })))
const Configuracion = lazy(() => import('@/pages/admin/Configuracion').then((m) => ({ default: m.Configuracion })))

function AdminFallback() {
  return <div className="flex min-h-[60vh] items-center justify-center text-white/50">Cargando…</div>
}

function Layout() {
  return (
    <div className="min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeAlumno />} />
        <Route
          path="/admin/login"
          element={
            <Suspense fallback={<AdminFallback />}>
              <LoginAdmin />
            </Suspense>
          }
        />
        <Route
          path="/admin/calendario"
          element={
            <ProtectedRoute>
              <Suspense fallback={<AdminFallback />}>
                <Calendario />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/alumnos"
          element={
            <ProtectedRoute>
              <Suspense fallback={<AdminFallback />}>
                <MisAlumnos />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/asistencia"
          element={
            <ProtectedRoute>
              <Suspense fallback={<AdminFallback />}>
                <Asistencia />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/configuracion"
          element={
            <ProtectedRoute>
              <Suspense fallback={<AdminFallback />}>
                <Configuracion />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
