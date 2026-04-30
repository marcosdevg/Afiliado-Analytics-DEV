/**
 * Check leve para o n8n decidir se vale a pena chamar /pipeline.
 * Não recebe base64 — apenas instance + grupo origem. Responde { active: boolean }.
 *
 * Authorization: Bearer ESPELHAMENTO_N8N_SECRET (mesmo segredo do pipeline).
 *
 * GET  ?instance=<nome>&grupo=<jid>[&userId=<uuid>]
 * POST { "instanceName": "...", "grupoOrigemJid": "...", "userId": "..." }
 *
 * Semântica de `active`:
 *  - true  → existe config de espelhamento ATIVA para (instance, grupo) do usuário.
 *  - false → não existe. O n8n deve descartar sem chamar /pipeline.
 *
 * Em caso de ambiguidade (mesmo nome_instancia em múltiplos usuários sem userId),
 * retorna active=true para não bloquear indevidamente — o /pipeline fará o resolve final.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeGroupJid } from "@/lib/espelhamento-limits";

export const dynamic = "force-dynamic";

function verifyN8nSecret(req: NextRequest): boolean {
  const expected = (process.env.ESPELHAMENTO_N8N_SECRET ?? "").trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
  }
  return createClient(url, key);
}

async function resolve(
  instanceName: string,
  grupoOrigemJidRaw: string,
  userIdFilter: string,
  apikeyFilter: string
): Promise<{ active: boolean; reason?: string }> {
  if (!instanceName || !grupoOrigemJidRaw) {
    return { active: false, reason: "missing_params" };
  }

  const supabase = getServiceSupabase();
  const grupoNorm = normalizeGroupJid(grupoOrigemJidRaw);

  let instQuery = supabase
    .from("evolution_instances")
    .select("id, user_id")
    .eq("nome_instancia", instanceName);
  if (apikeyFilter) instQuery = instQuery.eq("hash", apikeyFilter);
  if (userIdFilter) instQuery = instQuery.eq("user_id", userIdFilter);
  const { data: instList, error: instErr } = await instQuery;
  if (instErr) return { active: false, reason: "instance_query_error" };
  if (!instList?.length) return { active: false, reason: "instance_not_found" };

  if (instList.length > 1 && !userIdFilter && !apikeyFilter) {
    return { active: true, reason: "ambiguous_instance" };
  }

  const inst = instList[0] as { id: string; user_id: string };

  const { data: configs, error: cfgErr } = await supabase
    .from("espelhamento_config")
    .select("grupo_origem_jid")
    .eq("user_id", inst.user_id)
    .eq("instance_id", inst.id)
    .eq("ativo", true);
  if (cfgErr) return { active: false, reason: "config_query_error" };

  const hasMatch = (configs ?? []).some(
    (c: { grupo_origem_jid: string }) => normalizeGroupJid(c.grupo_origem_jid) === grupoNorm
  );
  return { active: hasMatch, reason: hasMatch ? undefined : "no_active_config_for_group" };
}

export async function GET(req: NextRequest) {
  if (!verifyN8nSecret(req)) {
    return NextResponse.json({ active: false, reason: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const instanceName = (url.searchParams.get("instance") ?? "").trim();
  const grupoOrigemJid = (url.searchParams.get("grupo") ?? "").trim();
  const userIdFilter = (url.searchParams.get("userId") ?? "").trim();
  const apikeyFilter = (url.searchParams.get("apikey") ?? "").trim();
  try {
    const result = await resolve(instanceName, grupoOrigemJid, userIdFilter, apikeyFilter);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ active: false, reason: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyN8nSecret(req)) {
    return NextResponse.json({ active: false, reason: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const instanceName = typeof body.instanceName === "string" ? body.instanceName.trim() : "";
    const grupoOrigemJid = typeof body.grupoOrigemJid === "string" ? body.grupoOrigemJid.trim() : "";
    const userIdFilter = typeof body.userId === "string" ? body.userId.trim() : "";
    const apikeyFilter = typeof body.apikey === "string" ? body.apikey.trim() : "";
    const result = await resolve(instanceName, grupoOrigemJid, userIdFilter, apikeyFilter);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ active: false, reason: msg }, { status: 500 });
  }
}
