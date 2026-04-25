"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Pencil,
  X,
  Play,
  Pause,
  Clock,
  Hash,
  Tag,
  Send,
  PlayCircle,
} from "lucide-react";

type ListaResumo = { id: string; nome_lista: string; bot_id: string; groups_count: number };
type OfertaListaResumo = { id: string; nome: string };

type AutomacaoRow = {
  id: string;
  listaId: string | null;
  listaNome: string;
  botId: string;
  botUsername: string | null;
  botName: string | null;
  listaOfertasId: string | null;
  listaOfertasNome: string | null;
  listaOfertasMlId: string | null;
  listaOfertasMlNome: string | null;
  listaOfertasInfoId: string | null;
  listaOfertasInfoNome: string | null;
  keywords: string[];
  subId1: string;
  subId2: string;
  subId3: string;
  ativo: boolean;
  proximoIndice: number;
  ultimoDisparoAt: string | null;
  proximaKeyword: string | null;
  horarioInicio: string | null;
  horarioFim: string | null;
};

type Modo = "keywords" | "shopee" | "ml" | "info";

function detectModo(a: Pick<AutomacaoRow, "listaOfertasId" | "listaOfertasMlId" | "listaOfertasInfoId">): Modo {
  if (a.listaOfertasInfoId) return "info";
  if (a.listaOfertasId && a.listaOfertasMlId) return "shopee"; // crossover renderizado como shopee+ml — simplificado
  if (a.listaOfertasId) return "shopee";
  if (a.listaOfertasMlId) return "ml";
  return "keywords";
}

function modoLabel(m: Modo): string {
  switch (m) {
    case "keywords":
      return "Keywords (Shopee ao vivo)";
    case "shopee":
      return "Lista Shopee pré-salva";
    case "ml":
      return "Lista Mercado Livre";
    case "info":
      return "Lista Infoprodutor";
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

export default function TelegramAutomacoesClient() {
  const [automacoes, setAutomacoes] = useState<AutomacaoRow[]>([]);
  const [listas, setListas] = useState<ListaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutomacaoRow | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [autoRes, listasRes] = await Promise.all([
        fetch("/api/telegram/continuo"),
        fetch("/api/telegram/listas"),
      ]);
      const aJson = await autoRes.json();
      const lJson = await listasRes.json();
      if (!autoRes.ok) throw new Error(aJson?.error ?? "Erro ao carregar automações");
      setAutomacoes(Array.isArray(aJson.data) ? aJson.data : []);
      setListas(Array.isArray(lJson.data) ? lJson.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openNewModal = () => {
    if (listas.length === 0) {
      setError('Crie ao menos uma "Lista de Grupos" antes de configurar uma automação.');
      return;
    }
    setEditing(null);
    setModalOpen(true);
  };

  const openEditModal = (a: AutomacaoRow) => {
    setEditing(a);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSaved = (msg: string) => {
    setOk(msg);
    setError(null);
    closeModal();
    loadAll();
  };

  const togglePauseResume = async (a: AutomacaoRow) => {
    setTogglingId(a.id);
    setError(null);
    setOk(null);
    try {
      if (a.ativo) {
        const r = await fetch("/api/telegram/continuo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: a.id, ativo: false }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Erro");
        setAutomacoes((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, ativo: false } : x))
        );
        setOk("Automação pausada.");
      } else {
        // Pra reativar, refaz o POST como criação atualizando o registro
        const r = await fetch("/api/telegram/continuo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: a.id,
            updateOnly: false,
            listaId: a.listaId,
            listaOfertasId: a.listaOfertasId,
            listaOfertasMlId: a.listaOfertasMlId,
            listaOfertasInfoId: a.listaOfertasInfoId,
            keywords: a.keywords,
            subId1: a.subId1,
            subId2: a.subId2,
            subId3: a.subId3,
            horarioInicio: a.horarioInicio,
            horarioFim: a.horarioFim,
            ativo: true,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Erro");
        setAutomacoes((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, ativo: true } : x))
        );
        setOk("Automação reativada.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setTogglingId(null);
    }
  };

  const removeAutomacao = async (a: AutomacaoRow) => {
    if (!confirm(`Excluir esta automação? "${a.listaNome}"`)) return;
    setRemovingId(a.id);
    setError(null);
    setOk(null);
    try {
      const r = await fetch(`/api/telegram/continuo?id=${encodeURIComponent(a.id)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro");
      setAutomacoes((prev) => prev.filter((x) => x.id !== a.id));
      setOk("Automação excluída.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemovingId(null);
    }
  };

  const testarDisparo = async (a: AutomacaoRow) => {
    setTestingId(a.id);
    setError(null);
    setOk(null);
    try {
      const r = await fetch("/api/telegram/cron-disparo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId: a.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro");
      const result = j?.results?.[0];
      if (result?.ok) {
        setOk(`Teste OK: ${result.sent ?? 0}/${(result.sent ?? 0) + (result.failed ?? 0)} mensagens enviadas. Veja no Telegram.`);
      } else if (result) {
        setError(`Teste falhou: ${result.error ?? "erro desconhecido"}`);
      } else {
        setError(j?.message ?? "Sem resultado");
      }
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <section className="space-y-4 mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary font-heading flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-400" />
            Automações Contínuas · Telegram
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Disparam sozinhas a cada 10 minutos dentro da janela horária configurada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-dark-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova automação
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {ok}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-text-secondary py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : automacoes.length === 0 ? (
        <p className="text-sm text-text-secondary py-6">
          Nenhuma automação configurada. Clique em &quot;Nova automação&quot; pra começar.
        </p>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {automacoes.map((a) => {
            const modo = detectModo(a);
            return (
              <li
                key={a.id}
                className={`rounded-lg border p-4 flex flex-col gap-3 ${
                  a.ativo
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-dark-border bg-dark-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{a.listaNome}</p>
                    <p className="text-xs text-text-secondary mt-0.5 truncate">
                      {a.botUsername ? `@${a.botUsername}` : "bot ?"} · {modoLabel(modo)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      a.ativo
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {a.ativo ? "ATIVO" : "PAUSADO"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {a.horarioInicio ?? "—"} → {a.horarioFim ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    <span>último: {formatRelative(a.ultimoDisparoAt)}</span>
                  </div>
                  {modo === "keywords" && a.keywords.length > 0 && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Hash className="h-3.5 w-3.5" />
                      <span className="truncate">
                        {a.keywords.length} keyword{a.keywords.length > 1 ? "s" : ""}
                        {a.proximaKeyword && ` · próxima: "${a.proximaKeyword}"`}
                      </span>
                    </div>
                  )}
                  {modo === "shopee" && a.listaOfertasNome && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Tag className="h-3.5 w-3.5" />
                      <span className="truncate">Lista Shopee: {a.listaOfertasNome}</span>
                    </div>
                  )}
                  {modo === "ml" && a.listaOfertasMlNome && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Tag className="h-3.5 w-3.5" />
                      <span className="truncate">Lista ML: {a.listaOfertasMlNome}</span>
                    </div>
                  )}
                  {modo === "info" && a.listaOfertasInfoNome && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Tag className="h-3.5 w-3.5" />
                      <span className="truncate">Lista Infoprodutor: {a.listaOfertasInfoNome}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => togglePauseResume(a)}
                    disabled={togglingId === a.id}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                      a.ativo
                        ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        : "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                    }`}
                  >
                    {togglingId === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : a.ativo ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {a.ativo ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => testarDisparo(a)}
                    disabled={testingId === a.id}
                    className="inline-flex items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-400 hover:bg-sky-500/20 disabled:opacity-50"
                    title="Dispara um tick agora, ignorando janela horária"
                  >
                    {testingId === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="h-3.5 w-3.5" />
                    )}
                    Testar
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(a)}
                    className="inline-flex items-center gap-1 rounded-md border border-dark-border px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAutomacao(a)}
                    disabled={removingId === a.id}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {removingId === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <AutomacaoModal
          listas={listas}
          editing={editing}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modal de criar/editar automação
// ────────────────────────────────────────────────────────────────────────────────

function AutomacaoModal({
  listas,
  editing,
  onClose,
  onSaved,
}: {
  listas: ListaResumo[];
  editing: AutomacaoRow | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = editing !== null;

  // Estados do form
  const [listaId, setListaId] = useState<string>(editing?.listaId ?? listas[0]?.id ?? "");
  const [modo, setModo] = useState<Modo>(
    editing
      ? detectModo(editing)
      : "keywords"
  );

  const [keywordsText, setKeywordsText] = useState<string>(editing ? (editing.keywords ?? []).join("\n") : "");
  const [subId1, setSubId1] = useState(editing?.subId1 ?? "");
  const [subId2, setSubId2] = useState(editing?.subId2 ?? "");
  const [subId3, setSubId3] = useState(editing?.subId3 ?? "");

  const [listaOfertasId, setListaOfertasId] = useState<string>(editing?.listaOfertasId ?? "");
  const [listaOfertasMlId, setListaOfertasMlId] = useState<string>(editing?.listaOfertasMlId ?? "");
  const [listaOfertasInfoId, setListaOfertasInfoId] = useState<string>(editing?.listaOfertasInfoId ?? "");

  const [horarioInicio, setHorarioInicio] = useState<string>(editing?.horarioInicio ?? "08:00");
  const [horarioFim, setHorarioFim] = useState<string>(editing?.horarioFim ?? "22:00");

  // Listas de ofertas pra dropdowns
  const [listasShopee, setListasShopee] = useState<OfertaListaResumo[]>([]);
  const [listasMl, setListasMl] = useState<OfertaListaResumo[]>([]);
  const [listasInfo, setListasInfo] = useState<OfertaListaResumo[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Carrega listas de ofertas conforme o modo selecionado
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingDropdowns(true);
      try {
        if (modo === "shopee" && listasShopee.length === 0) {
          const r = await fetch("/api/shopee/minha-lista-ofertas/listas");
          const j = await r.json();
          if (!cancelled) {
            const arr = Array.isArray(j.listas) ? j.listas : [];
            setListasShopee(arr.map((x: { id: string; nome: string }) => ({ id: x.id, nome: x.nome })));
          }
        }
        if (modo === "ml" && listasMl.length === 0) {
          const r = await fetch("/api/mercadolivre/minha-lista-ofertas/listas");
          const j = await r.json();
          if (!cancelled) {
            const arr = Array.isArray(j.listas) ? j.listas : [];
            setListasMl(arr.map((x: { id: string; nome: string }) => ({ id: x.id, nome: x.nome })));
          }
        }
        if (modo === "info" && listasInfo.length === 0) {
          const r = await fetch("/api/infoprodutor/minha-lista-ofertas/listas");
          const j = await r.json();
          if (!cancelled) {
            const arr = Array.isArray(j.listas) ? j.listas : [];
            setListasInfo(arr.map((x: { id: string; nome: string }) => ({ id: x.id, nome: x.nome })));
          }
        }
      } finally {
        if (!cancelled) setLoadingDropdowns(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const switchModo = (next: Modo) => {
    setModo(next);
    if (next !== "keywords") {
      setKeywordsText("");
    }
    if (next !== "shopee") setListaOfertasId("");
    if (next !== "ml") setListaOfertasMlId("");
    if (next !== "info") setListaOfertasInfoId("");
  };

  const handleSave = async () => {
    if (!listaId) {
      setErr("Selecione uma lista de grupos.");
      return;
    }
    if (!horarioInicio || !horarioFim) {
      setErr("Defina horário de início e fim (máx. 14h).");
      return;
    }

    const keywords = keywordsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (modo === "keywords" && keywords.length === 0) {
      setErr("Informe ao menos uma keyword.");
      return;
    }
    if (modo === "shopee" && !listaOfertasId) {
      setErr("Selecione uma lista Shopee.");
      return;
    }
    if (modo === "ml" && !listaOfertasMlId) {
      setErr("Selecione uma lista Mercado Livre.");
      return;
    }
    if (modo === "info" && !listaOfertasInfoId) {
      setErr("Selecione uma lista Infoprodutor.");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        listaId,
        keywords: modo === "keywords" ? keywords : [],
        subId1: modo === "keywords" ? subId1 : "",
        subId2: modo === "keywords" ? subId2 : "",
        subId3: modo === "keywords" ? subId3 : "",
        listaOfertasId: modo === "shopee" ? listaOfertasId : "",
        listaOfertasMlId: modo === "ml" ? listaOfertasMlId : "",
        listaOfertasInfoId: modo === "info" ? listaOfertasInfoId : "",
        horarioInicio,
        horarioFim,
        ativo: true,
      };
      if (isEdit && editing) {
        payload.id = editing.id;
        payload.updateOnly = true; // mantém ativo/proximoIndice/keyword_pool atual
      }
      const r = await fetch("/api/telegram/continuo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro ao salvar");
      onSaved(isEdit ? "Automação atualizada." : "Automação criada e ativada.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const listasComGrupos = useMemo(() => listas.filter((l) => l.groups_count > 0), [listas]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            {isEdit ? "Editar automação" : "Nova automação Telegram"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-dark-bg hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {err && (
          <div className="flex items-center gap-2 p-2.5 mb-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {err}
          </div>
        )}

        <div className="space-y-3 overflow-y-auto pr-1">
          {/* Lista de grupos */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Lista de grupos *
            </label>
            <select
              value={listaId}
              onChange={(e) => setListaId(e.target.value)}
              disabled={isEdit}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm disabled:opacity-60"
            >
              <option value="">— escolha —</option>
              {listasComGrupos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome_lista} ({l.groups_count} grupo{l.groups_count > 1 ? "s" : ""})
                </option>
              ))}
            </select>
            {listasComGrupos.length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1">
                Nenhuma lista com grupos. Crie listas e adicione grupos primeiro.
              </p>
            )}
            {isEdit && (
              <p className="text-[11px] text-text-secondary mt-1">
                Lista não pode ser alterada (criar nova automação se quiser trocar).
              </p>
            )}
          </div>

          {/* Modo */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Modo de envio *
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <ModoButton active={modo === "keywords"} onClick={() => switchModo("keywords")} label="Keywords" sub="Shopee ao vivo" />
              <ModoButton active={modo === "shopee"} onClick={() => switchModo("shopee")} label="Shopee" sub="Lista pré-salva" />
              <ModoButton active={modo === "ml"} onClick={() => switchModo("ml")} label="Mercado Livre" sub="Lista pré-salva" />
              <ModoButton active={modo === "info"} onClick={() => switchModo("info")} label="Infoprodutor" sub="Lista pré-salva" />
            </div>
          </div>

          {/* Conteúdo do modo selecionado */}
          {modo === "keywords" && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Keywords (uma por linha) *
                </label>
                <textarea
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder={"ofertas relâmpago\nachadinhos shopee\npromoção"}
                  rows={4}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm font-mono resize-y"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    SubID 1
                  </label>
                  <input
                    type="text"
                    value={subId1}
                    onChange={(e) => setSubId1(e.target.value)}
                    className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 px-2 text-text-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    SubID 2
                  </label>
                  <input
                    type="text"
                    value={subId2}
                    onChange={(e) => setSubId2(e.target.value)}
                    className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 px-2 text-text-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    SubID 3
                  </label>
                  <input
                    type="text"
                    value={subId3}
                    onChange={(e) => setSubId3(e.target.value)}
                    className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 px-2 text-text-primary text-xs"
                  />
                </div>
              </div>
            </>
          )}

          {modo === "shopee" && (
            <DropdownLista
              label="Lista Shopee pré-salva *"
              loading={loadingDropdowns}
              listas={listasShopee}
              value={listaOfertasId}
              onChange={setListaOfertasId}
            />
          )}
          {modo === "ml" && (
            <DropdownLista
              label="Lista Mercado Livre *"
              loading={loadingDropdowns}
              listas={listasMl}
              value={listaOfertasMlId}
              onChange={setListaOfertasMlId}
            />
          )}
          {modo === "info" && (
            <DropdownLista
              label="Lista Infoprodutor *"
              loading={loadingDropdowns}
              listas={listasInfo}
              value={listaOfertasInfoId}
              onChange={setListaOfertasInfoId}
            />
          )}

          {/* Janela horária */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Janela horária (Brasília) — máx. 14h *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
                className="rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
              />
              <span className="text-text-secondary text-sm">→</span>
              <input
                type="time"
                value={horarioFim}
                onChange={(e) => setHorarioFim(e.target.value)}
                className="rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
              />
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Cron roda a cada 10 min — só dispara dentro dessa janela. Janela pode atravessar
              meia-noite (ex: 22:00 → 06:00).
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-dark-border mt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Salvar alterações" : "Criar e ativar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModoButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left transition-colors ${
        active
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-dark-border bg-dark-bg hover:border-dark-border/80"
      }`}
    >
      <p className={`text-sm font-medium ${active ? "text-emerald-300" : "text-text-primary"}`}>{label}</p>
      <p className="text-[10px] text-text-secondary mt-0.5">{sub}</p>
    </button>
  );
}

function DropdownLista({
  label,
  loading,
  listas,
  value,
  onChange,
}: {
  label: string;
  loading: boolean;
  listas: OfertaListaResumo[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm disabled:opacity-60"
      >
        <option value="">{loading ? "Carregando..." : "— escolha —"}</option>
        {listas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
      {!loading && listas.length === 0 && (
        <p className="text-[11px] text-amber-400 mt-1">
          Nenhuma lista encontrada. Crie uma na seção correspondente do menu.
        </p>
      )}
    </div>
  );
}
