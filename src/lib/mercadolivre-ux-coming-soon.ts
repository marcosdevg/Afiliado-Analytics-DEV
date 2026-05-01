/**
 * Quando `true`, a UI de Mercado Livre / crossover mostra apenas o splash "Em Breve"
 * (nav, listas, grupos, config). Mantém `false` enquanto o fluxo ML estiver liberado.
 */
export const MERCADOLIVRE_UX_COMING_SOON = false;

export function isGruposVendaMlOfferBlocked(
  source: "shopee" | "ml" | "amazon" | "crossover" | "infoprodutor",
): boolean {
  if (!MERCADOLIVRE_UX_COMING_SOON) return false;
  return source === "ml" || source === "crossover";
}
