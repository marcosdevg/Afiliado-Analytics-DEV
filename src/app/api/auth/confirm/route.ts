import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { access_token, refresh_token } = await request.json()

  // Usamos as chaves de admin para criar um cliente seguro no lado do servidor
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Usamos os tokens recebidos para obter a sessão do usuário
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })

  if (error) {
    console.error('Erro ao confirmar o token:', error)
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // Se tudo deu certo, a 'data' contém a sessão e o usuário
  // E o cookie de sessão já foi definido no navegador do usuário
  return NextResponse.json({ user: data.user }, { status: 200 })
}