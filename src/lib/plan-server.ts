/**
 * Helpers de plano para o backend (API routes).
 * Usam service-role do Supabase para consultar dados.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEntitlementsForTier,
  type PlanEntitlements,
  type PlanTier,
} from "./plan-entitlements";
import {
  isAfiliadoCoinsKiwifySubscriptionRow,
  resolveTierFromKiwifyIds,
  subscriptionBillingIsQuarterlyFromCheckoutSlug,
} from "./kiwify-plan-catalog";
import { ensureAfiliadoMonthlyProCoins } from "./afiliado-coins-server";
import { normalizeAfiliadoCoins } from "./afiliado-coins";

export type PlanUsageSnapshot = {
  evolutionInstances: number;
  captureSites: number;
  gruposVendaLists: number;
  gruposVendaGroupsTotal: number;
  activeCampaigns: number;
  videoExportsToday: number;
  /** Saldo Afiliado Coins (após crédito mensal Pro/Staff se aplicável). */
  afiliadoCoins: number;
};

export function utcTodayYmd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function tierMatchesProfileSubscription(
  resolved: PlanTier,
  profileTier: PlanTier
): boolean {
  if (resolved === profileTier) return true;
  if (profileTier === "legacy" && resolved === "inicial") return true;
  return false;
}

/** Interpreta `subscriptions.frequency` (payload Kiwify). */
function billingQuarterlyFromFrequency(
  freq: string | null | undefined
): boolean | null {
  const f = (freq ?? "").toLowerCase().trim();
  if (!f) return null;
  if (f.includes("quarter") || f.includes("trim") || f.includes("trimest")) {
    return true;
  }
  if (
    f.includes("month") ||
    f.includes("mensal") ||
    f.includes("mês") ||
    (f.includes("mes") && !f.includes("trimest"))
  ) {
    return false;
  }
  return null;
}

/**
 * Para o plano ativo do perfil: `true` = assinatura trimestral, `false` = mensal,
 * `null` = não deu pra inferir (não trava CTA por período — ex.: slug antigo).
 */
export async function getActiveSubscriptionBillingQuarterlyForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, plan_tier")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.email) return null;
  const tier = profile.plan_tier as PlanTier;
  if (tier === "staff") return null;

  const now = new Date().toISOString();
  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select(
      "checkout_url, status, access_until, plan_id, product_id, frequency, user_id, email"
    )
    .eq("email", profile.email);

  if (error || !subs?.length) return null;

  const planRows = subs.filter(
    (s) =>
      !isAfiliadoCoinsKiwifySubscriptionRow({
        checkout_url: s.checkout_url,
        product_id: s.product_id,
      })
  );

  const validSubs = planRows.filter((s) => {
    const au = s.access_until ? new Date(s.access_until).toISOString() : null;
    const notRefunded = s.status !== "refunded";
    const notExpired = au ? au >= now : false;
    const okStatus =
      s.status === "active" ||
      s.status === "past_due" ||
      s.status === "canceled";
    return notRefunded && notExpired && okStatus;
  });

  const matching = validSubs.filter((s) =>
    tierMatchesProfileSubscription(
      resolveTierFromKiwifyIds({
        checkoutLink: s.checkout_url,
        planId: s.plan_id,
        productId: s.product_id,
      }),
      tier
    )
  );

  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const ta = a.access_until ? new Date(a.access_until).getTime() : 0;
    const tb = b.access_until ? new Date(b.access_until).getTime() : 0;
    return tb - ta;
  });

  const row = matching[0]!;
  const fromFreq = billingQuarterlyFromFrequency(row.frequency);
  if (fromFreq !== null) return fromFreq;

  return subscriptionBillingIsQuarterlyFromCheckoutSlug(row.checkout_url);
}

export async function getPlanTierForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanTier> {
  const { data } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();
  const tier = data?.plan_tier;
  if (
    tier === "pro" ||
    tier === "padrao" ||
    tier === "inicial" ||
    tier === "legacy" ||
    tier === "staff" ||
    tier === "trial"
  ) {
    return tier;
  }
  return "inicial";
}

export async function getEntitlementsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanEntitlements> {
  const tier = await getPlanTierForUser(supabase, userId);
  return getEntitlementsForTier(tier);
}

/**
 * Plano padrão: só 1 site público; mantém o mais antigo ativo e desativa os demais (sem `DELETE`).
 * Pro/Staff: reativa todos os sites para o link público voltar.
 */
export async function reconcileCaptureSitesForPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const ent = await getEntitlementsForUser(supabase, userId);
  const limit = ent.captureLinks;

  const { data: rows, error } = await supabase
    .from("capture_sites")
    .select("id")
    .eq("userid", userId)
    .order("created_at", { ascending: true });

  if (error || !rows?.length) return;

  const now = new Date().toISOString();

  if (limit <= 1) {
    const keepId = rows[0]!.id;
    await Promise.all(
      rows.map((r) =>
        supabase
          .from("capture_sites")
          .update({
            active: r.id === keepId,
            updated_at: now,
          })
          .eq("id", r.id)
          .eq("userid", userId)
      )
    );
  } else {
    await Promise.all(
      rows.map((r) =>
        supabase
          .from("capture_sites")
          .update({ active: true, updated_at: now })
          .eq("id", r.id)
          .eq("userid", userId)
      )
    );
  }
}

export async function getUsageSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanUsageSnapshot> {
  const [
    { count: evoCount },
    { count: captureCount },
    { count: listsCount },
    { count: groupsCount },
    { count: activeCampaignsCount },
    { count: exportsCount },
  ] = await Promise.all([
    supabase
      .from("evolution_instances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("capture_sites")
      .select("id", { count: "exact", head: true })
      .eq("userid", userId),
    supabase
      .from("listas_grupos_venda")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("grupos_venda")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("grupos_venda_continuo")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ativo", true),
    supabase
      .from("video_export_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("export_day", utcTodayYmd()),
  ]);

  let afiliadoCoins = 0;
  try {
    const { error: coinErr } = await ensureAfiliadoMonthlyProCoins(supabase, userId);
    if (coinErr) console.warn("[plan-server] ensureAfiliadoMonthlyProCoins:", coinErr.message);
    const { data: prof } = await supabase
      .from("profiles")
      .select("afiliado_coins")
      .eq("id", userId)
      .maybeSingle();
    const parsed = normalizeAfiliadoCoins(prof?.afiliado_coins);
    afiliadoCoins = parsed !== null ? parsed : 0;
  } catch (e) {
    console.warn("[plan-server] afiliadoCoins snapshot:", e);
  }

  return {
    evolutionInstances: evoCount ?? 0,
    captureSites: captureCount ?? 0,
    gruposVendaLists: listsCount ?? 0,
    gruposVendaGroupsTotal: groupsCount ?? 0,
    activeCampaigns: activeCampaignsCount ?? 0,
    videoExportsToday: exportsCount ?? 0,
    afiliadoCoins,
  };
}

export async function recordVideoExportUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase.from("video_export_usage").insert({
    user_id: userId,
    export_day: utcTodayYmd(),
  });
}
