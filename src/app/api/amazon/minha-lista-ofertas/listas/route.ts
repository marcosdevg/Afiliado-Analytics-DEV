import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateAmazon } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const userId = gate.userId;
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from("listas_ofertas_amazon")
      .select("id, nome, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type ListaRow = { id: string; nome: string; createdAt: string };
    const listas: ListaRow[] = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ""),
      nome: String(r.nome ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));

    const { data: counts } = await supabase
      .from("minha_lista_ofertas_amazon")
      .select("lista_id");
    const countByLista: Record<string, number> = {};
    (counts ?? []).forEach((c: { lista_id: string }) => {
      countByLista[c.lista_id] = (countByLista[c.lista_id] ?? 0) + 1;
    });

    const data = listas.map((l) => ({
      ...l,
      totalItens: countByLista[l.id] ?? 0,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const userId = gate.userId;
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const nome = String(body?.nome ?? "").trim() || "Nova lista Amazon";

    const { data: row, error } = await supabase
      .from("listas_ofertas_amazon")
      .insert({ user_id: userId, nome })
      .select("id, nome, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data: { id: row.id, nome: row.nome ?? "", createdAt: row.created_at, totalItens: 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const userId = gate.userId;
    const supabase = await createClient();

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id da lista é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("listas_ofertas_amazon")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
