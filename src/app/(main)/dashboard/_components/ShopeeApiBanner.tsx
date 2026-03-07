"use client";

import Link from "next/link";
import { PlugZap } from "lucide-react";

export default function ShopeeApiBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-r from-shopee-orange/55 via-white/10 to-sky-500/40 shadow-sm">
      <div className="relative overflow-hidden rounded-2xl bg-dark-card p-4">
        {/* highlights suaves (sem animação) */}
        <div className="pointer-events-none absolute inset-0 opacity-90 bg-[radial-gradient(circle_at_15%_0%,rgba(255,87,34,0.18),transparent_55%),radial-gradient(circle_at_100%_25%,rgba(56,189,248,0.14),transparent_60%)]" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {/* Ícone destacado */}
            <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 flex items-center justify-center">
              <PlugZap className="h-5 w-5 text-shopee-orange" />
            </div>

            {/* Textos */}
            <div className="min-w-0">
              <p className="text-text-primary">
                <span className="font-bold">Integração Direta com a Shopee</span>
              </p>
              <p className="text-sm text-text-secondary mt-1">
                Utilize a API oficial da Shopee para buscar seus dados automaticamente todos os dias.
              </p>
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/configuracoes"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <PlugZap className="h-4 w-4" />
            Vincular API Shopee
          </Link>
        </div>
      </div>
    </div>
  );
}
