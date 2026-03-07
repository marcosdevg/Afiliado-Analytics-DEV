"use client";

import { AlertTriangle, RotateCcw, X } from "lucide-react";

export default function ResetMetricsModal(props: {
  open: boolean;
  oldUrl: string;
  newUrl: string;
  viewCount: number;
  clickCount: number;
  saving: boolean;
  onCancel: () => void;
  onSaveWithoutReset: () => void;
  onSaveWithReset: () => void;
}) {
  const {
    open,
    oldUrl,
    newUrl,
    viewCount,
    clickCount,
    saving,
    onCancel,
    onSaveWithoutReset,
    onSaveWithReset,
  } = props;

  if (!open) return null;

  const hasData = viewCount > 0 || clickCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!saving) onCancel();
      }}
    >
      <div
        className="w-full max-w-[560px] bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-dark-border flex items-start gap-3">
          <div className="mt-0.5 h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary leading-snug">
              Você trocou o link do botão
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Para manter as métricas consistentes, recomendamos resetar os contadores quando você muda o destino do
              botão.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:text-text-primary hover:border-dark-border/80 transition-colors disabled:opacity-50"
            aria-label="Fechar"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="text-xs text-text-secondary bg-dark-bg border border-dark-border rounded-lg p-3">
            <div className="grid grid-cols-[60px_1fr] gap-x-3 gap-y-2">
              <span className="text-text-secondary/80">Antes</span>
              <span className="font-mono break-all text-text-primary/90">{oldUrl || "(vazio)"}</span>

              <span className="text-text-secondary/80">Depois</span>
              <span className="font-mono break-all text-text-primary/90">{newUrl || "(vazio)"}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <RotateCcw className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Métricas atuais: <span className="text-sky-300 font-semibold">{viewCount}</span> views,{" "}
              <span className="text-emerald-300 font-semibold">{clickCount}</span> cliques.
            </span>
          </div>

          {!hasData && (
            <div className="text-xs text-text-secondary bg-dark-bg border border-dark-border rounded-lg p-3">
              Como não há dados para resetar, você pode apenas salvar normalmente.
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-dark-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          <button
            onClick={onSaveWithoutReset}
            disabled={saving}
            className="px-3.5 py-2 text-sm bg-sky-600/20 border border-sky-500/30 text-sky-200 rounded-lg hover:bg-sky-600/30 hover:border-sky-400/40 transition-colors font-semibold disabled:opacity-50"
            type="button"
          >
            Salvar sem resetar
          </button>

          <button
            onClick={onSaveWithReset}
            disabled={saving || !hasData}
            className="px-3.5 py-2 text-sm bg-shopee-orange text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
            type="button"
            title={!hasData ? "Sem dados para resetar" : "Salvar e resetar métricas"}
          >
            Salvar e resetar
          </button>
        </div>
      </div>
    </div>
  );
}
