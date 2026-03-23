import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";
import { getEntitlementsForUser, getUsageSnapshot } from "@/lib/plan-server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("evolution_instances")
    .select("id, nome_instancia, numero_whatsapp, hash, get_participants, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instances: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ent = await getEntitlementsForUser(supabase, user.id);
  const usage = await getUsageSnapshot(supabase, user.id);
  if (usage.evolutionInstances >= ent.evolutionInstances) {
    return NextResponse.json(
      { error: `Limite de ${ent.evolutionInstances} instância(s) atingido. Faça upgrade para conectar mais.` },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const nome_instancia = typeof body.nome_instancia === "string" ? body.nome_instancia.trim() : "";
  const numero_whatsapp = typeof body.numero_whatsapp === "string" ? body.numero_whatsapp.replace(/\D/g, "") : "";
  const hash = typeof body.hash === "string" ? body.hash.trim() : null;
  const get_participants = body.get_participants === true || body.get_participants === "true";

  if (!nome_instancia) {
    return NextResponse.json({ error: "Nome da instância é obrigatório." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("evolution_instances")
    .insert({
      user_id: user.id,
      nome_instancia,
      numero_whatsapp: numero_whatsapp || null,
      hash: hash || null,
      get_participants,
      updated_at: new Date().toISOString(),
    })
    .select("id, nome_instancia, numero_whatsapp, hash, get_participants, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Já existe uma instância com esse nome." }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.nome_instancia === "string") updates.nome_instancia = body.nome_instancia.trim();
  if (typeof body.numero_whatsapp === "string") updates.numero_whatsapp = body.numero_whatsapp.replace(/\D/g, "") || null;
  if (typeof body.hash === "string") updates.hash = body.hash.trim() || null;
  if (typeof body.get_participants === "boolean") updates.get_participants = body.get_participants;
  if (body.get_participants === "true") updates.get_participants = true;
  if (body.get_participants === "false") updates.get_participants = false;

  const { data, error } = await supabase
    .from("evolution_instances")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, nome_instancia, numero_whatsapp, hash, get_participants, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || (await req.json().catch(() => ({})))?.id;
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const { error } = await supabase
    .from("evolution_instances")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
