'use client'

import { useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { X, Eye, EyeOff } from 'lucide-react'
import InfoModal from '@/app/components/ui/InfoModal'

type LoginModalProps = {
  onClose: () => void
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const backdropClickStartRef = useRef(false)
  const handleBackdropMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    backdropClickStartRef.current = e.target === e.currentTarget
  }
  const handleBackdropMouseUp: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const endedOnBackdrop = e.target === e.currentTarget
    if (!submitting && backdropClickStartRef.current && endedOnBackdrop) {
      onClose()
    }
    backdropClickStartRef.current = false
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciais inválidas. Por favor, tente novamente.')
      setSubmitting(false)
      return
    }

    onClose()
    router.replace('/dashboard')
  }

  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    try {
      await fetch('/api/resend-setup-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Intencionalmente não exibimos erro para não diferenciar casos.
    } finally {
      setSubmitting(false)
      setShowSuccessModal(true)
    }
  }

  const handleInfoModalConfirm = () => {
    setShowSuccessModal(false)
    setIsForgotPassword(false)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all"
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
        aria-modal="true"
        role="dialog"
      >
        <div
          // ALTERAÇÃO: Mudança de bg-[#131316] para bg-[#23232A] (tom mais claro e elegante)
          className="relative w-full max-w-[420px] mx-4 overflow-hidden rounded-[24px] border border-white/10 bg-[#23232A] p-7 sm:p-9 shadow-[0_32px_64px_rgba(0,0,0,0.6)]"
          onMouseDown={() => {
            backdropClickStartRef.current = false
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Efeito Glow Interno do Modal - Mantido sutil */}
          <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.12)_0%,transparent_70%)] blur-[20px]" />

          <button
            onClick={!submitting ? onClose : undefined}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 z-10"
            aria-label="Fechar"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>

          {isForgotPassword ? (
            <div className="relative z-10">
              <h2 className="text-center font-[var(--font-space-grotesk)] text-[24px] font-bold tracking-tight text-white">
                Recuperar Senha
              </h2>
              <p className="mt-2 text-center font-['Inter'] text-[14px] text-white/60">
                Digite seu e-mail para receber o link.
              </p>
              
              <div className="mt-8">
                <form onSubmit={handlePasswordReset} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="mb-1.5 block font-['Inter'] text-[13px] font-medium text-white/70">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      // Ajuste leve no bg do input para contrastar com o novo fundo do modal
                      className="block w-full rounded-[12px] border border-white/10 bg-black/20 px-4 py-3 font-['Inter'] text-[14px] text-white placeholder-white/30 outline-none transition-all focus:border-[#e24c30]/50 focus:bg-black/30 focus:ring-1 focus:ring-[#e24c30]/50 disabled:opacity-50"
                      disabled={submitting}
                      placeholder="seu@email.com"
                    />
                  </div>

                  {error && <p className="text-center font-['Inter'] text-[13px] text-[#ef4444]">{error}</p>}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex w-full justify-center rounded-[12px] bg-gradient-to-br from-[#e24c30] to-[#ff7a54] px-4 py-[14px] font-['Inter'] text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(226,76,48,0.25)] transition-all hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(226,76,48,0.4)] disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {submitting ? 'Enviando...' : 'Enviar link'}
                    </button>
                  </div>
                </form>

                <p className="mt-5 text-center">
                  <button
                    onClick={() => {
                      setIsForgotPassword(false)
                      setError(null)
                    }}
                    className="font-['Inter'] text-[13px] font-medium text-[#fb923c] transition-colors hover:text-[#ff7a54]"
                    disabled={submitting}
                  >
                    Voltar para o login
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="relative z-10">
              <h2 className="text-center font-[var(--font-space-grotesk)] text-[24px] font-bold tracking-tight text-white">
                Acesse sua conta
              </h2>
              
              <div className="mt-8">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label
                      htmlFor="email-modal"
                      className="mb-1.5 block font-['Inter'] text-[13px] font-medium text-white/70"
                    >
                      Email
                    </label>
                    <input
                      id="email-modal"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      // Ajuste leve no bg do input
                      className="block w-full rounded-[12px] border border-white/10 bg-black/20 px-4 py-3 font-['Inter'] text-[14px] text-white placeholder-white/30 outline-none transition-all focus:border-[#e24c30]/50 focus:bg-black/30 focus:ring-1 focus:ring-[#e24c30]/50 disabled:opacity-50"
                      disabled={submitting}
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password-modal"
                      className="mb-1.5 block font-['Inter'] text-[13px] font-medium text-white/70"
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        id="password-modal"
                        name="password"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        // Ajuste leve no bg do input
                        className="block w-full rounded-[12px] border border-white/10 bg-black/20 px-4 py-3 pr-12 font-['Inter'] text-[14px] text-white placeholder-white/30 outline-none transition-all focus:border-[#e24c30]/50 focus:bg-black/30 focus:ring-1 focus:ring-[#e24c30]/50 disabled:opacity-50"
                        disabled={submitting}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/30 transition-colors hover:text-white"
                        aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showPwd}
                        disabled={submitting}
                      >
                        {showPwd ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-center font-['Inter'] text-[13px] text-[#ef4444]">{error}</p>}

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setError(null)
                      }}
                      className="font-['Inter'] text-[13px] font-medium text-white/50 transition-colors hover:text-[#fb923c]"
                      disabled={submitting}
                    >
                      Esqueceu a senha?
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex w-full justify-center rounded-[12px] bg-gradient-to-br from-[#e24c30] to-[#ff7a54] px-4 py-[14px] font-['Inter'] text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(226,76,48,0.25)] transition-all hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(226,76,48,0.4)] disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {submitting ? 'Entrando...' : 'Entrar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSuccessModal && (
        <InfoModal
          message="Se existir uma conta para este e-mail, enviaremos um link para redefinir sua senha. Verifique sua caixa de entrada e o spam."
          onConfirm={handleInfoModalConfirm}
        />
      )}
    </>
  )
}