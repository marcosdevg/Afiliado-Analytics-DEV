/**
 * Rotas /dashboard/* bloqueadas para `plan_tier = trial` (plano gratuito por cupom).
 * O restante do dashboard (comissões, cliques, links, gerador Shopee, captura) segue liberado
 * conforme `LIMITS.trial` em plan-entitlements.
 */
export const TRIAL_BLOCKED_DASHBOARD_PREFIXES: string[] = [
  "/dashboard/gpl",
  "/dashboard/ati",
  "/dashboard/espelhamento-grupos",
  "/dashboard/meta-ads",
  "/dashboard/video-editor",
  "/dashboard/gerador-especialista",
  "/dashboard/minha-lista-ofertas-ml",
  "/dashboard/minha-lista-ofertas-amazon",
  "/dashboard/tendencias-shopee",
  "/dashboard/admin",
  "/dashboard/infoprodutor",
];

export function isTrialBlockedDashboardPath(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  return TRIAL_BLOCKED_DASHBOARD_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix + "/")
  );
}
