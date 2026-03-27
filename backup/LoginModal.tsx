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

    // Resposta neutra no UI (anti-enumeração): sempre mostra “enviado”
    // e não revela se o e-mail existe. [page:11]
    try {
      await fetch('/api/resend-setup-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Intencionalmente não exibimos erro para não diferenciar casos.
      // (Se quiser, pode logar só em dev.)
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="bg-dark-card rounded-lg p-8 shadow-xl max-w-sm w-full relative border border-dark-border"
          onMouseDown={() => {
            backdropClickStartRef.current = false
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={!submitting ? onClose : undefined}
            className="absolute top-4 right-4 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
            aria-label="Fechar"
            disabled={submitting}
          >
            <X className="h-6 w-6" />
          </button>

          {isForgotPassword ? (
            <div>
              <h2 className="text-center text-2xl font-bold tracking-tight text-text-primary font-heading">
                Recuperar Senha
              </h2>
              <p className="mt-2 text-center text-sm text-text-secondary">
                Digite seu e-mail para receber o link.
              </p>
              <div className="mt-8">
                <form onSubmit={handlePasswordReset} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                      Email
                    </label>
                    <div className="mt-1">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full appearance-none rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-text-primary placeholder-text-secondary/70 shadow-sm focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {error && <p className="text-sm text-center text-red-500">{error}</p>}

                  <div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex w-full justify-center rounded-md border border-transparent bg-shopee-orange py-2 px-4 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:ring-offset-2 focus:ring-offset-dark-card disabled:opacity-50"
                    >
                      {submitting ? 'Enviando...' : 'Enviar link'}
                    </button>
                  </div>
                </form>

                <p className="mt-4 text-center text-sm">
                  <button
                    onClick={() => {
                      setIsForgotPassword(false)
                      setError(null)
                    }}
                    className="font-medium text-shopee-orange transition-opacity hover:opacity-80"
                    disabled={submitting}
                  >
                    Voltar para o login
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-center text-2xl font-bold tracking-tight text-text-primary font-heading">
                Acesse sua conta
              </h2>
              <div className="mt-8">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <label
                      htmlFor="email-modal"
                      className="block text-sm font-medium text-text-secondary"
                    >
                      Email
                    </label>
                    <div className="mt-1">
                      <input
                        id="email-modal"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full appearance-none rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-text-primary placeholder-text-secondary/70 shadow-sm focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password-modal"
                      className="block text-sm font-medium text-text-secondary"
                    >
                      Senha
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="password-modal"
                        name="password"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full appearance-none rounded-md border border-dark-border bg-dark-bg px-3 py-2 pr-10 text-text-primary placeholder-text-secondary/70 shadow-sm focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-shopee-orange transition-colors"
                        aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showPwd}
                        disabled={submitting}
                      >
                        {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <div className="flex items-center justify-end">
                    <div className="text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true)
                          setError(null)
                        }}
                        className="font-medium text-shopee-orange transition-opacity hover:opacity-80"
                        disabled={submitting}
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex w-full justify-center rounded-md border border-transparent bg-shopee-orange py-2 px-4 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:ring-offset-2 focus:ring-offset-dark-card disabled:opacity-50"
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
