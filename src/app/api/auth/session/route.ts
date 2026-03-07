// app/api/auth/session/route.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { session } = await req.json()

  if (!session) {
    return NextResponse.json({ error: 'Nenhuma sessão fornecida' }, { status: 400 })
  }

  // Criamos uma resposta inicial de sucesso
  const response = NextResponse.json({ message: 'Sessão definida' }, { status: 200 })

  // Criamos um cliente Supabase no lado do servidor
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // A resposta que enviaremos de volta para o navegador
          // já terá o cookie de sessão definido nela.
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // A MÁGICA: Usamos setSession para definir a autenticação no lado do servidor
  // a partir dos tokens que o cliente nos enviou.
  const { error } = await supabase.auth.setSession(session)

  if (error) {
    console.error("Erro ao definir a sessão no servidor:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Se tudo deu certo, a sessão agora está no cookie da 'response'
  // e podemos seguramente redirecionar para o dashboard.
  return response
}