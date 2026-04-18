"use client";

import { useState } from "react";
import { KeyRound, Trash2, ExternalLink } from "lucide-react";

const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com/apikeys";

type StripeIntegrationCardProps = {
  initialHasKey?: boolean;
  initialLast4?: string | null;
};

export default function StripeIntegrationCard({
  initialHasKey = false,
  initialLast4 = null,
}: StripeIntegrationCardProps) {
  const [secretKey, setSecretKey] = useState("");
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [last4, setLast4] = useState<string | null>(initialLast4);

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/settings/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripe_secret_key: secretKey.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      setSecretKey("");
      setHasKey(true);
      setLast4(json?.last4 ?? null);
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
      const res = await fetch("/api/settings/stripe", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover");
      setHasKey(false);
      setLast4(null);
      setSecretKey("");
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
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
          Stripe — API
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Conecte sua conta Stripe para criar produtos com checkout automático direto do Infoprodutor.
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {hasKey && !confirmRemove ? (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Desconectar Stripe
          </button>
        ) : null}

        {confirmRemove ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-xs text-text-secondary flex-1 min-w-[200px]">
              Apagar a chave secreta da Stripe deste servidor? Produtos já criados na Stripe continuam funcionando.
            </p>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-dark-bg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onRemove()}
              disabled={removing}
              className="rounded-md px-3 py-1.5 text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60"
            >
              {removing ? "Removendo…" : "Desconectar"}
            </button>
          </div>
        ) : null}

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <KeyRound className="h-4 w-4 text-shopee-orange" />
            Chave secreta (Secret Key)
          </label>
          <input
            type="password"
            value={secretKey}
            onChange={(e) => {
              setSecretKey(e.target.value);
              setOk(false);
            }}
            placeholder={hasKey ? "Deixe em branco para manter a atual" : "sk_live_... ou sk_test_..."}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
          {hasKey && last4 ? (
            <p className="text-[11px] text-text-secondary mt-1">
              Chave salva no servidor (termina em <span className="text-shopee-orange/90">…{last4}</span>).
            </p>
          ) : (
            <p className="text-[11px] text-text-secondary mt-1">
              Gere sua Secret Key no painel da Stripe:{" "}
              <a
                href={STRIPE_DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-shopee-orange hover:underline inline-flex items-center gap-1"
              >
                Stripe · API keys <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !secretKey.trim()}
            className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Validando…" : hasKey ? "Atualizar chave" : "Conectar Stripe"}
          </button>
          {ok && <span className="text-sm text-green-400">Chave validada e salva.</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </div>
    </section>
  );
}
