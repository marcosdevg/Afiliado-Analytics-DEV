'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import LoadingOverlay from '../../components/ui/LoadingOverlay'
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function PasswordResetClient() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ready, setReady] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const type = searchParams.get('type') || ''
  const token_hash = searchParams.get('token_hash') || ''

  const isRecoveryLink = type === 'recovery' && !!token_hash

  const reqs = [
    { key: 'len', label: '8+ caracteres', ok: password.length >= 8 },
    { key: 'lc', label: '1 letra minúscula', ok: /[a-z]/.test(password) },
    { key: 'uc', label: '1 letra maiúscula', ok: /[A-Z]/.test(password) },
    { key: 'dg', label: '1 número', ok: /[0-9]/.test(password) },
  ]
  const meetsAll = reqs.every((r) => r.ok)

  const mapSupabaseError = (msg?: string) => {
    if (!msg) return 'Erro ao configurar senha.'
    if (/otp_expired|expired/i.test(msg)) return 'Link inválido ou expirado. Solicite um novo.'
    if (/invalid/i.test(msg) && /token/i.test(msg)) return 'Link inválido ou expirado. Solicite um novo.'
    if (/auth session missing/i.test(msg)) return 'Sessão ausente. Abra o link do e‑mail novamente.'
    if (/Password should contain at least one character of each/i.test(msg)) {
      return 'A senha não atende aos requisitos mínimos.'
    }
    if (/at least/i.test(msg) && /characters?/i.test(msg)) {
      return 'A senha precisa ter no mínimo 8 caracteres.'
    }
    return msg
  }

  const cleanUrlParamsAfterSuccess = () => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.delete('token_hash')
    url.searchParams.delete('type')
    const qs = url.searchParams.toString()
    history.replaceState({}, document.title, url.pathname + (qs ? `?${qs}` : ''))
  }

  const redirectToDashboard = () => {
    setRedirecting(true)
    setError(null)

    router.replace('/dashboard')

    setTimeout(() => {
      try {
        if (window.location.pathname.startsWith('/password-reset')) {
          window.location.assign('/dashboard')
        }
      } catch {
        window.location.href = '/dashboard'
      }
    }, 250)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setReady(false)
        // Não validamos token aqui (KaBuM-like): só preparamos a tela.
        // Mas garantimos que o client está OK.
        await supabase.auth.getSession()
      } finally {
        if (alive) setReady(true)
      }
    })()

    return () => {
      alive = false
    }
  }, [supabase])

  // Importante: não deixar sessão existente liberar a tela.
  const canProceed = !redirecting && isRecoveryLink

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || redirecting) return

    setError(null)

    if (!isRecoveryLink) {
      setError('Link inválido ou expirado. Solicite um novo.')
      return
    }

    if (!password || password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    if (!meetsAll) {
      setError('A senha não atende aos requisitos mínimos.')
      return
    }

    setLoading(true)
    try {
      // 1) SEMPRE validar o token no submit (mesmo se já houver sessão no aparelho).
      // Isso impede o “reset infinito” no celular. [page:23]
      const { data: vData, error: vErr } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'recovery',
      })

      if (vErr) {
        setError(mapSupabaseError(vErr.message))
        return
      }

      // 2) Garantir “login automático” persistindo a sessão retornada
      if (vData?.session?.access_token && vData?.session?.refresh_token) {
        const { error: sErr } = await supabase.auth.setSession({
          access_token: vData.session.access_token,
          refresh_token: vData.session.refresh_token,
        })
        if (sErr) {
          setError(mapSupabaseError(sErr.message))
          return
        }
      }

      // 3) Troca a senha
      const { error: updErr } = await supabase.auth.updateUser({ password })
      if (updErr) {
        setError(mapSupabaseError(updErr.message))
        return
      }

      // 4) Pós-sucesso (best effort)
      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes?.user?.id
      if (userId) {
        await supabase.from('profiles').update({ account_setup_pending: false }).eq('id', userId)
      }

      // 5) Limpa URL + redireciona (e trava UI)
      cleanUrlParamsAfterSuccess()
      redirectToDashboard()
      return
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return <LoadingOverlay message="Preparando redefinição de senha..." />
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-dark-bg text-text-secondary bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-shopee-orange/10 via-transparent to-transparent">
      {(loading || redirecting) && (
        <LoadingOverlay message={redirecting ? 'Senha atualizada. Redirecionando…' : 'Salvando senha...'} />
      )}

      <div className="container mx-auto max-w-lg px-4 py-10">
        <div className="rounded-lg border border-dark-border bg-dark-card shadow-lg shadow-shopee-orange/10 ring-1 ring-transparent transition-colors hover:ring-shopee-orange/20">
          <div className="border-b border-dark-border px-6 py-5">
            <h1 className="font-heading text-2xl font-bold text-text-primary">Definir senha</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Crie uma senha para acessar o painel do Afiliado Analytics.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5 px-6 py-6">
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 pr-10 text-text-primary placeholder:text-text-secondary/70 ring-1 ring-transparent focus:border-shopee-orange focus:outline-none focus:ring-2 focus:ring-shopee-orange/40"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={!canProceed || loading || redirecting}
                  placeholder="Crie uma senha forte"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-shopee-orange transition-colors"
                  aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                  disabled={loading || redirecting}
                >
                  {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">Confirmar senha</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 pr-10 text-text-primary placeholder:text-text-secondary/70 ring-1 ring-transparent focus:border-shopee-orange focus:outline-none focus:ring-2 focus:ring-shopee-orange/40"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  disabled={!canProceed || loading || redirecting}
                  placeholder="Repita a senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-shopee-orange transition-colors"
                  aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                  disabled={loading || redirecting}
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {reqs.map((r) => (
                <div
                  key={r.key}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1 ${
                    r.ok
                      ? 'border-green-500/20 bg-green-500/10 text-green-400'
                      : 'border-dark-border bg-dark-card/40 text-text-secondary'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{r.label}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-shopee-orange px-5 py-2.5 font-semibold text-white shadow-lg shadow-shopee-orange/20 hover:brightness-110 hover:shadow-shopee-orange/30 focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 disabled:opacity-60"
              disabled={loading || redirecting || !canProceed}
            >
              {loading ? 'Salvando…' : redirecting ? 'Redirecionando…' : 'Salvar senha'}
            </button>

            {/* Evita “piscar” Link expirado por trás durante redirect */}
            {!canProceed && !redirecting && !loading && (
              <div className="rounded-md border-2 border-red-500 bg-red-500/15 p-3 shadow-md shadow-red-500/20">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
                  <div className="flex-1">
                    <h3 className="mb-0.5 text-sm font-semibold text-red-500">Link expirado</h3>
                    <p className="text-xs text-text-primary/90">
                      O link de redefinição pode ter expirado. Solicite um novo em &quot;Login&quot;
                      &gt; &quot;Esqueci a senha&quot;.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
