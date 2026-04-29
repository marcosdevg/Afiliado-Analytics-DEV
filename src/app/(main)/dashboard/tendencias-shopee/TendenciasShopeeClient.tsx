"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Copy,
  ExternalLink,
  Flame,
  Link2,
  ListPlus,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { useChartColors } from "@/app/components/theme/useChartColors";

const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });

type TrendProduct = {
  itemId: number;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  sales: number;
  commissionRate: number | null;
  ratingStar: number | null;
  productLink: string | null;
  shopName: string | null;
  categoryIds: number[];
  score: number;
  isViral: boolean;
  rankPosition: number | null;
  sparkline: number[];
};

type ApiResponse = {
  fetchedAt: string | null;
  stagnant: boolean;
  products: TrendProduct[];
  stats: { total: number; viralCount: number; avgScore: number };
};

type SortKey = "score" | "sales" | "commission";

type Lista = { id: string; nome: string };

const POLL_INTERVAL_MS = 5_000;

// Frases que rolam no console "do engenheiro de IA". A ideia é trocar a cada
// poucos segundos, dando a impressão de que algo está acontecendo nos
// bastidores. Os números usam placeholders {n} que preenchemos com counts reais.
const AI_STATUS_PHRASES = [
  "Analisando {total} produtos em alta...",
  "Cruzando comissões com volume de vendas...",
  "Detectando produtos virais nas últimas horas...",
  "Calculando score de viralização ponderado...",
  "Mapeando categorias com maior tração agora...",
  "Filtrando produtos com melhor relação preço × comissão...",
  "Identificando {viral} oportunidades quentes...",
  "Comparando velocidade de vendas entre nichos...",
  "Procurando janelas de oportunidade curtas...",
  "Verificando ratings e qualidade dos vendedores...",
];

function formatBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5_000) return "agora mesmo";
  if (ms < 60_000) return `há ${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `há ${Math.round(ms / 60_000)} min`;
  return `há ${Math.round(ms / 3_600_000)}h`;
}

/** Hook simples de count-up que anima de `prev` pra `target` em ~600ms. */
function useCountUp(target: number) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const start = prevRef.current;
    const delta = target - start;
    if (delta === 0) return;
    const startedAt = performance.now();
    const duration = 600;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return display;
}

export default function TendenciasShopeeClient({
  hasShopeeCredentials,
}: {
  hasShopeeCredentials: boolean;
}) {
  const colors = useChartColors();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("score");
  const [filter, setFilter] = useState("");
  const [aiPhraseIdx, setAiPhraseIdx] = useState(0);
  const [aiTyped, setAiTyped] = useState("");
  const [heartbeatPulse, setHeartbeatPulse] = useState(false);

  // Mapa pra detectar produtos que viraram virais entre dois polls (dispara confetti).
  const previousViralIds = useRef<Set<number>>(new Set());

  // Listas Shopee do usuário (pra o dropdown "Adicionar à lista").
  const [listas, setListas] = useState<Lista[]>([]);
  const [listasLoading, setListasLoading] = useState(false);

  // Feedback de ações (copia link, adiciona à lista).
  const [feedback, setFeedback] = useState<string>("");
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  // Polling do servidor.
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/shopee-trends?sort=${sort}&limit=50`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse | { error?: string };
      if (!res.ok || "error" in json && json.error) {
        const msg = "error" in json ? json.error : `HTTP ${res.status}`;
        setError(msg ?? "Erro ao carregar tendências");
        return;
      }
      const fresh = json as ApiResponse;
      setData((prev) => {
        // Detecta novos virais pra disparar confetti.
        if (prev && fresh.products) {
          const prevSet = previousViralIds.current;
          const newViral = fresh.products
            .filter((p) => p.isViral && !prevSet.has(p.itemId))
            .map((p) => p.itemId);
          if (newViral.length > 0 && prev.products.length > 0) {
            // Só dispara se a sessão já carregou pelo menos 1x antes
            // (evita confetti em massa no primeiro load).
            try {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.3 },
                colors: ["#ee4d2d", "#ffd23f", "#22c55e", "#0ea5e9"],
              });
            } catch {
              /* ignora se runtime do confetti não rodar */
            }
          }
        }
        previousViralIds.current = new Set(fresh.products.filter((p) => p.isViral).map((p) => p.itemId));
        return fresh;
      });
      setError(null);
      setHeartbeatPulse(true);
      setTimeout(() => setHeartbeatPulse(false), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao consultar API");
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Carrega listas Shopee do usuário pro dropdown "Adicionar à lista".
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setListasLoading(true);
        const res = await fetch("/api/shopee/minha-lista-ofertas/listas", { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) return;
        const json = (await res.json()) as { data?: Array<{ id: string; nome: string }> };
        setListas(json.data ?? []);
      } catch {
        /* ignora */
      } finally {
        if (alive) setListasLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Console "engenheiro de IA": typewriter rotacionando frases.
  useEffect(() => {
    const phrase = AI_STATUS_PHRASES[aiPhraseIdx]
      .replace("{total}", String(data?.stats.total ?? 0))
      .replace("{viral}", String(data?.stats.viralCount ?? 0));
    let i = 0;
    setAiTyped("");
    const typer = setInterval(() => {
      i += 1;
      setAiTyped(phrase.slice(0, i));
      if (i >= phrase.length) clearInterval(typer);
    }, 28);
    const rotate = setTimeout(() => {
      setAiPhraseIdx((idx) => (idx + 1) % AI_STATUS_PHRASES.length);
    }, 4500);
    return () => {
      clearInterval(typer);
      clearTimeout(rotate);
    };
  }, [aiPhraseIdx, data?.stats.total, data?.stats.viralCount]);

  // Filtragem cliente: nome do produto + nome da loja.
  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.products;
    return data.products.filter((p) => {
      const hay = `${p.productName} ${p.shopName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data?.products, filter]);

  const handleCopyLink = useCallback(async (p: TrendProduct) => {
    setActionInFlight(`link-${p.itemId}`);
    try {
      const res = await fetch("/api/shopee-trends/affiliate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: p.itemId, subId: "tendencias" }),
      });
      const json = (await res.json()) as { shortLink?: string; error?: string };
      if (!res.ok || !json.shortLink) {
        setFeedback(`Erro: ${json.error ?? "não foi possível gerar o link"}`);
        setTimeout(() => setFeedback(""), 4000);
        return;
      }
      await navigator.clipboard.writeText(json.shortLink);
      setFeedback(`Link copiado: ${json.shortLink}`);
      setTimeout(() => setFeedback(""), 3500);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Erro ao copiar link");
      setTimeout(() => setFeedback(""), 4000);
    } finally {
      setActionInFlight(null);
    }
  }, []);

  const handleAddToLista = useCallback(
    async (p: TrendProduct, listaId: string) => {
      setActionInFlight(`lista-${p.itemId}`);
      try {
        // 1) Gera link afiliado primeiro.
        const linkRes = await fetch("/api/shopee-trends/affiliate-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: p.itemId, subId: "tendencias" }),
        });
        const linkJson = (await linkRes.json()) as { shortLink?: string; error?: string };
        if (!linkRes.ok || !linkJson.shortLink) {
          setFeedback(`Erro: ${linkJson.error ?? "falha gerar link"}`);
          setTimeout(() => setFeedback(""), 4000);
          return;
        }
        // 2) Adiciona à lista.
        const addRes = await fetch("/api/shopee/minha-lista-ofertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listaId,
            converterLink: linkJson.shortLink,
            productName: p.productName,
            imageUrl: p.imageUrl ?? "",
            priceOriginal: p.priceMax ?? p.price ?? null,
            pricePromo: p.priceMin ?? p.price ?? null,
          }),
        });
        const addJson = (await addRes.json()) as { error?: string };
        if (!addRes.ok) {
          setFeedback(`Erro: ${addJson.error ?? "falha ao adicionar"}`);
          setTimeout(() => setFeedback(""), 4000);
          return;
        }
        setFeedback("Adicionado à lista ✓");
        setTimeout(() => setFeedback(""), 3000);
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : "Erro");
        setTimeout(() => setFeedback(""), 4000);
      } finally {
        setActionInFlight(null);
      }
    },
    [],
  );

  if (!hasShopeeCredentials) {
    return (
      <div className="bg-dark-bg min-h-[calc(100vh-4rem)] text-text-secondary">
        <div className="container mx-auto px-4 py-8">
          <PageHeader />
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center max-w-2xl mx-auto">
            <Settings2 className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-amber-100">Conecte sua conta Shopee primeiro</h2>
            <p className="mt-2 text-sm text-amber-200/90 leading-relaxed">
              Você precisa configurar suas credenciais Shopee Affiliate em Configurações →
              Integração Shopee pra gerar links afiliados a partir das tendências.
            </p>
            <Link
              href="/configuracoes"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-md bg-amber-500 text-amber-950 font-semibold text-sm hover:bg-amber-400 transition"
            >
              Ir para Configurações <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? { total: 0, viralCount: 0, avgScore: 0 };

  return (
    <div className="bg-dark-bg min-h-[calc(100vh-4rem)] text-text-secondary">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <PageHeader />

        {/* Console "Engenheiro de IA" — visual de terminal, mas adapta ao tema:
            no dark fica preto/ciano; no light fica branco com texto teal escuro. */}
        <div className="mt-4 rounded-xl border border-[#2c2c32] bg-[#101015] light:border-zinc-200 light:bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#7cd0f7] light:text-cyan-600 animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#9a9aa2] light:text-zinc-500">
              IA · Análise contínua
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-text-secondary">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full transition-all ${
                  heartbeatPulse ? "bg-emerald-400 scale-150 shadow-[0_0_12px_#34d399]" : "bg-emerald-500/60"
                }`}
              />
              {data?.stagnant ? "Snapshot pausado" : "Monitorando em tempo real"} · atualizado {formatRelative(data?.fetchedAt ?? null)}
            </span>
          </div>
          <div className="px-4 py-3 font-mono text-[12px] text-[#7cd0f7] light:text-cyan-700 flex items-center gap-2">
            <span className="text-[#5a5a64] light:text-zinc-400">{">"}</span>
            <span className="truncate">{aiTyped}</span>
            <span className="inline-block w-1.5 h-3.5 bg-[#7cd0f7] light:bg-cyan-700 animate-blink" />
          </div>
        </div>

        {/* Stats tickers */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Produtos analisados" value={stats.total} />
          <StatCard icon={<Flame className="w-4 h-4 text-orange-400" />} label="Em alta agora" value={stats.viralCount} accent="orange" />
          <StatCard icon={<Award className="w-4 h-4 text-[#7cd0f7]" />} label="Score médio" value={stats.avgScore} suffix="/100" />
          <StatCard icon={<Activity className="w-4 h-4 text-fuchsia-400" />} label="Snapshot" value={60} suffix="min" staticValue />
        </div>

        {/* Filtros */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#3e3e46] bg-[#222228] p-0.5">
            {(["score", "sales", "commission"] as SortKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                  sort === k ? "bg-[#ee4d2d] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
                }`}
              >
                {k === "score" ? "Score" : k === "sales" ? "Mais vendidos" : "Maior comissão"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md rounded-lg border border-[#3e3e46] bg-[#1c1c1f] px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-[#7a7a80]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por produto ou loja..."
              className="flex-1 bg-transparent outline-none text-[12px] text-text-primary placeholder:text-[#6b6b72]"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3e3e46] bg-[#222228] text-[11px] font-semibold text-[#c8c8ce] hover:bg-[#2f2f34]"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Forçar atualização
          </button>
        </div>

        {/* Feedback */}
        {feedback ? (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
            {feedback}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300">{error}</p>
          </div>
        ) : null}

        {/* Lista de produtos */}
        {loading && !data ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#ee4d2d]" />
          </div>
        ) : null}

        {data && filteredProducts.length === 0 ? (
          <div className="mt-8 rounded-xl border border-[#2c2c32] bg-[#1c1c1f] p-8 text-center">
            <p className="text-[12px] text-[#9a9aa2]">Nenhum produto correspondente. Aguarde a próxima varredura ou limpe o filtro.</p>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.itemId}
              product={p}
              listas={listas}
              listasLoading={listasLoading}
              actionInFlight={actionInFlight}
              onCopyLink={handleCopyLink}
              onAddToLista={handleAddToLista}
              chartTextColor={colors.text}
              chartGridColor={colors.grid}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .animate-blink { animation: blink 1s steps(2) infinite; }
      `}</style>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading flex items-center gap-2">
          <Flame className="w-6 h-6 text-[#ee4d2d]" />
          Tendências Shopee
        </h1>
        
      </div>
      <Link
        href="/dashboard"
        className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[#ee4d2d] hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  accent,
  staticValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  accent?: "orange";
  staticValue?: boolean;
}) {
  const animated = useCountUp(staticValue ? value : value);
  const displayed = staticValue ? value : animated;
  const accentClass =
    accent === "orange" ? "border-orange-500/25" : "border-[#2c2c32]";
  return (
    <div className={`rounded-xl border ${accentClass} bg-[#1c1c1f] p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#9a9aa2] uppercase tracking-wider">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 text-base sm:text-lg font-bold text-text-primary leading-tight">
        {formatInt(displayed)}
        {suffix ? <span className="text-[10px] text-[#9a9aa2] ml-0.5">{suffix}</span> : null}
      </p>
    </div>
  );
}

function ProductCard({
  product,
  listas,
  listasLoading,
  actionInFlight,
  onCopyLink,
  onAddToLista,
  chartTextColor,
  chartGridColor,
}: {
  product: TrendProduct;
  listas: Lista[];
  listasLoading: boolean;
  actionInFlight: string | null;
  onCopyLink: (p: TrendProduct) => void;
  onAddToLista: (p: TrendProduct, listaId: string) => void;
  chartTextColor: string;
  chartGridColor: string;
}) {
  const [showListaMenu, setShowListaMenu] = useState(false);
  const isCopying = actionInFlight === `link-${product.itemId}`;
  const isAddingToLista = actionInFlight === `lista-${product.itemId}`;

  const sparklineData = useMemo(() => {
    const points = product.sparkline.length > 1 ? product.sparkline : [product.sales, product.sales];
    return {
      labels: points.map((_, i) => i),
      datasets: [
        {
          data: points,
          borderColor: product.isViral ? "#ee4d2d" : "#7cd0f7",
          backgroundColor: product.isViral ? "rgba(238,77,45,0.1)" : "rgba(124,208,247,0.1)",
          borderWidth: 1.5,
          tension: 0.35,
          pointRadius: 0,
          fill: true,
        },
      ],
    };
  }, [product.sparkline, product.sales, product.isViral]);

  const sparklineOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: { display: false, grid: { display: false } },
      },
      animation: { duration: 250 },
    }),
    [],
  );

  const priceLabel = (() => {
    if (product.priceMin != null && product.priceMax != null && product.priceMin !== product.priceMax) {
      return `${formatBRL(product.priceMin)} – ${formatBRL(product.priceMax)}`;
    }
    return formatBRL(product.price ?? product.priceMin);
  })();

  return (
    <div
      className={`relative rounded-xl border p-3 transition-all hover:translate-y-[-1px] ${
        product.isViral
          ? "border-[#ee4d2d]/40 bg-gradient-to-br from-[#1c1c1f] via-[#211517] to-[#1c1c1f] shadow-[0_0_24px_rgba(238,77,45,0.08)]"
          : "border-[#2c2c32] bg-[#1c1c1f]"
      }`}
    >
      {product.isViral ? (
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#ee4d2d] text-[9px] font-bold uppercase tracking-wider text-white animate-pulse">
          <Flame className="w-2.5 h-2.5" />
          Viral
        </span>
      ) : null}

      <div className="flex gap-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="w-16 h-16 rounded-lg object-cover bg-[#222228] border border-[#2c2c32] shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-[#222228] border border-[#2c2c32] shrink-0" />
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p className="text-[12px] font-semibold text-text-primary line-clamp-2">{product.productName}</p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#9a9aa2]">
            {product.shopName ? <span className="truncate max-w-[160px]">{product.shopName}</span> : null}
            {product.ratingStar != null ? (
              <span className="inline-flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                {product.ratingStar.toFixed(1)}
              </span>
            ) : null}
            <span>· {formatInt(product.sales)} vendidos</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-bold text-emerald-400 tabular-nums">{priceLabel}</span>
            {product.commissionRate != null ? (
              <span className="text-[10px] text-[#7cd0f7]">{(product.commissionRate * 100).toFixed(1)}% comissão</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <ScoreBadge score={product.score} />
          <div className="w-20 h-8">
            <Line data={sparklineData} options={sparklineOptions as never} />
          </div>
          {/* chartTextColor + chartGridColor reservados pra V2 (axis labels em gráficos maiores) */}
          <span className="hidden">{chartTextColor}{chartGridColor}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {product.productLink ? (
          <a
            href={product.productLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#3e3e46] bg-[#222228] text-[10px] text-[#c8c8ce] hover:bg-[#2f2f34]"
            title="Ver produto na Shopee"
          >
            <ExternalLink className="w-3 h-3" />
            Ver na Shopee
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => onCopyLink(product)}
          disabled={isCopying}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#ee4d2d]/40 bg-[#ee4d2d]/10 text-[10px] font-semibold text-[#ee4d2d] hover:bg-[#ee4d2d]/20 disabled:opacity-50"
        >
          {isCopying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
          Copiar link afiliado
        </button>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowListaMenu((v) => !v)}
            disabled={isAddingToLista || listasLoading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#3e3e46] bg-[#222228] text-[10px] text-[#c8c8ce] hover:bg-[#2f2f34] disabled:opacity-50"
          >
            {isAddingToLista ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListPlus className="w-3 h-3" />}
            Adicionar à lista
          </button>
          {showListaMenu && listas.length > 0 ? (
            <div className="absolute right-0 top-full mt-1 z-10 min-w-[180px] rounded-lg border border-[#3e3e46] bg-[#1c1c1f] shadow-xl py-1">
              {listas.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setShowListaMenu(false);
                    onAddToLista(product, l.id);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-[11px] text-[#c8c8ce] hover:bg-[#2f2f34]"
                >
                  {l.nome}
                </button>
              ))}
            </div>
          ) : null}
          {showListaMenu && listas.length === 0 ? (
            <div className="absolute right-0 top-full mt-1 z-10 min-w-[200px] rounded-lg border border-[#3e3e46] bg-[#1c1c1f] shadow-xl px-3 py-2">
              <p className="text-[10px] text-[#9a9aa2]">Nenhuma lista encontrada.</p>
              <Link
                href="/dashboard/links"
                className="text-[10px] text-[#ee4d2d] hover:underline inline-flex items-center gap-1 mt-1"
              >
                <Link2 className="w-3 h-3" />
                Criar uma lista
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75 ? "from-[#ee4d2d] to-[#ff7a55]" : score >= 50 ? "from-[#0ea5e9] to-[#7cd0f7]" : "from-[#3e3e46] to-[#52525b]";
  return (
    <div className={`flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br ${tone}`}>
      <div className="text-center">
        <p className="text-[14px] font-black text-white leading-none tabular-nums">{score}</p>
        <p className="text-[8px] text-white/80 uppercase tracking-wider mt-0.5">Score</p>
      </div>
    </div>
  );
}
