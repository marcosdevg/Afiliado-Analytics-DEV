// app/(main)/dashboard/page.tsx
import { createClient } from '../../../../utils/supabase/server'
import { redirect } from 'next/navigation'
import CommissionsPage from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  if (error) redirect('/')
  if (profile?.subscription_status !== 'active') redirect('/minha-conta/renovar')

  return <CommissionsPage />
}
