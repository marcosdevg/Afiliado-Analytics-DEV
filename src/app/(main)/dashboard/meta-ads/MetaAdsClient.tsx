"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  AlertCircle,
  Settings,
  ChevronRight,
  Building2,
  Target,
  Image as ImageIcon,
  Link2,
  CheckCircle2,
  Loader2,
  Upload,
  ImagePlus,
  Video,
} from "lucide-react";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";
import {
  META_CAMPAIGN_OBJECTIVES,
  META_OPTIMIZATION_GOALS,
  META_COUNTRIES,
  META_CALL_TO_ACTIONS,
} from "@/lib/meta-ads-constants";

type AdAccount = { id: string; name: string; business_id?: string };
type Page = { id: string; name: string; instagram_account?: { id: string; username: string } | null };
type Pixel = { id: string; name: string };
type LibraryImage = { hash: string; url: string | null; id: string | null };
type LibraryVideo = { id: string; title: string; source: string | null; length: number | null; picture: string | null };

const STEPS = [
  { id: 1, title: "Conta e Página", icon: Building2 },
  { id: 2, title: "Campanha", icon: Megaphone },
  { id: 3, title: "Conjunto de anúncios", icon: Target },
  { id: 4, title: "Anúncio (criativo)", icon: ImageIcon },
];

export default function MetaAdsClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("OUTCOME_TRAFFIC");
  const [campaignId, setCampaignId] = useState("");
  const [adsetName, setAdsetName] = useState("");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [countryCode, setCountryCode] = useState("BR");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [optimizationGoal, setOptimizationGoal] = useState("LINK_CLICKS");
  const [pixelId, setPixelId] = useState("");
  const [conversionEvent, setConversionEvent] = useState("");
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [adsetId, setAdsetId] = useState("");
  const [adName, setAdName] = useState("");
  const [adLink, setAdLink] = useState("");
  const [adMessage, setAdMessage] = useState("");
  const [adTitle, setAdTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageHash, setImageHash] = useState("");
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [createdAdId, setCreatedAdId] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [videoId, setVideoId] = useState("");
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [callToAction, setCallToAction] = useState("LEARN_MORE");
  const [tokenDebug, setTokenDebug] = useState<{ scopes: string[]; has_pages_manage_ads: boolean; is_valid: boolean } | null>(null);
  const [loadingTokenDebug, setLoadingTokenDebug] = useState(false);
  const [promotePages, setPromotePages] = useState<Page[]>([]);
  const [loadingPromotePages, setLoadingPromotePages] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, pagRes] = await Promise.all([
          fetch("/api/meta/accounts"),
          fetch("/api/meta/pages"),
        ]);
        const accJson = await accRes.json();
        const pagJson = await pagRes.json();
        if (cancelled) return;
        if (accRes.ok && accJson.adAccounts?.length) setAdAccounts(accJson.adAccounts);
        if (pagRes.ok && pagJson.pages?.length) setPages(pagJson.pages);
        if (!accRes.ok && accJson.error) setError(accJson.error);
        else if (!pagRes.ok && pagJson.error) setError(pagJson.error);
      } catch {
        if (!cancelled) setError("Erro ao carregar contas e páginas.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!adAccountId) {
      setPixels([]);
      setPromotePages([]);
      return;
    }
    let cancelled = false;
    setLoadingPromotePages(true);
    const selectedAccount = adAccounts.find((a) => a.id === adAccountId);
    const query = new URLSearchParams({ ad_account_id: adAccountId });
    if (selectedAccount?.business_id) query.set("business_id", selectedAccount.business_id);
    fetch(`/api/meta/promote-pages?${query.toString()}`)
      .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (ok && json.pages) {
          setPromotePages(json.pages);
          setPageId((prev) => {
            if (!prev) return prev;
            if (json.pages.some((p: Page) => p.id === prev)) return prev;
            return "";
          });
          setError(null);
        } else if (!ok && json?.error) {
          setPromotePages([]);
          setError(json.error);
        } else {
          setPromotePages([]);
        }
      })
      .catch(() => { if (!cancelled) { setPromotePages([]); setError("Erro ao carregar Páginas desta conta."); } })
      .finally(() => { if (!cancelled) setLoadingPromotePages(false); });
    return () => { cancelled = true; };
  }, [adAccountId, adAccounts]);

  const selectedAccount = adAccounts.find((a) => a.id === adAccountId);
  const isPortfolioAccount = Boolean(selectedAccount?.business_id);
  const pageList = isPortfolioAccount ? pages : (promotePages.length ? promotePages : pages);

  useEffect(() => {
    if (!adAccountId) {
      setPixels([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/meta/pixels?ad_account_id=${encodeURIComponent(adAccountId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.pixels) setPixels(json.pixels);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [adAccountId]);

  useEffect(() => {
    if (step !== 4 || !adAccountId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/meta/adimages?ad_account_id=${encodeURIComponent(adAccountId)}`).then((r) => r.json()),
      fetch(`/api/meta/advideos?ad_account_id=${encodeURIComponent(adAccountId)}`).then((r) => r.json()),
    ]).then(([imgJson, vidJson]) => {
      if (!cancelled && imgJson.images) setLibraryImages(imgJson.images);
      if (!cancelled && vidJson.videos) setLibraryVideos(vidJson.videos);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [step, adAccountId]);

  const canStep2 = adAccountId && pageId;
  const canStep3 = campaignId && campaignName;
  const canStep4 = adsetId && adsetName;

  const createCampaign = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adAccountId,
          name: campaignName,
          objective: campaignObjective,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar campanha");
      setCampaignId(json.campaign_id);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar campanha");
    } finally {
      setLoading(false);
    }
  };

  const createAdSet = async () => {
    const budgetCents = Math.round(parseFloat(dailyBudget || "0") * 100);
    if (budgetCents < 100) {
      setError("Orçamento diário mínimo: R$ 1,00 (100 centavos).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta/adsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adAccountId,
          campaign_id: campaignId,
          name: adsetName,
          daily_budget: budgetCents,
          country_code: countryCode,
          age_min: parseInt(ageMin, 10) || 18,
          age_max: parseInt(ageMax, 10) || 65,
          gender,
          optimization_goal: optimizationGoal,
          pixel_id: pixelId || undefined,
          custom_conversion_id: conversionEvent || undefined,
          conversion_event: conversionEvent || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar conjunto");
      setAdsetId(json.adset_id);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar conjunto");
    } finally {
      setLoading(false);
    }
  };

  const createAd = async () => {
    const hasImage = imageHash.trim() || imageUrl.trim();
    const hasVideo = mediaType === "video" && videoId.trim();
    if (!adLink.trim() || !adMessage.trim()) {
      setError("Preencha link e texto do anúncio.");
      return;
    }
    if (mediaType === "image" && !hasImage) {
      setError("Escolha uma imagem da biblioteca, envie uma nova ou use a URL.");
      return;
    }
    if (mediaType === "video") {
      if (!hasVideo) {
        setError("Escolha um vídeo da biblioteca ou envie um novo.");
        return;
      }
      if (!hasImage) {
        setError("O Meta exige uma imagem de capa (thumbnail) para anúncios com vídeo. Escolha ou envie uma imagem.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string | undefined> = {
        ad_account_id: adAccountId,
        adset_id: adsetId,
        name: adName || "Anúncio",
        page_id: pageId,
        link: adLink.trim(),
        message: adMessage.trim(),
        title: adTitle.trim() || undefined,
        call_to_action: callToAction,
      };
      if (mediaType === "video") {
        body.video_id = videoId.trim();
        if (imageHash.trim()) body.image_hash = imageHash.trim();
        else body.image_url = imageUrl.trim();
      } else {
        if (imageHash.trim()) body.image_hash = imageHash.trim();
        else body.image_url = imageUrl.trim();
      }
      const res = await fetch("/api/meta/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar anúncio");
      setCreatedAdId(json.ad_id ?? "");
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar anúncio");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setCampaignId("");
    setAdsetId("");
    setCreatedAdId("");
    setError(null);
  };

  return (
    <>
      {loading && <LoadingOverlay message="Criando no Meta..." />}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary font-heading flex items-center gap-2">
          <Megaphone className="h-8 w-8 text-shopee-orange" />
          Criar Campanha Meta
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Crie campanha, conjunto e anúncio pelo app. Tudo é criado em modo <strong>Pausado</strong>; ative no Gerenciador do Meta quando quiser.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">{error}</p>
            <p className="text-xs text-text-secondary mt-1">
              Se o erro persistir, confira o token e as permissões do app no Meta.{" "}
              <button type="button" onClick={() => router.push("/configuracoes")} className="text-shopee-orange hover:underline font-semibold">
                Configurações →
              </button>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLoadingTokenDebug(true);
                  setTokenDebug(null);
                  try {
                    const res = await fetch("/api/meta/debug-token");
                    const json = await res.json();
                    if (res.ok && json.scopes) setTokenDebug({ scopes: json.scopes, has_pages_manage_ads: !!json.has_pages_manage_ads, is_valid: !!json.is_valid });
                    else setTokenDebug({ scopes: [], has_pages_manage_ads: false, is_valid: false });
                  } catch {
                    setTokenDebug({ scopes: [], has_pages_manage_ads: false, is_valid: false });
                  } finally {
                    setLoadingTokenDebug(false);
                  }
                }}
                disabled={loadingTokenDebug}
                className="text-xs font-medium text-shopee-orange hover:underline disabled:opacity-50"
              >
                {loadingTokenDebug ? "Carregando…" : "Ver permissões que o Meta enxerga neste token"}
              </button>
            </div>
            {tokenDebug && (
              <div className="mt-2 p-2 rounded bg-dark-bg/80 text-xs text-text-secondary border border-dark-border">
                <p className="font-medium text-text-primary mb-1">
                  Token válido: {tokenDebug.is_valid ? "Sim" : "Não"} — pages_manage_ads: {tokenDebug.has_pages_manage_ads ? "Sim" : "Não"}
                </p>
                <p className="mb-1">Permissões: {tokenDebug.scopes.length ? tokenDebug.scopes.join(", ") : "nenhuma"}</p>
                {!tokenDebug.has_pages_manage_ads && (
                  <p className="text-amber-400">O token em Configurações não tem pages_manage_ads. Gere um novo no Graph API Explorer com essa permissão e cole em Configurações.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="flex flex-wrap gap-2 mb-8">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => s.id < step || (s.id === 1) ? setStep(s.id) : undefined}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              step === s.id
                ? "bg-shopee-orange border-shopee-orange text-white"
                : s.id < step
                  ? "bg-dark-card border-dark-border text-text-primary hover:bg-dark-bg"
                  : "border-dark-border text-text-secondary cursor-default"
            }`}
          >
            <s.icon className="h-4 w-4" />
            {s.title}
            {s.id < step && <CheckCircle2 className="h-4 w-4" />}
          </button>
        ))}
      </div>

      {/* Step 1: Conta e Página */}
      {step === 1 && (
        <div className="rounded-xl border border-dark-border bg-dark-card p-6 max-w-xl space-y-6">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Building2 className="h-5 w-5 text-shopee-orange" />
            Conta de anúncios e Página do Facebook
          </h2>
          <p className="text-sm text-text-secondary">
            Escolha a conta onde a campanha será criada e a Página do Facebook que aparecerá no anúncio (obrigatório para criativos com link).
          </p>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Conta de anúncios</label>
            <select
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            >
              <option value="">Selecione</option>
              {adAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">O token precisa da permissão <strong>pages_manage_ads</strong>. Em conta empresarial são listadas todas as suas Páginas; em conta pessoal, só as vinculadas à conta.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Página do Facebook</label>
            {loadingPromotePages && adAccountId && !isPortfolioAccount ? (
              <p className="text-sm text-text-secondary">Carregando Páginas desta conta…</p>
            ) : (
              <>
            <select
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                  disabled={adAccountId && !isPortfolioAccount ? promotePages.length === 0 : false}
                >
                  <option value="">Selecione</option>
                  {(adAccountId ? pageList : pages).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {adAccountId && !isPortfolioAccount && !loadingPromotePages && promotePages.length === 0 && (
                  <p className="text-sm text-amber-500 mt-2">Nenhuma Página disponível para esta conta. Vincule uma Página ao negócio no Facebook ou use uma conta de anúncios pessoal.</p>
                )}
                {!adAccountId && pages.length === 0 && adAccounts.length > 0 && (
                  <p className="text-xs text-amber-500 mt-1">Nenhuma página encontrada. Conecte uma Página ao seu perfil no Meta.</p>
                )}
              </>
            )}
          </div>
          {adAccounts.length === 0 && (
            <div className="p-4 rounded-lg bg-dark-bg border border-dark-border text-text-secondary text-sm">
              <p>Configure o token do Meta em Configurações para listar contas e páginas.</p>
              <button
                type="button"
                onClick={() => router.push("/configuracoes")}
                className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-md bg-shopee-orange text-white text-sm font-semibold hover:opacity-90"
              >
                <Settings className="h-4 w-4" /> Configurações
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!canStep2}
            className="flex items-center gap-2 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próximo: Campanha <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 2: Campanha */}
      {step === 2 && (
        <div className="rounded-xl border border-dark-border bg-dark-card p-6 max-w-xl space-y-6">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-shopee-orange" />
            Nova campanha
          </h2>
          <p className="text-sm text-text-secondary">
            Escolha o objetivo e o nome. A campanha será criada em status <strong>Pausada</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Objetivo da campanha</label>
            <select
              value={campaignObjective}
              onChange={(e) => setCampaignObjective(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            >
              {META_CAMPAIGN_OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Nome da campanha</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Black Friday - Afiliado"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-dark-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={createCampaign}
              disabled={!campaignName.trim() || loading}
              className="flex items-center gap-2 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar campanha e continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Conjunto */}
      {step === 3 && (
        <div className="rounded-xl border border-dark-border bg-dark-card p-6 max-w-xl space-y-6">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Target className="h-5 w-5 text-shopee-orange" />
            Conjunto de anúncios
          </h2>
          <p className="text-sm text-text-secondary">
            Orçamento diário, público (país, idade, gênero), meta de desempenho e opcionalmente pixel/evento de conversão.
          </p>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Nome do conjunto</label>
            <input
              type="text"
              value={adsetName}
              onChange={(e) => setAdsetName(e.target.value)}
              placeholder="Ex: Conjunto BR 18-45"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Orçamento diário (R$)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            />
            <p className="text-xs text-text-secondary mt-1">Mínimo R$ 1,00. Ex: 10 = R$ 10/dia.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Meta de desempenho</label>
            <select
              value={optimizationGoal}
              onChange={(e) => {
                const v = e.target.value;
                setOptimizationGoal(v);
                if (!["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(v)) {
                  setPixelId("");
                  setConversionEvent("");
                }
              }}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            >
              {META_OPTIMIZATION_GOALS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(optimizationGoal) && (
            <>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Conjunto de dados (Pixel)</label>
            <select
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            >
              <option value="">Nenhum (tráfego/cliques)</option>
              {pixels.map((p) => (
                <option key={p.id} value={p.id}>{p.name || p.id}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">Opcional. Para campanhas de conversão, selecione o pixel.</p>
          </div>
          {pixelId && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Evento de conversão</label>
              <select
                value={conversionEvent}
                onChange={(e) => setConversionEvent(e.target.value)}
                className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
              >
                <option value="">Nenhum</option>
                <option value="PURCHASE">Comprar (Purchase)</option>
                <option value="LEAD">Lead</option>
                <option value="COMPLETE_REGISTRATION">Cadastro completo</option>
                <option value="ADD_TO_CART">Adicionar ao carrinho</option>
                <option value="INITIATE_CHECKOUT">Iniciar checkout</option>
                <option value="VIEW_CONTENT">Visualizar conteúdo</option>
                <option value="PAGE_VIEW">Visualização de página</option>
              </select>
            </div>
          )}
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">País</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
              >
                {META_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1">Idade mín.</label>
                <input
                  type="number"
                  min="18"
                  max="65"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1">Idade máx.</label>
                <input
                  type="number"
                  min="18"
                  max="65"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Gênero</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "all" | "male" | "female")}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            >
              <option value="all">Todos</option>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-md border border-dark-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={createAdSet}
              disabled={!adsetName.trim() || loading}
              className="flex items-center gap-2 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar conjunto e continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Anúncio */}
      {step === 4 && (
        <div className="rounded-xl border border-dark-border bg-dark-card p-6 max-w-xl space-y-6">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-shopee-orange" />
            Anúncio (criativo com link)
          </h2>
          <p className="text-sm text-text-secondary">
            Identidade (quem aparece no anúncio), destino, texto e imagem.
          </p>
          <div className="rounded-lg border border-dark-border bg-dark-bg/50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Identidade</h3>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Página do Facebook</label>
              <p className="text-sm text-text-primary">
                {pages.find((p) => p.id === pageId)?.name || "—"}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">Definida no passo 1 (Conta e Página).</p>
            </div>
            {pages.find((p) => p.id === pageId)?.instagram_account && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Conta do Instagram</label>
                <select
                  value={instagramAccountId}
                  onChange={(e) => setInstagramAccountId(e.target.value)}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                >
                  <option value="">Não usar Instagram</option>
                  <option value={pages.find((p) => p.id === pageId)!.instagram_account!.id}>
                    @{pages.find((p) => p.id === pageId)!.instagram_account!.username || pages.find((p) => p.id === pageId)!.instagram_account!.id}
                  </option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Nome do anúncio</label>
            <input
              type="text"
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              placeholder="Ex: Anúncio 1 - Shopee"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1 flex items-center gap-1">
              <Link2 className="h-4 w-4" /> Link de destino
            </label>
            <input
              type="url"
              value={adLink}
              onChange={(e) => setAdLink(e.target.value)}
              placeholder="https://shope.ee/...?utm_content=AD_ID"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Texto do anúncio (message)</label>
            <textarea
              value={adMessage}
              onChange={(e) => setAdMessage(e.target.value)}
              placeholder="Descrição ou chamada para ação..."
              rows={3}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Título (opcional)</label>
            <input
              type="text"
              value={adTitle}
              onChange={(e) => setAdTitle(e.target.value)}
              placeholder="Título do link"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Chamada para ação</label>
            <select
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            >
              {META_CALL_TO_ACTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">Botão exibido no anúncio (ex.: Saiba mais, Comprar agora).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Tipo de mídia</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMediaType("image"); setVideoId(""); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${mediaType === "image" ? "bg-shopee-orange border-shopee-orange text-white" : "border-dark-border text-text-primary hover:bg-dark-bg"}`}
              >
                <ImageIcon className="h-4 w-4" /> Imagem
              </button>
              <button
                type="button"
                onClick={() => { setMediaType("video"); setVideoId(""); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${mediaType === "video" ? "bg-shopee-orange border-shopee-orange text-white" : "border-dark-border text-text-primary hover:bg-dark-bg"}`}
              >
                <Video className="h-4 w-4" /> Vídeo
              </button>
            </div>
          </div>
          {mediaType === "image" && (
          <>
          <div className="rounded-lg border border-dark-border bg-dark-bg/50 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-shopee-orange" />
              Imagem do anúncio (biblioteca do Facebook — recomendado)
            </h3>
            <p className="text-xs text-text-secondary">
              Envie para a biblioteca do Meta ou escolha uma imagem já enviada. Evita erro de &quot;não foi possível baixar sua imagem&quot;.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg cursor-pointer">
                <Upload className="h-4 w-4" />
                Enviar nova imagem
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingImage || !adAccountId}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !adAccountId) return;
                    setUploadingImage(true);
                    setError(null);
                    try {
                      const form = new FormData();
                      form.set("file", f);
                      form.set("ad_account_id", adAccountId);
                      const res = await fetch("/api/meta/adimages", { method: "POST", body: form });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar");
                      setImageHash(json.hash);
                      setImageUrl("");
                      setLibraryImages((prev) => [{ hash: json.hash, url: null, id: null }, ...prev]);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro ao enviar imagem");
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <div className="flex-1 min-w-[200px]">
                <select
                  value={imageHash}
                  onChange={(e) => {
                    setImageHash(e.target.value);
                    if (e.target.value) setImageUrl("");
                  }}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                >
                  <option value="">Escolher da biblioteca...</option>
                  {libraryImages.map((img) => (
                    <option key={img.hash} value={img.hash}>
                      {img.url ? `Imagem (${img.hash.slice(0, 12)}…)` : `Hash: ${img.hash.slice(0, 16)}…`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(imageHash || imageUrl) && (
              <div className="flex items-center gap-2 text-sm text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                {imageHash ? "Imagem da biblioteca selecionada." : "URL da imagem preenchida."}
              </div>
            )}
            {libraryImages.some((i) => i.hash === imageHash && i.url) && (
              <img
                src={libraryImages.find((i) => i.hash === imageHash)!.url!}
                alt="Preview"
                className="max-h-32 rounded border border-dark-border object-contain bg-dark-bg"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Ou use URL da imagem</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                if (e.target.value) setImageHash("");
              }}
              placeholder="https://... (se não usar a biblioteca)"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
            <p className="text-xs text-text-secondary mt-1">Só use se a imagem estiver acessível publicamente na internet.</p>
            {imageUrl && (
              <img src={imageUrl} alt="Preview" className="mt-2 max-h-32 rounded border border-dark-border object-contain bg-dark-bg" />
            )}
          </div>
          </>
          )}
          {mediaType === "video" && (
          <div className="rounded-lg border border-dark-border bg-dark-bg/50 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Video className="h-4 w-4 text-shopee-orange" />
              Vídeo do anúncio (biblioteca do Meta)
            </h3>
            <p className="text-xs text-text-secondary">
              Envie um novo vídeo ou escolha um já enviado para a biblioteca da conta.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploadingVideo ? "Enviando..." : "Enviar novo vídeo"}
                <input
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  disabled={uploadingVideo || !adAccountId}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !adAccountId) return;
                    setUploadingVideo(true);
                    setError(null);
                    try {
                      const form = new FormData();
                      form.set("file", f);
                      form.set("ad_account_id", adAccountId);
                      const res = await fetch("/api/meta/advideos", { method: "POST", body: form });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar");
                      setVideoId(json.video_id);
                      setLibraryVideos((prev) => [{ id: json.video_id, title: json.video_id, source: null, length: null, picture: null }, ...prev]);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro ao enviar vídeo");
                    } finally {
                      setUploadingVideo(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <div className="flex-1 min-w-[200px]">
                <select
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                >
                  <option value="">Escolher da biblioteca...</option>
                  {libraryVideos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} {v.length != null ? `(${Math.round(v.length)}s)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {videoId && (
              <>
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  Vídeo da biblioteca selecionado.
                </div>
                <div className="mt-2">
                  <p className="text-xs text-text-secondary mb-1">Miniatura do vídeo:</p>
                  <img
                    src={libraryVideos.find((v) => v.id === videoId)?.picture ?? `/api/meta/advideos/thumbnail?video_id=${encodeURIComponent(videoId)}`}
                    alt="Miniatura do vídeo"
                    className="max-h-40 w-auto rounded border border-dark-border object-contain bg-dark-bg"
                  />
                </div>
              </>
            )}
            <div className="border-t border-dark-border pt-4 mt-4">
              <h4 className="text-sm font-semibold text-text-primary mb-2">Imagem de capa do vídeo (obrigatório)</h4>
              <p className="text-xs text-text-secondary mb-3">
                O Meta exige uma imagem de capa para anúncios com vídeo. Envie ou escolha uma imagem da biblioteca.
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Enviar nova imagem
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingImage || !adAccountId}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f || !adAccountId) return;
                      setUploadingImage(true);
                      setError(null);
                      try {
                        const form = new FormData();
                        form.set("file", f);
                        form.set("ad_account_id", adAccountId);
                        const res = await fetch("/api/meta/adimages", { method: "POST", body: form });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar");
                        setImageHash(json.hash);
                        setImageUrl("");
                        setLibraryImages((prev) => [{ hash: json.hash, url: null, id: null }, ...prev]);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Erro ao enviar imagem");
                      } finally {
                        setUploadingImage(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                <div className="flex-1 min-w-[200px]">
                  <select
                    value={imageHash}
                    onChange={(e) => {
                      setImageHash(e.target.value);
                      if (e.target.value) setImageUrl("");
                    }}
                    className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                  >
                    <option value="">Escolher da biblioteca...</option>
                    {libraryImages.map((img) => (
                      <option key={img.hash} value={img.hash}>
                        {img.url ? `Imagem (${img.hash.slice(0, 12)}…)` : `Hash: ${img.hash.slice(0, 16)}…`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (e.target.value) setImageHash("");
                  }}
                  placeholder="Ou URL da imagem de capa"
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
                />
              </div>
              {(imageHash || imageUrl) && (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-500 mt-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Imagem de capa selecionada.
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-text-secondary mb-1">Miniatura da capa:</p>
                    {imageUrl ? (
                      <img src={imageUrl} alt="Capa" className="max-h-40 w-auto rounded border border-dark-border object-contain bg-dark-bg" />
                    ) : libraryImages.find((i) => i.hash === imageHash)?.url ? (
                      <img src={libraryImages.find((i) => i.hash === imageHash)!.url!} alt="Capa" className="max-h-40 w-auto rounded border border-dark-border object-contain bg-dark-bg" />
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-md border border-dark-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={createAd}
              disabled={
                !adLink.trim() || !adMessage.trim() || loading ||
                (mediaType === "image" && !imageHash.trim() && !imageUrl.trim()) ||
                (mediaType === "video" && (!videoId.trim() || (!imageHash.trim() && !imageUrl.trim())))
              }
              className="flex items-center gap-2 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar anúncio
            </button>
          </div>
        </div>
      )}

      {/* Sucesso: step 4 concluído com createdAdId */}
      {step === 4 && createdAdId && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Anúncio criado
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            ID do anúncio: <code className="bg-dark-bg px-1 rounded text-text-primary">{createdAdId}</code>. Use esse valor no link de destino (utm_content) para cruzar com a Shopee no ATI.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Criar outra campanha
          </button>
        </div>
      )}
    </>
  );
}
