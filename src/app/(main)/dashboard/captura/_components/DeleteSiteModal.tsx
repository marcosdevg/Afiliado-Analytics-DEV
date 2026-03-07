"use client";

import { AlertTriangle } from "lucide-react";

export default function DeleteSiteModal(props: {
  open: boolean;
  isDeleting: boolean;
  publicUrl: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { open, isDeleting, publicUrl, onClose, onConfirm } = props;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => (!isDeleting ? onClose() : null)}
    >
      <div
        className="w-full max-w-md bg-dark-card border border-dark-border rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-dark-border flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <h3 className="text-lg font-semibold text-text-primary">Apagar site?</h3>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-text-secondary">
            Isso vai apagar seu site de captura e os eventos (views/cliques) relacionados.
          </p>
          <p className="text-sm text-text-secondary">
            Se você quer trocar o slug, esse é o caminho: apagar e criar novamente.
          </p>

          <div className="text-xs text-text-secondary bg-dark-bg border border-dark-border rounded-md p-3">
            <div className="font-mono break-all">{publicUrl}</div>
          </div>
        </div>

        <div className="p-5 border-t border-dark-border flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-dark-bg border border-dark-border text-text-secondary rounded-md hover:border-shopee-orange hover:text-shopee-orange transition-colors font-medium disabled:opacity-50"
            type="button"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-semibold disabled:opacity-50"
            type="button"
          >
            {isDeleting ? "Excluindo..." : "Apagar"}
          </button>
        </div>
      </div>
    </div>
  );
}
