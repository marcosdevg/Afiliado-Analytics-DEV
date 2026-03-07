// app/dashboard/links/editar/[id]/page.tsx
"use client";

import { useSupabase } from "@/app/components/auth/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { X } from "lucide-react";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";

interface LinkData {
  id: string;
  name: string;
  original_url: string;
  slug: string;
  tags: string[];
  expires_at: string | null;
  active: boolean;
}

export default function EditarLinkPage() {
  const context = useSupabase();
  const session = context?.session;
  const supabase = context?.supabase;
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Estados do formulário
  const [name, setName] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  const fetchLink = useCallback(async () => {
    if (!supabase) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('id', linkId)
      .single();

    if (!error && data) {
      setLinkData(data);
      setName(data.name);
      setOriginalUrl(data.original_url);
      setSlug(data.slug);
    } else {
      router.push('/dashboard/links');
    }
    setIsLoading(false);
  }, [supabase, linkId, router]);

  useEffect(() => {
    if (session && supabase) {
      fetchLink();
    }
  }, [session, supabase, fetchLink]);

  const handleSave = async () => {
    if (!supabase || !linkData) return;

    setError("");
    setIsSaving(true);

    // Validações
    if (!name.trim()) {
      setError("Nome do link é obrigatório");
      setIsSaving(false);
      return;
    }

    if (!originalUrl.trim() || !originalUrl.startsWith('http')) {
      setError("URL original inválida");
      setIsSaving(false);
      return;
    }

    // Não permitir alterar o slug (conforme imagem de referência)
    const { error: updateError } = await supabase
      .from('links')
      .update({
        name: name.trim(),
        original_url: originalUrl.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', linkId);

    if (updateError) {
      setError("Erro ao salvar alterações: " + updateError.message);
      setIsSaving(false);
      return;
    }

    setShowModal(false);
    router.push('/dashboard/links');
  };

  useEffect(() => {
    if (linkData) {
      setShowModal(true);
    }
  }, [linkData]);

  if (!session) {
    return <LoadingOverlay message="Carregando sessão..." />;
  }

  if (isLoading) {
    return <LoadingOverlay message="Carregando link..." />;
  }

  return (
    <>
      {isSaving && <LoadingOverlay message="Salvando alterações..." />}
      
      {/* Backdrop */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => router.push('/dashboard/links')}
        />
      )}

      {/* Modal */}
      {showModal && linkData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-lg border border-dark-border w-full max-w-lg shadow-2xl">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-text-primary">Editar Link</h2>
              <button
                onClick={() => router.push('/dashboard/links')}
                className="p-1 rounded-md text-text-secondary hover:text-shopee-orange hover:bg-dark-bg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-secondary mb-4">
                Edite os detalhes do link. O slug não pode ser alterado.
              </p>

              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-text-primary mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-shopee-orange"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-url" className="block text-sm font-medium text-text-primary mb-2">
                  URL de destino
                </label>
                <input
                  type="url"
                  id="edit-url"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-shopee-orange"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-slug" className="block text-sm font-medium text-text-primary mb-2">
                  Slug
                </label>
                <input
                  type="text"
                  id="edit-slug"
                  value={slug}
                  disabled
                  className="w-full px-4 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-text-secondary cursor-not-allowed"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-500 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-border">
              <button
                onClick={() => router.push('/dashboard/links')}
                className="px-4 py-2 bg-dark-bg border border-dark-border text-text-secondary rounded-md hover:border-shopee-orange hover:text-shopee-orange transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
