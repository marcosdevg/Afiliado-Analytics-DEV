import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("shopee_app_id, shopee_api_key_last4")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({
    shopee_app_id: data?.shopee_app_id ?? "",
    has_key: !!data?.shopee_api_key_last4,
    last4: data?.shopee_api_key_last4 ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const shopee_app_id = String(body?.shopee_app_id ?? "").trim();
  const shopee_api_key = String(body?.shopee_api_key ?? "").trim();

  if (!shopee_app_id) {
    return NextResponse.json({ error: "Shopee App ID é obrigatório" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { shopee_app_id };

  if (shopee_api_key) {
    patch.shopee_api_key = shopee_api_key;
    patch.shopee_api_key_last4 = shopee_api_key.slice(-4);
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// ← NOVO: limpa toda a integração Shopee
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({
      shopee_app_id: null,
      shopee_api_key: null,
      shopee_api_key_last4: null,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
