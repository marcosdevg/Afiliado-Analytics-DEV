/**
 * Endereço do remetente — usado pra gerar etiquetas de envio dos pedidos Stripe.
 * Todos os campos opcionais, mas o card da UI pede preenchimento mínimo antes
 * de liberar a impressão da etiqueta (nome/CEP/endereço/cidade/UF).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const FIELDS = [
  "shipping_sender_name",
  "shipping_sender_document",
  "shipping_sender_phone",
  "shipping_sender_cep",
  "shipping_sender_street",
  "shipping_sender_number",
  "shipping_sender_complement",
  "shipping_sender_neighborhood",
  "shipping_sender_city",
  "shipping_sender_uf",
] as const;

type Field = (typeof FIELDS)[number];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select(FIELDS.join(", "))
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  const row = (data ?? {}) as unknown as Record<string, string | null>;
  const out: Record<Field, string> = {} as Record<Field, string>;
  for (const f of FIELDS) out[f] = row[f] ?? "";
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const patch: Record<string, string | null> = {};
  for (const f of FIELDS) {
    const v = typeof body?.[f] === "string" ? (body[f] as string).trim() : "";
    patch[f] = v || null;
  }

  // UF sempre 2 letras maiúsculas se informada
  if (patch.shipping_sender_uf) {
    patch.shipping_sender_uf = patch.shipping_sender_uf.toUpperCase().slice(0, 2);
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patch: Record<Field, null> = {} as Record<Field, null>;
  for (const f of FIELDS) patch[f] = null;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
