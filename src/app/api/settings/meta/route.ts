import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("meta_access_token_last4")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({
    has_token: !!data?.meta_access_token_last4,
    last4: data?.meta_access_token_last4 ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const token = String(body?.meta_access_token ?? "").trim();

  if (!token) {
    return NextResponse.json(
      { error: "Token de acesso do Meta é obrigatório" },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {
    meta_access_token: token,
    meta_access_token_last4: token.slice(-4),
  };

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) {
    const msg = error.message || "Failed";
    const isMissingColumn = /column.*does not exist|undefined column/i.test(msg);
    return NextResponse.json(
      {
        error: isMissingColumn
          ? "As colunas do Meta ainda não existem no banco. Execute a migração no Supabase (SQL em supabase/migrations/20250306_ati_meta_and_validated.sql)."
          : msg,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({
      meta_access_token: null,
      meta_access_token_last4: null,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
