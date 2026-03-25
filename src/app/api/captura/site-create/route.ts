import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { getEntitlementsForUser, getUsageSnapshot } from "@/lib/plan-server";

export const dynamic = "force-dynamic";

/** 23505 em UNIQUE(userid): legado "1 site por conta" — não confundir com slug duplicado. */
function isUniqueViolationOnUserId(error: { message?: string; details?: string }): boolean {
  const blob = `${error.message ?? ""} ${error.details ?? ""}`;
  const lower = blob.toLowerCase();
  if (/\(\s*userid\s*\)\s*=/i.test(blob) || /\(\s*user_id\s*\)\s*=/i.test(blob)) return true;
  if (lower.includes("userid_key") || lower.includes("user_id_key")) return true;
  return false;
}

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

  const { user_id: _ignore, userid: _ignore2, ...rest } = body as Record<string, unknown>;
  const { data, error } = await supabase
    .from("capture_sites")
    .insert({ ...rest, userid: user.id })
    .select()
    .single();

  if (error) {
    const dup = "code" in error && error.code === "23505";
    if (dup && isUniqueViolationOnUserId(error)) {
      return NextResponse.json(
        {
          error:
            "O banco ainda só permite um site de captura por conta (regra antiga em userid). " +
            "Execute no Supabase (SQL Editor) a migration `20250325_capture_sites_multiple_per_user.sql` deste projeto, " +
            "ou remova manualmente a constraint UNIQUE em userid e garanta UNIQUE(domain, slug).",
          code: "capture_sites_userid_unique_legacy",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: dup
          ? "Esse slug já existe neste domínio (link público único em toda a plataforma). Outro usuário pode estar usando, ou você já tem outro site com esse slug. Escolha outro."
          : error.message,
      },
      { status: dup ? 409 : 500 }
    );
  }
  return NextResponse.json(data);
}
