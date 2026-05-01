/**
 * Catálogo de IDs/checkout_links Kiwify → tier de plano.
 *
 * Os CHECKOUT LINKS são os códigos curtos que vêm no campo `checkout_link`
 * do payload do webhook Kiwify (ex.: "Q1eE7t8").
 *
 * Tiers ativos: pro > padrao > inicial. (legacy/staff/trial não vêm via Kiwify.)
 *
 * Mapeamento histórico: os slugs do antigo "padrao" hoje correspondem ao
 * "inicial" (mesmas features). Eles continuam ativos por contas existentes.
 *
 * Para adicionar novos planos: incluir os IDs/links nos arrays abaixo.
 */

import type { PlanTier } from "./plan-entitlements";

// ── Checkout links Kiwify ─────────────────────────────────────────────────────

// INICIAL (R$ 47,90/mês) — novos slugs do plano de entrada
const INICIAL_CHECKOUT_LINKS_PRINCIPAL = ["k3DTSRU", "2Q1D0ob"];
const INICIAL_CHECKOUT_LINKS_SECUNDARIO = ["AsmPxQv", "JlH396G"];

// INICIAL — slugs históricos (antigo "padrao"). Mantidos ativos: contas existentes
// vão revalidar via webhook e continuam no nível de features que pagaram.
const LEGACY_PADRAO_CHECKOUT_LINKS_PRINCIPAL = ["Q1eE7t8", "jGMeK6e"];
const LEGACY_PADRAO_CHECKOUT_LINKS_SECUNDARIO = ["M2qUkd9", "HijcSN1"];

// PADRÃO (R$ 127,90/mês) — novo plano intermediário
const PADRAO_CHECKOUT_LINKS_PRINCIPAL = ["DzMLl6Q", "bh2PrXd"];
const PADRAO_CHECKOUT_LINKS_SECUNDARIO = ["hzhlBau", "6dNguFg"];

// PRO (R$ 197,90/mês)
const PRO_CHECKOUT_LINKS_PRINCIPAL = [
  "4fAAtkD",
  "TndnsLB",
  "y7I4SuT",
  "y7QHrMp",
];
const PRO_CHECKOUT_LINKS_SECUNDARIO = [
  "0mRaPls",
  "xaX0Ryx",
  "Kqrzgpp",
  "tdDRvEF",
];

const ALL_INICIAL_CHECKOUT_LINKS = new Set([
  ...INICIAL_CHECKOUT_LINKS_PRINCIPAL,
  ...INICIAL_CHECKOUT_LINKS_SECUNDARIO,
  ...LEGACY_PADRAO_CHECKOUT_LINKS_PRINCIPAL,
  ...LEGACY_PADRAO_CHECKOUT_LINKS_SECUNDARIO,
]);

const ALL_PADRAO_CHECKOUT_LINKS = new Set([
  ...PADRAO_CHECKOUT_LINKS_PRINCIPAL,
  ...PADRAO_CHECKOUT_LINKS_SECUNDARIO,
]);

const ALL_PRO_CHECKOUT_LINKS = new Set([
  ...PRO_CHECKOUT_LINKS_PRINCIPAL,
  ...PRO_CHECKOUT_LINKS_SECUNDARIO,
]);

/** Slugs Kiwify do checkout trimestral (par a par com o mensal no catálogo). */
const KIWIFY_TRIMESTRAL_CHECKOUT_SLUGS = new Set<string>([
  ...INICIAL_CHECKOUT_LINKS_PRINCIPAL.slice(1, 2),
  ...INICIAL_CHECKOUT_LINKS_SECUNDARIO.slice(1, 2),
  ...LEGACY_PADRAO_CHECKOUT_LINKS_PRINCIPAL.slice(1, 2),
  ...LEGACY_PADRAO_CHECKOUT_LINKS_SECUNDARIO.slice(1, 2),
  ...PADRAO_CHECKOUT_LINKS_PRINCIPAL.slice(1, 2),
  ...PADRAO_CHECKOUT_LINKS_SECUNDARIO.slice(1, 2),
  ...PRO_CHECKOUT_LINKS_PRINCIPAL.filter((_, i) => i % 2 === 1),
  ...PRO_CHECKOUT_LINKS_SECUNDARIO.filter((_, i) => i % 2 === 1),
]);

// ── Plan IDs / Product IDs legados (existentes nas subscriptions atuais) ──────
// Esses eram emitidos quando o tier de entrada se chamava "padrao"; hoje
// correspondem ao "inicial" (mesmas features).
const LEGACY_PLAN_IDS = new Set([
  "cd0e2638-5fee-4bc4-bf69-50d4a262c645",
  "7291b77e-33b2-41f6-9c71-f8f06f5c8d81",
  "bc04f1cf-a966-46b4-b3f8-3e00cdfe9d57",
  "b91aef1b-9e46-41cf-a2b7-ebe4e6e16c44",
  "a5d39f63-2a56-458b-82e3-97e5b5b5b4b2",
  "13296838-3e47-47fa-aab7-c7f99949cd27",
]);

const LEGACY_PRODUCT_IDS = new Set([
  "6e7ddf3b-8e9a-4b58-9826-40d0e2a9e99e",
  "da415550-9caf-11f0-8961-f353f012e41a",
]);

// ── Plan IDs dos novos planos (via env vars para flexibilidade) ────────────────
function parseEnvIdSet(key: string): Set<string> {
  const val = process.env[key];
  if (!val) return new Set();
  return new Set(val.split(",").map((s) => s.trim()).filter(Boolean));
}

function getProPlanIds(): Set<string> {
  return parseEnvIdSet("KIWIFY_PRO_PLAN_IDS");
}

function getPadraoPlanIds(): Set<string> {
  return parseEnvIdSet("KIWIFY_PADRAO_PLAN_IDS");
}

function getInicialPlanIds(): Set<string> {
  return parseEnvIdSet("KIWIFY_INICIAL_PLAN_IDS");
}

// ── Normaliza um ID removendo espaços ─────────────────────────────────────────
function norm(id: string | null | undefined): string {
  return (id ?? "").trim();
}

/**
 * Kiwify pode enviar só o slug (`bkPvMEa`) ou URL (`https://pay.kiwify.com.br/bkPvMEa`).
 */
export function normalizeKiwifyCheckoutSlug(
  raw: string | null | undefined
): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  const noQuery = s.split("?")[0]!.trim();
  s = noQuery;
  try {
    if (s.includes("kiwify.com") || /^https?:\/\//i.test(s)) {
      const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
      const u = new URL(href);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      return (last ?? "").trim();
    }
  } catch {
    /* slug solto */
  }
  return s;
}

/**
 * Resolve o tier a partir do checkout_link do webhook.
 * Retorna null se o checkout_link não for reconhecido.
 */
/**
 * Se o slug for de um checkout conhecido: true = trimestral, false = mensal.
 * Slug desconhecido → null (não travar CTAs por período).
 */
export function subscriptionBillingIsQuarterlyFromCheckoutSlug(
  checkoutLink: string | null | undefined
): boolean | null {
  const cl = normalizeKiwifyCheckoutSlug(checkoutLink);
  if (!cl) return null;
  if (KIWIFY_TRIMESTRAL_CHECKOUT_SLUGS.has(cl)) return true;
  if (
    ALL_INICIAL_CHECKOUT_LINKS.has(cl) ||
    ALL_PADRAO_CHECKOUT_LINKS.has(cl) ||
    ALL_PRO_CHECKOUT_LINKS.has(cl)
  ) {
    return false;
  }
  return null;
}

export function resolveTierFromCheckoutLink(
  checkoutLink: string | null | undefined
): PlanTier | null {
  const cl = normalizeKiwifyCheckoutSlug(checkoutLink);
  if (!cl) return null;
  if (ALL_PRO_CHECKOUT_LINKS.has(cl)) return "pro";
  if (ALL_PADRAO_CHECKOUT_LINKS.has(cl)) return "padrao";
  if (ALL_INICIAL_CHECKOUT_LINKS.has(cl)) return "inicial";
  return null;
}

/**
 * Resolve o tier a partir dos IDs do plano/produto Kiwify.
 * Usa checkout_link como primeira prioridade, depois plan_id, depois product_id.
 */
export function resolveTierFromKiwifyIds(opts: {
  checkoutLink?: string | null;
  planId?: string | null;
  productId?: string | null;
}): PlanTier {
  // 1) Checkout link tem prioridade máxima
  const fromCheckout = resolveTierFromCheckoutLink(opts.checkoutLink);
  if (fromCheckout) return fromCheckout;

  const pid = norm(opts.planId);
  const prodId = norm(opts.productId);

  // 2) Env-based Pro/Padrao/Inicial plan IDs
  const proPlanIds = getProPlanIds();
  const padraoPlanIds = getPadraoPlanIds();
  const inicialPlanIds = getInicialPlanIds();

  if (pid && proPlanIds.has(pid)) return "pro";
  if (pid && padraoPlanIds.has(pid)) return "padrao";
  if (pid && inicialPlanIds.has(pid)) return "inicial";

  // 3) Legacy plan IDs → inicial (eram emitidos quando o tier de entrada
  //    se chamava "padrao"; hoje correspondem ao "inicial")
  if (pid && LEGACY_PLAN_IDS.has(pid)) return "inicial";

  // 4) Legacy product IDs → inicial
  if (prodId && LEGACY_PRODUCT_IDS.has(prodId)) return "inicial";

  // 5) Default: inicial (entrada)
  return "inicial";
}

/**
 * Dado uma lista de tiers, retorna o mais alto.
 * pro > padrao > inicial > legacy
 */
export function bestPlanTier(tiers: PlanTier[]): PlanTier {
  if (tiers.includes("pro")) return "pro";
  if (tiers.includes("padrao")) return "padrao";
  if (tiers.includes("inicial")) return "inicial";
  if (tiers.includes("legacy")) return "legacy";
  return "inicial";
}

/** Checkout links Kiwify → pacotes Afiliado Coins (campo `checkout_link` do webhook). */
const AFILIADO_COINS_CHECKOUT_LINKS: Record<string, number> = {
  bkPvMEa: 100,
  xRCi6UB: 300,
  zUjcXsG: 800,
  d8VevfX: 1500,
  pLNfiLh: 3500,
  q6sCIdX: 10000,
};

/**
 * Mapa extra via env: `KIWIFY_AFILIADO_COINS_MAP=slug1:100,slug2:300`
 * (útil se criares um checkout novo na Kiwify com slug diferente do catálogo).
 */
function parseEnvAfiliadoCoinsMap(): Record<string, number> {
  const raw = process.env.KIWIFY_AFILIADO_COINS_MAP?.trim();
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const n = parseInt(part.slice(idx + 1).trim(), 10);
    if (k && Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

/** Quantidade de coins do pack, ou 0 se não for compra de coins. */
export function resolveAfiliadoCoinsFromKiwifyCheckout(
  checkoutLink: string | null | undefined
): number {
  const k = normalizeKiwifyCheckoutSlug(checkoutLink);
  if (!k) return 0;
  const envMap = parseEnvAfiliadoCoinsMap();
  if (envMap[k] !== undefined) return envMap[k]!;
  return AFILIADO_COINS_CHECKOUT_LINKS[k] ?? 0;
}

/** Produto Kiwify "Afiliado Coins" (packs). */
const AFILIADO_COINS_KIWIFY_PRODUCT_IDS = new Set([
  "e62fb0f0-2d1e-11f1-b936-eb83c4eeb33b",
]);

function parseEnvAfiliadoCoinsProductIds(): Set<string> {
  const raw = process.env.KIWIFY_AFILIADO_COINS_PRODUCT_IDS?.trim();
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

/**
 * Linha em `subscriptions` que é só compra de coins — não deve alterar plan_tier no recálculo.
 */
export function isAfiliadoCoinsKiwifySubscriptionRow(row: {
  checkout_url?: string | null;
  product_id?: string | null;
}): boolean {
  if (resolveAfiliadoCoinsFromKiwifyCheckout(row.checkout_url) > 0) return true;
  const pid = norm(row.product_id);
  if (!pid) return false;
  if (AFILIADO_COINS_KIWIFY_PRODUCT_IDS.has(pid)) return true;
  return parseEnvAfiliadoCoinsProductIds().has(pid);
}
