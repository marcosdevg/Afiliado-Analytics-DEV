// components/account/ChangePasswordModal.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../../utils/supabase/client'
import { Lock, X, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'

type ChangePasswordModalProps = {
  onClose: () => void
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const reqs = [
    { key: 'len', label: '8+ caracteres', ok: newPassword.length >= 8 },
    { key: 'lc', label: '1 letra minúscula', ok: /[a-z]/.test(newPassword) },
    { key: 'uc', label: '1 letra maiúscula', ok: /[A-Z]/.test(newPassword) },
    { key: 'dg', label: '1 número', ok: /[0-9]/.test(newPassword) },
  ]
  const meetsAll = reqs.every(r => r.ok)

  // ESC para fechar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose]) // [web:1274][web:1279]

  // Fechar apenas se mousedown e mouseup acontecerem no backdrop
  const pointerDownOnBackdrop = useRef(false)
  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    pointerDownOnBackdrop.current = e.target === e.currentTarget
  }
  const handleBackdropMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const upOnBackdrop = e.target === e.currentTarget
    if (pointerDownOnBackdrop.current && upOnBackdrop) onClose()
    pointerDownOnBackdrop.current = false
  } // [web:1272][web:1273]

  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (!newPassword || newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      setLoading(false)
      return
    }
    if (!meetsAll) {
      setError('A senha não atende aos requisitos mínimos.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setError(`Erro: ${error.message}`)
      setLoading(false)
      return
    }

    setMessage('Senha alterada com sucesso!')
    setLoading(false)
    setTimeout(() => onClose(), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-dark-border bg-dark-card shadow-lg shadow-shopee-orange/10 ring-1 ring-transparent transition-colors"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-shopee-orange/50"
          aria-label="Fechar"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="border-b border-dark-border px-6 py-6">
          <div className="text-center">
            <Lock className="mx-auto h-10 w-10 text-shopee-orange" />
            <h2 id="change-password-title" className="mt-4 font-heading text-2xl font-bold text-text-primary">
              Alterar senha
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Defina a sua nova senha para a sua conta.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordUpdate} className="space-y-5 px-6 py-6">
          {/* Nova senha */}
          <div>
            <label htmlFor="new-password-modal" className="mb-1 block text-sm text-text-secondary">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="new-password-modal"
                name="new-password"
                type={showNew ? 'text' : 'password'}
                placeholder="Digite a nova senha"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="block w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 pr-10 text-text-primary placeholder:text-text-secondary/70 ring-1 ring-transparent focus:border-shopee-orange focus:outline-none focus:ring-2 focus:ring-shopee-orange/40 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-shopee-orange"
                aria-label={showNew ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div>
            <label htmlFor="confirm-password-modal" className="mb-1 block text-sm text-text-secondary">
              Confirme a nova senha
            </label>
            <div className="relative">
              <input
                id="confirm-password-modal"
                name="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirme a nova senha"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="block w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 pr-10 text-text-primary placeholder:text-text-secondary/70 ring-1 ring-transparent focus:border-shopee-orange focus:outline-none focus:ring-2 focus:ring-shopee-orange/40 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-shopee-orange"
                aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Checklist e alertas mantidos */}
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
            {reqs.map((r) => (
              <div
                key={r.key}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 ${r.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-dark-border bg-dark-card/50 text-text-secondary'}`}
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
          {message && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-200 text-sm text-center">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md bg-shopee-orange py-2.5 px-4 text-sm font-semibold text-white shadow-lg shadow-shopee-orange/20 hover:brightness-110 hover:shadow-shopee-orange/30 focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 disabled:opacity-60"
          >
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  )
}
