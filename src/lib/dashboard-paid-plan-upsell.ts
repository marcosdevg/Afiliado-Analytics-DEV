import type { PlanEntitlements, PlanTier } from "@/lib/plan-entitlements";
import { isTrialBlockedDashboardPath } from "@/lib/trial-dashboard-blocked-paths";

/**
 * Mostrar o painel "Recurso do plano pago" no layout do dashboard (sidebar mantida).
 * Baseado em **entitlements** onde o trial difere do padrão (GPL, grupos, listas) e em
 * `tier === "trial"` nas rotas só-Pro, para não substituir o `ProFeatureGate` do plano Padrão.
 */
export function shouldShowPaidPlanUpsellInDashboard(
  pathname: string,
  tier: PlanTier,
  entitlements: PlanEntitlements | null
): boolean {
  if (!entitlements || !isTrialBlockedDashboardPath(pathname)) return false;

  const p = pathname.split("?")[0] ?? pathname;

  if (p === "/dashboard/gpl" || p.startsWith("/dashboard/gpl/")) {
    return !entitlements.gpl.enabled;
  }
  if (p === "/dashboard/grupos-venda" || p.startsWith("/dashboard/grupos-venda/")) {
    return entitlements.gruposVenda.maxGroupsTotal <= 0;
  }
  if (p.startsWith("/dashboard/minha-lista-ofertas")) {
    return entitlements.gruposVenda.maxLists === 0;
  }
  if (p.startsWith("/dashboard/admin")) {
    return tier === "trial";
  }
  return tier === "trial";
}
