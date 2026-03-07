// app/minha-conta/renovar/page.tsx
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'

const kiwifyLoginUrl = 'https://dashboard.kiwify.com/login?lang=pt'

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
    <div className="bg-slate-50 min-h-screen flex items-center justify-center font-sans p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Sua assinatura expirou</h1>
        <p className="text-slate-600 mb-6">
          Seu acesso ao dashboard foi pausado. Para continuar usando a ferramenta, por favor, gerencie sua assinatura e reative seu plano na Kiwify.
        </p>
        <Link
          href={kiwifyLoginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 py-3 px-4 text-lg font-bold text-white shadow-lg transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Gerenciar Assinatura na Kiwify
          <ExternalLink className="h-5 w-5" />
        </Link>
      </div>
    </div>
  )
}
