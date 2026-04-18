"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Printer, Loader2, AlertTriangle } from "lucide-react";

type Sender = {
  name: string;
  document: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  uf: string;
};

type Etiqueta = {
  sessionId: string;
  orderNumber: string;
  dateLabel: string;
  amount: number;
  productName: string;
  receiver: {
    name: string;
    phone: string | null;
    line1: string;
    line2: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
};

type EtiquetaDataResponse = {
  sender: Sender | null;
  senderValid: boolean;
  etiquetas: Etiqueta[];
  errors: { sessionId: string; reason: string }[];
};

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function EtiquetasModal({
  open,
  sessionIds,
  onClose,
}: {
  open: boolean;
  sessionIds: string[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EtiquetaDataResponse | null>(null);

  useEffect(() => {
    if (!open || sessionIds.length === 0) return;
    setLoading(true);
    setError(null);
    setData(null);
    (async () => {
      try {
        const res = await fetch("/api/infoprodutor/etiqueta-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionIds }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar etiquetas");
        setData(json as EtiquetaDataResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sessionIds]);

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sender = data?.sender;
  const senderValid = data?.senderValid ?? false;
  const etiquetas = data?.etiquetas ?? [];
  const errors = data?.errors ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="etiqueta-modal-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto print:static print:bg-white print:backdrop-blur-none print:overflow-visible"
      onClick={onClose}
    >
      {/* CSS local: impressão corta todo resto da página, só mostra as etiquetas */}
      <style>{`
        @media print {
          @page { size: A6 portrait; margin: 6mm; }
          body > *:not(.etiqueta-modal-overlay) { display: none !important; }
          .etiqueta-modal-overlay { position: static !important; background: white !important; height: auto !important; overflow: visible !important; }
          .etiqueta-modal-chrome { display: none !important; }
          .etiqueta-modal-body { padding: 0 !important; }
          .etiqueta-sheet { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; page-break-inside: avoid; break-inside: avoid; }
          .etiqueta-sheet + .etiqueta-sheet { page-break-before: always; break-before: page; }
        }
      `}</style>

      <div
        className="min-h-full flex items-start justify-center p-4 sm:p-6 print:p-0 print:block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-3xl">
          {/* Chrome do modal (header e footer) */}
          <div className="etiqueta-modal-chrome bg-[#1c1c1f] border border-[#2c2c32] rounded-t-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#f0f0f2]">
                Etiqueta{etiquetas.length === 1 ? "" : "s"} de envio
              </h3>
              <p className="text-[10px] text-[#9a9aa2]">
                {loading
                  ? "Carregando…"
                  : `${etiquetas.length} ${etiquetas.length === 1 ? "pronta" : "prontas"} para imprimir${
                      errors.length > 0 ? ` · ${errors.length} com erro` : ""
                    }`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={loading || etiquetas.length === 0 || !senderValid}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#635bff] hover:bg-[#5047e5] text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                title={
                  !senderValid
                    ? "Preencha o endereço do remetente em Configurações"
                    : etiquetas.length === 0
                      ? "Nenhuma etiqueta pronta"
                      : "Imprimir"
                }
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir {etiquetas.length > 1 ? `(${etiquetas.length})` : ""}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] hover:bg-[#2f2f34]"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="etiqueta-modal-body bg-[#f6f6f6] border-x border-b border-[#2c2c32] rounded-b-2xl p-4 sm:p-6 space-y-4">
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#635bff]" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-2 text-black">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            ) : (
              <>
                {!senderValid ? (
                  <div className="rounded-lg border border-amber-500 bg-amber-100 p-4 flex items-start gap-3 text-black etiqueta-modal-chrome">
                    <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-amber-900">Endereço do remetente incompleto</p>
                      <p className="text-amber-800 text-xs mt-1">
                        Preencha nome, CEP, cidade e UF em Configurações antes de imprimir.
                      </p>
                      <Link
                        href="/configuracoes"
                        target="_blank"
                        className="inline-block mt-2 text-xs font-bold text-amber-900 underline"
                      >
                        Abrir Configurações
                      </Link>
                    </div>
                  </div>
                ) : null}

                {errors.length > 0 ? (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-black etiqueta-modal-chrome">
                    <p className="text-xs font-semibold text-amber-900 mb-1">
                      {errors.length} pedido(s) foram pulados:
                    </p>
                    <ul className="text-[11px] text-amber-800 list-disc ml-4 space-y-0.5">
                      {errors.map((e) => (
                        <li key={e.sessionId}>
                          <code className="text-[10px]">…{e.sessionId.slice(-8)}</code> — {e.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {etiquetas.length === 0 ? (
                  <p className="text-center text-sm text-[#555] py-8">
                    Nenhuma etiqueta pôde ser gerada.
                  </p>
                ) : (
                  etiquetas.map((et) => (
                    <EtiquetaSheet key={et.sessionId} sender={sender} etiqueta={et} />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EtiquetaSheet({ sender, etiqueta }: { sender: Sender | null | undefined; etiqueta: Etiqueta }) {
  const senderLine = sender
    ? [sender.street, sender.number ? `nº ${sender.number}` : null, sender.complement]
        .filter(Boolean)
        .join(" ")
    : "";
  const senderCityUf = sender ? [sender.city, sender.uf].filter(Boolean).join("/") : "";
  const receiverCityUf = [etiqueta.receiver.city, etiqueta.receiver.state].filter(Boolean).join("/");

  return (
    <div className="etiqueta-sheet bg-white border-2 border-black rounded-md overflow-hidden text-black shadow-lg">
      {/* Remetente */}
      <div className="px-4 py-3 border-b-2 border-black">
        <p className="text-[9px] font-bold uppercase tracking-widest text-black/60">Remetente</p>
        {sender ? (
          <>
            <p className="text-sm font-bold mt-0.5">{sender.name}</p>
            {sender.document ? <p className="text-[11px]">CPF/CNPJ: {sender.document}</p> : null}
            <p className="text-[11px] mt-1">{senderLine}</p>
            {sender.neighborhood ? <p className="text-[11px]">{sender.neighborhood}</p> : null}
            <p className="text-[11px]">{senderCityUf}</p>
            <p className="text-[11px] font-semibold">CEP: {sender.cep}</p>
            {sender.phone ? <p className="text-[11px]">Tel: {sender.phone}</p> : null}
          </>
        ) : (
          <p className="text-[11px] italic text-black/60">Preencha em Configurações.</p>
        )}
      </div>

      {/* Destinatário */}
      <div className="px-4 py-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-black/60">Destinatário</p>
        <p className="text-2xl font-black uppercase mt-1 leading-tight">{etiqueta.receiver.name}</p>
        <p className="text-[13px] mt-2 leading-relaxed">{etiqueta.receiver.line1}</p>
        <p className="text-[13px]">{receiverCityUf}</p>
        <div className="mt-3 inline-block border-2 border-black px-3 py-2 rounded">
          <span className="text-[10px] font-bold uppercase tracking-widest">CEP</span>
          <p className="text-2xl font-black tracking-widest leading-none mt-0.5">
            {etiqueta.receiver.postalCode || "—"}
          </p>
        </div>
        {etiqueta.receiver.phone ? (
          <p className="text-[12px] mt-2">Tel: {etiqueta.receiver.phone}</p>
        ) : null}
      </div>

      {/* Info pedido */}
      <div className="px-4 py-2 border-t border-black/40 bg-black/5 text-[10px] flex flex-wrap gap-x-3 gap-y-0.5 justify-between">
        <span>
          <strong>Pedido:</strong> #{etiqueta.orderNumber}
        </span>
        <span>
          <strong>Data:</strong> {etiqueta.dateLabel}
        </span>
        <span>
          <strong>Valor:</strong> {formatBRL(etiqueta.amount)}
        </span>
      </div>

      <div className="px-4 py-2 border-t border-black/20 text-[10px]">
        <strong>Produto:</strong> {etiqueta.productName}
      </div>
    </div>
  );
}
