'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
      title={isLight ? 'Tema claro' : 'Tema escuro'}
      className={`group relative flex h-8 w-14 items-center rounded-full border border-dark-border bg-dark-card transition-colors hover:border-shopee-orange/60 ${className}`}
    >
      <span
        className={`absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-shopee-orange text-white shadow-md transition-all duration-300 ${
          isLight ? 'left-[calc(100%-1.75rem)]' : 'left-1'
        }`}
      >
        {isLight ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}
