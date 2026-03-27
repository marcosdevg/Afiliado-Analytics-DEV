// app/minha-conta/renovar/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { LogoutButton } from './LogoutButton'

const kiwifyLoginUrl = 'https://dashboard.kiwify.com/login?lang=pt'
const whatsappUrl = 'https://wa.me/5579999144028'

export default async function RenewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  if (!error && profile?.subscription_status === 'active') {
    redirect('/dashboard')
  }

  return (
    <div className="bg-dark-bg min-h-screen flex flex-col items-center justify-center font-sans p-4">

      {/* Logo */}
        <Image
          src="/logo.png"
          alt="Afiliado Analytics"
          width={240}
          height={40}
          priority
          className="object-contain"
        />

      {/* Card — shadow-md para sombra mais suave */}
      <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl shadow-md overflow-hidden">

        {/* Corpo */}
        <div className="px-6 py-8 text-center">

          {/* Ícone central */}
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>

          <h1 className="text-xl font-bold text-text-primary mb-3">
            Sua assinatura expirou
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed mb-8">
            Seu acesso ao dashboard foi pausado. Para continuar usando a ferramenta,
            gerencie sua assinatura e reative seu plano na Kiwify.
          </p>

          {/* Botão principal — Kiwify */}
          <Link
            href={kiwifyLoginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-shopee-orange to-orange-500 py-3 px-4 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:ring-offset-2 focus:ring-offset-dark-card"
          >
            Gerenciar Assinatura na Kiwify
            <ExternalLink className="h-4 w-4" />
          </Link>

          {/* Divisor */}
          <div className="my-5 flex items-center gap-3">
            <span className="flex-1 h-px bg-dark-border" />
            <span className="text-xs text-text-secondary">ou</span>
            <span className="flex-1 h-px bg-dark-border" />
          </div>

          {/* Botão de logout — Client Component */}
          <LogoutButton />
        </div>

        {/* Rodapé do card */}
        <div className="px-6 py-4 border-t border-dark-border bg-dark-bg/40 text-center">
          <p className="text-xs text-text-secondary">
            Dúvidas?{' '}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-shopee-orange hover:underline"
            >
           Chame no WhatsApp
            </a>
          </p>
        </div>
      </div>

      {/* Copyright */}
      <p className="mt-8 text-xs text-text-secondary/60">
        © 2026 Afiliado Analytics. Todos os direitos reservados.
      </p>
    </div>
  )
}
