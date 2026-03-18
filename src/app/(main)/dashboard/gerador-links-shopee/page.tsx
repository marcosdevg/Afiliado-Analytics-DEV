"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Link2, Sparkles, Trash2, Search, ExternalLink, ShoppingBag,
  Hand, ListPlus, AlertCircle, Loader2, ChevronLeft, ChevronRight,
  ImageIcon, Share2, Copy, MessageCircle, Download, TrendingUp, X,
  Plus, Info, Zap, Star, Tag, CheckCircle2, Check,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductOffer = {
  itemId: number; productName: string; productLink: string; offerLink: string;
  imageUrl: string; priceMin: number; priceMax: number; priceDiscountRate: number;
  sales: number; ratingStar: number; commissionRate: number; commission: number; shopName: string;
};

type HistoryEntry = {
  id: string; shortLink: string; originUrl: string; subId1: string; subId2: string;
  subId3: string; observation: string; productName: string; slug: string; imageUrl: string;
  commissionRate: number; commissionValue: number; priceShopee: number | null;
  priceShopeeOriginal: number | null; priceShopeeDiscountRate: number | null; createdAt: string;
};

// ─── Utils ────────────────────────────────────────────────────────────────────
function extractItemIdFromUrl(url: string): number | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/[.-]i\.(\d+)\.(\d+)/);
  if (match) return parseInt(match[2], 10);
  return null;
}

function extractSlugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+/, "").trim();
    const withoutQuery = path.split("?")[0];
    const parts = withoutQuery.split(/[.-]i\.\d+\.\d+/);
    return (parts[0] || path || "").replace(/^-+|-+$/g, "");
  } catch { return ""; }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}

// ─── Portal Tooltip ───────────────────────────────────────────────────────────
function Tooltip({ text, children, wide }: { text: string; children?: React.ReactNode; wide?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);

  const tooltip = visible ? createPortal(
    <span style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
      className={`pointer-events-none ${wide ? "w-72" : "w-56"} p-2.5 bg-[#111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#bbb] leading-relaxed whitespace-normal block`}>
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111]" />
    </span>, document.body
  ) : null;

  return (
    <span ref={anchorRef} className="relative inline-flex items-center" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children ?? (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#333]/80 text-[#888] hover:bg-shopee-orange/20 hover:text-shopee-orange transition-colors cursor-help">
          <Info className="h-2.5 w-2.5" />
        </span>
      )}
      {tooltip}
    </span>
  );
}

// ─── Custom Checkbox ──────────────────────────────────────────────────────────
function OrangeCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`shrink-0 w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
        checked ? "bg-shopee-orange border-shopee-orange shadow-[0_0_8px_rgba(238,77,45,0.4)]" : "bg-dark-bg border-dark-border hover:border-shopee-orange/50"
      }`}>
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,6 5,9 10,3" />
        </svg>
      )}
    </button>
  );
}

// ─── Product card (usado nas listas de resultados) ────────────────────────────
function ProductRow({ product, onSelect, compact, selected }: { product: ProductOffer; onSelect: () => void; compact?: boolean; selected?: boolean }) {
  const commPct = ((product.commissionRate ?? 0) * 100).toFixed(1);
  return (
    <button type="button" onClick={onSelect}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all group ${
        selected
          ? "border-shopee-orange bg-shopee-orange/10 shadow-[0_0_0_1px_rgba(238,77,45,0.3)]"
          : "border-dark-border hover:border-shopee-orange/40 bg-dark-bg/60 hover:bg-dark-bg"
      }`}>
      {product.imageUrl
        ? <img src={product.imageUrl} alt="" className={`${compact ? "w-10 h-10" : "w-12 h-12"} object-contain rounded-lg bg-white/5 shrink-0`} />
        : <div className={`${compact ? "w-10 h-10" : "w-12 h-12"} rounded-lg bg-dark-card shrink-0 flex items-center justify-center`}><ImageIcon className="h-4 w-4 text-text-secondary/40" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-text-primary truncate`}>{product.productName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs font-semibold text-shopee-orange">{formatCurrency(product.priceMin)}</span>
          {product.priceDiscountRate > 0 && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">{Math.round(product.priceDiscountRate * 100)}% OFF</span>}
          <span className="text-[10px] text-text-secondary">{product.sales} vendidos</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-xs font-bold text-emerald-400 block">{formatCurrency(product.commission)}</span>
        <span className="text-[10px] text-text-secondary">{commPct}% comissão</span>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-shopee-orange/50 group-hover:text-shopee-orange shrink-0 transition-colors" />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function GeradorLinksShopeePage() {
  const [inputValue, setInputValue] = useState("");
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastGeneratedLink, setLastGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [storyCaption, setStoryCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [generatedStoryImage, setGeneratedStoryImage] = useState<string | null>(null);
  const [storyImageLoading, setStoryImageLoading] = useState(false);
  const [storyImageUseGenerated, setStoryImageUseGenerated] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOffer | null>(null);
  const [goldenProducts, setGoldenProducts] = useState<ProductOffer[]>([]);
  const [bestSellers, setBestSellers] = useState<ProductOffer[]>([]);
  const [loadingBestSellers, setLoadingBestSellers] = useState(false);
  const [bestSellerKeyword, setBestSellerKeyword] = useState("");
  const [lastBestSellerKeyword, setLastBestSellerKeyword] = useState("");
  const [bestSellerPage, setBestSellerPage] = useState(1);
  const BEST_SELLERS_PER_PAGE = 4;
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [addToListFeedback, setAddToListFeedback] = useState<string | null>(null);
  const [linksInOfferList, setLinksInOfferList] = useState<Set<string>>(new Set());
  const [addToListModal, setAddToListModal] = useState<{ open: boolean; entries: HistoryEntry[] }>({ open: false, entries: [] });
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [listasOfertas, setListasOfertas] = useState<{ id: string; nome: string; totalItens: number }[]>([]);
  const [novaListaNome, setNovaListaNome] = useState("");
  const [selectedListaId, setSelectedListaId] = useState<string | null>(null);
  const [addToListLoading, setAddToListLoading] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState<boolean | null>(null);
  const [whatsappSharing, setWhatsappSharing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configCardRef = useRef<HTMLDivElement>(null);
  const handleSearchRef = useRef<(term?: string) => Promise<void>>(() => Promise.resolve());

  const checkApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/shopee");
      const data = await res.json();
      setHasApiKeys(!!data?.has_key && !!data?.shopee_app_id);
    } catch { setHasApiKeys(false); }
  }, []);

  useEffect(() => { checkApiKeys(); }, [checkApiKeys]);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !hasApiKeys) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { debounceRef.current = null; handleSearchRef.current(trimmed); }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputValue, hasApiKeys]);

  const loadHistory = useCallback(async (page: number, search?: string) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "4" });
      if (search?.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/shopee/link-history?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar histórico");
      setHistory(Array.isArray(json.data) ? json.data : []);
      setHistoryTotal(Number(json.total) ?? 0);
      setHistoryTotalPages(Math.max(1, Number(json.totalPages) ?? 1));
      setHistoryPage(Number(json.page) ?? 1);
    } catch { setHistory([]); } finally { setHistoryLoading(false); }
  }, []);

  const [historySearchDebounced, setHistorySearchDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setHistorySearchDebounced(historySearch), 300); return () => clearTimeout(t); }, [historySearch]);
  useEffect(() => { setHistoryPage(1); }, [historySearchDebounced]);
  useEffect(() => { loadHistory(historyPage, historySearchDebounced); }, [historyPage, historySearchDebounced, loadHistory]);

  const loadLinksInOfferList = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas");
      const json = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(json?.data) ? json.data : [];
      setLinksInOfferList(new Set(list.map((o: { converterLink?: string }) => (o.converterLink ?? "").trim()).filter(Boolean)));
    } catch { /**/ }
  }, []);
  useEffect(() => { loadLinksInOfferList(); }, [loadLinksInOfferList]);

  const handleSearch = useCallback(async (term?: string) => {
    const trimmed = (term ?? inputValue).trim();
    if (!trimmed || !hasApiKeys) return;
    setError(null); setSearchLoading(true); setProducts([]); setSelectedProduct(null); setGoldenProducts([]);
    try {
      const itemId = extractItemIdFromUrl(trimmed);
      if (Number.isFinite(itemId)) {
        const res = await fetch(`/api/shopee/product-search?itemId=${itemId}&limit=1`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar produto");
        const list = (data?.products ?? []) as ProductOffer[];
        if (list.length > 0) {
          setSelectedProduct(list[0]);
          const name = list[0].productName?.split(/\s+/).slice(0, 4).join(" ") || "";
          if (name) {
            const similarRes = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(name)}&limit=15`);
            const similarData = await similarRes.json();
            const similar = (similarData?.products ?? []) as ProductOffer[];
            const currentRate = list[0].commissionRate ?? 0;
            let sameNiche = similar.filter((p) => p.itemId !== list[0].itemId && (p.commissionRate ?? 0) >= currentRate).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0));
            if (sameNiche.length === 0) sameNiche = similar.filter((p) => p.itemId !== list[0].itemId).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0)).slice(0, 5);
            setGoldenProducts(sameNiche);
          }
        }
      } else {
        const res = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(trimmed)}&limit=20`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar produtos");
        setProducts((data?.products ?? []) as ProductOffer[]);
        setSelectedProduct(null); setGoldenProducts([]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao buscar"); }
    finally { setSearchLoading(false); }
  }, [inputValue, hasApiKeys]);

  handleSearchRef.current = handleSearch;

  useEffect(() => { setGeneratedStoryImage(null); setStoryImageUseGenerated(false); setLastGeneratedLink(""); setStoryCaption(""); }, [selectedProduct?.itemId]);

  const handleSelectProduct = useCallback(async (product: ProductOffer) => {
    setSelectedProduct(product); setProducts([]);
    const name = product.productName?.split(/\s+/).slice(0, 4).join(" ") || "";
    setGoldenProducts([]);
    if (name) {
      try {
        const res = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(name)}&limit=15`);
        const data = await res.json();
        const similar = (data?.products ?? []) as ProductOffer[];
        const currentRate = product.commissionRate ?? 0;
        let sameNiche = similar.filter((p) => p.itemId !== product.itemId && (p.commissionRate ?? 0) >= currentRate).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0));
        if (sameNiche.length === 0) sameNiche = similar.filter((p) => p.itemId !== product.itemId).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0)).slice(0, 5);
        setGoldenProducts(sameNiche);
      } catch { setGoldenProducts([]); }
    }
  }, []);

  // Selecionar da lista de mais vendidos NÃO limpa a lista — mantém o contexto de navegação
  const handleSelectProductFromList = useCallback((product: ProductOffer) => { handleSelectProduct(product); }, [handleSelectProduct]);

  const handleConvertLink = useCallback(async () => {
    const originUrl = selectedProduct?.productLink || selectedProduct?.offerLink || inputValue.trim();
    if (!originUrl) { setError("Selecione um produto ou informe o link."); return; }
    setError(null); setConvertLoading(true);
    try {
      const subIds = [subId1, subId2, subId3].map((s) => s.trim());
      const res = await fetch("/api/shopee/generate-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originUrl, subIds }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao converter link");
      const shortLink = data?.shortLink ?? "";
      const slug = extractSlugFromUrl(originUrl);
      const rate = selectedProduct?.priceDiscountRate ?? 0;
      const priceMin = selectedProduct?.priceMin ?? 0;
      const priceMax = selectedProduct?.priceMax ?? 0;
      const pricePromo = priceMin;
      const priceOriginal = rate > 0 && rate < 100 && priceMin > 0 ? Math.round((priceMin / (1 - rate / 100)) * 100) / 100 : priceMax > 0 ? priceMax : null;
      const postRes = await fetch("/api/shopee/link-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortLink, originUrl, subId1: subIds[0] ?? "", subId2: subIds[1] ?? "", subId3: subIds[2] ?? "", observation: "", productName: selectedProduct?.productName ?? "", slug, imageUrl: selectedProduct?.imageUrl ?? "", commissionRate: selectedProduct?.commissionRate ?? 0, commissionValue: selectedProduct?.commission ?? 0, priceShopee: pricePromo || null, priceShopeeOriginal: priceOriginal, priceShopeeDiscountRate: rate || null }),
      });
      if (!postRes.ok) { const err = await postRes.json().catch(() => ({})); throw new Error(err?.error ?? "Erro ao salvar no histórico"); }
      setLastGeneratedLink(shortLink);
      await loadHistory(1, historySearchDebounced);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao converter"); }
    finally { setConvertLoading(false); }
  }, [selectedProduct, inputValue, subId1, subId2, subId3, historySearchDebounced, loadHistory]);

  const runSearchNow = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    handleSearch();
  }, [handleSearch]);

  const loadBestSellers = useCallback(async () => {
    const keyword = bestSellerKeyword.trim();
    if (!keyword || !hasApiKeys) return;
    setError(null); setLoadingBestSellers(true); setBestSellers([]);
    try {
      const params = new URLSearchParams({ keyword, sortType: "2", limit: "20", listType: "2" });
      const res = await fetch(`/api/shopee/product-search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar mais vendidos");
      setBestSellers((data?.products ?? []) as ProductOffer[]);
      setLastBestSellerKeyword(keyword);
      setBestSellerPage(1);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao listar mais vendidos"); }
    finally { setLoadingBestSellers(false); }
  }, [hasApiKeys, bestSellerKeyword]);

  const handleGenerateStoryImage = useCallback(async () => {
    if (!selectedProduct?.imageUrl) return;
    setStoryImageLoading(true); setGeneratedStoryImage(null); setStoryImageUseGenerated(false);
    try {
      const res = await fetch("/api/shopee/generate-story-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: selectedProduct.imageUrl, productName: selectedProduct.productName ?? "" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao gerar imagem");
      setGeneratedStoryImage(data?.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : data?.imageUrl ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao gerar imagem"); }
    finally { setStoryImageLoading(false); }
  }, [selectedProduct]);

  const handleGenerateCaption = useCallback(async () => {
    if (!selectedProduct?.productName) return;
    setCaptionLoading(true); setShareFeedback("");
    try {
      const res = await fetch("/api/shopee/generate-caption", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productName: selectedProduct.productName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao gerar legenda");
      setStoryCaption(data?.caption ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao gerar legenda"); }
    finally { setCaptionLoading(false); }
  }, [selectedProduct]);

  const getSelectedImageFile = useCallback(async (): Promise<File | null> => {
    const url = storyImageUseGenerated && generatedStoryImage ? generatedStoryImage : selectedProduct?.imageUrl;
    if (!url) return null;
    try {
      let blob: Blob;
      if (url.startsWith("data:")) { const res = await fetch(url); blob = await res.blob(); }
      else { const res = await fetch(`/api/shopee/proxy-image?url=${encodeURIComponent(url)}`); if (!res.ok) return null; blob = await res.blob(); }
      if (!blob || blob.size === 0) return null;
      const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      return new File([blob], "story-shopee.jpg", { type });
    } catch { return null; }
  }, [storyImageUseGenerated, generatedStoryImage, selectedProduct?.imageUrl]);

  const handleShareStory = useCallback(async () => {
    if (!lastGeneratedLink) { setShareFeedback('Converte o link primeiro (botão "Converter Link").'); return; }
    try { await navigator.clipboard.writeText(lastGeneratedLink); } catch { setShareFeedback("Não foi possível copiar o link. Copie manualmente."); return; }
    const imageFile = await getSelectedImageFile();
    const canShare = typeof navigator !== "undefined" && navigator.share;
    const canShareFiles = imageFile && (navigator as { canShare?: (x: { files?: File[] }) => boolean }).canShare?.({ files: [imageFile] });
    if (canShare && canShareFiles) {
      try { await navigator.share({ files: [imageFile], title: "Story Shopee" }); setShareFeedback("Link copiado! Escolha Instagram → Stories e cole o link no sticker."); }
      catch (err) { if ((err as Error)?.name !== "AbortError") { setShareFeedback('Link copiado! Use "Baixar imagem" e cole no Stories.'); if (typeof window !== "undefined") window.open("https://www.instagram.com/", "_blank", "noopener"); } }
    } else { setShareFeedback('Link copiado! Use "Baixar imagem" e cole no Instagram Stories.'); if (typeof window !== "undefined") window.open("https://www.instagram.com/", "_blank", "noopener"); }
    setTimeout(() => setShareFeedback(""), 9000);
  }, [lastGeneratedLink, getSelectedImageFile]);

  const handleShareWhatsApp = useCallback(async () => {
    if (!lastGeneratedLink) { setShareFeedback('Converta o link primeiro.'); return; }
    setWhatsappSharing(true);
    const link = lastGeneratedLink;
    const legenda = storyCaption.trim();
    let textAsCaption = !legenda ? `Comprar agora: ${link}` : /\{Link do Converter Link\}|\{link\}/i.test(legenda) ? legenda.replace(/\{Link do Converter Link\}|\{link\}/i, link) : (() => { const lines = legenda.split("\n"); const title = lines[0]?.trim() ?? ""; const rest = lines.slice(1).join("\n").trim(); return rest ? `${title}\n\nComprar agora: ${link}\n\n${rest}` : `${title}\n\nComprar agora: ${link}`; })();
    const linesAll = textAsCaption.split("\n");
    textAsCaption = (linesAll.length > 10 ? linesAll.slice(0, 10).join("\n") : textAsCaption).slice(0, 700).trim();
    try { await navigator.clipboard.writeText(textAsCaption); } catch { /**/ }
    const imageFile = await getSelectedImageFile();
    const canShare = typeof navigator !== "undefined" && navigator.share;
    const canShareFiles = imageFile && (navigator as { canShare?: (x: { files?: File[] }) => boolean }).canShare?.({ files: [imageFile] });
    if (canShare && canShareFiles) {
      try { await navigator.share({ files: [imageFile], title: "Story Shopee" }); setShareFeedback("Legenda copiada! Cole no WhatsApp Status."); }
      catch (err) { if ((err as Error)?.name !== "AbortError") { setShareFeedback('Legenda copiada! Use "Baixar imagem" e compartilhe no WhatsApp.'); window.open(`https://wa.me/?text=${encodeURIComponent(textAsCaption)}`, "_blank", "noopener"); } }
    } else { window.open(`https://wa.me/?text=${encodeURIComponent(textAsCaption)}`, "_blank", "noopener"); setShareFeedback('Legenda copiada! Use "Baixar imagem" e cole no WhatsApp.'); }
    setTimeout(() => setShareFeedback(""), 9000);
    setWhatsappSharing(false);
  }, [lastGeneratedLink, storyCaption, getSelectedImageFile]);

  const handleDownloadStoryImage = useCallback(async () => {
    const url = storyImageUseGenerated && generatedStoryImage ? generatedStoryImage : selectedProduct?.imageUrl;
    if (!url) return;
    try {
      if (url.startsWith("data:")) { const a = document.createElement("a"); a.href = url; a.download = "story-shopee.jpg"; a.click(); }
      else { const res = await fetch(url, { mode: "cors" }); const blob = await res.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "story-shopee.jpg"; a.click(); URL.revokeObjectURL(a.href); }
      setShareFeedback("Imagem baixada! Anexe no WhatsApp ou no Story do Instagram."); setTimeout(() => setShareFeedback(""), 4000);
    } catch { const a = document.createElement("a"); a.href = url; a.download = "story-shopee.jpg"; a.target = "_blank"; a.rel = "noopener"; a.click(); setShareFeedback("Imagem aberta em nova aba. Salve com botão direito."); setTimeout(() => setShareFeedback(""), 5000); }
  }, [storyImageUseGenerated, generatedStoryImage, selectedProduct?.imageUrl]);

  const handleDeleteHistory = useCallback(async (id: string) => {
    try { const res = await fetch(`/api/shopee/link-history?id=${encodeURIComponent(id)}`, { method: "DELETE" }); if (!res.ok) throw new Error("Erro ao excluir"); await loadHistory(historyPage, historySearchDebounced); } catch { /**/ }
  }, [historyPage, historySearchDebounced, loadHistory]);

  const openAddToListModal = useCallback((entriesToAdd: HistoryEntry[]) => {
    if (entriesToAdd.length === 0) return;
    setAddToListModal({ open: true, entries: entriesToAdd }); setSelectedListaId(null); setNovaListaNome("");
  }, []);

  const toggleHistorySelect = useCallback((id: string) => {
    setSelectedHistoryIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const selectAllHistory = useCallback(() => { if (history.length === 0) return; setSelectedHistoryIds(new Set(history.map((h) => h.id))); }, [history]);
  const clearHistorySelection = useCallback(() => setSelectedHistoryIds(new Set()), []);

  const loadListasOfertas = useCallback(async () => {
    try { const res = await fetch("/api/shopee/minha-lista-ofertas/listas"); const json = await res.json(); if (!res.ok) return; setListasOfertas(Array.isArray(json?.data) ? json.data : []); } catch { setListasOfertas([]); }
  }, []);
  useEffect(() => { if (addToListModal.open) loadListasOfertas(); }, [addToListModal.open, loadListasOfertas]);

  const confirmAddToList = useCallback(async () => {
    const entries = addToListModal.entries;
    if (!entries.length) return;
    if (!selectedListaId && !novaListaNome.trim()) { setAddToListFeedback("Selecione uma lista ou crie uma nova."); return; }
    setAddToListLoading(true); setAddToListFeedback(null);
    try {
      let targetListaId = selectedListaId;
      if (!targetListaId && novaListaNome.trim()) {
        const createRes = await fetch("/api/shopee/minha-lista-ofertas/listas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: novaListaNome.trim() }) });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson?.error ?? "Erro ao criar lista");
        targetListaId = createJson?.data?.id;
      }
      if (!targetListaId) throw new Error("Selecione ou crie uma lista.");
      let added = 0;
      for (const entry of entries) {
        const res = await fetch("/api/shopee/minha-lista-ofertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listaId: targetListaId, imageUrl: entry.imageUrl ?? "", productName: entry.productName ?? "", converterLink: entry.shortLink ?? "", priceOriginal: entry.priceShopeeOriginal ?? undefined, pricePromo: entry.priceShopee ?? undefined, discountRate: entry.priceShopeeDiscountRate ?? undefined }) });
        if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data?.error ?? "Erro ao adicionar"); }
        setLinksInOfferList((prev) => new Set(prev).add(entry.shortLink ?? "")); added++;
      }
      setAddToListModal({ open: false, entries: [] });
      setSelectedHistoryIds((prev) => { const next = new Set(prev); entries.forEach((e) => next.delete(e.id)); return next; });
      setAddToListFeedback(added === 1 ? "Adicionado à lista!" : `${added} produtos adicionados à lista!`);
      setTimeout(() => setAddToListFeedback(null), 3000);
    } catch (e) { setAddToListFeedback(e instanceof Error ? e.message : "Erro ao adicionar"); }
    finally { setAddToListLoading(false); }
  }, [addToListModal.entries, selectedListaId, novaListaNome]);

  const closeAddToListModal = useCallback(() => { setAddToListModal({ open: false, entries: [] }); setSelectedListaId(null); setNovaListaNome(""); }, []);

  const canConvert = !convertLoading && (!!selectedProduct || !!extractItemIdFromUrl(inputValue)) && !!hasApiKeys;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">

      {/* ─── CABEÇALHO ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="p-1.5 rounded-lg bg-shopee-orange/15">
            <Link2 className="h-5 w-5 text-shopee-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-heading">Gerador de Links Shopee</h1>
            <p className="text-xs text-text-secondary">Crie links de afiliado com Sub IDs e gerencie seu histórico</p>
          </div>
        </div>
        {hasApiKeys !== null && (
          <div className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${hasApiKeys ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
            {hasApiKeys ? <><CheckCircle2 className="h-3.5 w-3.5" /> API conectada</> : <><AlertCircle className="h-3.5 w-3.5" /> API não configurada</>}
          </div>
        )}
      </div>

      {/* ─── AVISO SEM API ───────────────────────────────────────────────────── */}
      {hasApiKeys === false && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/25 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-300">API da Shopee não configurada</p>
            <p className="text-xs text-text-secondary mt-0.5">Cadastre o App ID e a chave da API para usar o gerador.</p>
          </div>
          <Link href="/configuracoes" className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-medium transition-colors">
            Configurar →
          </Link>
        </div>
      )}

      {/* ─── SEÇÃO PRINCIPAL ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Coluna esquerda: Configurar link ── */}
        <div ref={configCardRef} className="bg-dark-card rounded-xl border border-dark-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Configurar Link</h2>
          </div>

          {/* Campo principal */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs font-medium text-text-secondary">Link ou nome do produto</span>
              <Tooltip text="Cole o link de um produto Shopee (shopee.com.br/...) ou digite palavras-chave para buscar produtos." wide />
            </div>
            <div className="relative">
              <input type="text" value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={(e) => {
                  const next = e.relatedTarget; const card = configCardRef.current;
                  if (!card) { runSearchNow(); return; }
                  try { if (next == null || !card.contains(next as Node)) runSearchNow(); } catch { runSearchNow(); }
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearchNow(); } }}
                placeholder="Cole o link ou busque por nome..."
                className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange text-sm transition-all"
              />
              {searchLoading
                ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-shopee-orange" />
                : inputValue
                  ? <button type="button" onClick={() => setInputValue("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/60 hover:text-text-primary transition-colors"><X className="h-4 w-4" /></button>
                  : <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/40" />
              }
            </div>
          </div>

          {/* Lista de produtos da busca */}
          {products.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg/50 p-2 space-y-1.5 scrollbar-shopee">
              {products.map((p) => <ProductRow key={p.itemId} product={p} onSelect={() => handleSelectProduct(p)} />)}
            </div>
          )}

          {/* Sub IDs */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag className="h-3.5 w-3.5 text-text-secondary/70" />
              <span className="text-xs font-medium text-text-secondary">Sub IDs de rastreamento</span>
              <Tooltip text="Use Sub IDs para rastrear a origem dos cliques. Ex: Sub ID 1 = 'instagram', Sub ID 2 = 'stories', Sub ID 3 = 'blackfriday'." wide />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: subId1, set: setSubId1, placeholder: "instagram" },
                { value: subId2, set: setSubId2, placeholder: "stories" },
                { value: subId3, set: setSubId3, placeholder: "campanha1" },
              ].map((s, i) => (
                <div key={i}>
                  <label className="text-[10px] text-text-secondary/70 mb-1 block">Sub ID {i + 1}</label>
                  <input type="text" value={s.value} onChange={(e) => s.set(e.target.value)} placeholder={s.placeholder}
                    className="w-full px-2.5 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs placeholder-text-secondary/40 focus:outline-none focus:border-shopee-orange transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2">
            <button type="button" onClick={() => handleSearch()} disabled={searchLoading || !inputValue.trim() || !hasApiKeys}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:border-shopee-orange/50 hover:text-shopee-orange disabled:opacity-40 transition-colors text-sm font-medium">
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
            <button type="button" onClick={handleConvertLink} disabled={!canConvert}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity text-sm">
              {convertLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar Link Afiliado
            </button>
          </div>

          {/* Link gerado */}
          {lastGeneratedLink && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-400 font-medium truncate flex-1">{lastGeneratedLink}</span>
              <button type="button" onClick={() => { navigator.clipboard.writeText(lastGeneratedLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                className="shrink-0 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-colors">
                {linkCopied ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          )}

          {/* Divisor + Mais vendidos */}
          <div className="border-t border-dark-border/50 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-text-secondary">Listar mais vendidos</span>
              <Tooltip text="Busque os 20 produtos mais vendidos de uma categoria para escolher o de maior comissão." wide />
            </div>
            <div className="flex gap-2">
              <input type="text" value={bestSellerKeyword} onChange={(e) => setBestSellerKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); loadBestSellers(); } }}
                placeholder="Ex: camisas, eletrônicos..."
                className="flex-1 px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/40 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              <button type="button" onClick={loadBestSellers} disabled={loadingBestSellers || !bestSellerKeyword.trim() || !hasApiKeys}
                className="px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:border-emerald-500/50 hover:text-emerald-400 disabled:opacity-40 transition-colors shrink-0 inline-flex items-center gap-1.5 text-sm font-medium">
                {loadingBestSellers ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                Buscar
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* ── Coluna direita: Visualização / Mais vendidos ── */}
        <div className="bg-dark-card rounded-xl border border-dark-border p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Star className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
              {bestSellers.length > 0 ? `Mais vendidos — "${lastBestSellerKeyword}"` : "Produto selecionado"}
            </h2>
            {bestSellers.length > 0 && (
              <button type="button" onClick={() => setBestSellers([])} className="ml-auto text-xs text-text-secondary hover:text-red-400 transition-colors flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> Fechar
              </button>
            )}
          </div>

          {bestSellers.length > 0 ? (
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              {/* Cabeçalho da lista */}
              <div className="flex items-center justify-between shrink-0">
                <p className="text-xs text-text-secondary">
                  {bestSellers.length} produto{bestSellers.length !== 1 ? "s" : ""} encontrado{bestSellers.length !== 1 ? "s" : ""}
                </p>
                {selectedProduct && bestSellers.some(p => p.itemId === selectedProduct.itemId) && (
                  <span className="text-[10px] font-medium text-shopee-orange bg-shopee-orange/10 border border-shopee-orange/30 px-2 py-0.5 rounded-full shrink-0">
                    ✓ selecionado
                  </span>
                )}
              </div>

              {/* Itens da página atual */}
              <div className="space-y-1.5">
                {bestSellers
                  .slice((bestSellerPage - 1) * BEST_SELLERS_PER_PAGE, bestSellerPage * BEST_SELLERS_PER_PAGE)
                  .map((p) => (
                    <ProductRow
                      key={p.itemId}
                      product={p}
                      onSelect={() => handleSelectProductFromList(p)}
                      selected={selectedProduct?.itemId === p.itemId}
                    />
                  ))}
              </div>

              {/* Paginação */}
              {bestSellers.length > BEST_SELLERS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1 shrink-0">
                  <button
                    type="button"
                    disabled={bestSellerPage === 1}
                    onClick={() => setBestSellerPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-dark-border text-text-secondary hover:border-shopee-orange/50 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    ← Anterior
                  </button>
                  <span className="text-[11px] text-text-secondary tabular-nums">
                    {bestSellerPage} / {Math.ceil(bestSellers.length / BEST_SELLERS_PER_PAGE)}
                  </span>
                  <button
                    type="button"
                    disabled={bestSellerPage >= Math.ceil(bestSellers.length / BEST_SELLERS_PER_PAGE)}
                    onClick={() => setBestSellerPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-dark-border text-text-secondary hover:border-shopee-orange/50 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Próxima →
                  </button>
                </div>
              )}
            </div>
          ) : selectedProduct ? (
            <div className="space-y-4 flex-1">
              {/* Card do produto selecionado */}
              <div className="flex gap-3 p-3 rounded-xl border border-dark-border bg-dark-bg/60">
                {selectedProduct.imageUrl
                  ? <img src={selectedProduct.imageUrl} alt="" className="w-20 h-20 object-contain rounded-lg bg-white/5 shrink-0" />
                  : <div className="w-20 h-20 rounded-lg bg-dark-card shrink-0 flex items-center justify-center"><ImageIcon className="h-5 w-5 text-text-secondary/30" /></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary line-clamp-2">{selectedProduct.productName}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">@{selectedProduct.shopName} · {selectedProduct.sales} vendidos{selectedProduct.ratingStar > 0 ? ` · ★ ${selectedProduct.ratingStar}` : ""}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-lg font-bold text-shopee-orange">{formatCurrency(selectedProduct.priceMin)}</span>
                    {selectedProduct.priceDiscountRate > 0 && <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">{Math.round(selectedProduct.priceDiscountRate * 100)}% OFF</span>}
                  </div>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                    {((selectedProduct.commissionRate ?? 0) * 100).toFixed(1)}% comissão · {formatCurrency(selectedProduct.commission)}
                  </p>
                </div>
              </div>

              {/* Oportunidades de ouro */}
              {goldenProducts.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs font-semibold text-text-primary">Oportunidades de Ouro</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Maior comissão no nicho</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-shopee pr-1">
                    {goldenProducts.slice(0, 5).map((p) => <ProductRow key={p.itemId} product={p} onSelect={() => handleSelectProduct(p)} compact />)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-dark-border rounded-xl bg-dark-bg/30">
              <Hand className="h-12 w-12 text-shopee-orange/40 mb-3" />
              <p className="text-sm font-semibold text-text-primary mb-1">Comece aqui!</p>
              <p className="text-xs text-text-secondary max-w-xs">
                Cole um link Shopee ou busque por palavra-chave. Para ver os mais vendidos, use a seção abaixo no painel esquerdo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── STORIES ──────────────────────────────────────────────────────────── */}
      {selectedProduct && (
        <div className="bg-dark-card rounded-xl border border-dark-border p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-shopee-orange/10">
              <ImageIcon className="h-4 w-4 text-shopee-orange" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Preparar para Stories</h2>
            {!lastGeneratedLink && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                <AlertCircle className="h-3 w-3" /> Converta o link primeiro
              </span>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Imagens */}
            <div className="shrink-0 space-y-3">
              <div className="flex gap-4">
                {/* Imagem Shopee */}
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-[11px] text-text-secondary font-medium">Original</span>
                  <button type="button" onClick={() => setStoryImageUseGenerated(false)}
                    className={`w-[110px] aspect-[9/16] rounded-xl overflow-hidden transition-all ${!storyImageUseGenerated ? "ring-2 ring-shopee-orange" : "ring-1 ring-dark-border hover:ring-shopee-orange/40"}`}>
                    {selectedProduct.imageUrl
                      ? <img src={selectedProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-dark-bg flex items-center justify-center"><ImageIcon className="h-6 w-6 text-text-secondary/30" /></div>
                    }
                  </button>
                  {!storyImageUseGenerated && <span className="text-[10px] text-shopee-orange font-medium">✓ Em uso</span>}
                </div>

                {/* Imagem IA */}
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-[11px] text-text-secondary font-medium">IA gerada</span>
                  {storyImageLoading ? (
                    <div className="w-[110px] aspect-[9/16] rounded-xl border border-dashed border-dark-border bg-dark-bg flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-shopee-orange" /><span className="text-[10px] text-text-secondary">Gerando...</span></div>
                    </div>
                  ) : generatedStoryImage ? (
                    <>
                      <button type="button" onClick={() => setStoryImageUseGenerated(true)}
                        className={`w-[110px] aspect-[9/16] rounded-xl overflow-hidden transition-all ${storyImageUseGenerated ? "ring-2 ring-shopee-orange" : "ring-1 ring-dark-border hover:ring-shopee-orange/40"}`}>
                        <img src={generatedStoryImage} alt="" className="w-full h-full object-cover" />
                      </button>
                      {storyImageUseGenerated && <span className="text-[10px] text-shopee-orange font-medium">✓ Em uso</span>}
                    </>
                  ) : (
                    <div className="w-[110px] aspect-[9/16] rounded-xl border border-dashed border-dark-border bg-dark-bg flex items-center justify-center">
                      <span className="text-[10px] text-text-secondary/60 text-center px-2">Clique em Gerar</span>
                    </div>
                  )}
                  <button type="button" onClick={handleGenerateStoryImage} disabled={storyImageLoading || !selectedProduct?.imageUrl}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:border-shopee-orange/50 hover:text-shopee-orange disabled:opacity-40 transition-colors inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Gerar IA
                  </button>
                </div>
              </div>

              {/* Botões download */}
              <button type="button" onClick={handleDownloadStoryImage} disabled={!selectedProduct?.imageUrl && !generatedStoryImage}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:border-shopee-orange/50 hover:text-shopee-orange disabled:opacity-40 transition-colors text-sm">
                <Download className="h-4 w-4" /> Baixar imagem
              </button>
            </div>

            {/* Legenda + ações de share */}
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs font-medium text-text-secondary">Legenda para o Story</span>
                  <Tooltip text="Status WhatsApp: máx. 700 caracteres e 10 linhas. A legenda é cortada automaticamente ao compartilhar." wide />
                </div>
                <textarea value={storyCaption} onChange={(e) => setStoryCaption(e.target.value)}
                  placeholder='Clique em "Gerar legenda" para criar uma legenda de venda com IA...'
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/40 focus:outline-none focus:border-shopee-orange resize-y scrollbar-shopee transition-all"
                />
              </div>

              {/* Botões de compartilhamento */}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleGenerateCaption} disabled={captionLoading || !selectedProduct?.productName}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity text-sm">
                  {captionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar legenda
                </button>
                <button type="button" onClick={handleShareStory} disabled={!lastGeneratedLink}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${lastGeneratedLink ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90 shadow-lg shadow-pink-500/20" : "bg-dark-bg border border-dark-border text-text-secondary/50 cursor-not-allowed"}`}>
                  <Share2 className="h-4 w-4" /> Instagram
                </button>
                <button type="button" onClick={handleShareWhatsApp} disabled={!lastGeneratedLink || whatsappSharing}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${lastGeneratedLink && !whatsappSharing ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-dark-bg border border-dark-border text-text-secondary/50 cursor-not-allowed"}`}>
                  {whatsappSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  WhatsApp
                </button>
              </div>

              {shareFeedback && (
                <div className="flex items-start gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
                  <Copy className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-400">{shareFeedback}</p>
                </div>
              )}

              <p className="text-[11px] text-text-secondary/60 leading-relaxed">
                <strong className="text-text-secondary/80">Instagram:</strong> link copiado, envie a imagem e cole o link no sticker &quot;Adicionar link&quot; do Stories.{" "}
                <strong className="text-text-secondary/80">WhatsApp:</strong> legenda copiada (com link), envie a imagem e cole a legenda no Status.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── HISTÓRICO ──────────────────────────────────────────────────────── */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <Link2 className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
              Histórico de Links
            </h2>
            {historyTotal > 0 && (
              <span className="text-[11px] text-text-secondary bg-dark-bg border border-dark-border px-2 py-0.5 rounded-full">{historyTotal} links</span>
            )}
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
            <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Buscar produto, link..."
              className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/40 focus:outline-none focus:border-shopee-orange transition-all"
            />
          </div>
        </div>

        {/* Seleção em massa */}
        {history.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={selectAllHistory}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/40 transition-colors">
              Selecionar todos
            </button>
            {selectedHistoryIds.size > 0 && (
              <>
                <button type="button" onClick={clearHistorySelection}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-dark-border text-text-secondary hover:text-text-primary transition-colors">
                  Limpar
                </button>
                <button type="button" onClick={() => openAddToListModal(history.filter((h) => selectedHistoryIds.has(h.id)))}
                  className="text-xs px-3 py-1.5 rounded-lg bg-shopee-orange text-white font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-1">
                  <ListPlus className="h-3.5 w-3.5" /> Adicionar à lista ({selectedHistoryIds.size})
                </button>
              </>
            )}
          </div>
        )}

        {addToListFeedback && (
          <div className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${addToListFeedback.startsWith("Adicionado") || addToListFeedback.includes("adicionados") ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-400" : "bg-amber-500/8 border-amber-500/20 text-amber-400"}`}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {addToListFeedback}
          </div>
        )}

        {historyLoading && history.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-text-secondary text-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando histórico...
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-2xl bg-dark-bg border border-dark-border mb-3">
              <Link2 className="h-8 w-8 text-text-secondary/30" />
            </div>
            <p className="text-sm text-text-secondary">Nenhum link gerado ainda.</p>
            <p className="text-xs text-text-secondary/60 mt-1">Use &quot;Converter Link&quot; para criar seu primeiro link de afiliado.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {history.map((h) => {
                const isSelected = selectedHistoryIds.has(h.id);
                return (
                  <div key={h.id}
                    onClick={() => toggleHistorySelect(h.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? "bg-shopee-orange/5 border-shopee-orange/30" : "border-dark-border bg-dark-bg/60 hover:border-dark-border/80 hover:bg-dark-bg"}`}>
                    <div className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <OrangeCheckbox checked={isSelected} onChange={() => toggleHistorySelect(h.id)} />
                    </div>
                    {h.imageUrl
                      ? <img src={h.imageUrl} alt="" className="w-12 h-12 object-contain rounded-lg bg-white/5 shrink-0" />
                      : <div className="w-12 h-12 rounded-lg bg-dark-card shrink-0 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-text-secondary/30" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary line-clamp-1">{h.productName || "Link gerado"}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</p>
                      {(h.subId1 || h.subId2 || h.subId3) && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {[h.subId1, h.subId2, h.subId3].filter(Boolean).map((s, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-dark-card border border-dark-border text-text-secondary">{s}</span>
                          ))}
                        </div>
                      )}
                      {(h.commissionRate > 0 || h.commissionValue > 0) && (
                        <p className="text-[11px] text-emerald-400 font-medium mt-1">
                          {((h.commissionRate ?? 0) * 100).toFixed(1)}% · {formatCurrency(h.commissionValue ?? 0)}
                        </p>
                      )}
                    </div>
                    {/* Ações */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(h.shortLink);
                          setCopiedHistoryId(h.id);
                          window.setTimeout(() => {
                            setCopiedHistoryId((cur) => (cur === h.id ? null : cur));
                          }, 1000);
                        }}
                        className={`p-1.5 rounded-lg border transition-colors duration-200 ${
                          copiedHistoryId === h.id
                            ? "bg-emerald-500/25 border-emerald-400/70 text-emerald-400"
                            : "bg-dark-card border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/40"
                        }`}
                        title={copiedHistoryId === h.id ? "Copiado!" : "Copiar link"}
                      >
                        {copiedHistoryId === h.id ? (
                          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                            <span className="absolute inset-0 rounded-full bg-emerald-500/35" />
                            <Check className="h-2.5 w-2.5 text-emerald-300 relative z-[1]" strokeWidth={3} />
                          </span>
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button type="button" onClick={() => openAddToListModal([h])}
                        className={`p-1.5 rounded-lg border transition-colors ${linksInOfferList.has(h.shortLink ?? "") ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-400" : "bg-dark-card border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/40"}`}
                        title={linksInOfferList.has(h.shortLink ?? "") ? "Já na lista" : "Adicionar à lista"}>
                        <ListPlus className="h-3.5 w-3.5" />
                      </button>
                      <a href={h.shortLink} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-dark-card border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/40 transition-colors" title="Abrir link">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button type="button" onClick={() => handleDeleteHistory(h.id)}
                        className="p-1.5 rounded-lg bg-dark-card border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/40 transition-colors" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginação */}
            {historyTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-dark-border pt-4">
                <p className="text-xs text-text-secondary">Página {historyPage} de {historyTotalPages}</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPage <= 1 || historyLoading}
                    className="p-2 rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:text-shopee-orange disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))} disabled={historyPage >= historyTotalPages || historyLoading}
                    className="p-2 rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:text-shopee-orange disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── MODAL ADICIONAR À LISTA ──────────────────────────────────────────── */}
      {addToListModal.open && addToListModal.entries.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeAddToListModal}>
          <div className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-dark-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <ListPlus className="h-4 w-4 text-shopee-orange" />
                Adicionar à lista
                {addToListModal.entries.length > 1 && <span className="text-sm font-normal text-text-secondary">({addToListModal.entries.length} produtos)</span>}
              </h3>
              <button type="button" onClick={closeAddToListModal} className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-bg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Nova lista</p>
                <div className="flex gap-2">
                  <input type="text" value={novaListaNome} onChange={(e) => { setNovaListaNome(e.target.value); setSelectedListaId(null); }}
                    placeholder="Ex: Black Friday, Animes..."
                    className="flex-1 px-3 py-2.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-shopee-orange/40 focus:border-shopee-orange text-sm transition-all"
                  />
                  <button type="button"
                    onClick={async () => {
                      if (!novaListaNome.trim()) return;
                      const res = await fetch("/api/shopee/minha-lista-ofertas/listas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: novaListaNome.trim() }) });
                      const json = await res.json();
                      if (res.ok && json?.data?.id) { setSelectedListaId(json.data.id); loadListasOfertas(); }
                    }}
                    className="px-3 py-2.5 rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:border-shopee-orange hover:text-shopee-orange transition-colors inline-flex items-center gap-1.5 text-sm shrink-0">
                    <Plus className="h-4 w-4" /> Criar
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Lista existente</p>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-dark-border divide-y divide-dark-border bg-dark-bg/50 scrollbar-shopee">
                  {listasOfertas.length === 0 ? (
                    <div className="px-4 py-6 text-xs text-text-secondary text-center">Nenhuma lista. Crie uma acima.</div>
                  ) : listasOfertas.map((l) => (
                    <button key={l.id} type="button" onClick={() => { setSelectedListaId(l.id); setNovaListaNome(""); }}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors text-sm ${selectedListaId === l.id ? "bg-shopee-orange/10 text-shopee-orange border-l-2 border-shopee-orange" : "hover:bg-dark-bg text-text-primary"}`}>
                      <span className="font-medium truncate">{l.nome}</span>
                      <span className="text-xs text-text-secondary shrink-0">{l.totalItens} itens</span>
                    </button>
                  ))}
                </div>
              </div>

              {addToListFeedback && (
                <p className={`text-xs ${addToListFeedback.includes("Sele") ? "text-amber-400" : "text-red-400"}`}>{addToListFeedback}</p>
              )}
            </div>

            <div className="p-5 pt-0 flex gap-2 justify-end">
              <button type="button" onClick={closeAddToListModal} className="px-4 py-2.5 rounded-lg border border-dark-border text-text-secondary hover:bg-dark-bg transition-colors text-sm">
                Cancelar
              </button>
              <button type="button" onClick={confirmAddToList} disabled={addToListLoading || (!selectedListaId && !novaListaNome.trim())}
                className="px-4 py-2.5 rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity text-sm inline-flex items-center gap-2">
                {addToListLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
                {addToListModal.entries.length === 1 ? "Adicionar" : `Adicionar ${addToListModal.entries.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
