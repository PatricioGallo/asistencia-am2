import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'

const schema = z.object({
  email: z.string().email('Ingresá un mail válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

export function LoginAdmin() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (session) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? '/admin/calendario'
    return <Navigate to={from} replace />
  }

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const { error } = await signIn(values.email, values.password)
    setLoading(false)
    if (error) {
      toast.error('No pudimos iniciar sesión', { description: error })
      return
    }
    navigate('/admin/calendario')
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-400">
            <LogIn className="size-5 text-white" />
          </span>
          <div>
            <CardTitle>Ingreso docente</CardTitle>
            <CardSubtitle className="mt-0">Administrá tus clases y asistencias</CardSubtitle>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Mail" type="email" autoComplete="email" placeholder="docente@ejemplo.com" error={errors.email?.message} {...register('email')} />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" loading={loading} className="w-full">
            Ingresar
          </Button>
        </form>
      </Card>
    </div>
  )
}
