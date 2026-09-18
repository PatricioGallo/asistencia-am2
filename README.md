# Asistencia AM2

Web app (React + Vite + TypeScript, PWA instalable en Android/iOS) para tomar asistencia en clase con un código que vale 60 segundos.

- **Alumnos** (sin login): ven la clase en curso, ponen su legajo, ven su nombre/asistencias/% y cargan el código de 60s para confirmar presente.
- **Docente** (con login): programa clases en un calendario, genera el código de cada clase, carga asistencias manuales, administra sus alumnos y ve las estadísticas de asistencia (75% requerido) por comisión.

## 1. Crear el proyecto en Supabase

1. Andá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (plan gratuito).
2. En el **SQL editor** del proyecto, pegá y ejecutá entero el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repo. Crea las tablas, la vista de asistencia, las funciones y la seguridad (RLS).
3. En **Project Settings → API**, copiá la **Project URL** y la **anon public key**.
4. En **Authentication → Users**, hacé click en "Add user" y creá tu usuario docente (mail + contraseña). Al crearlo, un trigger genera automáticamente tu perfil en la tabla `profesores`.
   > No hay pantalla de registro público en la app a propósito: el usuario admin se crea acá, no desde la web.

## 2. Configurar el proyecto local

```bash
cp .env.local.example .env.local
```

Completá `.env.local` con la URL y la anon key del paso 1:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## 3. Correr en desarrollo

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`. La home (`/`) es la vista del alumno. Para entrar como docente, andá a "Docente" en la barra o a `/admin/login`.

## 4. Uso básico como docente

1. **Calendario**: creá tus comisiones (ej: 2S1, 2Q1), después programá una clase (nombre + una fila por comisión con fecha y horario).
2. Durante el horario programado de una sesión, aparece el botón **Generar código** (vale 60 segundos, lo volvés a generar cuantas veces haga falta).
3. **Mis alumnos**: cargalos a mano o importá un CSV con columnas `legajo, nombre, apellido, comision`.
4. **Asistencia**: tabla por comisión con presentes, % y si cumple el 75% requerido. Ahí también podés cargar una asistencia manual (por ejemplo, si no llegaste a anotar el código), eligiendo cualquier alumno y cualquier clase — si asistió a la sesión de otra comisión, igual cuenta.

## 5. Deploy a Vercel

1. Subí este repo a GitHub (ya está conectado a `PatricioGallo/asistencia-am2`).
2. En [vercel.com](https://vercel.com), importá el repo (framework preset: Vite).
3. Cargá las mismas variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en Project Settings → Environment Variables.
4. Deploy. Los alumnos pueden instalar la PWA desde el navegador del celular (Android: "Agregar a pantalla de inicio"; iOS Safari: compartir → "Agregar a inicio").

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, React Router, TanStack Query, Supabase (Postgres + Auth), Framer Motion, vite-plugin-pwa.
