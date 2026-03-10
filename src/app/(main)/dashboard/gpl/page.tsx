"use client";

import { useState, useEffect, useMemo } from "react";
import { useIdbKeyState } from "@/app/hooks/useIdbKeyState";
import { useSupabase } from "@/app/components/auth/AuthProvider";
import {
  Calculator,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Info,
  ArrowRight,
  MessageCircle,
  Search,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";

interface CommissionDataRow {
  "ID do pedido": string;
  "Comissão líquida do afiliado(R$)": string;
  "Horário do pedido": string;

  // ✅ chave usada no CSV e no payload da API no seu projeto
  "Status do Pedido"?: string;

  Canal?: string;
  "Canal do pedido"?: string;
  "Canal de divulgação"?: string;
  "Canal do afiliado"?: string;
  "Canal de origem"?: string;

  [key: string]: unknown;
}

function parseMoneyPt(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  const s = String(input).trim();
  if (!s) return 0;

  const cleaned = s
    .replace(/\s/g, "")
    .replace(/[R$\u00A0]/g, "")
    .replace(/[%]/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function normalizeStr(input?: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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

function extractChannel(row: CommissionDataRow): string {
  const candidates = [
    "Canal",
    "Canal do pedido",
    "Canal de divulgação",
    "Canal do afiliado",
    "Canal de origem",
  ];
  for (const key of candidates) {
    const v = row[key];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

type CanonicalChannel = "whatsapp" | "websites" | "others" | "unknown";

function normalizeChannel(raw: unknown): CanonicalChannel {
  const s = normalizeStr(raw);
  if (!s) return "unknown";
  if (s.includes("whats")) return "whatsapp";
  if (s.includes("web")) return "websites";
  if (s.includes("other") || s.includes("outro")) return "others";
  return "unknown";
}

const TARGET_CHANNELS: CanonicalChannel[] = ["whatsapp", "websites", "others"];

// =========================
// ✅ STATUS FILTER (NOVO)
// =========================
function extractOrderStatus(row: CommissionDataRow): string {
  const v = row["Status do Pedido"];
  if (v == null) return "";
  return String(v);
}

type CanonicalOrderStatus = "pending" | "completed" | "other" | "unknown";

function normalizeOrderStatus(raw: unknown): CanonicalOrderStatus {
  const s = normalizeStr(raw);
  if (!s) return "unknown";

  // PT-BR comuns
  if (s.includes("pend")) return "pending"; // pendente, pending
  if (s.includes("conclu")) return "completed"; // concluido, concluído
  if (s.includes("complet")) return "completed"; // completed, completo

  // outros (não queremos)
  if (s.includes("cancel")) return "other";
  if (s.includes("nao pago") || s.includes("não pago") || s.includes("unpaid"))
    return "other";

  return "other";
}

const TARGET_ORDER_STATUSES: CanonicalOrderStatus[] = ["pending", "completed"];

function getInclusiveDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

type ApiCheckState = "checking" | "hasKeys" | "noKeys";

type GplApiRangeCache = {
  fromDraft: string;
  toDraft: string;
  fromApplied: string;
  toApplied: string;
};

type EvolutionInstanceItem = { id: string; nome_instancia: string; numero_whatsapp: string | null };
type WhatsAppGroup = { id: string; nome: string; qtdMembros: number };

// ✅ chave para persistir o resultado da checagem (evita voltar pra "checking")
const LS_API_CHECK_KEY = "gpl_api_check_state_v1";

function readApiCheckFromLocalStorage(): ApiCheckState {
  if (typeof window === "undefined") return "checking";
  const v = window.localStorage.getItem(LS_API_CHECK_KEY);
  return v === "hasKeys" || v === "noKeys" ? v : "checking";
}

function writeApiCheckToLocalStorage(v: ApiCheckState) {
  if (typeof window === "undefined") return;
  if (v === "hasKeys" || v === "noKeys")
    window.localStorage.setItem(LS_API_CHECK_KEY, v);
}

export default function GplCalculatorPage() {
  const context = useSupabase();
  const session = context?.session;

  // IDB (quando não tiver API)
  const [idbRawData, , isDataLoading] = useIdbKeyState<CommissionDataRow[]>(
    "commissionsRawData_idb",
    []
  );

  // Cache da API (persistente)
  const [apiRowsCache, setApiRowsCache, isApiRowsCacheLoading] =
    useIdbKeyState<CommissionDataRow[]>("gplApiRows_idb", []);

  const [apiRangeCache, setApiRangeCache, isApiRangeCacheLoading] =
    useIdbKeyState<GplApiRangeCache>("gplApiRange_idb", {
      fromDraft: "",
      toDraft: "",
      fromApplied: "",
      toApplied: "",
    });

  // ✅ estado inicial vem do localStorage (assim não fica "checking" toda vez)
  const [apiCheckState, setApiCheckState] = useState<ApiCheckState>(() =>
    readApiCheckFromLocalStorage()
  );
  const hasShopeeKeys = apiCheckState === "hasKeys";

  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiFetchTick, setApiFetchTick] = useState(0);
  const [apiFetchedOnce, setApiFetchedOnce] = useState(false);

  // Draft (inputs)
  const [startDateDraft, setStartDateDraft] = useState<string>("");
  const [endDateDraft, setEndDateDraft] = useState<string>("");

  // Applied (range usado no fetch/cálculos em modo API)
  const [startDateApplied, setStartDateApplied] = useState<string>("");
  const [endDateApplied, setEndDateApplied] = useState<string>("");

  const [groupSize, setGroupSize] = useState<string>("");

  // Calculados
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [gplPeriod, setGplPeriod] = useState<number>(0);
  const [gplMonthly, setGplMonthly] = useState<number>(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
  const [daysInPeriod, setDaysInPeriod] = useState<number>(0);

  // Avisos (draft)
  const [draftDays, setDraftDays] = useState<number>(0);
  const [showShortPeriodWarning, setShowShortPeriodWarning] = useState(false);
  const [showMaxPeriodWarning, setShowMaxPeriodWarning] = useState(false);

  // Instâncias Evolution + grupos WhatsApp (n8n buscar_grupo)
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstanceItem[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [groupsCache, setGroupsCache] = useState<Record<string, WhatsAppGroup[]>>({});
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupNameFilter, setGroupNameFilter] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  // 1) Checar chaves — reaproveita cache; e não volta a "checking" em toda entrada
  useEffect(() => {
    if (isApiRowsCacheLoading || isApiRangeCacheLoading) return;

    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/settings/shopee");
        const json = await res.json();
        if (!res.ok) throw new Error();

        const ok = !!json?.has_key && !!json?.shopee_app_id;
        if (!alive) return;

        if (!ok) {
          setApiCheckState("noKeys");
          writeApiCheckToLocalStorage("noKeys");
          return;
        }

        setApiCheckState("hasKeys");
        writeApiCheckToLocalStorage("hasKeys");

        const hasCachedRows = (apiRowsCache?.length ?? 0) > 0;
        const hasCachedRange =
          !!apiRangeCache?.fromApplied && !!apiRangeCache?.toApplied;

        // Se já tem cache (rows + range), não refaz fetch automático ao voltar
        if (hasCachedRows && hasCachedRange) {
          setStartDateDraft(apiRangeCache.fromDraft || apiRangeCache.fromApplied);
          setEndDateDraft(apiRangeCache.toDraft || apiRangeCache.toApplied);
          setStartDateApplied(apiRangeCache.fromApplied);
          setEndDateApplied(apiRangeCache.toApplied);
          setApiFetchedOnce(true);
          return;
        }

        // Primeira entrada (sem cache): busca ontem→ontem
        const y = getYesterday();
        setStartDateDraft((prev) => prev || y);
        setEndDateDraft((prev) => prev || y);
        setStartDateApplied(y);
        setEndDateApplied(y);

        setApiRangeCache({
          fromDraft: y,
          toDraft: y,
          fromApplied: y,
          toApplied: y,
        });

        setApiFetchTick((t) => t + 1);
      } catch {
        if (!alive) return;
        setApiCheckState("noKeys");
        writeApiCheckToLocalStorage("noKeys");
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiRowsCacheLoading, isApiRangeCacheLoading]);

  // 2) Em modo não-API, applied acompanha o draft
  useEffect(() => {
    if (hasShopeeKeys) return;
    setStartDateApplied(startDateDraft);
    setEndDateApplied(endDateDraft);
  }, [hasShopeeKeys, startDateDraft, endDateDraft]);

  // 3) Validar período (draft) e calcular dias (draft)
  useEffect(() => {
    if (!startDateDraft || !endDateDraft) {
      setDraftDays(0);
      setShowShortPeriodWarning(false);
      setShowMaxPeriodWarning(false);
      return;
    }

    const start = new Date(startDateDraft + "T00:00:00");
    const end = new Date(endDateDraft + "T00:00:00");

    if (end < start) {
      setEndDateDraft("");
      setDraftDays(0);
      setShowShortPeriodWarning(false);
      setShowMaxPeriodWarning(false);
      return;
    }

    const inclusiveDays = getInclusiveDays(startDateDraft, endDateDraft);

    if (inclusiveDays > 30) {
      setEndDateDraft("");
      setDraftDays(0);
      setShowShortPeriodWarning(false);
      setShowMaxPeriodWarning(false);
      return;
    }

    setDraftDays(inclusiveDays);
    setShowShortPeriodWarning(inclusiveDays < 3);
    setShowMaxPeriodWarning(inclusiveDays === 30);
  }, [startDateDraft, endDateDraft]);

  // 4) Faixa disponível
  const availableDateRange = useMemo(() => {
    if (hasShopeeKeys) {
      const min = get3MonthsAgo();
      const max = getYesterday();
      return { min, max };
    }
    return null as null | { min: string; max: string };
  }, [hasShopeeKeys]);

  // 5) maxEndDate
  const maxEndDate = useMemo(() => {
    const range = availableDateRange;
    if (!startDateDraft || !range) return range?.max || "";

    const start = new Date(startDateDraft + "T00:00:00");
    const maxAllowed = new Date(start);
    maxAllowed.setDate(start.getDate() + 29);

    const reportMax = new Date(range.max + "T00:00:00");
    const finalMax = maxAllowed < reportMax ? maxAllowed : reportMax;
    return localYMD(finalMax);
  }, [startDateDraft, availableDateRange]);

  // 6) Fetch API quando applied mudar
  useEffect(() => {
    if (!hasShopeeKeys) return;
    if (!startDateApplied || !endDateApplied) return;

    let alive = true;

    (async () => {
      setIsApiLoading(true);
      setApiError(null);
      try {
        const res = await fetch(
          `/api/shopee/conversion-report?start=${encodeURIComponent(
            startDateApplied
          )}&end=${encodeURIComponent(endDateApplied)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao buscar dados da Shopee");

        if (!alive) return;

        const rows = (json?.data ?? []) as CommissionDataRow[];

        setApiRowsCache(rows);
        setApiRangeCache({
          fromDraft: startDateDraft || startDateApplied,
          toDraft: endDateDraft || endDateApplied,
          fromApplied: startDateApplied,
          toApplied: endDateApplied,
        });

        setApiFetchedOnce(true);
      } catch (e) {
        if (!alive) return;
        setApiRowsCache([]);
        setApiFetchedOnce(true);
        setApiError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (alive) setIsApiLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShopeeKeys, startDateApplied, endDateApplied, apiFetchTick]);

  // 7) Fonte efetiva
  const sourceRows = useMemo(() => {
    if (hasShopeeKeys) return apiRowsCache ?? [];
    return idbRawData ?? [];
  }, [hasShopeeKeys, apiRowsCache, idbRawData]);

  // 8) ✅ Filtrar canais + status (NOVO)
  const filteredData = useMemo(() => {
    const src = sourceRows ?? [];

    return src.filter((row) => {
      const chOk = TARGET_CHANNELS.includes(
        normalizeChannel(extractChannel(row as CommissionDataRow))
      );

      const stOk = TARGET_ORDER_STATUSES.includes(
        normalizeOrderStatus(extractOrderStatus(row as CommissionDataRow))
      );

      return chOk && stOk;
    });
  }, [sourceRows]);

  // 9) Range do IDB quando não tem API
  const idbDateRange = useMemo(() => {
    if (hasShopeeKeys) return null;
    if (!filteredData || filteredData.length === 0) return null;

    const ymds: string[] = [];
    for (const row of filteredData) {
      const dateStr = (row as CommissionDataRow)["Horário do pedido"];
      if (!dateStr) continue;
      const d = new Date(String(dateStr));
      if (!Number.isNaN(d.getTime())) ymds.push(localYMD(d));
    }
    if (ymds.length === 0) return null;
    ymds.sort();
    return { min: ymds[0], max: ymds[ymds.length - 1] };
  }, [hasShopeeKeys, filteredData]);

  const effectiveRange = hasShopeeKeys ? availableDateRange : idbDateRange;

  const maxEndDateEffective = useMemo(() => {
    const range = effectiveRange;
    if (!startDateDraft || !range) return range?.max || "";

    const start = new Date(startDateDraft + "T00:00:00");
    const maxAllowed = new Date(start);
    maxAllowed.setDate(start.getDate() + 29);

    const reportMax = new Date(range.max + "T00:00:00");
    const finalMax = maxAllowed < reportMax ? maxAllowed : reportMax;
    return localYMD(finalMax);
  }, [startDateDraft, effectiveRange]);

  // 10) daysInPeriod
  useEffect(() => {
    if (!startDateApplied || !endDateApplied) {
      setDaysInPeriod(0);
      return;
    }
    const start = new Date(startDateApplied + "T00:00:00");
    const end = new Date(endDateApplied + "T00:00:00");
    if (end < start) {
      setDaysInPeriod(0);
      return;
    }
    setDaysInPeriod(getInclusiveDays(startDateApplied, endDateApplied));
  }, [startDateApplied, endDateApplied]);

  // 11) lucro total
  useEffect(() => {
    if (!filteredData || filteredData.length === 0 || !startDateApplied || !endDateApplied) {
      setTotalProfit(0);
      return;
    }

    let profitSum = 0;

    for (const row of filteredData) {
      const dateStr = (row as CommissionDataRow)["Horário do pedido"];
      if (!dateStr) continue;

      const orderDate = new Date(String(dateStr));
      if (Number.isNaN(orderDate.getTime())) continue;

      const orderYMD = localYMD(orderDate);
      if (orderYMD < startDateApplied || orderYMD > endDateApplied) continue;

      profitSum += parseMoneyPt(
        (row as CommissionDataRow)["Comissão líquida do afiliado(R$)"]
      );
    }

    setTotalProfit(profitSum);
  }, [filteredData, startDateApplied, endDateApplied]);

  // 12) GPL
  useEffect(() => {
    const groupNum = parseFloat(groupSize || "0");
    if (isNaN(groupNum) || groupNum <= 0 || daysInPeriod === 0) {
      setGplPeriod(0);
      setGplMonthly(0);
      setMonthlyRevenue(0);
      return;
    }

    const gplInPeriod = totalProfit / groupNum;
    setGplPeriod(gplInPeriod);

    const gplMonth = (gplInPeriod / daysInPeriod) * 30;
    setGplMonthly(gplMonth);

    setMonthlyRevenue(gplMonth * groupNum);
  }, [groupSize, totalProfit, daysInPeriod]);

  // Instâncias Evolution: carregar ao montar
  useEffect(() => {
    let alive = true;
    fetch("/api/evolution/instances")
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data.instances)) setEvolutionInstances(data.instances);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const selectedInstance = evolutionInstances.find((i) => i.id === selectedInstanceId);
  const selectedInstanceName = selectedInstance?.nome_instancia ?? "";

  // Grupos: cache por instância; buscar ao selecionar só se ainda não tiver cache
  const fetchGroupsForInstance = async (instanceId: string, nomeInstancia: string) => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const res = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoAcao: "buscar_grupo", nomeInstancia }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao buscar grupos");
      const lista = json?.grupos ?? [];
      const normalized: WhatsAppGroup[] = lista.map((g: { id?: string; nome?: string; subject?: string; name?: string; qtdMembros?: number; size?: number; participants?: unknown[] }) => ({
        id: String(g.id ?? ""),
        nome: String(g.nome ?? g.subject ?? g.name ?? "Sem nome"),
        qtdMembros: Number(g.qtdMembros ?? g.size ?? (Array.isArray(g.participants) ? g.participants.length : 0)),
      }));
      setGroupsCache((prev) => ({ ...prev, [instanceId]: normalized }));
      setGroups(normalized);
    } catch (e) {
      setGroups([]);
      setGroupsError(e instanceof Error ? e.message : "Erro ao buscar grupos");
      setGroupsCache((prev) => ({ ...prev, [instanceId]: [] }));
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedInstanceId || !selectedInstanceName) {
      setGroups([]);
      setGroupsError(null);
      return;
    }
    const cached = groupsCache[selectedInstanceId];
    if (cached !== undefined) {
      setGroups(cached);
      setGroupsError(null);
      return;
    }
    fetchGroupsForInstance(selectedInstanceId, selectedInstanceName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchGroupsForInstance está definido no componente
  }, [selectedInstanceId, selectedInstanceName]);

  const filteredGroups = useMemo(() => {
    if (!groupNameFilter.trim()) return groups;
    const q = normalizeStr(groupNameFilter);
    return groups.filter((g) => normalizeStr(g.nome).includes(q));
  }, [groups, groupNameFilter]);

  const totalMembersSelected = useMemo(() => {
    return groups
      .filter((g) => selectedGroupIds.has(g.id))
      .reduce((acc, g) => acc + g.qtdMembros, 0);
  }, [groups, selectedGroupIds]);

  useEffect(() => {
    if (totalMembersSelected > 0) setGroupSize(String(totalMembersSelected));
  }, [totalMembersSelected]);

  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPerformanceBadge = () => {
    if (gplMonthly >= 1.5) {
      return {
        color: "bg-green-500/20 text-green-400 border-green-500/30",
        text: "🟢 Excelente performance",
      };
    } else if (gplMonthly >= 0.8) {
      return {
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        text: "🟡 Boa performance",
      };
    } else if (gplMonthly > 0) {
      return {
        color: "bg-red-500/20 text-red-400 border-red-500/30",
        text: "🔴 Performance precisa melhorar",
      };
    }
    return null;
  };

  const performanceBadge = getPerformanceBadge();
  const showResults = gplPeriod > 0;

  if (!session) return <LoadingOverlay message="Carregando sessão..." />;

  // ✅ Agora o loading de integração só aparece na PRIMEIRA vez (sem estado salvo)
  if (apiCheckState === "checking") {
    return <LoadingOverlay message="Verificando integração com a Shopee..." />;
  }

  if (!hasShopeeKeys && isDataLoading) return <LoadingOverlay message="Carregando dados..." />;

  const hasAnySource = hasShopeeKeys || (idbRawData && idbRawData.length > 0);

  const hasFilteredData = hasShopeeKeys
    ? apiFetchedOnce
      ? filteredData.length > 0
      : true
    : filteredData.length > 0;

  const channelsLabel = "WhatsApp, Websites e Others";

  const canSearchApi =
    hasShopeeKeys &&
    !!startDateDraft &&
    !!endDateDraft &&
    draftDays > 0 &&
    !isApiLoading &&
    !apiError;

  function onClickBuscar() {
    if (!hasShopeeKeys) return;
    if (!startDateDraft || !endDateDraft) return;

    setStartDateApplied(startDateDraft);
    setEndDateApplied(endDateDraft);

    setApiRangeCache({
      fromDraft: startDateDraft,
      toDraft: endDateDraft,
      fromApplied: startDateDraft,
      toApplied: endDateDraft,
    });

    setApiFetchTick((t) => t + 1);
    if (selectedInstanceId && selectedInstanceName) {
      fetchGroupsForInstance(selectedInstanceId, selectedInstanceName);
    }
  }

  return (
    <div>
      {/* ... resto do seu JSX continua igual daqui pra baixo ... */}
      {/* (mantive exatamente como você enviou) */}

      <style jsx>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(56%) sepia(93%) saturate(1573%) hue-rotate(358deg)
            brightness(100%) contrast(103%);
          cursor: pointer;
        }
        input[type="date"]:disabled::-webkit-calendar-picker-indicator {
          filter: opacity(0.5);
        }
        .date-empty::-webkit-datetime-edit-text,
        .date-empty::-webkit-datetime-edit-month-field,
        .date-empty::-webkit-datetime-edit-day-field,
        .date-empty::-webkit-datetime-edit-year-field {
          color: rgb(156 163 175) !important;
        }
        .date-filled::-webkit-datetime-edit-text,
        .date-filled::-webkit-datetime-edit-month-field,
        .date-filled::-webkit-datetime-edit-day-field,
        .date-filled::-webkit-datetime-edit-year-field {
          color: rgb(243 244 246) !important;
        }
      `}</style>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary font-heading">Calculadora GPL</h1>
        <p className="text-text-secondary mt-2">
          Calcule o valor médio que cada lead gera de comissão (Ganho por Lead)
        </p>
        <p className="text-xs text-text-secondary mt-1">
          Métricas dos canais <span className="text-text-primary">{channelsLabel}</span>
        </p>
        {evolutionInstances.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-500/80 shrink-0" />
            <span className="text-xs text-text-secondary">Instância WhatsApp:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedInstanceId("");
                  setSelectedGroupIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !selectedInstanceId
                    ? "bg-shopee-orange text-white border border-shopee-orange"
                    : "bg-dark-bg text-text-secondary border border-dark-border hover:border-dark-border hover:text-text-primary"
                }`}
              >
                Nenhuma
              </button>
              {evolutionInstances.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => {
                    setSelectedInstanceId(inst.id);
                    setSelectedGroupIds(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedInstanceId === inst.id
                      ? "bg-shopee-orange text-white border border-shopee-orange"
                      : "bg-dark-bg text-text-secondary border border-dark-border hover:border-dark-border hover:text-text-primary"
                  }`}
                >
                  {inst.nome_instancia}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {apiError && (
        <div className="bg-dark-card p-6 rounded-lg border border-red-500/30 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Erro ao buscar dados da Shopee
              </h2>
              <p className="text-sm text-text-secondary mt-1">{apiError}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/configuracoes"
                  className="px-4 py-2 rounded-lg border border-dark-border text-text-secondary hover:border-shopee-orange hover:text-shopee-orange transition-colors text-sm font-semibold"
                >
                  Ver Configurações
                </Link>
                <button
                  onClick={() => {
                    setApiError(null);
                    setApiFetchTick((t) => t + 1);
                  }}
                  className="px-4 py-2 rounded-lg bg-shopee-orange hover:bg-shopee-orange/90 text-white transition-colors text-sm font-semibold"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasAnySource ? (
        <div className="bg-dark-card p-8 rounded-lg border-2 border-dashed border-dark-border">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="opacity-60">
              <div className="bg-dark-bg p-4 rounded-full mb-4 inline-block">
                <Calculator className="h-12 w-12 text-text-secondary" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Relatório necessário
              </h2>
              <p className="text-text-secondary mb-6">
                📊 Para usar esta função, faça upload do relatório na seção
                &quot;Análise de Comissões&quot; ou cadastre suas chaves da Shopee.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3 bg-shopee-orange hover:bg-shopee-orange/90 text-white font-semibold rounded-lg transition-colors"
            >
              Ir para Análise de Comissões
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : !hasFilteredData ? (
        <div className="bg-dark-card p-8 rounded-lg border-2 border-dashed border-dark-border">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="bg-dark-bg p-4 rounded-full mb-4 inline-block">
              <Calculator className="h-12 w-12 text-text-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Nenhum pedido nos canais {channelsLabel}
            </h2>
            <p className="text-text-secondary">
              Ajuste o período ou verifique se há pedidos com canal WhatsApp, Websites ou
              Others.
            </p>
          </div>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda */}
          <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-green-500/10 p-2 rounded">
                <Calculator className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  ✓ Usando dados da Shopee {hasShopeeKeys ? "via API" : "do seu relatório"}
                </h2>
                <p className="text-xs text-text-secondary">Preencha os campos abaixo</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Pessoas */}
              <div>
                <label
                  htmlFor="groupSize"
                  className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2"
                >
                  <Users className="h-4 w-4 text-indigo-400" />
                  Pessoas no Grupo
                  <button type="button" className="group relative" aria-label="Informação">
                    <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                      <p className="text-text-primary">
                        Total de membros no(s) canal(is) onde você divulga.
                      </p>
                    </div>
                  </button>
                </label>

                <input
                  id="groupSize"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ex: 4741"
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Período */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Calendar className="h-4 w-4 text-sky-400" />
                  Período de Análise
                  <button type="button" className="group relative" aria-label="Informação">
                    <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                      <p className="text-text-primary">
                        Selecione um período de até 30 dias para análise.
                      </p>
                    </div>
                  </button>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="startDate" className="text-xs text-text-secondary mb-1 block">
                      Data Inicial
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      value={startDateDraft}
                      min={effectiveRange?.min}
                      max={effectiveRange?.max}
                      onChange={(e) => setStartDateDraft(e.target.value)}
                      className={`w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange transition-all ${
                        startDateDraft ? "date-filled" : "date-empty"
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="text-xs text-text-secondary mb-1 block">
                      Data Final
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={endDateDraft}
                      min={startDateDraft || effectiveRange?.min}
                      max={maxEndDateEffective}
                      disabled={!startDateDraft}
                      onChange={(e) => setEndDateDraft(e.target.value)}
                      className={`w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        endDateDraft ? "date-filled" : "date-empty"
                      }`}
                    />
                  </div>
                </div>

                {draftDays > 0 && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-text-secondary">
                      Período selecionado: {draftDays} dia(s)
                    </p>

                    {hasShopeeKeys && (
                      <button
                        type="button"
                        onClick={onClickBuscar}
                        disabled={!canSearchApi}
                        className="px-4 py-2 rounded-md bg-shopee-orange text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                        title="Buscar dados da Shopee no período selecionado"
                      >
                        {isApiLoading ? "Buscando..." : "Buscar"}
                      </button>
                    )}
                  </div>
                )}

                {showShortPeriodWarning && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-400">
                      Atenção: períodos curtos podem gerar projeções imprecisas.
                    </p>
                  </div>
                )}

                {showMaxPeriodWarning && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-400">
                      Você atingiu o período máximo de 30 dias.
                    </p>
                  </div>
                )}
              </div>

              {/* Lucro Total */}
              <div>
                <label
                  htmlFor="totalProfit"
                  className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2"
                >
                  <DollarSign className="h-4 w-4 text-green-400" />
                  Lucro Total (Comissão Líquida)
                  <button type="button" className="group relative" aria-label="Informação">
                    <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                      <p className="text-text-primary">
                        Valor total de comissões do período aplicado (calculado automaticamente).
                      </p>
                    </div>
                  </button>
                </label>
                <input
                  id="totalProfit"
                  type="text"
                  value={formatCurrency(totalProfit)}
                  disabled
                  className="w-full px-4 py-3 bg-dark-bg/50 border border-dark-border rounded-lg text-text-primary font-semibold cursor-not-allowed opacity-75"
                />
              </div>
            </div>
          </div>

          {/* Coluna Direita */}
          <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-shopee-orange" />
              <h2 className="text-lg font-semibold text-text-primary">Resultados</h2>
            </div>

            {showResults ? (
              <div className="space-y-4">
                <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                  <p className="text-xs text-text-secondary mb-1.5">
                    GPL no período ({daysInPeriod} dia{daysInPeriod !== 1 ? "s" : ""})
                  </p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatCurrency(gplPeriod)}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">por lead</p>
                </div>

                <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                  <p className="text-xs text-text-secondary mb-1.5">GPL por mês projetado</p>
                  <p className="text-2xl font-bold text-shopee-orange">
                    {formatCurrency(gplMonthly)}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">por lead/mês</p>
                </div>

                <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                  <p className="text-xs text-text-secondary mb-1.5">Receita mensal estimada</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(monthlyRevenue)}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">total/mês</p>
                </div>

                {performanceBadge && (
                  <div
                    className={`p-3 rounded-lg border text-center text-sm font-semibold ${performanceBadge.color}`}
                  >
                    {performanceBadge.text}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="bg-dark-bg p-4 rounded-full mb-4">
                  <TrendingUp className="h-10 w-10 text-text-secondary" />
                </div>
                <p className="text-text-secondary">
                  Preencha o número de pessoas do grupo para ver os resultados.
                </p>
              </div>
            )}
          </div>
        </div>

        {selectedInstanceId && (
          <div className="mt-8 bg-dark-card p-5 rounded-lg border border-dark-border">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500/80" />
              Grupos desta instância
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Selecione um ou mais grupos para preencher automaticamente &quot;Pessoas no grupo&quot; com a soma dos membros.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Filtrar por nome do grupo"
                  value={groupNameFilter}
                  onChange={(e) => setGroupNameFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-md border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
                />
              </div>
              <button
                type="button"
                onClick={() => selectedInstanceId && selectedInstanceName && fetchGroupsForInstance(selectedInstanceId, selectedInstanceName)}
                disabled={groupsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-shopee-orange text-white text-sm font-semibold hover:bg-shopee-orange/90 disabled:opacity-50 transition-opacity shrink-0"
              >
                {groupsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar
              </button>
              {totalMembersSelected > 0 && (
                <p className="text-sm text-emerald-400 font-medium flex items-center gap-1 self-center">
                  <Users className="h-4 w-4" />
                  Total: {totalMembersSelected.toLocaleString("pt-BR")} pessoas
                </p>
              )}
            </div>
            {groupsError && (
              <p className="text-sm text-red-400 mb-3">{groupsError}</p>
            )}
            {groupsLoading ? (
              <div className="flex items-center gap-2 py-6 text-text-secondary">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando grupos...
              </div>
            ) : filteredGroups.length === 0 ? (
              <p className="text-sm text-text-secondary py-4">
                Nenhum grupo encontrado.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredGroups.map((g) => (
                  <label
                    key={g.id}
                    className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedGroupIds.has(g.id)
                        ? "bg-shopee-orange/10 border-shopee-orange/50"
                        : "bg-dark-bg/50 border-dark-border hover:bg-dark-bg"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.has(g.id)}
                        onChange={() => toggleGroupSelection(g.id)}
                        className="mt-0.5 rounded border-dark-border text-shopee-orange focus:ring-shopee-orange"
                      />
                      <span className="text-sm font-medium text-text-primary line-clamp-2 flex-1" title={g.nome}>
                        {g.nome}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary pl-6">
                      {g.qtdMembros.toLocaleString("pt-BR")} membros
                    </p>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        </>
      )}
    </div>
  );
}
