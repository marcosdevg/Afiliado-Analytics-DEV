import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { getEntitlementsForUser, getUsageSnapshot } from "@/lib/plan-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ent = await getEntitlementsForUser(supabase, user.id);
  const usage = await getUsageSnapshot(supabase, user.id);

  if (usage.captureSites >= ent.captureLinks) {
    return NextResponse.json(
      { error: `Limite de ${ent.captureLinks} site(s) de captura atingido. Faça upgrade para criar mais.` },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const { data, error } = await supabase
    .from("capture_sites")
    .insert({ ...body, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
