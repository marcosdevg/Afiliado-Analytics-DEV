// src/app/(main)/dashboard/admin/convites/page.tsx
import { createClient } from '../../../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import ConvitesClient from './convites-client';
import { AlertCircle } from 'lucide-react';

const AUTHORIZED_EMAILS = [
  "marcosgomes7455@gmail.com",
  "erik15branca@gmail.com"
];

export default async function ConvitesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  if (profile?.subscription_status !== 'active') {
    redirect('/minha-conta/renovar');
  }

  // Verificar se é admin autorizado
  const isAuthorized = AUTHORIZED_EMAILS.includes(user.email || '');

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">Acesso Negado</h1>
          <p className="text-text-secondary mb-6">
            Você não tem permissão para acessar esta página.
          </p>

          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity"
          >
            Voltar para o Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Se for autorizado, renderiza o componente client
  return <ConvitesClient />;
}
