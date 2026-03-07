"use client";

import { useSupabase } from "@/app/components/auth/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Link as LinkIcon, 
  ArrowLeft,
  Globe,
  Tag,
  Calendar,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";

const MAX_LINKS = 15;
const DOMAIN = 'a.afiliadoanalytics.com.br';

export default function NovoLinkPage() {
  const context = useSupabase();
  const session = context?.session;
  const supabase = context?.supabase;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [currentLinkCount, setCurrentLinkCount] = useState(0);
  const [name, setName] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const checkLinkCount = useCallback(async () => {
    if (!supabase || !session) return;

    const { count } = await supabase
      .from('links')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    setCurrentLinkCount(count || 0);
  }, [supabase, session]);

  useEffect(() => {
    checkLinkCount();
  }, [checkLinkCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !session) return;

    setError("");
    setIsLoading(true);

    // Verificar limite de links
    if (currentLinkCount >= MAX_LINKS) {
      setError(`Você atingiu o limite de ${MAX_LINKS} links. Exclua alguns para criar novos.`);
      setIsLoading(false);
      return;
    }

    // Validações
    if (!name.trim()) {
      setError("Nome do link é obrigatório");
      setIsLoading(false);
      return;
    }

    if (!originalUrl.trim() || !originalUrl.startsWith('http')) {
      setError("URL original inválida (deve começar com http:// ou https://)");
      setIsLoading(false);
      return;
    }

    if (!slug.trim()) {
      setError("Slug é obrigatório");
      setIsLoading(false);
      return;
    }

    // Validar slug (apenas letras, números e hífens)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError("Slug deve conter apenas letras minúsculas, números e hífens");
      setIsLoading(false);
      return;
    }

    const tagsArray = tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const { error: insertError } = await supabase
      .from('links')
      .insert({
        user_id: session.user.id,
        name: name.trim(),
        original_url: originalUrl.trim(),
        domain: DOMAIN,
        slug: slug.trim().toLowerCase(),
        tags: tagsArray,
        expires_at: expiresAt || null,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        setError("Este slug já está em uso. Escolha outro.");
      } else {
        setError("Erro ao criar link: " + insertError.message);
      }
      setIsLoading(false);
      return;
    }

    router.push('/dashboard/links');
  };

  if (!session) {
    return <LoadingOverlay message="Carregando sessão..." />;
  }

  const previewUrl = slug ? `https://${DOMAIN}/${slug}` : `https://${DOMAIN}/seu-link`;
  const linksRemaining = MAX_LINKS - currentLinkCount;
  
  // Lógica de cores do aviso
  const isAtLimit = currentLinkCount >= MAX_LINKS;
  const isNearLimit = linksRemaining <= 3 && !isAtLimit;

  return (
    <>
      {isLoading && <LoadingOverlay message="Criando link..." />}
      
      <style jsx>{`
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: invert(58%) sepia(55%) saturate(2936%) hue-rotate(346deg) brightness(100%) contrast(92%);
          cursor: pointer;
        }
      `}</style>
      
      <div className="px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <Link
            href="/dashboard/links"
            className="p-2 rounded-md bg-dark-card border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange transition-colors w-fit"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">
            Criar Novo Link
          </h1>
        </div>

        {/* Aviso de limite com cores dinâmicas */}
        <div className={`mb-6 p-3 sm:p-4 rounded-md border flex items-start gap-2 sm:gap-3 ${
          isAtLimit
            ? 'bg-red-500/10 border-red-500/50' 
            : isNearLimit
            ? 'bg-yellow-500/10 border-yellow-500/50'
            : 'bg-blue-500/10 border-blue-500/30'
        }`}>
          <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
            isAtLimit
              ? 'text-red-500'
              : isNearLimit
              ? 'text-yellow-500'
              : 'text-blue-400'
          }`} />
          <div>
            <p className={`text-xs sm:text-sm font-semibold ${
              isAtLimit
                ? 'text-red-500'
                : isNearLimit
                ? 'text-yellow-500'
                : 'text-blue-400'
            }`}>
              {isAtLimit
                ? `Limite atingido! Você não pode criar mais links (${currentLinkCount}/${MAX_LINKS})`
                : `Você pode criar mais ${linksRemaining} link${linksRemaining !== 1 ? 's' : ''} (${currentLinkCount}/${MAX_LINKS} criados)`
              }
            </p>
            {isNearLimit && (
              <p className="text-xs text-yellow-500 mt-1">
                ⚠️ Você está próximo do limite. Exclua links inativos para liberar espaço.
              </p>
            )}
            {isAtLimit && (
              <p className="text-xs text-red-400 mt-1">
                Exclua alguns links para criar novos.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-2">
                  Nome do Link *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Campanha Black Friday"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#18181B] border border-[#27272A] rounded-md text-text-primary text-sm sm:text-base placeholder-[#52525B] focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:border-shopee-orange transition-all"
                  required
                />
                <p className="mt-1.5 text-xs text-[#C4C4C8]">
                  Um nome descritivo para identificar seu link
                </p>
              </div>

              <div>
                <label htmlFor="originalUrl" className="block text-sm font-medium text-text-primary mb-2">
                  Link Original *
                </label>
                <input
                  type="url"
                  id="originalUrl"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  placeholder="https://shopee.com.br/produto..."
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#18181B] border border-[#27272A] rounded-md text-text-primary text-sm sm:text-base placeholder-[#52525B] focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:border-shopee-orange transition-all"
                  required
                />
                <p className="mt-1.5 text-xs text-[#C4C4C8]">
                  URL para onde os usuários serão redirecionados
                </p>
              </div>

              <div>
                <label htmlFor="slug" className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Globe className="h-4 w-4 text-shopee-orange" />
                  Slug Personalizado *
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-text-secondary text-xs sm:text-sm whitespace-nowrap">
                    {DOMAIN}/
                  </span>
                  <input
                    type="text"
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="meu-link"
                    className="flex-grow px-3 sm:px-4 py-2.5 sm:py-3 bg-[#18181B] border border-[#27272A] rounded-md text-text-primary text-sm sm:text-base placeholder-[#52525B] focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:border-shopee-orange transition-all"
                    required
                  />
                </div>
                <p className="mt-1.5 text-xs text-[#C4C4C8]">
                  Apenas letras minúsculas, números e hífens
                </p>
              </div>

              <div>
                <label htmlFor="tags" className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Tag className="h-4 w-4 text-emerald-400" />
                  Tags (opcional)
                </label>
                <input
                  type="text"
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="black-friday, instagram, promoção"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#18181B] border border-[#27272A] rounded-md text-text-primary text-sm sm:text-base placeholder-[#52525B] focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:border-shopee-orange transition-all"
                />
                <p className="mt-1.5 text-xs text-[#C4C4C8]">
                  Separe as tags por vírgula para organização
                </p>
              </div>

              <div>
                <label htmlFor="expiresAt" className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  Data de Expiração (opcional)
                </label>
                <input
                  type="datetime-local"
                  id="expiresAt"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#18181B] border border-[#27272A] rounded-md text-text-primary text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:border-shopee-orange transition-all"
                />
                <p className="mt-1.5 text-xs text-[#C4C4C8]">
                  O link ficará inativo após esta data
                </p>
              </div>

              {error && (
                <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/50 rounded-md text-red-500 text-xs sm:text-sm flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || currentLinkCount >= MAX_LINKS}
                  className="w-full sm:flex-grow px-6 py-3 bg-shopee-orange text-white rounded-md hover:bg-[#F97316] transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm sm:text-base"
                >
                  Criar Link
                </button>
                <Link
                  href="/dashboard/links"
                  className="w-full sm:w-auto px-6 py-3 bg-dark-bg border border-dark-border text-text-secondary rounded-md hover:border-shopee-orange hover:text-shopee-orange transition-colors font-semibold text-center text-sm sm:text-base"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </div>

          <div className="bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-shopee-orange" />
              Preview do Link
            </h3>
            <div className="bg-[#18181B] p-4 sm:p-5 rounded-md border border-[#27272A]">
              <p className="text-xs sm:text-sm text-[#C4C4C8] mb-2">Seu link ficará assim:</p>
              <p className="text-shopee-orange font-mono text-sm sm:text-lg break-all font-medium">
                {previewUrl}
              </p>
            </div>
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
              <p className="text-xs sm:text-sm text-blue-400 leading-relaxed">
                💡 <strong>Dica:</strong> Após criar, você poderá ver estatísticas detalhadas de cliques e gerenciar o status do link.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
