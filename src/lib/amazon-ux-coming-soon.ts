/**
 * Quando `true`, a UI de Amazon / crossover mostra apenas o stub "Em Breve"
 * (nav, listas, grupos, config). Mantém `false` enquanto o fluxo Amazon estiver liberado.
 */
export const AMAZON_UX_COMING_SOON = false;

export function isGruposVendaAmazonOfferBlocked(
  source: "shopee" | "ml" | "amazon" | "crossover" | "infoprodutor",
): boolean {
  if (!AMAZON_UX_COMING_SOON) return false;
  return source === "amazon" || source === "crossover";
}
