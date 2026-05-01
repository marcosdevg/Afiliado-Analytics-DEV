"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { MinhaListaOfertasMlListsPanel } from "@/app/components/minha-lista-ofertas/MinhaListaOfertasMlListsPanel";
import { MinhaListaOfertasAmazonListsPanel } from "@/app/components/minha-lista-ofertas/MinhaListaOfertasAmazonListsPanel";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import {
  ShoppingBag,
  ArrowLeft,
  Loader2,
  Trash2,
  ExternalLink,
  ListChecks,
  FolderMinus,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  Lock,
} from "lucide-react";
import { Reorder } from "framer-motion";
import ConfirmModal from "@/app/components/ui/ConfirmModal";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { MERCADOLIVRE_UX_COMING_SOON } from "@/lib/mercadolivre-ux-coming-soon";
import { usePlanEntitlements } from "../PlanEntitlementsContext";
import ProFeatureGate from "../ProFeatureGate";
import MlEmBreveSplash from "@/app/components/ml/MlEmBreveSplash";

type Lista = {
  id: string;
  nome: string;
  totalItens: number;
  createdAt?: string;
};

type Item = {
  id: string;
  listaId: string;
  imageUrl: string;
  productName: string;
  priceOriginal: number | null;
  pricePromo: number | null;
  discountRate: number | null;
  converterLink: string;
  createdAt: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function displayPrecoPorLista(item: Item): string {
  const por =
    effectiveListaOfferPromoPrice(item.priceOriginal, item.pricePromo, item.discountRate) ?? item.pricePromo;
  return por != null ? formatCurrency(por) : "—";
}

type ListaStore = "shopee" | "ml" | "amazon";

export default function MinhaListaOfertasPage() {
  // Inicial não tem ML/Amazon — tabs continuam VISÍVEIS com cadeado (gatilho
  // de upgrade). O conteúdo ML/Amazon é envolto em ProFeatureGate, que mostra
  // o upsell do plano Padrão.
  const { entitlements } = usePlanEntitlements();
  const canUseMl = Boolean(entitlements?.mercadoLivre);
  const canUseAmazon = Boolean(entitlements?.amazon);

  const [listaStore, setListaStore] = useState<ListaStore>("shopee");
  const [listas, setListas] = useState<Lista[]>([]);
  const [itemsByLista, setItemsByLista] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingListaId, setLoadingListaId] = useState<string | null>(null);
  const [expandedListas, setExpandedListas] = useState<Set<string>>(new Set());
  const [filterByLista, setFilterByLista] = useState<Record<string, string>>({});
  const [pageByLista, setPageByLista] = useState<Record<string, number>>({});
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    type: "deleteItem" | "emptyList" | "deleteList";
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "default";
    payload: { itemId?: string; listaId: string };
  } | null>(null);
  const [isSyncingOrder, setIsSyncingOrder] = useState(false);
  const ITEMS_PER_PAGE = 5;
  const LISTAS_PER_PAGE = 4;
  const [listasPage, setListasPage] = useState(1);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const totalListasPages = Math.max(1, Math.ceil(listas.length / LISTAS_PER_PAGE));
  const pagedListas = useMemo(() => {
    const from = (listasPage - 1) * LISTAS_PER_PAGE;
    return listas.slice(from, from + LISTAS_PER_PAGE);
  }, [listas, listasPage]);

  useEffect(() => {
    setListasPage((p) => Math.min(Math.max(1, p), totalListasPages));
  }, [listas.length, totalListasPages]);

  const loadListas = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar listas");
      setListas(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar listas");
      setListas([]);
    }
  }, []);

  const loadItems = useCallback(async (listaId: string) => {
    setLoadingListaId(listaId);
    try {
      const res = await fetch(`/api/shopee/minha-lista-ofertas?lista_id=${listaId}`);
      const json = await res.json();
      if (!res.ok) return;
      setItemsByLista((prev) => ({ ...prev, [listaId]: Array.isArray(json?.data) ? json.data : [] }));
    } catch {
      setItemsByLista((prev) => ({ ...prev, [listaId]: [] }));
    } finally {
      setLoadingListaId(null);
    }
  }, []);

  useEffect(() => {
    if (listaStore !== "shopee") return;
    setLoading(true);
    setError(null);
    loadListas().finally(() => setLoading(false));
  }, [loadListas, listaStore]);

  useEffect(() => {
    if (listaStore !== "shopee") return;
    listas.forEach((l) => loadItems(l.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas, listaStore]);

  const handleDeleteItemClick = (itemId: string, listaId: string) => {
    setConfirmState({
      type: "deleteItem",
      title: "Remover produto",
      message: "Remover este produto da lista?",
      confirmLabel: "Remover",
      variant: "danger",
      payload: { itemId, listaId },
    });
  };

  const handleEmptyListClick = (listaId: string) => {
    setConfirmState({
      type: "emptyList",
      title: "Esvaziar lista",
      message: "Remover todos os produtos desta lista? A lista continuará existindo.",
      confirmLabel: "Esvaziar",
      variant: "danger",
      payload: { listaId },
    });
  };

  const handleDeleteListClick = (listaId: string) => {
    setConfirmState({
      type: "deleteList",
      title: "Apagar lista",
      message: "Apagar esta lista e todos os produtos? Não é possível desfazer.",
      confirmLabel: "Apagar",
      variant: "danger",
      payload: { listaId },
    });
  };

  const runConfirmAction = useCallback(async () => {
    if (!confirmState) return;
    const { type, payload } = confirmState;
    setConfirmLoading(true);
    try {
      if (type === "deleteItem" && payload.itemId) {
        const res = await fetch(`/api/shopee/minha-lista-ofertas?id=${payload.itemId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover");
        setItemsByLista((prev) => ({
          ...prev,
          [payload.listaId]: (prev[payload.listaId] ?? []).filter((i) => i.id !== payload.itemId),
        }));
        setListas((prev) => prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: Math.max(0, (l.totalItens ?? 0) - 1) } : l)));
      } else if (type === "emptyList") {
        const res = await fetch(`/api/shopee/minha-lista-ofertas?lista_id=${payload.listaId}&empty=1`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao esvaziar");
        setItemsByLista((prev) => ({ ...prev, [payload.listaId]: [] }));
        setListas((prev) => prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: 0 } : l)));
      } else if (type === "deleteList") {
        const res = await fetch(`/api/shopee/minha-lista-ofertas/listas?id=${payload.listaId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao apagar lista");
        setListas((prev) => prev.filter((l) => l.id !== payload.listaId));
        setItemsByLista((prev) => {
          const next = { ...prev };
          delete next[payload.listaId];
          return next;
        });
      }
      setConfirmState(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na ação");
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmState]);

  const handleConfirmCancel = useCallback(() => {
    if (!confirmLoading) setConfirmState(null);
  }, [confirmLoading]);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {}).catch(() => {});
  };

  const toggleLista = (listaId: string) => {
    setExpandedListas((prev) => {
      const next = new Set(prev);
      if (next.has(listaId)) next.delete(listaId);
      else next.add(listaId);
      return next;
    });
  };

  const handleReorder = (listaId: string, newOrder: Item[]) => {
    setItemsByLista((prev) => {
      const allItems = [...(prev[listaId] ?? [])];
      const filter = (filterByLista[listaId] ?? "").trim().toLowerCase();
      const page = pageByLista[listaId] ?? 1;

      if (filter) {
        const filteredIndices = allItems
          .map((item, idx) => ((item.productName || "").toLowerCase().includes(filter) ? idx : -1))
          .filter((idx) => idx !== -1);
        
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE;
        const pageIndices = filteredIndices.slice(from, to);

        pageIndices.forEach((originalIdx, i) => {
          if (newOrder[i]) {
            allItems[originalIdx] = newOrder[i];
          }
        });
      } else {
        const from = (page - 1) * ITEMS_PER_PAGE;
        allItems.splice(from, newOrder.length, ...newOrder);
      }

      return { ...prev, [listaId]: allItems };
    });
  };

  const saveNewOrder = async (listaId: string) => {
    // Cancela qualquer salvamento pendente para esta lista
    if (saveTimeoutRef.current[listaId]) {
      clearTimeout(saveTimeoutRef.current[listaId]);
    }

    // Agenda o salvamento para 500ms a partir de agora
    saveTimeoutRef.current[listaId] = setTimeout(async () => {
      const items = itemsByLista[listaId] || [];
      if (items.length === 0) return;

      setIsSyncingOrder(true);
      try {
        const res = await fetch("/api/shopee/minha-lista-ofertas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listaId,
            itemIds: items.map((i) => i.id),
          }),
        });

        if (!res.ok) throw new Error("Erro ao salvar ordem");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar nova ordem");
      } finally {
        setIsSyncingOrder(false);
        delete saveTimeoutRef.current[listaId];
      }
    }, 500);
  };

  const moveItem = (listaId: string, index: number, direction: "up" | "down") => {
    const items = [...(itemsByLista[listaId] ?? [])];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const [removed] = items.splice(index, 1);
    items.splice(newIndex, 0, removed);
    
    setItemsByLista((prev) => ({ ...prev, [listaId]: items }));
    // Auto-save for simple arrow moves
    fetch("/api/shopee/minha-lista-ofertas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listaId,
        itemIds: items.map((i) => i.id),
      }),
    });
  };

  const getFilteredAndPaginatedItems = (listaId: string) => {
    const items = itemsByLista[listaId] ?? [];
    const filter = (filterByLista[listaId] ?? "").trim().toLowerCase();
    const filtered = filter
      ? items.filter((i) => (i.productName || "").toLowerCase().includes(filter))
      : items;
    const page = pageByLista[listaId] ?? 1;
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const from = (page - 1) * ITEMS_PER_PAGE;
    const slice = filtered.slice(from, from + ITEMS_PER_PAGE);
    return { slice, totalPages, page, total: filtered.length };
  };

  const setListaPage = (listaId: string, page: number) => {
    setPageByLista((prev) => ({ ...prev, [listaId]: page }));
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {listaStore === "ml" && MERCADOLIVRE_UX_COMING_SOON ? (
            <button
              type="button"
              onClick={() => setListaStore("shopee")}
              className="p-2 rounded-lg border border-dark-border bg-dark-card text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors"
              title="Voltar para Shopee"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              href={
                listaStore === "shopee"
                  ? "/dashboard/gerador-links-shopee"
                  : listaStore === "ml"
                    ? "/dashboard/minha-lista-ofertas-ml"
                    : "/dashboard/minha-lista-ofertas-amazon"
              }
              className="p-2 rounded-lg border border-dark-border bg-dark-card text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          {listaStore === "shopee" ? (
            <img src="/shop.webp" alt="Shopee" className="w-12 object-contain" />
          ) : listaStore === "ml" ? (
            <img src="/ml.png" alt="Mercado Livre" className="w-12 h-12 object-contain" />
          ) : (
            <img src="/amazonlogo.webp" alt="Amazon" className="w-12 h-12 object-contain" />
          )}
          <h1 className="text-xl font-semibold">Minha Lista de Ofertas</h1>
        </div>

        {/*
          Tabs Mercado Livre / Amazon ficam SEMPRE visíveis como gatilho de
          venda; pra Inicial vão com cadeado e ao clicar mostram o
          ProFeatureGate (upsell do Padrão).
        */}
        <div
          className="mb-6 flex rounded-xl border border-dark-border bg-dark-card p-1"
          role="tablist"
          aria-label="Origem da lista"
        >
          <button
            type="button"
            role="tab"
            aria-selected={listaStore === "shopee"}
            onClick={() => setListaStore("shopee")}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              listaStore === "shopee"
                ? "bg-shopee-orange text-white shadow"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Shopee
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listaStore === "ml"}
            onClick={() => setListaStore("ml")}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              listaStore === "ml"
                ? "bg-[#e24c30] text-white shadow"
                : "text-text-secondary hover:text-text-primary"
            } ${!canUseMl ? "opacity-70" : ""}`}
          >
            <span>Mercado Livre</span>
            {!canUseMl && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listaStore === "amazon"}
            onClick={() => setListaStore("amazon")}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              listaStore === "amazon"
                ? "bg-amber-500 text-black shadow"
                : "text-text-secondary hover:text-text-primary"
            } ${!canUseAmazon ? "opacity-70" : ""}`}
          >
            <span>Amazon</span>
            {!canUseAmazon && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          </button>
        </div>

        {listaStore === "ml" ? (
          MERCADOLIVRE_UX_COMING_SOON ? (
            <div className="rounded-xl border border-dark-border bg-dark-card p-6 flex justify-center">
              <MlEmBreveSplash showBack={false} compact />
            </div>
          ) : (
            // Pra Inicial, ProFeatureGate exibe o upsell do plano Padrão.
            <ProFeatureGate feature="mercadoLivre">
              <MinhaListaOfertasMlListsPanel />
            </ProFeatureGate>
          )
        ) : listaStore === "amazon" ? (
          <ProFeatureGate feature="amazon">
            <MinhaListaOfertasAmazonListsPanel />
          </ProFeatureGate>
        ) : (
          <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden">
            <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
                  <ListChecks className="w-3 h-3 text-[#e24c30]" />
                </div>
                <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Minhas listas e produtos (Shopee)</h2>
                {!loading && listas.length > 0 ? (
                  <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">
                    {listas.length} {listas.length === 1 ? "lista" : "listas"}
                  </span>
                ) : null}
              </div>
              <Link
                href="/dashboard/gerador-links-shopee"
                className="text-[11px] font-medium text-[#e24c30] hover:underline shrink-0"
              >
                Gerador / histórico Shopee →
              </Link>
            </div>

            {error ? (
              <div className="px-3 py-2 border-b border-[#2c2c32] bg-red-500/5 text-[11px] text-red-400 flex items-center justify-between gap-2">
                <span className="min-w-0">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-[#a0a0a0] hover:text-white shrink-0"
                  aria-label="Fechar aviso"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : null}

            <div className="max-h-[min(70vh,720px)] overflow-y-auto bg-[#1c1c1f] scrollbar-thin">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#e24c30]" />
                </div>
              ) : listas.length === 0 ? (
                <div className="mx-auto my-8 flex max-w-sm flex-col items-center justify-center rounded-2xl px-4 py-12 text-center">
                  <ListChecks className="h-12 w-12 text-[#686868] mb-3" />
                  <p className="font-medium text-[#f0f0f2]">Nenhuma lista ainda</p>
                  <p className="text-xs text-[#bebebe] mt-2 leading-relaxed">
                    No Gerador de Links Shopee, use &quot;Adicionar a Minha Lista&quot; no histórico e crie ou escolha uma
                    lista.
                  </p>
                  <Link
                    href="/dashboard/gerador-links-shopee"
                    className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#e24c30] text-white text-xs font-semibold hover:bg-[#c94028] transition-colors"
                  >
                    Ir para Gerador de Links
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 p-3 sm:p-5">
                  <ul className="space-y-3">
                    {pagedListas.map((lista) => {
                      const isExpanded = expandedListas.has(lista.id);
                      const { slice, totalPages, page, total } = getFilteredAndPaginatedItems(lista.id);
                      return (
                        <li
                          key={lista.id}
                          className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden"
                        >
                          <div className="flex flex-wrap items-stretch gap-0">
                            <button
                              type="button"
                              onClick={() => toggleLista(lista.id)}
                              className="flex-1 min-w-0 p-4 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-[#2f2f34]/80 transition-colors"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-[#a0a0a0] shrink-0" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-[#a0a0a0] shrink-0" />
                                )}
                                {/* Listas criadas pelo wizard Sho.IA têm prefixo "🤖 Sho.IA · ".
                                    Detectamos e trocamos por imagem do mascote +
                                    nome amigável (sem o prefixo). */}
                                {(() => {
                                  const SHOIA_PREFIX = "🤖 Sho.IA · ";
                                  const isShoia = lista.nome.startsWith(SHOIA_PREFIX);
                                  const displayName = isShoia
                                    ? lista.nome.slice(SHOIA_PREFIX.length)
                                    : lista.nome;
                                  return (
                                    <>
                                      {isShoia ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src="/tendencias/cabecasho.png"
                                          alt=""
                                          aria-hidden
                                          className="w-8 h-8 shrink-0 object-contain"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-lg border border-[#e24c30]/35 bg-[#e24c30]/10 flex items-center justify-center shrink-0">
                                          <ShoppingBag className="h-4 w-4 text-[#e24c30]" />
                                        </div>
                                      )}
                                      <span className="text-sm font-bold uppercase tracking-wide text-[#f0f0f2] truncate">
                                        {displayName}
                                      </span>
                                    </>
                                  );
                                })()}
                                <span className="text-sm text-[#9a9aa2] shrink-0">
                                  ({lista.totalItens ?? 0} itens)
                                </span>
                              </span>
                            </button>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end px-4 py-4 pl-0 sm:pl-2 border-t border-[#2c2c32] sm:border-t-0 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => handleEmptyListClick(lista.id)}
                                disabled={(itemsByLista[lista.id]?.length ?? 0) === 0}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-[#e24c30]/10 hover:text-[#e24c30] hover:border-[#e24c30]/40 disabled:opacity-40"
                                title="Esvaziar lista"
                              >
                                <FolderMinus className="h-3.5 w-3.5" /> Esvaziar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteListClick(lista.id)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                title="Apagar lista"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Apagar
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-[#2c2c32] p-4 bg-[#1c1c1f]">
                              {loadingListaId === lista.id ? (
                                <div className="flex justify-center py-6">
                                  <Loader2 className="h-6 w-6 animate-spin text-[#e24c30]" />
                                </div>
                              ) : !itemsByLista[lista.id]?.length ? (
                                <p className="text-sm text-[#9a9aa2] py-4 text-center">
                                  Nenhum produto nesta lista.
                                </p>
                              ) : (
                                <>
                                    <div className="mb-3 flex items-center gap-2">
                                      <Search className="h-4 w-4 text-[#a0a0a0] shrink-0" />
                                      <input
                                        type="text"
                                        value={filterByLista[lista.id] ?? ""}
                                        onChange={(e) => {
                                          setFilterByLista((prev) => ({ ...prev, [lista.id]: e.target.value }));
                                          setPageByLista((prev) => ({ ...prev, [lista.id]: 1 }));
                                        }}
                                        placeholder="Filtrar por nome do produto..."
                                        className="flex-1 px-3 py-2 rounded-lg border border-[#2c2c32] bg-[#222228] text-[#f0f0f2] text-sm placeholder:text-[#6b6b72]"
                                      />
                                    </div>

                                <Reorder.Group
                                  axis="y"
                                  values={slice}
                                  onReorder={(newOrder) => handleReorder(lista.id, newOrder)}
                                  className="space-y-4"
                                >
                                  {slice.map((item, idx) => (
                                    <Reorder.Item
                                      key={item.id}
                                      value={item}
                                      onDragEnd={() => saveNewOrder(lista.id)}
                                      whileDrag={{ 
                                        scale: 1.02, 
                                        boxShadow: "0px 10px 30px rgba(0,0,0,0.5)",
                                        zIndex: 50 
                                      }}
                                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                      className="flex gap-4 p-3 rounded-xl border border-[#2c2c32] bg-[#222228] relative group hover:border-[#3e3e46] transition-colors touch-none"
                                    >
                                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[#3e3e46] group-hover:text-[#6b6b72] cursor-grab active:cursor-grabbing p-1">
                                        <GripVertical className="h-4 w-4" />
                                      </div>

                                      <div className="pl-6 flex gap-4 w-full">
                                        {item.imageUrl ? (
                                          <img
                                            src={item.imageUrl}
                                            alt=""
                                            className="w-20 h-20 object-contain rounded-lg bg-white shrink-0 border border-[#2c2c32]"
                                          />
                                        ) : (
                                          <div className="w-20 h-20 rounded-lg bg-[#1c1c1f] shrink-0 flex items-center justify-center border border-[#2c2c32] text-[#6b6b72] text-xs">
                                            —
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-medium text-[#f0f0f2] leading-snug">
                                              ✨ {item.productName || "Produto"}
                                            </p>
                                            
                                            <div className="flex flex-col gap-1">
                                              <button
                                                type="button"
                                                onClick={() => moveItem(lista.id, idx, "up")}
                                                disabled={idx === 0}
                                                className="p-1 rounded bg-[#2c2c32] text-[#a0a0a0] hover:text-white disabled:opacity-30 transition-colors"
                                                title="Mover para cima"
                                              >
                                                <ArrowUp className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => moveItem(lista.id, idx, "down")}
                                                disabled={idx === (itemsByLista[lista.id]?.length ?? 0) - 1}
                                                className="p-1 rounded bg-[#2c2c32] text-[#a0a0a0] hover:text-white disabled:opacity-30 transition-colors"
                                                title="Mover para baixo"
                                              >
                                                <ArrowDown className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                          <p className="text-sm text-[#9a9aa2] mt-1">
                                            💰 Preço:{" "}
                                            {item.discountRate != null && item.discountRate > 0 && (
                                              <span className="text-red-400 font-medium">
                                                  -{Math.round(item.discountRate)}%{" "}
                                                </span>
                                              )}
                                              <span className="text-[#9a9aa2]">🔴</span>{" "}
                                              <span className="line-through">
                                                {item.priceOriginal != null ? formatCurrency(item.priceOriginal) : "—"}
                                              </span>
                                              {" por "}
                                              <span className="text-emerald-400 font-medium">
                                                ✅ {displayPrecoPorLista(item)}
                                              </span>
                                            </p>
                                            <p className="text-sm font-medium text-[#f0f0f2] mt-1">
                                              🏷️ PROMOÇÃO - CLIQUE NO LINK 👇
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => copyLink(item.converterLink)}
                                              className="text-sm text-emerald-400 hover:underline break-all text-left"
                                            >
                                              {item.converterLink}
                                            </button>
                                            <div className="flex items-center gap-2 mt-2">
                                              <a
                                                href={item.converterLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-[#e24c30] hover:underline flex items-center gap-1"
                                              >
                                                <ExternalLink className="h-3 w-3" /> Abrir link
                                              </a>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteItemClick(item.id, lista.id)}
                                                className="text-xs text-red-400 hover:underline flex items-center gap-1 ml-auto"
                                              >
                                                <Trash2 className="h-3 w-3" /> Remover
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </Reorder.Item>
                                    ))}
                                  </Reorder.Group>

                                  {totalPages > 1 && (
                                    <GeradorPaginationBar
                                      className="mt-4 border-t border-[#2c2c32] pt-3"
                                      page={page}
                                      totalPages={totalPages}
                                      summary={`Mostrando ${slice.length} de ${total} produto(s)`}
                                      onPrev={() => setListaPage(lista.id, Math.max(1, page - 1))}
                                      onNext={() => setListaPage(lista.id, Math.min(totalPages, page + 1))}
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {listas.length > 0 ? (
                    <div className="rounded-xl border border-[#2c2c32] bg-[#222228] px-3 py-3">
                      <GeradorPaginationBar
                        page={listasPage}
                        totalPages={totalListasPages}
                        summary={`Mostrando ${pagedListas.length} de ${listas.length} lista(s)`}
                        onPrev={() => setListasPage((p) => Math.max(1, p - 1))}
                        onNext={() => setListasPage((p) => Math.min(totalListasPages, p + 1))}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {listaStore === "shopee" && confirmState && (
          <ConfirmModal
            open={!!confirmState}
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            cancelLabel="Cancelar"
            variant={confirmState.variant}
            loading={confirmLoading}
            onConfirm={runConfirmAction}
            onCancel={handleConfirmCancel}
          />
        )}
      </div>
    </div>
  );
}
