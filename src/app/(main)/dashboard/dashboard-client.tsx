"use client";

import { useSupabase } from "@/app/components/auth/AuthProvider";
import {
  Wallet,
  ShoppingCart,
  DollarSign,
  CheckCircle,
  Hourglass,
  XCircle,
  AlertCircle,
  Replace,
  BadgeDollarSign,
  CalendarDays,
  TrendingUp,
  Percent,
  CreditCard,
} from "lucide-react";
import Papa from "papaparse";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useIdbKeyState } from "@/app/hooks/useIdbKeyState";

import OrdersChart, { type ChartView } from "./OrdersChart";
import DataTable from "./DataTable";
import Tabs from "./Tabs";
import CategoryAnalysis from "./CategoryAnalysis";
import AttributionAnalysis from "./AttributionAnalysis";
import type { TemporalChartData, ChannelData, SubIdData, ProductData } from "@/types";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";
import { GeneratingReportPill } from "@/app/components/ui/GeneratingReportPill";

import DateRangeControls from "./_components/DateRangeControls";
import ShopeeApiBanner from "./_components/ShopeeApiBanner";
import ReportUploadCard from "@/app/components/ui/ReportUploadCard";

import {
  buildCommissionAnalytics,
  type CommissionDataRow,
  parseMoneyPt,
  toYMD,
} from "@/lib/commissions/buildCommissionAnalytics";

// ─── helpers de data local (sem bug de fuso horário UTC-3) ───────────────────
function localYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localYMD(d);
}

function get3MonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return localYMD(d);
}

function formatDateBR(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}
// ─────────────────────────────────────────────────────────────────────────────

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseMoneyPt(value) : value;
  return `R$ ${num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseMoneyAny(v: unknown): number {
  const s = safeString(v).trim();
  if (!s) return 0;
  return parseMoneyPt(s);
}

// ── Range SEM bug de fuso: compara por data LOCAL quando for timestamp ISO ──
function inRange(dateStr: string, from: string, to: string) {
  const raw = safeString(dateStr).trim();
  if (!raw) return false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw >= from && raw <= to;
  }

  const ymdPrefix = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymdPrefix)) {
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) {
      const local = localYMD(dt);
      return local >= from && local <= to;
    }
    return ymdPrefix >= from && ymdPrefix <= to;
  }

  const dt2 = new Date(raw);
  if (Number.isNaN(dt2.getTime())) return false;
  const ymd2 = toYMD(dt2);
  return ymd2 >= from && ymd2 <= to;
}

// ─── Normalização (API vs CSV) ───────────────────────────────────────────────
const PERF_ORIGIN_CSV_KEY =
  "Origem da Performance: Direta vs. Indireta (Pendentes + Concluídos)" as const;

const PERF_ORIGIN_API_PT_KEY = "Tipo de atribuição" as const;

function normalizePerfOriginValue(value: unknown): string {
  const raw = safeString(value).trim();
  if (!raw) return "";

  const s = raw.toLowerCase();

  if (s === "direct" || s.includes("direct") || s.includes("direta")) return "Direta";
  if (s === "indirect" || s.includes("indirect") || s.includes("indireta")) return "Indireta";

  return raw;
}

/**
 * Garante que:
 * - a coluna PERF_ORIGIN_CSV_KEY exista (mesmo quando a fonte é API).
 * - Sub_id1 vire Sub_id (pra sua tabela/SubIdData).
 */
function normalizeCommissionRow(row: CommissionDataRow): CommissionDataRow {
  const obj = row as unknown as Record<string, unknown>;

  const currentPerf = safeString(obj[PERF_ORIGIN_CSV_KEY]).trim();
  if (!currentPerf) {
    const fromApi =
      obj[PERF_ORIGIN_API_PT_KEY] ??
      obj["attributionType"] ??
      obj["attribution_type"] ??
      obj["performanceOrigin"] ??
      obj["performance_origin"];

    const normalized = normalizePerfOriginValue(fromApi);
    obj[PERF_ORIGIN_CSV_KEY] = normalized;
  }

  const currentSubId = safeString(obj["Sub_id"]).trim();
  if (!currentSubId) {
    const v = safeString(obj["Sub_id1"]).trim();
    if (v) obj["Sub_id"] = v;
  }

  return obj as unknown as CommissionDataRow;
}

function normalizeRows(rows: CommissionDataRow[]): CommissionDataRow[] {
  return rows.map(normalizeCommissionRow);
}

// ─── CSV: limpar headers sem transformHeader (compatível com worker:true) ────
function trimObjectKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row ?? {})) out[String(k).trim()] = v;
  return out as T;
}

// ─── Status helpers (pra filtrar em Canal/Sub_id) ────────────────────────────
type CanonicalStatus = "completed" | "pending" | "canceled" | "unpaid" | "unknown";

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeStatus(raw: unknown): CanonicalStatus {
  const s = stripDiacritics(String(raw ?? "")).toLowerCase().trim();
  if (!s) return "unknown";

  if (s === "completed" || s === "concluido" || s === "concluida") return "completed";
  if (s === "pending" || s === "pendente") return "pending";

  if (s === "canceled" || s === "cancelled" || s === "cancelado" || s === "cancelada")
    return "canceled";

  if (s === "unpaid" || s === "nao pago" || s === "nao_pago" || s === "nao-pago")
    return "unpaid";

  return "unknown";
}

function isEarningStatus(status: CanonicalStatus) {
  return status === "completed" || status === "pending";
}
// ─────────────────────────────────────────────────────────────────────────────

type ChannelRow = ChannelData & { totalValue: number };
type SubIdRow = SubIdData & { totalValue: number };

export default function CommissionsPage() {
  const context = useSupabase();
  const session = context?.session;

  const [rawData, setRawData, isDataLoading] = useIdbKeyState<CommissionDataRow[]>(
    "commissionsRawData_idb",
    []
  );
  const [fileName, setFileName] = useIdbKeyState<string | null>("commissionsFileName_idb", null);
  const [adInvestment, setAdInvestment] = useIdbKeyState<string>("commissionsAdInvestment_idb", "");

  const [source, setSource, isSourceLoading] = useIdbKeyState<"csv" | "api" | null>(
    "commissionsSource_idb",
    null
  );

  const [isParsing, setIsParsing] = useState(false);
  const [hasShopeeKeys, setHasShopeeKeys] = useState(false);
  const [loadingShopee, setLoadingShopee] = useState(false);
  const [shopeeError, setShopeeError] = useState<string | null>(null);

  const [dateFromDraft, setDateFromDraft] = useState("");
  const [dateToDraft, setDateToDraft] = useState("");
  const [dateFromApplied, setDateFromApplied] = useState("");
  const [dateToApplied, setDateToApplied] = useState("");

  const [chartView, setChartView] = useState<ChartView>("week");
  const [drilledDownWeek, setDrilledDownWeek] = useState<TemporalChartData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(0);

  // ✅ NOVO (estado do investimento, iniciando em 0)
  const [investimento, setInvestimento] = useState<number>(0);

  // ✅ NOVO (formatação do input em moeda)
  function formatCurrencyInputPtBR(raw: string) {
    const digits = String(raw ?? "").replace(/\D/g, "");
    const value = digits ? Number(digits) / 100 : 0;
    return `R$ ${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // ✅ NOVO (sincroniza investimento numérico com o estado persistido adInvestment)
  useEffect(() => {
    setInvestimento(parseMoneyPt(adInvestment));
  }, [adInvestment]);

  // ✅ AJUSTE PRINCIPAL:
  // - Se tem API, só faz fetch automático (ontem→ontem) quando NÃO houver dados salvos.
  // - Se já existe rawData salvo, NÃO limpa nem refaz fetch ao voltar para a aba.
  useEffect(() => {
    if (isSourceLoading || isDataLoading) return;

    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/settings/shopee");
        const json = await res.json();
        if (!res.ok) return;

        const hasKey = !!json?.has_key && !!json?.shopee_app_id;
        if (!alive) return;

        setHasShopeeKeys(hasKey);

        if (!hasKey) return;

        const hasSavedData = (rawData?.length ?? 0) > 0;
        const isCsvModeWithFile = source === "csv" && !!fileName && hasSavedData;

        // Se usuário está usando CSV (com arquivo), respeita e não troca pra API.
        if (isCsvModeWithFile) return;

        // Se já tem dados salvos e não está em modo CSV, não refaz busca automática.
        if (hasSavedData) {
          if (source !== "csv") setSource("api"); // só garante o modo
          return;
        }

        // Sem dados salvos => comportamento atual (buscar ontem)
        const yesterday = getYesterday();

        setSource("api");
        setDateFromDraft(yesterday);
        setDateToDraft(yesterday);
        setDateFromApplied(yesterday);
        setDateToApplied(yesterday);

        setFileName(null);
        setAdInvestment("");
        setActiveTab(0);
        setDrilledDownWeek(null);

        await fetchShopee(yesterday, yesterday);
      } catch {
        // silencioso
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSourceLoading, isDataLoading]);

  async function fetchShopee(from: string, to: string) {
    setLoadingShopee(true);
    setShopeeError(null);
    try {
      const res = await fetch(
        `/api/shopee/conversion-report?start=${encodeURIComponent(from)}&end=${encodeURIComponent(
          to
        )}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao buscar dados na Shopee");

      const rows = (json.data ?? []) as CommissionDataRow[];
      const normalized = normalizeRows(rows);

      setRawData(normalized);
      setFileName(`API Shopee • ${from} → ${to}`);
      setSource("api");
      setAdInvestment("");
      setActiveTab(0);
      setDrilledDownWeek(null);
    } catch (e) {
      setShopeeError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingShopee(false);
    }
  }

  useEffect(() => {
    if (!rawData || rawData.length === 0) return;

    let min: Date | null = null;
    let max: Date | null = null;

    for (const r of rawData) {
      const dt = new Date(safeString(r["Horário do pedido"]));
      if (Number.isNaN(dt.getTime())) continue;
      if (!min || dt < min) min = dt;
      if (!max || dt > max) max = dt;
    }

    if (min && max) {
      const from = toYMD(min);
      const to = toYMD(max);
      setDateFromDraft((prev) => prev || from);
      setDateToDraft((prev) => prev || to);
      setDateFromApplied((prev) => prev || from);
      setDateToApplied((prev) => prev || to);
    }
  }, [rawData]);

  const filteredAppliedRows = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    if (!dateFromApplied || !dateToApplied) return rawData;
    return rawData.filter((r) => inRange(r["Horário do pedido"], dateFromApplied, dateToApplied));
  }, [rawData, dateFromApplied, dateToApplied]);

  const analytics = useMemo(() => buildCommissionAnalytics(filteredAppliedRows), [filteredAppliedRows]);

  const channelTableData = useMemo<ChannelRow[]>(() => {
    const agg = new Map<string, { commission: number; totalValue: number; orderIds: Set<string> }>();

    for (const r of filteredAppliedRows) {
      const status = normalizeStatus(r["Status do Pedido"]);
      if (!isEarningStatus(status)) continue;

      const channel = safeString(r["Canal"]).trim() || "N/A";
      const orderId = safeString(r["ID do pedido"]).trim();

      const commission = parseMoneyAny(r["Comissão líquida do afiliado(R$)"]);
      const totalValue = parseMoneyAny(r["Valor de Compra(R$)"]);

      const current = agg.get(channel) ?? { commission: 0, totalValue: 0, orderIds: new Set<string>() };
      current.commission += commission;
      current.totalValue += totalValue;
      if (orderId) current.orderIds.add(orderId);
      agg.set(channel, current);
    }

    return Array.from(agg.entries())
      .map(([channel, v]) => ({
        channel,
        commission: v.commission,
        totalValue: v.totalValue,
        orders: v.orderIds.size,
      }))
      .sort((a, b) => b.commission - a.commission) as ChannelRow[];
  }, [filteredAppliedRows]);

  const subIdTableData = useMemo<SubIdRow[]>(() => {
    const agg = new Map<string, { commission: number; totalValue: number; orderIds: Set<string> }>();

    for (const r of filteredAppliedRows) {
      const status = normalizeStatus(r["Status do Pedido"]);
      if (!isEarningStatus(status)) continue;

      const obj = r as unknown as Record<string, unknown>;

      const subId =
        safeString(obj["Sub_id"]).trim() || safeString(obj["Sub_id1"]).trim() || "Sem Sub ID";

      const orderId = safeString(r["ID do pedido"]).trim();

      const commission = parseMoneyAny(r["Comissão líquida do afiliado(R$)"]);
      const totalValue = parseMoneyAny(r["Valor de Compra(R$)"]);

      const current = agg.get(subId) ?? { commission: 0, totalValue: 0, orderIds: new Set<string>() };
      current.commission += commission;
      current.totalValue += totalValue;
      if (orderId) current.orderIds.add(orderId);
      agg.set(subId, current);
    }

    return Array.from(agg.entries())
      .map(([subId, v]) => ({
        subId,
        commission: v.commission,
        totalValue: v.totalValue,
        orders: v.orderIds.size,
      }))
      .sort((a, b) => b.commission - a.commission) as SubIdRow[];
  }, [filteredAppliedRows]);

  const investment = parseMoneyPt(adInvestment);
  const netCommission = investment > 0 ? analytics.totalCommission - investment : analytics.totalCommission;
  const roiPercentage = investment > 0 ? (netCommission / investment) * 100 : 0;
  const cpa =
    investment > 0
      ? analytics.completedOrders + analytics.pendingOrders > 0
        ? investment / (analytics.completedOrders + analytics.pendingOrders)
        : 0
      : 0;

  // ✅ NOVO (cálculos pedidos para a nova linha, baseados no estado investimento + comissão líquida + pedidos únicos)
  const pedidosUnicos = analytics.completedOrders + analytics.pendingOrders;
  const lucroPerf = analytics.totalCommission - investimento;
  const roiPerf = investimento > 0 ? (lucroPerf / investimento) * 100 : 0;
  const cpaPerf = pedidosUnicos > 0 ? investimento / pedidosUnicos : 0;

  const chartData = useMemo(() => {
    if (drilledDownWeek && drilledDownWeek.startDate) {
      const weekTemplate: TemporalChartData[] = [];
      const start = new Date(drilledDownWeek.startDate);
      start.setHours(0, 0, 0, 0);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);

      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dayKey = toYMD(d);
        const dayAgg = analytics.ordersByDay[dayKey];
        const label = d
          .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
          .replace(".", "")
          .replace(/^\w/, (c) => c.toUpperCase());

        weekTemplate.push({
          label,
          pedidos: dayAgg?.orderIds.size || 0,
          concluidos: dayAgg?.concluidos.size || 0,
          pendentes: dayAgg?.pendentes.size || 0,
          cancelados: dayAgg?.cancelados.size || 0,
          nao_pagos: dayAgg?.nao_pagos.size || 0,
        });
      }
      return weekTemplate;
    }

    switch (chartView) {
      case "hour":
        return analytics.ordersByHour;
      case "week":
        return analytics.ordersByWeek;
      case "month":
        return analytics.ordersByMonth;
      default:
        return [];
    }
  }, [
    analytics.ordersByDay,
    analytics.ordersByHour,
    analytics.ordersByMonth,
    analytics.ordersByWeek,
    chartView,
    drilledDownWeek,
  ]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];

      setActiveTab(0);
      setFileName(file.name);
      setAdInvestment("");
      setIsParsing(true);
      setShopeeError(null);
      setSource("csv");

      setDateFromDraft("");
      setDateToDraft("");
      setDateFromApplied("");
      setDateToApplied("");
      setDrilledDownWeek(null);

      Papa.parse<CommissionDataRow>(file, {
        worker: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const cleaned = (results.data ?? []).map(
              (r) => trimObjectKeys(r as unknown as Record<string, unknown>) as unknown as CommissionDataRow
            ) as CommissionDataRow[];

            const normalized = normalizeRows(cleaned);
            setRawData(normalized);
          } finally {
            setIsParsing(false);
          }
        },
        error: (error: Error) => {
          console.error("Erro ao ler o arquivo:", error.message);
          setIsParsing(false);
        },
      });
    }
  };

  const showSwapButton = source === "csv" && !!fileName && !isParsing;

  function triggerRefetch(from: string, to: string) {
    setRawData([]);
    setDateFromApplied(from);
    setDateToApplied(to);
    setDrilledDownWeek(null);
    setActiveTab(0);
    fetchShopee(from, to);
  }

  const tabs = useMemo(
    () => [
      {
        label: "Visão Geral",
        content: (
          <OrdersChart
            data={chartData}
            view={chartView}
            isPending={isPending}
            setView={(view) => {
              startTransition(() => {
                setChartView(view);
                setDrilledDownWeek(null);
              });
            }}
            isDrilledDown={!!drilledDownWeek}
            onBackClick={() => startTransition(() => setDrilledDownWeek(null))}
            onBarClick={(data) => startTransition(() => setDrilledDownWeek(data))}
          />
        ),
      },
      {
        label: "Análise por Categoria",
        content: (
          <CategoryAnalysis
            topCategoriesData={analytics.topCategoriesData}
            categoryTreeData={analytics.categoryTreeData}
          />
        ),
      },
      { label: "Análise de Origem", content: <AttributionAnalysis data={analytics.attributionData} /> },
      {
        label: "Análise de Produtos",
        content: (
          <DataTable<ProductData>
            title="Top 10 Produtos Mais Vendidos"
            subtitle="(Pendentes + Concluídos)"
            data={analytics.productData.slice(0, 10)}
            columns={[
              { header: "Produto", accessor: "productName" },
              { header: "Qtd. Vendida", accessor: "qty" },
              {
                header: "Comissão Total",
                accessor: "commission",
                render: (value) => formatCurrency(value),
              },
            ]}
          />
        ),
      },
      {
        label: "Desempenho por Canal & Sub_id",
        content: (
          <div className="grid grid-cols-1 gap-8">
            <DataTable<ChannelRow>
              title="Comissão por Canal"
              subtitle="(Pendentes + Concluídos)"
              data={channelTableData}
              forceHorizontalScroll
              columns={[
                { header: "Canal", accessor: "channel" },
                { header: "Pedidos", accessor: "orders" },
                {
                  header: "Valor Total (R$)",
                  accessor: "totalValue",
                  render: (value) => formatCurrency(value),
                },
                {
                  header: "Comissão Total",
                  accessor: "commission",
                  render: (value) => formatCurrency(value),
                },
              ]}
            />

            <DataTable<SubIdRow>
              title="Comissão por Sub_id"
              subtitle="(Pendentes + Concluídos)"
              data={subIdTableData}
              forceHorizontalScroll
              columns={[
                { header: "Sub_id", accessor: "subId" },
                { header: "Pedidos", accessor: "orders" },
                {
                  header: "Valor Total (R$)",
                  accessor: "totalValue",
                  render: (value) => formatCurrency(value),
                },
                {
                  header: "Comissão Total",
                  accessor: "commission",
                  render: (value) => formatCurrency(value),
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [
      analytics.attributionData,
      analytics.categoryTreeData,
      analytics.productData,
      analytics.topCategoriesData,
      analytics.ordersByDay,
      analytics.ordersByHour,
      analytics.ordersByMonth,
      analytics.ordersByWeek,
      chartData,
      chartView,
      drilledDownWeek,
      isPending,
      startTransition,
      channelTableData,
      subIdTableData,
    ]
  );

  if (!session) return <LoadingOverlay message="Carregando sessão..." />;

  if (isDataLoading || isSourceLoading) {
    return <LoadingOverlay message="Carregando dados da análise..." />;
  }

  const hasData = filteredAppliedRows.length > 0;
  const isApiMode = source === "api" || (hasShopeeKeys && source !== "csv");
  const yesterday = getYesterday();
  const minDate = get3MonthsAgo();

  const showDateControls =
    !isParsing && source !== "csv" && (hasData || loadingShopee || (hasShopeeKeys && isApiMode));

  const csvPeriodLabel =
    source === "csv" && hasData && dateFromApplied && dateToApplied
      ? `${formatDateBR(dateFromApplied)} a ${formatDateBR(dateToApplied)}`
      : null;

  // ✅ NOVO: linha só aparece se usuário subiu CSV ou se está usando API
  const showPerformanceRow = (source === "csv" && !!fileName) || isApiMode;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-text-primary font-heading">Análise de Comissões</h1>

        <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
          {/* Controles de período — apenas modo API (agora na mesma linha do título) */}
          {showDateControls && (
            <DateRangeControls
              from={dateFromDraft}
              to={dateToDraft}
              minDate={minDate}
              maxDate={yesterday}
              onChangeFrom={setDateFromDraft}
              onChangeTo={setDateToDraft}
              actions={
                isApiMode ? (
                  <button
                    onClick={() => triggerRefetch(dateFromDraft, dateToDraft)}
                    disabled={loadingShopee || !dateFromDraft || !dateToDraft}
                    className="rounded-md bg-shopee-orange px-4 py-2 text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    Atualizar
                  </button>
                ) : undefined
              }
            />
          )}

          {showSwapButton && (
            <div className="flex items-center gap-4 sm:gap-6">
              {csvPeriodLabel && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <CalendarDays className="h-4 w-4 flex-shrink-0" />
                  <span>Período de</span>
                  <span className="font-medium text-text-primary">{csvPeriodLabel}</span>
                </div>
              )}

              <label
                htmlFor="commissions-upload-new"
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-dark-border text-text-secondary rounded-md hover:border-shopee-orange hover:text-shopee-orange cursor-pointer transition-colors"
                title="Selecionar outro arquivo"
              >
                <Replace className="h-4 w-4" />
                <span>Trocar Relatório</span>
                <input
                  id="commissions-upload-new"
                  name="commissions-upload-new"
                  type="file"
                  className="sr-only"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {showDateControls && shopeeError && <p className="mb-6 text-sm text-red-400">{shopeeError}</p>}

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-dark-card p-[18px] rounded-lg border border-dark-border flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-green-400" />
            <p className="text-sm text-text-secondary">Comissão Total</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(analytics.totalCommission)}</p>
        </div>

        <div className="bg-dark-card p-[18px] rounded-lg border border-dark-border flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <BadgeDollarSign className="h-5 w-5 text-emerald-400" />
            <p className="text-sm text-text-secondary">Comissão Líquida</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(netCommission)}</p>
        </div>

        <div className="bg-dark-card p-[18px] rounded-lg border border-dark-border flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 text-indigo-400" />
            <p className="text-sm text-text-secondary">Vendas Geradas</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(analytics.totalSales)}</p>
        </div>

        <div className="relative group bg-dark-card p-[18px] rounded-lg border border-dark-border flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-sky-400" />
            <p className="text-sm text-text-secondary">Pedidos Únicos</p>
          </div>

          <p className="mt-2 text-2xl font-bold text-text-primary">
            {analytics.completedOrders + analytics.pendingOrders}
          </p>

          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-4 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-10">
            <div className="bg-dark-tooltip p-4 rounded-lg shadow-lg border border-dark-border">
              <h4 className="font-bold text-sm mb-3 text-text-primary font-heading text-left">
                Detalhes dos Pedidos
              </h4>
              <div className="space-y-2 text-sm text-left">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <CheckCircle className="h-4 w-4 text-green-400" /> Concluídos:
                  </span>
                  <span className="font-semibold text-text-primary">{analytics.completedOrders}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <Hourglass className="h-4 w-4 text-amber-400" /> Pendentes:
                  </span>
                  <span className="font-semibold text-text-primary">{analytics.pendingOrders}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <XCircle className="h-4 w-4 text-red-400" /> Cancelados:
                  </span>
                  <span className="font-semibold text-text-primary">{analytics.canceledOrders}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <AlertCircle className="h-4 w-4 text-yellow-400" /> Não Pagos:
                  </span>
                  <span className="font-semibold text-text-primary">{analytics.unpaidOrders}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ NOVO: Linha de performance (abaixo dos cards e acima das abas) */}
      {showPerformanceRow && (
  <div className="mt-6 border-dark-border rounded-lg px-4 py-0">
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
      {/* Investimento */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-shopee-orange flex-shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-secondary font-semibold">
            Investimento (opcional):
          </span>
          <input
            value={adInvestment || "R$ 0,00"}
            onChange={(e) => {
              const formatted = formatCurrencyInputPtBR(e.target.value);
              setAdInvestment(formatted);
              setInvestimento(parseMoneyPt(formatted));
            }}
            className="w-[180px] rounded-md border border-blue-900/70 bg-dark-bg py-2 px-3 text-sm text-text-primary placeholder-text-secondary/60 focus:border-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-900/70 transition-colors"
            inputMode="numeric"
          />
        </div>
      </div>

      {/* ROI */}
      <div className="flex items-center gap-2">
        <Percent className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        <p className="text-sm text-text-secondary">
          ROI:{" "}
          <span className="font-semibold text-text-primary">
            {roiPerf.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            %
          </span>{" "}
          <span className="text-text-secondary">({formatCurrency(lucroPerf)})</span>
        </p>
      </div>

      {/* CPA */}
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-sky-400 flex-shrink-0" />
        <p className="text-sm text-text-secondary">
          CPA:{" "}
          <span className="font-semibold text-text-primary">
            {formatCurrency(cpaPerf)}
          </span>
        </p>
      </div>
    </div>
  </div>
)}


      {hasData ? (
        <div className="mt-4">
          <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      ) : loadingShopee ? (
        <GeneratingReportPill message="Buscando dados na Shopee e calculando métricas..." />
      ) : hasShopeeKeys ? (
        <div className="mt-8 bg-dark-card p-6 rounded-lg border border-dark-border">
          <h2 className="text-lg font-semibold text-text-primary font-heading">
            Não foi possível carregar seus dados da Shopee
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Verifique suas chaves em Configurações ou tente atualizar o período.
          </p>

          {shopeeError && <p className="mt-3 text-sm text-red-400">{shopeeError}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => triggerRefetch(dateFromDraft, dateToDraft)}
              disabled={loadingShopee || !dateFromDraft || !dateToDraft}
              className="rounded-md bg-shopee-orange px-4 py-2 text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              Atualizar
            </button>
            <a
              href="/configuracoes"
              className="rounded-md border border-dark-border px-4 py-2 text-sm font-semibold text-text-secondary hover:border-shopee-orange hover:text-shopee-orange transition-colors"
            >
              Ir para Configurações
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <ShopeeApiBanner />
          <ReportUploadCard
            title="Importar relatório"
            label="Selecione o relatório de Comissões (.csv)"
            fileName={fileName}
            loading={isParsing}
            loadingText="Processando arquivo..."
            successText="carregado! Análise acima."
            accept=".csv"
            onFilesSelected={(files) => {
              const file = files[0];
              if (!file) return;

              // reutiliza seu handler existente, sem mexer no resto do código
              handleFileChange({ target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }}
          />
        </div>
      )}
    </div>
  );
}
