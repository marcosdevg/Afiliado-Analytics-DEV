"use client";

import { useState } from "react";
import { KeyRound, Trash2, AlertTriangle, ExternalLink } from "lucide-react";

interface MetaIntegrationCardProps {
  initialHasToken: boolean;
  initialLast4: string | null;
}

const META_TOKEN_URL = "https://developers.facebook.com/tools/explorer/";

export default function MetaIntegrationCard({
  initialHasToken,
  initialLast4,
}: MetaIntegrationCardProps) {
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(initialHasToken);
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
      const res = await fetch("/api/settings/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta_access_token: token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      setToken("");
      const status = await fetch("/api/settings/meta").then((r) => r.json());
      setHasToken(!!status?.has_token);
      setLast4(status?.last4 ?? null);
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
      const res = await fetch("/api/settings/meta", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover");
      setToken("");
      setHasToken(false);
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
          Meta Ads (Facebook / Instagram)
        </h2>
        {hasToken && !confirmRemove && (
          <button
            onClick={() => setConfirmRemove(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover token
          </button>
        )}
      </div>

      <div className="px-5 py-5 space-y-4">
        {confirmRemove && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-400">Remover token do Meta?</p>
              <p className="text-xs text-text-secondary mt-0.5">
                O módulo ATI deixará de carregar dados do Meta até você configurar novamente.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={onRemove}
                  disabled={removing}
                  className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  {removing ? "Removendo..." : "Confirmar"}
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
            <KeyRound className="h-4 w-4 text-indigo-400" />
            Token de Acesso (Access Token)
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setOk(false);
            }}
            placeholder={
              hasToken
                ? `Token atual: ••••${last4} — cole para substituir`
                : "Cole seu token de acesso do Meta aqui"
            }
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {ok && <span className="text-sm text-green-400">Salvo com sucesso.</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>

        <p className="text-xs text-text-secondary/70">
          Use um <strong>token de longa duração</strong> com permissões{" "}
          <code className="bg-dark-bg px-1 rounded">ads_management</code> e{" "}
          <code className="bg-dark-bg px-1 rounded">ads_read</code>. Gere no{" "}
          <a
            href={META_TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
          >
            Graph API Explorer <ExternalLink className="h-3 w-3" />
          </a>{" "}
          ou no Gerenciador de Negócios do Meta. Não é necessário Pixel — apenas este token.
        </p>
      </div>
    </section>
  );
}
