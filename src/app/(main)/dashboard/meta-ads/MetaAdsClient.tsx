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
  ChevronLeft,
  Zap,
  Instagram,
} from "lucide-react";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";
import {
  META_CAMPAIGN_OBJECTIVES,
  META_COUNTRIES,
  META_CALL_TO_ACTIONS,
  getOptimizationGoalsForObjective,
  getDefaultGoalForObjective,
} from "@/lib/meta-ads-constants";

type AdAccount = { id: string; name: string; business_id?: string };
type Page = { id: string; name: string; instagram_account?: { id: string; username: string } | null };
type Pixel = { id: string; name: string };
type InstagramAccount = { id: string; username: string; profile_pic: string | null };
type LibraryImage = { hash: string; url: string | null; id: string | null };
type LibraryVideo = { id: string; title: string; source: string | null; length: number | null; picture: string | null };

const STEPS = [
  { id: 1, title: "Conta & Página", icon: Building2 },
  { id: 2, title: "Campanha", icon: Megaphone },
  { id: 3, title: "Conjunto", icon: Target },
  { id: 4, title: "Anúncio", icon: ImageIcon },
];

// ─── Field helpers ─────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none focus:border-shopee-orange transition-colors";
const selectCls = inputCls;

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide">{children}</label>
      {hint && <p className="text-[11px] text-text-secondary/60 mt-0.5">{hint}</p>}
    </div>
  );
}

function SectionBox({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dark-border/60 bg-dark-bg/40 p-4 space-y-4">
      <div className="flex items-center gap-2 border-l-2 border-shopee-orange/60 pl-2">
        <Icon className="h-3.5 w-3.5 text-shopee-orange/80" />
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

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
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [loadingIgAccounts, setLoadingIgAccounts] = useState(false);
  const [igDebug, setIgDebug] = useState<string | null>(null);
  const [igManualMode, setIgManualMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, pagRes] = await Promise.all([fetch("/api/meta/accounts"), fetch("/api/meta/pages")]);
        const accJson = await accRes.json();
        const pagJson = await pagRes.json();
        if (cancelled) return;
        if (accRes.ok && accJson.adAccounts?.length) setAdAccounts(accJson.adAccounts);
        if (pagRes.ok && pagJson.pages?.length) setPages(pagJson.pages);
        if (!accRes.ok && accJson.error) setError(accJson.error);
        else if (!pagRes.ok && pagJson.error) setError(pagJson.error);
      } catch { if (!cancelled) setError("Erro ao carregar contas e páginas."); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!adAccountId) { setPixels([]); setPromotePages([]); return; }
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
        } else { setPromotePages([]); if (!ok && json?.error) setError(json.error); }
      })
      .catch(() => { if (!cancelled) { setPromotePages([]); setError("Erro ao carregar Páginas desta conta."); } })
      .finally(() => { if (!cancelled) setLoadingPromotePages(false); });
    return () => { cancelled = true; };
  }, [adAccountId, adAccounts]);

  useEffect(() => {
    if (!adAccountId) { setIgAccounts([]); setInstagramAccountId(""); return; }
    let cancelled = false;
    setLoadingIgAccounts(true);
    const params = new URLSearchParams({ ad_account_id: adAccountId });
    if (pageId) params.set("page_id", pageId);
    const acct = adAccounts.find((a) => a.id === adAccountId);
    if (acct?.business_id) params.set("business_id", acct.business_id);
    fetch(`/api/meta/instagram-accounts?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) { setIgAccounts(json.accounts ?? []); setIgDebug(json._debug ? json._debug.join(" | ") : null); } })
      .catch(() => { if (!cancelled) { setIgAccounts([]); setIgDebug(null); } })
      .finally(() => { if (!cancelled) setLoadingIgAccounts(false); });
    return () => { cancelled = true; };
  }, [adAccountId, pageId, adAccounts]);

  const selectedAccount = adAccounts.find((a) => a.id === adAccountId);
  const isPortfolioAccount = Boolean(selectedAccount?.business_id);
  const pageList = isPortfolioAccount ? pages : (promotePages.length ? promotePages : pages);

  useEffect(() => {
    if (!adAccountId) { setPixels([]); return; }
    let cancelled = false;
    fetch(`/api/meta/pixels?ad_account_id=${encodeURIComponent(adAccountId)}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled && json.pixels) setPixels(json.pixels); })
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
  const allowedGoalsForObjective = getOptimizationGoalsForObjective(campaignObjective);
  const isCurrentGoalAllowed = allowedGoalsForObjective.some((o) => o.value === optimizationGoal);

  useEffect(() => {
    if (canStep3 && !isCurrentGoalAllowed) {
      setOptimizationGoal(getDefaultGoalForObjective(campaignObjective));
      setPixelId(""); setConversionEvent("");
    }
  }, [campaignObjective, canStep3, isCurrentGoalAllowed]);

  const canStep4 = adsetId && adsetName;

  const createCampaign = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meta/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_account_id: adAccountId, name: campaignName, objective: campaignObjective }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar campanha");
      setCampaignId(json.campaign_id); setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar campanha"); }
    finally { setLoading(false); }
  };

  const createAdSet = async () => {
    const budgetCents = Math.round(parseFloat(dailyBudget || "0") * 100);
    if (budgetCents < 100) { setError("Orçamento diário mínimo: R$ 6,00 (100 centavos)."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meta/adsets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adAccountId, campaign_id: campaignId, name: adsetName,
          daily_budget: budgetCents, country_code: countryCode,
          age_min: parseInt(ageMin, 10) || 18, age_max: parseInt(ageMax, 10) || 65,
          gender, optimization_goal: optimizationGoal,
          pixel_id: pixelId || undefined, custom_conversion_id: conversionEvent || undefined, conversion_event: conversionEvent || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar conjunto");
      setAdsetId(json.adset_id); setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar conjunto"); }
    finally { setLoading(false); }
  };

  const createAd = async () => {
    const hasImage = imageHash.trim() || imageUrl.trim();
    const hasVideo = mediaType === "video" && videoId.trim();
    if (!adMessage.trim()) { setError("Preencha o texto do anúncio."); return; }
    if (mediaType === "image" && !hasImage) { setError("Escolha uma imagem da biblioteca, envie uma nova ou use a URL."); return; }
    if (mediaType === "video") {
      if (!hasVideo) { setError("Escolha um vídeo da biblioteca ou envie um novo."); return; }
      if (!hasImage) { setError("O Meta exige uma imagem de capa para anúncios com vídeo."); return; }
    }
    setLoading(true); setError(null);
    try {
      const body: Record<string, string | undefined> = {
        ad_account_id: adAccountId, adset_id: adsetId, name: adName || "Anúncio",
        page_id: pageId, link: adLink.trim(), message: adMessage.trim(),
        title: adTitle.trim() || undefined, call_to_action: callToAction,
        instagram_actor_id: instagramAccountId || undefined,
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar anúncio");
      setCreatedAdId(json.ad_id ?? ""); setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar anúncio"); }
    finally { setLoading(false); }
  };

  const handleReset = () => { setStep(1); setCampaignId(""); setAdsetId(""); setCreatedAdId(""); setError(null); };

  // Upload helpers
  const uploadImage = async (file: File) => {
    if (!adAccountId) return;
    setUploadingImage(true); setError(null);
    try {
      const form = new FormData(); form.set("file", file); form.set("ad_account_id", adAccountId);
      const res = await fetch("/api/meta/adimages", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar");
      setImageHash(json.hash); setImageUrl("");
      setLibraryImages((prev) => [{ hash: json.hash, url: null, id: null }, ...prev]);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao enviar imagem"); }
    finally { setUploadingImage(false); }
  };

  const uploadVideo = async (file: File) => {
    if (!adAccountId) return;
    setUploadingVideo(true); setError(null);
    try {
      const form = new FormData(); form.set("file", file); form.set("ad_account_id", adAccountId);
      const res = await fetch("/api/meta/advideos", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar");
      setVideoId(json.video_id);
      setLibraryVideos((prev) => [{ id: json.video_id, title: json.video_id, source: null, length: null, picture: null }, ...prev]);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao enviar vídeo"); }
    finally { setUploadingVideo(false); }
  };

  return (
    <>
      {loading && <LoadingOverlay message="Criando no Meta..." />}

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-shopee-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary leading-tight">Criar Campanha Meta</h1>
            <p className="text-[11px] text-text-secondary/70 mt-px">Tudo criado em modo <strong className="text-text-secondary">Pausado</strong> — ative no Gerenciador quando quiser.</p>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-5 p-3 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">{error}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button type="button" onClick={() => router.push("/configuracoes")} className="text-xs text-shopee-orange hover:underline font-semibold">
                Configurações →
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoadingTokenDebug(true); setTokenDebug(null);
                  try {
                    const res = await fetch("/api/meta/debug-token");
                    const json = await res.json();
                    if (res.ok && json.scopes) setTokenDebug({ scopes: json.scopes, has_pages_manage_ads: !!json.has_pages_manage_ads, is_valid: !!json.is_valid });
                    else setTokenDebug({ scopes: [], has_pages_manage_ads: false, is_valid: false });
                  } catch { setTokenDebug({ scopes: [], has_pages_manage_ads: false, is_valid: false }); }
                  finally { setLoadingTokenDebug(false); }
                }}
                disabled={loadingTokenDebug}
                className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-50 underline"
              >
                {loadingTokenDebug ? "Carregando…" : "Ver permissões do token"}
              </button>
            </div>
            {tokenDebug && (
              <div className="mt-2 p-2.5 rounded-xl bg-dark-bg/80 text-xs text-text-secondary border border-dark-border space-y-1">
                <p className="font-semibold text-text-primary">
                  Token válido: <span className={tokenDebug.is_valid ? "text-emerald-400" : "text-red-400"}>{tokenDebug.is_valid ? "Sim" : "Não"}</span>
                  {" · "}pages_manage_ads: <span className={tokenDebug.has_pages_manage_ads ? "text-emerald-400" : "text-red-400"}>{tokenDebug.has_pages_manage_ads ? "Sim" : "Não"}</span>
                </p>
                <p>Permissões: {tokenDebug.scopes.length ? tokenDebug.scopes.join(", ") : "nenhuma"}</p>
                {!tokenDebug.has_pages_manage_ads && (
                  <p className="text-amber-400">Gere um novo token no Graph API Explorer com a permissão <strong>pages_manage_ads</strong> e cole em Configurações.</p>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 text-xs shrink-0">✕</button>
        </div>
      )}

      {/* ── Stepper ── */}
      <div className="mb-7">
        <div className="flex items-center gap-0">
          {STEPS.map((s, idx) => {
            const done = s.id < step;
            const current = s.id === step;
            const future = s.id > step;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => (done || s.id === 1) ? setStep(s.id) : undefined}
                  className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 transition-all ${future ? "cursor-default opacity-40" : "cursor-pointer"}`}
                >
                  {/* Círculo */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                    current ? "bg-shopee-orange text-white shadow-[0_0_12px_rgba(238,77,45,0.4)]"
                    : done ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                    : "bg-dark-card border-2 border-dark-border text-text-secondary"
                  }`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
                  </div>
                  {/* Label */}
                  <span className={`hidden sm:block text-xs font-medium whitespace-nowrap ${current ? "text-text-primary" : done ? "text-emerald-400" : "text-text-secondary"}`}>
                    {s.title}
                  </span>
                </button>
                {/* Linha conectora */}
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 transition-colors ${done ? "bg-emerald-500/40" : "bg-dark-border"}`} />
                )}
              </div>
            );
          })}
        </div>
        {/* Label mobile do step atual */}
        <p className="sm:hidden text-xs font-medium text-text-primary mt-2 ml-0.5">
          {STEPS[step - 1]?.title}
        </p>
      </div>

      {/* ── Step 1: Conta e Página ── */}
      {step === 1 && (
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 max-w-xl space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-bold text-text-primary">Conta de anúncios & Página</h2>
          </div>

          {adAccounts.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center border border-dashed border-dark-border rounded-xl">
              <Settings className="h-8 w-8 text-text-secondary/30" />
              <p className="text-xs text-text-secondary/60">Configure o token do Meta em Configurações para listar contas.</p>
              <button type="button" onClick={() => router.push("/configuracoes")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-shopee-orange text-white text-xs font-semibold hover:opacity-90">
                <Settings className="h-3.5 w-3.5" /> Configurações
              </button>
            </div>
          ) : (
            <>
              <div>
                <FieldLabel hint="A conta onde a campanha será criada. Precisa da permissão pages_manage_ads.">Conta de anúncios</FieldLabel>
                <select value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} className={selectCls}>
                  <option value="">Selecione uma conta</option>
                  {adAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel hint="Página do Facebook que aparecerá como autor do anúncio.">Página do Facebook</FieldLabel>
                {loadingPromotePages && adAccountId && !isPortfolioAccount ? (
                  <div className="flex items-center gap-2 text-xs text-text-secondary py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando páginas…
                  </div>
                ) : (
                  <>
                    <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={selectCls}
                      disabled={adAccountId && !isPortfolioAccount ? promotePages.length === 0 : false}>
                      <option value="">Selecione uma página</option>
                      {(adAccountId ? pageList : pages).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {adAccountId && !isPortfolioAccount && !loadingPromotePages && promotePages.length === 0 && (
                      <p className="text-xs text-amber-400 mt-1.5">Nenhuma Página disponível. Vincule uma Página ao negócio no Facebook.</p>
                    )}
                  </>
                )}
              </div>

              {/* Instagram (opcional) */}
              <div>
                <FieldLabel hint="Opcional. Se selecionada, o anúncio também aparecerá nesta conta do Instagram.">
                  <span className="flex items-center gap-1.5"><Instagram className="h-3 w-3" /> Conta do Instagram</span>
                </FieldLabel>
                {loadingIgAccounts && adAccountId ? (
                  <div className="flex items-center gap-2 text-xs text-text-secondary py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando contas Instagram…
                  </div>
                ) : igAccounts.length > 0 ? (
                  <>
                    <select value={instagramAccountId} onChange={(e) => setInstagramAccountId(e.target.value)} className={selectCls}>
                      <option value="">Não usar Instagram</option>
                      {igAccounts.map((ig) => (
                        <option key={ig.id} value={ig.id}>@{ig.username}</option>
                      ))}
                    </select>
                    {!igManualMode && (
                      <button type="button" onClick={() => setIgManualMode(true)} className="text-[10px] text-text-secondary/50 hover:text-shopee-orange mt-1 transition-colors">
                        Não encontrou? Digitar ID manualmente
                      </button>
                    )}
                    {igManualMode && (
                      <input type="text" value={instagramAccountId} onChange={(e) => setInstagramAccountId(e.target.value.trim())}
                        placeholder="Cole o ID numérico da conta IG"
                        className={`${inputCls} mt-1.5`} />
                    )}
                  </>
                ) : adAccountId ? (
                  <div>
                    <p className="text-[11px] text-amber-400/80 mb-1.5">Nenhuma conta encontrada via API. O token pode precisar da permissão <strong>instagram_basic</strong>.</p>
                    <input type="text" value={instagramAccountId} onChange={(e) => setInstagramAccountId(e.target.value.trim())}
                      placeholder="Cole o ID numérico da conta IG (ex: 17841400123456)"
                      className={inputCls} />
                    <p className="text-[10px] text-text-secondary/40 mt-1.5">
                      Para encontrar o ID: abra o Gerenciador de Anúncios do Meta → crie um anúncio → em &quot;Identidade&quot; selecione a conta IG → inspecione a rede (DevTools) e procure o campo <code className="text-text-secondary/60">instagram_actor_id</code>.
                    </p>
                    {igDebug && <p className="text-[10px] text-text-secondary/30 mt-1 break-all">Debug: {igDebug}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary/60 py-1.5">Selecione uma conta de anúncios primeiro.</p>
                )}
              </div>
            </>
          )}

          <button type="button" onClick={() => setStep(2)} disabled={!canStep2}
            className="inline-flex items-center gap-2 rounded-xl bg-shopee-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
            Próximo <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Campanha ── */}
      {step === 2 && (
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 max-w-xl space-y-5">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-bold text-text-primary">Nova campanha</h2>
          </div>
          <div>
            <FieldLabel hint="Determina como o Meta otimiza a entrega dos seus anúncios.">Objetivo da campanha</FieldLabel>
            <select value={campaignObjective} onChange={(e) => setCampaignObjective(e.target.value)} className={selectCls}>
              {META_CAMPAIGN_OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Nome da campanha</FieldLabel>
            <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Black Friday — Afiliado Shopee" className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button type="button" onClick={createCampaign} disabled={!campaignName.trim() || loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar campanha e continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Conjunto ── */}
      {step === 3 && (
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 max-w-xl space-y-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-bold text-text-primary">Conjunto de anúncios</h2>
          </div>

          <div>
            <FieldLabel>Nome do conjunto</FieldLabel>
            <input type="text" value={adsetName} onChange={(e) => setAdsetName(e.target.value)}
              placeholder="Ex: Conjunto BR 18-45" className={inputCls} />
          </div>

          <div>
            <FieldLabel hint="Mínimo R$ 6,00. Quanto mais alto, maior o alcance diário.">Orçamento diário (R$)</FieldLabel>
            <input type="number" min="1" step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} className={inputCls} />
          </div>

          <div>
            <FieldLabel hint={`Opções compatíveis com o objetivo "${META_CAMPAIGN_OBJECTIVES.find(c => c.value === campaignObjective)?.label ?? campaignObjective}".`}>
              Meta de desempenho
            </FieldLabel>
            <select value={isCurrentGoalAllowed ? optimizationGoal : getDefaultGoalForObjective(campaignObjective)}
              onChange={(e) => {
                const v = e.target.value; setOptimizationGoal(v);
                if (!["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(v)) { setPixelId(""); setConversionEvent(""); }
              }} className={selectCls}>
              {allowedGoalsForObjective.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(optimizationGoal) && (
            <SectionBox title="Pixel & conversão" icon={Target}>
              <div>
                <FieldLabel hint="Para campanhas de conversão. Opcional para tráfego/cliques.">Conjunto de dados (Pixel)</FieldLabel>
                <select value={pixelId} onChange={(e) => setPixelId(e.target.value)} className={selectCls}>
                  <option value="">Nenhum</option>
                  {pixels.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                </select>
              </div>
              {pixelId && (
                <div>
                  <FieldLabel>Evento de conversão</FieldLabel>
                  <select value={conversionEvent} onChange={(e) => setConversionEvent(e.target.value)} className={selectCls}>
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
            </SectionBox>
          )}

          <SectionBox title="Público" icon={Target}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>País</FieldLabel>
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={selectCls}>
                  {META_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Gênero</FieldLabel>
                <select value={gender} onChange={(e) => setGender(e.target.value as "all" | "male" | "female")} className={selectCls}>
                  <option value="all">Todos</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Idade mín.</FieldLabel>
                <input type="number" min="18" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={inputCls} />
              </div>
              <div>
                <FieldLabel>Idade máx.</FieldLabel>
                <input type="number" min="18" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={inputCls} />
              </div>
            </div>
          </SectionBox>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button type="button" onClick={createAdSet} disabled={!adsetName.trim() || loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar conjunto e continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Anúncio ── */}
      {step === 4 && (
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 max-w-xl space-y-5">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-bold text-text-primary">Anúncio — criativo</h2>
          </div>

          {/* Identidade */}
          <SectionBox title="Identidade" icon={Building2}>
            <div>
              <FieldLabel>Página do Facebook</FieldLabel>
              <p className="text-sm text-text-primary font-medium">{pages.find((p) => p.id === pageId)?.name || pageList.find((p) => p.id === pageId)?.name || "—"}</p>
              <p className="text-[11px] text-text-secondary/60 mt-0.5">Definida no passo 1.</p>
            </div>
            <div>
              <FieldLabel>Conta do Instagram</FieldLabel>
              {instagramAccountId ? (
                <p className="text-sm text-text-primary font-medium flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-pink-400" />
                  @{igAccounts.find((ig) => ig.id === instagramAccountId)?.username || instagramAccountId}
                </p>
              ) : (
                <p className="text-sm text-text-secondary/60">Não selecionada</p>
              )}
              <p className="text-[11px] text-text-secondary/60 mt-0.5">Definida no passo 1.</p>
            </div>
          </SectionBox>

          {/* Conteúdo */}
          <div>
            <FieldLabel>Nome do anúncio</FieldLabel>
            <input type="text" value={adName} onChange={(e) => setAdName(e.target.value)}
              placeholder="Ex: Anúncio 1 — Shopee Verão" className={inputCls} />
          </div>

          <div>
            <FieldLabel hint="Opcional — pode gerar depois no ATI com o ad_id.">
              <span className="flex items-center gap-1"><Link2 className="h-3 w-3" /> Link de destino</span>
            </FieldLabel>
            <input type="url" value={adLink} onChange={(e) => setAdLink(e.target.value)}
              placeholder="Deixe em branco ou cole o link da Shopee" className={inputCls} />
          </div>

          <div>
            <FieldLabel>Texto do anúncio *</FieldLabel>
            <textarea value={adMessage} onChange={(e) => setAdMessage(e.target.value)}
              placeholder="Descrição ou chamada para ação…" rows={3}
              className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Título (opcional)</FieldLabel>
              <input type="text" value={adTitle} onChange={(e) => setAdTitle(e.target.value)}
                placeholder="Título do link" className={inputCls} />
            </div>
            <div>
              <FieldLabel hint="Botão exibido no anúncio.">Chamada para ação</FieldLabel>
              <select value={callToAction} onChange={(e) => setCallToAction(e.target.value)} className={selectCls}>
                {META_CALL_TO_ACTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Tipo de mídia */}
          <div>
            <FieldLabel>Tipo de mídia</FieldLabel>
            <div className="flex gap-2">
              {[
                { type: "image" as const, label: "Imagem", Icon: ImageIcon },
                { type: "video" as const, label: "Vídeo", Icon: Video },
              ].map(({ type, label, Icon }) => (
                <button key={type} type="button"
                  onClick={() => { setMediaType(type); setVideoId(""); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all ${
                    mediaType === type
                      ? "bg-shopee-orange/10 border-shopee-orange text-shopee-orange"
                      : "border-dark-border text-text-secondary hover:border-dark-border/80 hover:text-text-primary"
                  }`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Imagem */}
          {mediaType === "image" && (
            <SectionBox title="Imagem do anúncio" icon={ImagePlus}>
              <p className="text-[11px] text-text-secondary/70">Use a biblioteca do Meta para evitar erros de download. Envie ou escolha uma imagem já enviada.</p>
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex items-center gap-1.5 rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 cursor-pointer transition-all ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}`}>
                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Enviar imagem
                  <input type="file" accept="image/*" className="sr-only" disabled={uploadingImage || !adAccountId}
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadImage(f); e.target.value = ""; } }} />
                </label>
                <select value={imageHash} onChange={(e) => { setImageHash(e.target.value); if (e.target.value) setImageUrl(""); }}
                  className={`flex-1 min-w-[160px] ${selectCls}`}>
                  <option value="">Escolher da biblioteca…</option>
                  {libraryImages.map((img) => (
                    <option key={img.hash} value={img.hash}>
                      {img.url ? `Imagem (${img.hash.slice(0, 12)}…)` : `Hash: ${img.hash.slice(0, 16)}…`}
                    </option>
                  ))}
                </select>
              </div>
              {(imageHash || imageUrl) && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {imageHash ? "Imagem da biblioteca selecionada." : "URL da imagem preenchida."}
                </div>
              )}
              {libraryImages.some((i) => i.hash === imageHash && i.url) && (
                <img src={libraryImages.find((i) => i.hash === imageHash)!.url!} alt="Preview"
                  className="max-h-28 rounded-xl border border-dark-border object-contain bg-dark-bg" />
              )}
              <div>
                <FieldLabel hint="Só use se a imagem estiver acessível publicamente na internet.">Ou URL da imagem</FieldLabel>
                <input type="url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageHash(""); }}
                  placeholder="https://..." className={inputCls} />
                {imageUrl && <img src={imageUrl} alt="Preview" className="mt-2 max-h-28 rounded-xl border border-dark-border object-contain bg-dark-bg" />}
              </div>
            </SectionBox>
          )}

          {/* Vídeo */}
          {mediaType === "video" && (
            <SectionBox title="Vídeo do anúncio" icon={Video}>
              <p className="text-[11px] text-text-secondary/70">Envie um vídeo ou escolha um da biblioteca da conta de anúncios.</p>
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex items-center gap-1.5 rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 cursor-pointer transition-all ${uploadingVideo ? "opacity-50 cursor-not-allowed" : ""}`}>
                  {uploadingVideo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploadingVideo ? "Enviando…" : "Enviar vídeo"}
                  <input type="file" accept="video/*" className="sr-only" disabled={uploadingVideo || !adAccountId}
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadVideo(f); e.target.value = ""; } }} />
                </label>
                <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className={`flex-1 min-w-[160px] ${selectCls}`}>
                  <option value="">Escolher da biblioteca…</option>
                  {libraryVideos.map((v) => (
                    <option key={v.id} value={v.id}>{v.title}{v.length != null ? ` (${Math.round(v.length)}s)` : ""}</option>
                  ))}
                </select>
              </div>
              {videoId && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Vídeo selecionado.</div>
                  <img
                    src={libraryVideos.find((v) => v.id === videoId)?.picture ?? `/api/meta/advideos/thumbnail?video_id=${encodeURIComponent(videoId)}`}
                    alt="Miniatura" className="max-h-32 w-auto rounded-xl border border-dark-border object-contain bg-dark-bg" />
                </div>
              )}

              {/* Capa do vídeo */}
              <div className="border-t border-dark-border/60 pt-4 mt-2 space-y-3">
                <FieldLabel hint="O Meta exige uma imagem de capa para anúncios com vídeo.">Imagem de capa *</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <label className={`inline-flex items-center gap-1.5 rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 cursor-pointer transition-all ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Enviar capa
                    <input type="file" accept="image/*" className="sr-only" disabled={uploadingImage || !adAccountId}
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadImage(f); e.target.value = ""; } }} />
                  </label>
                  <select value={imageHash} onChange={(e) => { setImageHash(e.target.value); if (e.target.value) setImageUrl(""); }}
                    className={`flex-1 min-w-[160px] ${selectCls}`}>
                    <option value="">Escolher da biblioteca…</option>
                    {libraryImages.map((img) => (
                      <option key={img.hash} value={img.hash}>
                        {img.url ? `Imagem (${img.hash.slice(0, 12)}…)` : `Hash: ${img.hash.slice(0, 16)}…`}
                      </option>
                    ))}
                  </select>
                </div>
                <input type="url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageHash(""); }}
                  placeholder="Ou URL da imagem de capa" className={inputCls} />
                {(imageHash || imageUrl) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Capa selecionada.</div>
                    {imageUrl ? (
                      <img src={imageUrl} alt="Capa" className="max-h-28 w-auto rounded-xl border border-dark-border object-contain bg-dark-bg" />
                    ) : libraryImages.find((i) => i.hash === imageHash)?.url ? (
                      <img src={libraryImages.find((i) => i.hash === imageHash)!.url!} alt="Capa" className="max-h-28 w-auto rounded-xl border border-dark-border object-contain bg-dark-bg" />
                    ) : null}
                  </div>
                )}
              </div>
            </SectionBox>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button type="button" onClick={createAd}
              disabled={!adMessage.trim() || loading ||
                (mediaType === "image" && !imageHash.trim() && !imageUrl.trim()) ||
                (mediaType === "video" && (!videoId.trim() || (!imageHash.trim() && !imageUrl.trim())))}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Criar anúncio
            </button>
          </div>
        </div>
      )}

      {/* ── Sucesso ── */}
      {step === 4 && createdAdId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={handleReset}>
          <div className="rounded-2xl border border-emerald-500/30 bg-dark-card p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-emerald-400">Anúncio criado!</h2>
                <p className="text-xs text-text-secondary">Em modo pausado — ative quando quiser.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <button type="button" onClick={handleReset}
                className="flex-1 rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
                Nova campanha
              </button>
              <button type="button" onClick={() => { handleReset(); router.push("/dashboard/ati"); }}
                className="flex-1 rounded-xl border border-dark-border bg-dark-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-dark-card transition-colors">
                Ir para o ATI →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
