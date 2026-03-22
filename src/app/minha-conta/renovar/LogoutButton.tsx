// app/minha-conta/renovar/LogoutButton.tsx
'use client'

import { LogOut } from 'lucide-react'
import { useSupabase } from '../../../app/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const context = useSupabase()
  const supabase = context?.supabase
  const router = useRouter()

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
      router.push('/')
      router.refresh() // <- limpa o contexto do AuthProvider no cliente
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dark-border bg-dark-bg py-3 px-4 text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-dark-bg/80 transition-colors focus:outline-none focus:ring-2 focus:ring-dark-border"
    >
      <LogOut className="h-4 w-4" />
      Sair da conta
    </button>
  )
}
