import { NextResponse } from "next/server";
import { gateEspecialistaGenerate } from "@/lib/require-entitlements";
import { veoFetchPredictOperation } from "@/lib/vertex/veo-long-running";
import { createClient } from "../../../../../utils/supabase/server";
import { refundAfiliadoCoins } from "@/lib/afiliado-coins-server";
import { AFILIADO_COINS_VIDEO_COST } from "@/lib/afiliado-coins";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 60;

function hasUsableVideo(
  videos:
    | { bytesBase64Encoded?: string; gcsUri?: string; mimeType?: string }[]
    | undefined,
): boolean {
  const v = videos?.[0];
  return Boolean(v && (v.bytesBase64Encoded || v.gcsUri));
}

async function settleVeoCoinHold(
  supabase: SupabaseClient,
  userId: string,
  operationName: string,
  outcome: "completed" | "refund",
): Promise<void> {
  if (outcome === "completed") {
    await supabase
      .from("expert_veo_coin_holds")
      .update({ status: "completed" })
      .eq("operation_name", operationName)
      .eq("user_id", userId)
      .eq("status", "pending");
    return;
  }

  const { data: rows, error: updErr } = await supabase
    .from("expert_veo_coin_holds")
    .update({ status: "refunded" })
    .eq("operation_name", operationName)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("coins");

  if (updErr || !rows?.length) return;

  const coins =
    typeof rows[0].coins === "number" && rows[0].coins > 0
      ? rows[0].coins
      : AFILIADO_COINS_VIDEO_COST;

  await refundAfiliadoCoins(supabase, userId, coins, "refund_expert_video_veo_poll_failed");
}

export async function POST(req: Request) {
  const gate = await gateEspecialistaGenerate();
  if (!gate.allowed) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const op =
    body && typeof body === "object" && typeof (body as { operationName?: string }).operationName === "string"
      ? (body as { operationName: string }).operationName.trim()
      : "";

  if (!op || !op.includes("/operations/")) {
    return NextResponse.json({ error: "operationName inválido" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const result = await veoFetchPredictOperation(op);

    if (result.done) {
      const okVideo = hasUsableVideo(result.videos);
      const apiErr = Boolean(result.error?.message);
      if (okVideo && !apiErr) {
        await settleVeoCoinHold(supabase, gate.userId, op, "completed");
      } else {
        await settleVeoCoinHold(supabase, gate.userId, op, "refund");
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao consultar operação Veo";
    console.error("expert-generator/veo-poll", e);
    await settleVeoCoinHold(supabase, gate.userId, op, "refund");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
