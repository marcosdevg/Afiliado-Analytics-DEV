'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { User, LogOut, Menu } from 'lucide-react'
import { useSupabase } from '../auth/AuthProvider'
import { useRouter } from 'next/navigation'

type HeaderProps = {
  onLoginClick: () => void;
}

export function Header({ onLoginClick }: HeaderProps) {
  const context = useSupabase()
  const session = context?.session
  const supabase = context?.supabase
  const router = useRouter()
  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    }
  }

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-dark-border bg-dark-bg/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={session ? '/dashboard' : '/'} className="flex items-baseline gap-2">
          {/* Substitui o ícone Lucide pelo SVG local em /public/icongrafic.svg */}
          <Image
            src="/icongrafic.svg"
            alt="Afiliado Analytics"
            width={15}
            height={15}
            className="h-5 w-5"
            priority
          />
          <div className="font-bold text-lg">
            <span className="text-text-primary">Afiliado</span>
            <span className="ml-1 text-shopee-orange">Analytics</span>
          </div>
        </Link>

        {session ? (
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-6">
              <Link href="/configuracoes" className="flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
                <User className="h-4 w-4" />
                <span>Minha Conta</span>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>

            <div className="sm:hidden relative">
              <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} aria-label="Abrir menu do usuário">
                <Menu className="h-6 w-6 text-text-primary" />
              </button>
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-dark-card rounded-md shadow-lg border border-dark-border py-1 z-50"
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  <Link href="/configuracoes" onClick={() => setIsUserMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-dark-bg">
                    <User className="h-4 w-4" />
                    <span>Minha Conta</span>
                  </Link>
                  <button onClick={() => { handleLogout(); setIsUserMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-dark-bg">
                    <LogOut className="h-4 w-4" />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 text-sm font-medium text-text-secondary md:flex">
              <Link href="/#features" className="transition-colors hover:text-text-primary">Funcionalidades</Link>
              <Link href="/#testimonials" className="transition-colors hover:text-text-primary">Feedbacks</Link>
              <Link href="/#pricing" className="transition-colors hover:text-text-primary">Preços</Link>
              <Link href="/#faq" className="transition-colors hover:text-text-primary">FAQ</Link>
            </nav>
            <button
              onClick={onLoginClick}
              className="rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Login
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
