/**
 * Crossover N-way nas listas de ofertas (Grupos de Venda).
 *
 * Suporta combinações arbitrárias de marketplaces:
 *  - Shopee + ML
 *  - Shopee + Amazon
 *  - Shopee + Infoprodutor
 *  - ML + Amazon
 *  - Shopee + ML + Amazon + Infoprodutor (4 fontes)
 *  - … qualquer subconjunto com 2+ fontes.
 *
 * A fila resultante alterna 1 item de cada fonte na ordem em que vieram,
 * round-robin: se a entrada for `[shopee, ml, amazon, info]`, o resultado é
 * `shopee[0], ml[0], amazon[0], info[0], shopee[1], ml[1], …`.
 * Se uma lista esgotar antes das outras, ela é pulada nos round-robins
 * seguintes e a ordem das demais é mantida.
 *
 * Aplicado em:
 *  - `src/app/api/grupos-venda/cron-disparo/route.ts` (cron de 10 minutos)
 *  - `src/app/api/grupos-venda/disparar/route.ts`     (disparo manual)
 */
export function interleaveCrossoverN<T>(...lists: T[][]): T[] {
  const sources = lists.filter((l) => l && l.length > 0);
  if (sources.length === 0) return [];
  if (sources.length === 1) return [...sources[0]];

  const out: T[] = [];
  const max = Math.max(...sources.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const src of sources) {
      if (i < src.length) out.push(src[i]);
    }
  }
  return out;
}

/**
 * Backward-compat: API antiga `interleaveCrossover(shopee, ml)`.
 * Mantida pra não quebrar imports existentes — basta delegar pro N-way.
 */
export function interleaveCrossover<T>(shopee: T[], ml: T[]): T[] {
  return interleaveCrossoverN(shopee, ml);
}

/**
 * Identificadores das fontes de oferta usadas pelo crossover.
 * O front e o n8n recebem qual subconjunto está ativo numa campanha.
 */
export type CrossoverSourceId = "shopee" | "ml" | "amazon" | "infoprodutor";

/**
 * Soma defensiva de uma combinação: retorna apenas os IDs de origem
 * que de fato têm itens nas listas correspondentes.
 */
export function activeCrossoverSources(input: {
  shopee?: unknown[] | null;
  ml?: unknown[] | null;
  amazon?: unknown[] | null;
  infoprodutor?: unknown[] | null;
}): CrossoverSourceId[] {
  const out: CrossoverSourceId[] = [];
  if (input.shopee && input.shopee.length > 0) out.push("shopee");
  if (input.ml && input.ml.length > 0) out.push("ml");
  if (input.amazon && input.amazon.length > 0) out.push("amazon");
  if (input.infoprodutor && input.infoprodutor.length > 0) out.push("infoprodutor");
  return out;
}
