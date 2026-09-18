import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface FieldWrapperProps {
  label: string
  error?: string
  children: ReactNode
  hint?: string
}

export function FieldWrapper({ label, error, hint, children }: FieldWrapperProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/70">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger-500">{error}</span>}
    </label>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <input className={cn('input-field', error && 'border-danger-500/60', className)} {...props} />
    </FieldWrapper>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  children: ReactNode
}

export function Select({ label, error, className, children, ...props }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <select className={cn('input-field appearance-none', error && 'border-danger-500/60', className)} {...props}>
        {children}
      </select>
    </FieldWrapper>
  )
}
