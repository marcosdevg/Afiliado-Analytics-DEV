// app/(main)/layout.tsx
'use client'

import { Header } from '../components/layout/Header' // Ajuste o caminho se necessário
import { Footer } from '../components/layout/Footer' // Ajuste o caminho se necessário
import { useState } from 'react'
import LoginModal from '../components/auth/LoginModal' // Ajuste o caminho se necessário

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showLoginModal, setShowLoginModal] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <Header onLoginClick={() => setShowLoginModal(true)} />
      <main className="flex-grow">{children}</main>
      <Footer />
      
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </div>
  )
}