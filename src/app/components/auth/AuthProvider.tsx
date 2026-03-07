'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '../../../../utils/supabase/client'
import type { SupabaseClient, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

type SupabaseContextType = {
  supabase: SupabaseClient
  session: Session | null
}

const SupabaseContext = createContext<SupabaseContextType | null>(null)

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const [session, setSession] = useState<Session | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Inicializa a sessão para UI do cliente (ok no browser)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuta mudanças de auth e mantém o estado em sincronia
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // Redireciona do checkout para o dashboard após login (lado do cliente)
  useEffect(() => {
    if (session) {
      if (window.location.pathname.startsWith('/checkout')) {
        router.push('/dashboard')
      }
    }
  }, [session, router])

  return (
    <SupabaseContext.Provider value={{ supabase, session }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}
