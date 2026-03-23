"use client";

import { usePlanEntitlements } from "./PlanEntitlementsContext";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

type Feature = "ati" | "criarCampanhaMeta" | "geradorCriativos";

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
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-dark-card border border-dark-border flex items-center justify-center">
          <Lock className="h-7 w-7 text-text-secondary/40" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">
          Recurso exclusivo do Plano Pro
        </h2>
        <p className="text-sm text-text-secondary max-w-sm">
          Esta funcionalidade está disponível apenas para assinantes do Plano
          Pro. Faça upgrade para desbloquear todos os recursos avançados.
        </p>
        <a
          href="https://pay.kiwify.com.br/4fAAtkD"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-shopee-orange hover:bg-shopee-orange/90 text-white font-semibold rounded-xl text-sm transition-colors shadow-[0_4px_16px_rgba(238,77,45,0.3)]"
        >
          Fazer Upgrade para Pro
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
