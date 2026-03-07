"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface GeneratingReportPillProps {
  message?: string;
  delayedMessage?: string;
  delayMs?: number;
}

export function GeneratingReportPill({
  message = "Buscando dados na Shopee e calculando métricas...",
  delayedMessage = "Ainda processando… isso pode levar alguns segundos.",
  delayMs = 4000,
}: GeneratingReportPillProps) {
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    // Reseta sempre que o componente é montado (novo loading)
    setIsDelayed(false);

    const timer = setTimeout(() => {
      setIsDelayed(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div className="mt-8 w-full flex items-center gap-5 px-6 py-5 bg-dark-card border border-dark-border rounded-2xl shadow-md">

      {/* Ícone */}
      <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-shopee-orange/10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-shopee-orange animate-spin" />
      </div>

      {/* Textos */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="font-bold text-text-primary text-base leading-snug">
          Gerando relatório...
        </span>
        <span
          className="text-sm leading-snug truncate transition-all duration-500 text-text-secondary"
        >
          {isDelayed ? delayedMessage : message}
        </span>

      </div>

    </div>
  );
}
