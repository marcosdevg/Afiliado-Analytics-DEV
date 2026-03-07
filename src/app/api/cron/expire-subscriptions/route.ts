// app/api/cron/expire-subscriptions/route.ts
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// Tipo do retorno do RPC
type GetProfilesToCancelRow = { email: string }

export async function GET(req: NextRequest) {
  // Produção: proteger com Authorization: Bearer CRON_SECRET
  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  if (isProd) {
    const auth = req.headers.get('authorization') || ''
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date().toISOString()

  // Seleciona e-mails que NÃO possuem nenhuma assinatura válida futura
  const { data: toCancelRows, error: rpcErr } = await supabase
    .rpc('get_profiles_to_cancel', { now_ts: now })
  if (rpcErr) return new Response(`RPC error: ${rpcErr.message}`, { status: 500 })

  // Mapeia o retorno do RPC para array de e‑mails sem usar any
  const rows: GetProfilesToCancelRow[] = (toCancelRows ?? []) as GetProfilesToCancelRow[]
  const emails: string[] = rows
    .map((r) => r.email)
    .filter((e): e is string => typeof e === 'string' && e.length > 0)

  if (emails.length === 0) return new Response('No changes', { status: 200 })

  const { error: upErr } = await supabase
    .from('profiles')
    .update({ subscription_status: 'canceled', access_until: null })
    .in('email', emails)
  if (upErr) return new Response(`Update error: ${upErr.message}`, { status: 500 })

  return new Response(`Canceled: ${emails.length}`, { status: 200 })
}
