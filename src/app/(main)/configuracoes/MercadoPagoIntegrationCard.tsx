"use client";

import { useEffect, useState } from "react";
import {
  KeyRound,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Link2,
} from "lucide-react";

const MP_DEVELOPERS_URL = "https://www.mercadopago.com.br/developers/panel/app";

type Status = {
  has_credentials: boolean;
  source: "oauth" | "manual" | null;
  secret_last4: string | null;
  public_key_last4: string | null;
  mp_user_id: string | null;
  live_mode: boolean | null;
};

const EMPTY_STATUS: Status = {
  has_credentials: false,
  source: null,
  secret_last4: null,
  public_key_last4: null,
  mp_user_id: null,
  live_mode: null,
};

export default function MercadoPagoIntegrationCard() {
  const [status, setStatus] = useState<Status>(EMPTY_STATUS);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [showManual, setShowManual] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Mensagens vindas do callback OAuth (?mp=ok ou ?mp=err).
  const [callbackBanner, setCallbackBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  const refreshStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/settings/mercadopago");
      if (!res.ok) throw new Error();
      const j = (await res.json()) as Status;
      setStatus(j ?? EMPTY_STATUS);
    } catch {
      setStatus(EMPTY_STATUS);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  // Lê ?mp=ok / ?mp=err da URL após retorno do OAuth.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const mp = url.searchParams.get("mp");
    if (!mp) return;
    if (mp === "ok") {
      setCallbackBanner({ ok: true, msg: "Conectado com sucesso ao Mercado Pago." });
    } else {
      const reason = url.searchParams.get("mp_reason") || "Falha ao conectar.";
      setCallbackBanner({ ok: false, msg: reason });
    }
    // Limpa os params da URL pra não repetir o banner ao recarregar.
    url.searchParams.delete("mp");
    url.searchParams.delete("mp_reason");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const onConnectOAuth = () => {
    window.location.href = "/api/mercadopago/oauth/start";
  };

  const onSaveManual = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/settings/mercadopago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken.trim(),
          public_key: publicKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      setAccessToken("");
      setPublicKey("");
      setOk(true);
      setShowManual(false);
      await refreshStatus();
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
      const res = await fetch("/api/settings/mercadopago", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao desconectar");
      setOk(false);
      setConfirmRemove(false);
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemoving(false);
    }
  };

  const connected = status.has_credentials;
  const source = status.source;
  const liveMode = status.live_mode;

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
          Infoprodutor
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Conecte sua conta Mercado Pago para receber pagamentos.
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {callbackBanner ? (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              callbackBanner.ok
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                : "border-red-500/30 bg-red-500/5 text-red-300"
            }`}
          >
            <p className="font-semibold">
              {callbackBanner.ok ? "✓ " : "✕ "}
              {callbackBanner.msg}
            </p>
          </div>
        ) : null}

        {loadingStatus ? (
          <p className="flex items-center gap-2 text-xs text-text-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando status...
          </p>
        ) : connected ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Conta Mercado Pago conectada
            </p>
            <ul className="text-[11px] text-text-secondary space-y-0.5">
              <li>
                Modo:{" "}
                <span className={liveMode ? "text-emerald-400" : "text-amber-400"}>
                  {liveMode ? "Produção" : liveMode === false ? "Sandbox / Teste" : "—"}
                </span>
              </li>
              <li>
                Conexão:{" "}
                <span className="text-text-primary">
                  {source === "oauth" ? "OAuth (recomendado)" : "Manual"}
                </span>
              </li>
              {status.mp_user_id ? (
                <li>
                  ID da conta MP:{" "}
                  <span className="text-shopee-orange/90">{status.mp_user_id}</span>
                </li>
              ) : null}
              {status.secret_last4 ? (
                <li>
                  Token termina em{" "}
                  <span className="text-shopee-orange/90">…{status.secret_last4}</span>
                </li>
              ) : null}
              {status.public_key_last4 ? (
                <li>
                  Public key termina em{" "}
                  <span className="text-shopee-orange/90">…{status.public_key_last4}</span>
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-text-secondary hidden">
            Nenhuma conta conectada. Use o botão abaixo para conectar via OAuth (recomendado).
          </p>
        )}

        {/* Botão OAuth — sempre visível. Conectar OU reconectar. */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onConnectOAuth}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 transition-opacity"
          >
            <Link2 className="h-4 w-4" />
            {connected ? "Reconectar via Mercado Pago" : "Conectar via Mercado Pago"}
          </button>

          {connected && !confirmRemove ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Desconectar
            </button>
          ) : null}
        </div>

        {confirmRemove ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-xs text-text-secondary flex-1 min-w-[200px]">
              Apagar credenciais do Mercado Pago deste servidor? Pagamentos já criados continuam ativos no MP.
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

        {/* Caminho manual — escondido por default, expansível. */}
        <div className="border-t border-dark-border/50 pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="text-xs font-semibold text-text-secondary hover:text-shopee-orange transition-colors"
          >
            {showManual ? "Ocultar credenciais manuais" : "Conectar manualmente (avançado)"}
          </button>

          {showManual ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <KeyRound className="h-4 w-4 text-shopee-orange" />
                  Access Token
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value);
                    setOk(false);
                  }}
                  placeholder="APP_USR-... ou TEST-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
                />
                <p className="text-[11px] text-text-secondary mt-1">
                  Encontra no painel do Mercado Pago em{" "}
                  <a
                    href={MP_DEVELOPERS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-shopee-orange hover:underline inline-flex items-center gap-1"
                  >
                    Developers · Aplicações <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  → Credenciais.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <KeyRound className="h-4 w-4 text-shopee-orange" />
                  Public Key 
                </label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => {
                    setPublicKey(e.target.value);
                    setOk(false);
                  }}
                  placeholder="APP_USR-... ou TEST-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
                />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => void onSaveManual()}
                  disabled={saving || !accessToken.trim()}
                  className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {saving ? "Validando…" : "Salvar credenciais"}
                </button>
                {ok && <span className="text-sm text-green-400">Credenciais validadas e salvas.</span>}
                {error && <span className="text-sm text-red-400">{error}</span>}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
