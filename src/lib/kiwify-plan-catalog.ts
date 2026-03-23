/**
 * Catálogo de IDs/checkout_links Kiwify → tier de plano.
 *
 * Os CHECKOUT LINKS são os códigos curtos que vêm no campo `checkout_link`
 * do payload do webhook Kiwify (ex.: "Q1eE7t8").
 *
 * Para adicionar novos planos: basta incluir os IDs/links nos arrays abaixo.
 */

import type { PlanTier } from "./plan-entitlements";

// ── Checkout links Kiwify ─────────────────────────────────────────────────────
// Produto Principal
const PADRAO_CHECKOUT_LINKS_PRINCIPAL = ["Q1eE7t8", "jGMeK6e"];
const PRO_CHECKOUT_LINKS_PRINCIPAL = ["4fAAtkD", "TndnsLB"];
// Produto Secundário
const PADRAO_CHECKOUT_LINKS_SECUNDARIO = ["M2qUkd9", "HijcSN1"];
const PRO_CHECKOUT_LINKS_SECUNDARIO = ["0mRaPls", "xaX0Ryx"];

const ALL_PADRAO_CHECKOUT_LINKS = new Set([
  ...PADRAO_CHECKOUT_LINKS_PRINCIPAL,
  ...PADRAO_CHECKOUT_LINKS_SECUNDARIO,
]);

const ALL_PRO_CHECKOUT_LINKS = new Set([
  ...PRO_CHECKOUT_LINKS_PRINCIPAL,
  ...PRO_CHECKOUT_LINKS_SECUNDARIO,
]);

// ── Plan IDs / Product IDs legados (existentes nas subscriptions atuais) ──────
// Esses eram usados antes dos novos planos; tratamos todos como "padrao"
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

// ── Normaliza um ID removendo espaços ─────────────────────────────────────────
function norm(id: string | null | undefined): string {
  return (id ?? "").trim();
}

/**
 * Resolve o tier a partir do checkout_link do webhook.
 * Retorna null se o checkout_link não for reconhecido.
 */
export function resolveTierFromCheckoutLink(
  checkoutLink: string | null | undefined
): PlanTier | null {
  const cl = norm(checkoutLink);
  if (!cl) return null;
  if (ALL_PRO_CHECKOUT_LINKS.has(cl)) return "pro";
  if (ALL_PADRAO_CHECKOUT_LINKS.has(cl)) return "padrao";
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

  // 2) Env-based Pro/Padrao plan IDs
  const proPlanIds = getProPlanIds();
  const padraoPlanIds = getPadraoPlanIds();

  if (pid && proPlanIds.has(pid)) return "pro";
  if (pid && padraoPlanIds.has(pid)) return "padrao";

  // 3) Legacy plan IDs → padrao
  if (pid && LEGACY_PLAN_IDS.has(pid)) return "padrao";

  // 4) Legacy product IDs → padrao
  if (prodId && LEGACY_PRODUCT_IDS.has(prodId)) return "padrao";

  // 5) Default: padrao (nunca "legacy" para novos)
  return "padrao";
}

/**
 * Dado uma lista de tiers, retorna o mais alto.
 * pro > padrao > legacy
 */
export function bestPlanTier(tiers: PlanTier[]): PlanTier {
  if (tiers.includes("pro")) return "pro";
  if (tiers.includes("padrao")) return "padrao";
  return "padrao";
}
