'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { User, LogOut, Menu, X } from 'lucide-react'
import { useSupabase } from '../auth/AuthProvider'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from '../theme/ThemeToggle'

type HeaderProps = {
  onLoginClick: () => void
}

const publicLinks = [
  { href: '/#features', label: 'Funcionalidades' },
  { href: '/#testimonials', label: 'Feedbacks' },
  { href: '/#pricing', label: 'Preços' },
  { href: '/#faq', label: 'FAQ' },
]

export function Header({ onLoginClick }: HeaderProps) {
  const context = useSupabase()
  const session = context?.session
  const supabase = context?.supabase
  const router = useRouter()
  const pathname = usePathname()

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLandingMenuOpen, setIsLandingMenuOpen] = useState(false) // Novo estado para o menu mobile da Landing Page
  const [scrolled, setScrolled] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isLandingHeader = (!session && pathname === '/') || isLoggingOut

  useEffect(() => {
    if (!isLandingHeader || pathname !== '/') {
      setScrolled(false)
      return
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [isLandingHeader, pathname])

  useEffect(() => {
    if (session) {
      setIsLoggingOut(false)
      return
    }

    if (!session && pathname === '/' && isLoggingOut) {
      const id = requestAnimationFrame(() => {
        setIsLoggingOut(false)
      })

      return () => cancelAnimationFrame(id)
    }
  }, [session, pathname, isLoggingOut])

  const handleLogout = async () => {
    if (!supabase) return

    setIsUserMenuOpen(false)
    setIsLoggingOut(true)

    try {
      await supabase.auth.signOut()
      router.replace('/')
      router.refresh()
    } catch (error) {
      setIsLoggingOut(false)
    }
  }

  if (isLandingHeader) {
    return (
      <header className="fixed left-0 top-0 z-[200] w-full">
        <div
          className={`pointer-events-none absolute inset-0 transition-all duration-300 ${
            scrolled ? 'bg-[#18181b]/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)]' : 'bg-transparent'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-0 transition-all duration-300 ${
            scrolled || isLandingMenuOpen ? 'backdrop-blur-[18px]' : ''
          }`}
        />

        <div className="relative mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-4 sm:px-7">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icongrafic.svg"
              alt="Afiliado Analytics"
              width={20}
              height={20}
              className="h-5 w-5"
              priority
            />

            <div className="text-lg font-bold leading-none">
              <span className="text-text-primary">Afiliado</span>
              <span className="ml-1 text-shopee-orange">Analytics</span>
            </div>
          </Link>

          <nav className="mr-[60px] hidden items-center gap-9 md:flex">
            {publicLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[14px] font-medium text-white/60 no-underline transition-colors duration-200 ease-in hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onLoginClick}
              className="hidden sm:inline-flex items-center justify-center rounded-full border-none bg-gradient-to-br from-[#e24c30] to-[#ff7a54] px-6 py-2.5 text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(226,76,48,0.4)] no-underline transition-all duration-[220ms] ease-in hover:-translate-y-[2px] hover:shadow-[0_8px_32px_rgba(226,76,48,0.5)]"
            >
              Entrar
            </button>

            {/* Menu Hamburguer Mobile */}
            <button
              onClick={() => setIsLandingMenuOpen(!isLandingMenuOpen)}
              className="md:hidden flex items-center justify-center text-white/80 hover:text-white transition-colors"
              aria-label="Alternar menu mobile"
            >
              {isLandingMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Dropdown Menu Mobile */}
        {isLandingMenuOpen && (
          <div className="absolute top-[68px] left-0 w-full bg-[#18181b]/95 backdrop-blur-xl border-b border-white/10 md:hidden flex flex-col items-center py-8 gap-6 shadow-2xl animate-in fade-in slide-in-from-top-5 duration-200">
            {publicLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsLandingMenuOpen(false)}
                className="text-base font-medium text-white/80 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
            
            <button
              onClick={() => {
                setIsLandingMenuOpen(false);
                onLoginClick();
              }}
              className="mt-4 sm:hidden w-[80%] max-w-[250px] flex items-center justify-center rounded-full border-none bg-gradient-to-br from-[#e24c30] to-[#ff7a54] px-6 py-3 text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(226,76,48,0.4)] transition-transform active:scale-95"
            >
              Entrar
            </button>
          </div>
        )}
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 bg-dark-bg/80 backdrop-blur-lg shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={session ? '/dashboard' : '/'} className="flex items-baseline gap-2">
          <Image
            src="/icongrafic.svg"
            alt="Afiliado Analytics"
            width={15}
            height={15}
            className="h-5 w-5"
            priority
          />
          <div className="text-lg font-bold">
            <span className="text-text-primary">Afiliado</span>
            <span className="ml-1 text-shopee-orange">Analytics</span>
          </div>
        </Link>

        {session ? (
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 sm:flex">
              <Link
                href="/configuracoes"
                className="flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                <User className="h-4 w-4" />
                <span>Minha Conta</span>
              </Link>

              <ThemeToggle />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>

            <div className="relative flex items-center gap-3 sm:hidden">
              <ThemeToggle />
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="Abrir menu do usuário"
              >
                <Menu className="h-6 w-6 text-text-primary" />
              </button>

              {isUserMenuOpen && (
                <div
                  className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-dark-border bg-dark-card py-1 shadow-lg"
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  <Link
                    href="/configuracoes"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-dark-bg"
                  >
                    <User className="h-4 w-4" />
                    <span>Minha Conta</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-dark-bg"
                  >
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
              <Link href="/#features" className="transition-colors hover:text-text-primary">
                Funcionalidades
              </Link>
              <Link href="/#testimonials" className="transition-colors hover:text-text-primary">
                Feedbacks
              </Link>
              <Link href="/#pricing" className="transition-colors hover:text-text-primary">
                Preços
              </Link>
              <Link href="/#faq" className="transition-colors hover:text-text-primary">
                FAQ
              </Link>
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