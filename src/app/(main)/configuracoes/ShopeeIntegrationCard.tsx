"use client";

import { useState } from "react";
import { IdCard, KeyRound, Trash2, AlertTriangle } from "lucide-react";
import { delMany } from "idb-keyval"; // ← melhor pra apagar várias chaves de uma vez [web:111]

interface ShopeeIntegrationCardProps {
  initialAppId: string;
  initialHasKey: boolean;
  initialLast4: string | null;
}

export default function ShopeeIntegrationCard({
  initialAppId,
  initialHasKey,
  initialLast4,
}: ShopeeIntegrationCardProps) {
  const [appId, setAppId] = useState(initialAppId);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [last4, setLast4] = useState<string | null>(initialLast4);

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const hasIntegration = !!appId || hasKey;

  const COMMISSIONS_IDB_KEYS = [
    "commissionsRawData_idb",
    "commissionsFileName_idb",
    "commissionsAdInvestment_idb",
    "commissionsSource_idb",
  ] as const;

  const onSave = async () => {
    const prevHadKey = hasKey; // ← guarda o estado ANTES de salvar (pra saber se “acabou de ativar”)

    setSaving(true);
    setError(null);
    setOk(false);

    try {
      const res = await fetch("/api/settings/shopee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopee_app_id: appId, shopee_api_key: apiKey }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");

      // Limpa o campo de senha e pega status atualizado
      setApiKey("");

      const status = await fetch("/api/settings/shopee").then((r) => r.json());

      // Considera integração “ativa” quando tem chave e app_id (mesma lógica da página de comissões)
      const nowHasKey = !!status?.has_key && !!status?.shopee_app_id;

      setHasKey(nowHasKey);
      setLast4(status?.last4 ?? null);

      // ✅ NOVO: se ACABOU de adicionar as chaves (antes não tinha, agora tem),
      // limpa os dados do CSV salvos no IDB pra evitar “ficar preso” no relatório antigo.
      if (!prevHadKey && nowHasKey) {
        await delMany([...COMMISSIONS_IDB_KEYS]); // [web:111]
      }

      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      // 1) Apaga credenciais no banco
      const res = await fetch("/api/settings/shopee", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover");

      // 2) Limpa os dados de análise do IndexedDB (mantém seu comportamento)
      await delMany([...COMMISSIONS_IDB_KEYS]); // [web:111]

      // 3) Reseta estado local
      setAppId("");
      setApiKey("");
      setHasKey(false);
      setLast4(null);
      setConfirmRemove(false);
      setOk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4 flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
          Integração Shopee (API)
        </h2>

        {hasIntegration && !confirmRemove && (
          <button
            onClick={() => setConfirmRemove(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover integração
          </button>
        )}
      </div>

      <div className="px-5 py-5 space-y-4">
        {confirmRemove && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-400">Remover integração?</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Suas chaves serão apagadas, os dados da Análise de Comissões serão limpos
                e a página voltará a pedir upload de arquivo CSV.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={onRemove}
                  disabled={removing}
                  className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  {removing ? "Removendo..." : "Confirmar remoção"}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  disabled={removing}
                  className="px-3 py-1.5 rounded-md border border-dark-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <IdCard className="h-4 w-4 text-shopee-orange" />
            Shopee App ID
          </label>
          <input
            value={appId}
            onChange={(e) => {
              setAppId(e.target.value);
              setOk(false);
            }}
            placeholder="Ex.: 1234567890"
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <KeyRound className="h-4 w-4 text-shopee-orange" />
            Shopee API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setOk(false);
            }}
            placeholder={
              hasKey
                ? `Chave atual: ••••${last4} — cole para substituir`
                : "Cole sua chave aqui"
            }
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>

          {ok && <span className="text-sm text-green-400">Salvo com sucesso.</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>

        <p className="text-xs text-text-secondary/70">
          Obtenha estes dados no seu Painel de Afiliado Shopee. Sua chave permanece oculta
          e só será substituída se você salvar uma nova.
        </p>
      </div>
    </section>
  );
}
