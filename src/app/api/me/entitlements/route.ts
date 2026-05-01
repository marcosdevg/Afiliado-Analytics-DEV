import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import {
  getActiveSubscriptionBillingQuarterlyForUser,
  getPlanTierForUser,
  getUsageSnapshot,
  reconcileCaptureSitesForPlan,
} from "@/lib/plan-server";
import { getEntitlementsForTier } from "@/lib/plan-entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tier = await getPlanTierForUser(supabase, user.id);
  const entitlements = getEntitlementsForTier(tier);
  await reconcileCaptureSitesForPlan(supabase, user.id);
  const usage = await getUsageSnapshot(supabase, user.id);
  const billingQuarterly =
    await getActiveSubscriptionBillingQuarterlyForUser(supabase, user.id);

  return NextResponse.json({ tier, entitlements, usage, billingQuarterly });
}
