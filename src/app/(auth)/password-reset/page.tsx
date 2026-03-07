import { Suspense } from 'react'
import PasswordResetClient from './password-reset-client'

export default function PasswordResetPage() {
  return (
    <Suspense fallback={<div className="p-6">Carregando…</div>}>
      <PasswordResetClient />
    </Suspense>
  )
}
