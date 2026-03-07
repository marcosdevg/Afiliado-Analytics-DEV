"use client";

import { useSupabase } from "@/app/components/auth/AuthProvider";
import { useEffect, useState, useMemo, useCallback } from "react";
import { 
  Link as LinkIcon, 
  Plus, 
  Copy, 
  Edit, 
  Trash2, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Calendar,
  MousePointerClick,
  Clock,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";
import CustomSelect from "@/app/components/ui/CustomSelect";

interface LinkData {
  id: string;
  name: string;
  original_url: string;
  domain: string;
  slug: string;
  tags: string[];
  expires_at: string | null;
  active: boolean;
  click_count: number;
  created_at: string;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type SortOption = 'newest' | 'oldest' | 'most-clicks' | 'least-clicks';

const MAX_LINKS = 15;

export default function LinksPage() {
  const context = useSupabase();
  const session = context?.session;
  const supabase = context?.supabase;

  const [links, setLinks] = useState<LinkData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Estados dos filtros
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Estados do modal de confirmação
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!supabase) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLinks(data);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (session && supabase) {
      fetchLinks();
    }
  }, [session, supabase, fetchLinks]);

  // Extrair todas as tags únicas dos links
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    links.forEach(link => {
      if (link.tags) {
        link.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [links]);

  // Filtrar e ordenar links
  const filteredAndSortedLinks = useMemo(() => {
    let filtered = [...links];

    if (statusFilter === 'active') {
      filtered = filtered.filter(link => link.active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(link => !link.active);
    }

    if (tagFilter !== 'all') {
      filtered = filtered.filter(link => 
        link.tags && link.tags.includes(tagFilter)
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most-clicks':
          return b.click_count - a.click_count;
        case 'least-clicks':
          return a.click_count - b.click_count;
        default:
          return 0;
      }
    });

    return filtered;
  }, [links, statusFilter, tagFilter, sortBy]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setLinkToDelete({ id, name });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!supabase || !linkToDelete) return;
    
    setIsDeleting(true);
    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', linkToDelete.id);

    if (!error) {
      await fetchLinks();
    }
    
    setIsDeleting(false);
    setShowDeleteModal(false);
    setLinkToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setLinkToDelete(null);
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    if (!supabase) return;
    
    const { error } = await supabase
      .from('links')
      .update({ active: !currentActive })
      .eq('id', id);

    if (!error) {
      fetchLinks();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Opções para os selects customizados
  const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
  ];

  const tagOptions = [
    { value: 'all', label: 'Todas as tags' },
    ...allTags.map(tag => ({ value: tag, label: tag })),
  ];

  const sortOptions = [
    { value: 'newest', label: 'Mais Recentes' },
    { value: 'oldest', label: 'Mais Antigos' },
    { value: 'most-clicks', label: 'Mais Clicks' },
    { value: 'least-clicks', label: 'Menos Clicks' },
  ];

  if (!session) {
    return <LoadingOverlay message="Carregando sessão..." />;
  }

  return (
    <>
      {isLoading && <LoadingOverlay message="Carregando links..." />}
      
      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-fade-in"
            onClick={cancelDelete}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-zoom-in-95">
            <div className="bg-dark-card rounded-lg border border-dark-border w-full max-w-md shadow-2xl">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-text-primary">
                      Excluir Link
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      Esta ação não pode ser desfeita
                    </p>
                  </div>
                </div>
                
                <p className="text-text-secondary text-sm mb-6">
                  Tem certeza que deseja excluir o link <span className="font-semibold text-text-primary">&quot;{linkToDelete?.name}&quot;</span>? 
                  Todos os dados de cliques também serão removidos permanentemente.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={cancelDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 bg-dark-bg border border-dark-border text-text-secondary rounded-md hover:border-shopee-orange hover:text-shopee-orange transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'Excluindo...' : 'Excluir Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      <div>
        {/* Cabeçalho com filtros inline */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-text-primary font-heading">
              Meus Links
            </h1>
            <Link
              href="/dashboard/links/novo"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity font-semibold"
            >
              <Plus className="h-5 w-5" />
              <span className="sm:inline">Criar Novo Link</span>
            </Link>
          </div>

          {/* Filtros inline com CustomSelect */}
          {links.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro de Status */}
              <CustomSelect
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={statusOptions}
              />

              {/* Filtro de Tags */}
              {allTags.length > 0 && (
                <CustomSelect
                  value={tagFilter}
                  onChange={setTagFilter}
                  options={tagOptions}
                />
              )}

              {/* Ordenação */}
              <CustomSelect
                value={sortBy}
                onChange={(value) => setSortBy(value as SortOption)}
                options={sortOptions}
              />

              {/* Contador de resultados mostrando filtrados vs máximo de 15 */}
              <span className="ml-auto text-xs text-text-secondary font-medium">
                {links.length} de {MAX_LINKS} link{links.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {links.length === 0 ? (
          <div className="bg-dark-card p-8 sm:p-12 rounded-lg border border-dark-border text-center">
            <LinkIcon className="h-12 sm:h-16 w-12 sm:w-16 text-text-secondary/30 mx-auto mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-2">
              Nenhum link criado ainda
            </h2>
            <p className="text-sm sm:text-base text-text-secondary mb-6">
              Crie seu primeiro link curto para começar a rastrear cliques
            </p>
            <Link
              href="/dashboard/links/novo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity font-semibold"
            >
              <Plus className="h-5 w-5" />
              Criar Primeiro Link
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedLinks.map((link) => {
              const shortUrl = `https://a.afiliadoanalytics.com.br/${link.slug}`;
              const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
              
              return (
                <div
                  key={link.id}
                  className="bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border hover:border-shopee-orange/30 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-grow space-y-3">
                      <div className="flex items-start gap-3">
                        <LinkIcon className="h-5 w-5 text-shopee-orange mt-1 flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-1 break-words">
                            {link.name}
                          </h3>
                          <div className="space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                              <span className="text-text-secondary whitespace-nowrap">Link curto:</span>
                              <button
                                onClick={() => copyToClipboard(shortUrl, link.id)}
                                className="text-shopee-orange hover:underline flex items-center gap-1 font-mono break-all text-left"
                              >
                                {shortUrl}
                                {copiedId === link.id ? (
                                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                                ) : (
                                  <Copy className="h-4 w-4 flex-shrink-0" />
                                )}
                              </button>
                            </div>
                            <div className="text-sm text-text-secondary">
                              <span className="whitespace-nowrap">Destino:</span>{" "}
                              <a
                                href={link.original_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-link hover:underline break-all"
                              >
                                {link.original_url}
                                <ExternalLink className="inline h-3 w-3 ml-1" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm ml-8">
                        <div className="flex items-center gap-2">
                          <MousePointerClick className="h-4 w-4 text-text-secondary" />
                          <span className="text-emerald-400 font-semibold">
                            {link.click_count}
                          </span>
                          <span className="text-emerald-400">cliques</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-text-secondary" />
                          <span className="text-text-secondary text-xs sm:text-sm">
                            {formatDate(link.created_at)}
                          </span>
                        </div>

                        {link.expires_at && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-text-secondary" />
                            <span className="text-text-secondary text-xs sm:text-sm">
                              Expira: {new Date(link.expires_at).toLocaleDateString('pt-BR')}
                            </span>
                            {isExpired && (
                              <span className="text-red-500 text-xs font-semibold">
                                (Expirado)
                              </span>
                            )}
                          </div>
                        )}

                        {link.tags && link.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {link.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-dark-border">
                      <button
                        onClick={() => toggleActive(link.id, link.active)}
                        className={`p-2 rounded-md transition-colors ${
                          link.active
                            ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                        }`}
                        title={link.active ? 'Desativar' : 'Ativar'}
                      >
                        {link.active ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </button>

                      <Link
                        href={`/dashboard/links/editar/${link.id}`}
                        className="p-2 rounded-md bg-dark-bg text-text-secondary hover:text-shopee-orange hover:bg-dark-border transition-colors"
                        title="Editar"
                      >
                        <Edit className="h-5 w-5" />
                      </Link>

                      <button
                        onClick={() => handleDeleteClick(link.id, link.name)}
                        className="p-2 rounded-md bg-dark-bg text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
