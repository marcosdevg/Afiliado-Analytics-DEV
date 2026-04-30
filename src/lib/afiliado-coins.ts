/** Custos e packs Afiliado Coins (Gerador de Especialista + Kiwify). */

export const AFILIADO_COINS_IMAGE_COST = 30;
export const AFILIADO_COINS_VIDEO_COST = 70;
/** Gerador de Criativos (video-editor): após quotas grátis diárias, custos em Afiliado Coins. */
export const AFILIADO_COINS_VIDEO_EDITOR_COPY_COST = 5;
export const AFILIADO_COINS_VIDEO_EDITOR_VOICE_FULL_COST = 15;
export const AFILIADO_COINS_VIDEO_EDITOR_EXPORT_COST = 30;
/** Mínimo de saldo para APIs do editor quando o limite diário de exports já foi atingido (permite ao menos copy paga). */
export const AFILIADO_COINS_VIDEO_EDITOR_GATE_MIN = AFILIADO_COINS_VIDEO_EDITOR_COPY_COST;

/** Saldo vindo do Supabase/JSON (às vezes string); evita `typeof !== "number"` e bloqueio errado na UI. */
export function normalizeAfiliadoCoins(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const n = Number(value.trim().replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.trunc(n));
  }
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
  }
  return null;
}
/** Crédito mensal automático — Pro (calendário UTC, ver RPC `ensure_afiliado_monthly_pro_coins`). */
export const AFILIADO_COINS_MONTHLY_PRO = 100;
/** Staff recebe este valor por mês UTC na mesma função SQL. */
export const AFILIADO_COINS_MONTHLY_STAFF = 1000;

export type AfiliadoCoinsPack = {
  coins: number;
  checkoutUrl: string;
  priceLabel: string;
};

export const AFILIADO_COINS_PACKS: AfiliadoCoinsPack[] = [
  { coins: 100, checkoutUrl: "https://pay.kiwify.com.br/bkPvMEa", priceLabel: "R$ 12" },
  { coins: 300, checkoutUrl: "https://pay.kiwify.com.br/xRCi6UB", priceLabel: "R$ 36" },
  { coins: 800, checkoutUrl: "https://pay.kiwify.com.br/zUjcXsG", priceLabel: "R$ 96" },
  { coins: 1500, checkoutUrl: "https://pay.kiwify.com.br/d8VevfX", priceLabel: "R$ 180" },
  { coins: 3500, checkoutUrl: "https://pay.kiwify.com.br/pLNfiLh", priceLabel: "R$ 400" },
  { coins: 10000, checkoutUrl: "https://pay.kiwify.com.br/q6sCIdX", priceLabel: "R$ 999" },
];
