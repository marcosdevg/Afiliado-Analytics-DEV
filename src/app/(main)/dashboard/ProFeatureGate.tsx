"use client";

import { usePlanEntitlements } from "./PlanEntitlementsContext";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Features gateáveis no client-side.
 * O tier mínimo determina a copy do bloqueio (Pro-only vs Padrão+).
 */
type Feature =
  | "ati"
  | "criarCampanhaMeta"
  | "geradorCriativos"
  | "espelhamentogrupos"
  | "especialistagenerate"
  | "infoprodutor"
  | "tendenciasShopee"
  | "analiseOfertasRelampago"
  | "mercadoLivre"
  | "amazon";

const FEATURE_MIN_TIER: Record<Feature, "padrao" | "pro"> = {
  ati: "padrao",
  criarCampanhaMeta: "padrao",
  espelhamentogrupos: "padrao",
  infoprodutor: "padrao",
  tendenciasShopee: "padrao",
  analiseOfertasRelampago: "padrao",
  mercadoLivre: "padrao",
  amazon: "padrao",
  geradorCriativos: "pro",
  especialistagenerate: "pro",
};

type GateCopy = {
  title: string;
  description: string;
};

function copyForFeature(feature: Feature): GateCopy {
  if (FEATURE_MIN_TIER[feature] === "pro") {
    return {
      title: "Recurso exclusivo do Plano Pro",
      description:
        "Esta funcionalidade está disponível apenas para assinantes do Plano Pro. Faça upgrade para desbloquear todos os recursos avançados.",
    };
  }
  return {
    title: "Recurso dos Planos Padrão e Pro",
    description:
      "Esta funcionalidade está disponível a partir do Plano Padrão. Faça upgrade para desbloquear marketplaces, automações avançadas e tendências.",
  };
}

export default function ProFeatureGate({
  feature,
  children,
}: {
  feature: Feature;
  children: ReactNode;
}) {
  const { entitlements, loading } = usePlanEntitlements();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-secondary text-sm">
        Carregando...
      </div>
    );
  }

  if (entitlements && !entitlements[feature]) {
    const copy = copyForFeature(feature);
    const minTier = FEATURE_MIN_TIER[feature];
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-dark-card border border-dark-border flex items-center justify-center">
          <Lock className="h-7 w-7 text-text-secondary/40" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{copy.title}</h2>
        <p className="text-sm text-text-secondary max-w-sm">{copy.description}</p>
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {minTier === "padrao" && (
            <>
              <a
                href="https://pay.kiwify.com.br/DzMLl6Q"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-col items-center justify-center gap-0.5 px-6 py-3 bg-shopee-orange hover:bg-shopee-orange/90 text-white font-semibold rounded-xl text-sm transition-colors shadow-[0_4px_16px_rgba(238,77,45,0.3)]"
              >
                <span>Plano Padrão Mensal</span>
                <span className="text-[10px] font-medium text-white/75 line-through">
                  De R$ 167,90
                </span>
                <span className="text-xs font-medium text-white/95">R$ 127,90/mês</span>
              </a>
              <a
                href="https://pay.kiwify.com.br/bh2PrXd"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-col items-center justify-center gap-0.5 px-6 py-3 bg-shopee-orange hover:bg-shopee-orange/90 text-white font-semibold rounded-xl text-sm transition-colors shadow-[0_4px_16px_rgba(238,77,45,0.3)]"
              >
                <span>Plano Padrão Trimestral</span>
                <span className="text-[10px] font-medium text-white/75 line-through">
                  De R$ 383,70
                </span>
                <span className="text-xs font-medium text-white/95">
                  R$ 297,90 por 3 meses
                </span>
              </a>
            </>
          )}
          <a
            href="https://pay.kiwify.com.br/y7I4SuT"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex flex-col items-center justify-center gap-0.5 px-6 py-3 ${
              minTier === "pro"
                ? "bg-shopee-orange hover:bg-shopee-orange/90 text-white"
                : "bg-dark-card hover:bg-dark-card/80 border border-dark-border text-text-primary"
            } font-semibold rounded-xl text-sm transition-colors shadow-[0_4px_16px_rgba(238,77,45,0.3)]`}
          >
            <span>Plano Pro Mensal</span>
            <span className="text-[10px] font-medium opacity-75 line-through">
              De R$ 297,90
            </span>
            <span className="text-xs font-medium">R$ 197,90/mês</span>
          </a>
          <a
            href="https://pay.kiwify.com.br/y7QHrMp"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex flex-col items-center justify-center gap-0.5 px-6 py-3 ${
              minTier === "pro"
                ? "bg-shopee-orange hover:bg-shopee-orange/90 text-white"
                : "bg-dark-card hover:bg-dark-card/80 border border-dark-border text-text-primary"
            } font-semibold rounded-xl text-sm transition-colors shadow-[0_4px_16px_rgba(238,77,45,0.3)]`}
          >
            <span>Plano Pro Trimestral</span>
            <span className="text-[10px] font-medium opacity-75 line-through">
              De R$ 593,70
            </span>
            <span className="text-xs font-medium">
              R$ 527,90 por 3 meses
            </span>
            <span className="text-[10px] font-medium opacity-85 text-center leading-snug px-1">
              Equivale a R$ 175,96/mês · Economize R$ 65,80 (10% OFF)
            </span>
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
