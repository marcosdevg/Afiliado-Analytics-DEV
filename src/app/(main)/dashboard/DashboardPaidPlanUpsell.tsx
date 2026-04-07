"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";

const checkoutPadrao = "https://pay.kiwify.com.br/Q1eE7t8";
const checkoutPro = "https://pay.kiwify.com.br/y7I4SuT";
const whatsappUrl = "https://wa.me/5579999144028";

/**
 * Upsell Padrão + Pro dentro da área principal do dashboard (mantém sidebar/header).
 * Usado para `plan_tier === trial` em rotas listadas em `trial-dashboard-blocked-paths`.
 */
export default function DashboardPaidPlanUpsell() {
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center px-4">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-md overflow-hidden">
        <div className="px-6 py-8">
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>

          <h1 className="text-xl font-bold text-text-primary mb-3">
            Recurso do plano pago
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed mb-8">
            Esta área faz parte dos planos Padrão ou Pro. Assine para desbloquear
            GPL, ATI, automação de grupos e muito mais.
          </p>

          <div className="flex flex-col gap-3">
            <a
              href={checkoutPro}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-shopee-orange to-orange-500 py-3 px-4 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              Assinar Pro
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={checkoutPadrao}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dark-border bg-dark-bg/60 py-3 px-4 text-base font-semibold text-text-primary transition-transform hover:scale-[1.01]"
            >
              Assinar Padrão
              <ExternalLink className="h-4 w-4" />
            </a>
            <Link
              href="/dashboard"
              className="text-sm text-shopee-orange hover:underline mt-1"
            >
              Voltar ao dashboard
            </Link>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-dark-border bg-dark-bg/40">
          <p className="text-xs text-text-secondary text-center">
            Dúvidas?{" "}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-shopee-orange hover:underline"
            >
              Chame no WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
