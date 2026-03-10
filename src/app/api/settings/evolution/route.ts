import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("evolution_n8n_webhook_url")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Erro ao carregar" }, { status: 500 });

  const url = (data?.evolution_n8n_webhook_url ?? "").trim();
  return NextResponse.json({
    evolution_n8n_webhook_url: url,
    has_webhook: !!url,
  });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = typeof body.evolution_n8n_webhook_url === "string" ? body.evolution_n8n_webhook_url.trim() : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      evolution_n8n_webhook_url: url || null,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
