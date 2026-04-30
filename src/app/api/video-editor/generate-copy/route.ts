/**
 * Gera copy de venda com Grok (xAI) para usar como narração/legenda em vídeo.
 * GET → { copyGenerationsUsedToday, copyGenerationsLimit }
 * POST { productName, style?, videoDuration?, useCoins? } → { copy, ... }
 * — Quota diária por plano; depois cobra Afiliado Coins (5) com useCoins: true.
 */

import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { createClient } from "@/lib/supabase-server";
import { getEntitlementsForUser, getUsageSnapshot } from "@/lib/plan-server";
import {
  AFILIADO_COINS_VIDEO_EDITOR_COPY_COST,
  AFILIADO_COINS_VIDEO_EDITOR_GATE_MIN,
} from "@/lib/afiliado-coins";
import { consumeAfiliadoCoins, refundAfiliadoCoins } from "@/lib/afiliado-coins-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROK_API = "https://api.x.ai/v1/chat/completions";
const MODEL = "grok-4.20-beta-latest-non-reasoning";

function utcTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const supabase = await createClient();
    const ent = await getEntitlementsForUser(supabase, gate.userId);
    const rawCopyLimit = ent.videoEditorCopyPerDay;
    const copyDailyLimit =
      typeof rawCopyLimit === "number" && Number.isFinite(rawCopyLimit) ? rawCopyLimit : 2;
    const today = utcTodayString();
    const { count, error } = await supabase
      .from("video_editor_copy_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", gate.userId)
      .eq("usage_day", today);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      copyGenerationsUsedToday: count ?? 0,
      copyGenerationsLimit: copyDailyLimit,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao consultar limite" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const supabase = await createClient();
    const ent = await getEntitlementsForUser(supabase, gate.userId);
    const usage = await getUsageSnapshot(supabase, gate.userId);
    if (ent.videoExportsPerDay !== null && usage.videoExportsToday >= ent.videoExportsPerDay) {
      if (usage.afiliadoCoins < AFILIADO_COINS_VIDEO_EDITOR_GATE_MIN) {
        return NextResponse.json(
          {
            error: `Limite diário de ${ent.videoExportsPerDay} vídeo(s) exportado(s) atingido. Precisa de pelo menos ${AFILIADO_COINS_VIDEO_EDITOR_GATE_MIN} Afiliado Coins para usar copy/voz/export fora da quota.`,
            videoLimitReached: true,
          },
          { status: 403 },
        );
      }
    }

    const rawCopyLimitPost = ent.videoEditorCopyPerDay;
    const copyDailyLimit =
      typeof rawCopyLimitPost === "number" && Number.isFinite(rawCopyLimitPost)
        ? rawCopyLimitPost
        : 2;
    const today = utcTodayString();
    const { count: usedCount, error: countErr } = await supabase
      .from("video_editor_copy_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", gate.userId)
      .eq("usage_day", today);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const n = usedCount ?? 0;
    const body = await req.json().catch(() => ({}));
    const useCoins = body?.useCoins === true;

    if (n >= copyDailyLimit) {
      if (!useCoins) {
        return NextResponse.json(
          {
            error: `Limite diário atingido: ${copyDailyLimit} gerações de copy com IA por dia. Volte amanhã ou use Afiliado Coins (${AFILIADO_COINS_VIDEO_EDITOR_COPY_COST}).`,
            limitReached: true,
            copyGenerationsUsedToday: n,
            copyGenerationsLimit: copyDailyLimit,
          },
          { status: 429 },
        );
      }
    }

    let paidWithAfiliadoCoins = false;
    if (n >= copyDailyLimit && useCoins) {
      const spend = await consumeAfiliadoCoins(
        supabase,
        gate.userId,
        AFILIADO_COINS_VIDEO_EDITOR_COPY_COST,
        "video_editor_copy_coins",
      );
      if (!spend.ok) {
        return NextResponse.json(
          {
            error: `Afiliado Coins insuficientes (necessário: ${AFILIADO_COINS_VIDEO_EDITOR_COPY_COST}) para gerar copy fora do limite diário.`,
            limitReached: true,
            copyGenerationsUsedToday: n,
            copyGenerationsLimit: copyDailyLimit,
            code: "INSUFFICIENT_COINS",
          },
          { status: 402 },
        );
      }
      paidWithAfiliadoCoins = true;
    }

    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    if (!apiKey?.trim()) {
      if (paidWithAfiliadoCoins) {
        await refundAfiliadoCoins(
          supabase,
          gate.userId,
          AFILIADO_COINS_VIDEO_EDITOR_COPY_COST,
          "refund_video_editor_copy_coins",
        );
      }
      return NextResponse.json(
        { error: "Chave da API Grok não configurada. Adicione GROK_API_KEY no .env.local" },
        { status: 500 }
      );
    }

    const productName = String(body?.productName ?? "").trim();
    const style = String(body?.style ?? "vendas").trim();
    const videoDuration = Number(body?.videoDuration) || 0;

    if (!productName) {
      if (paidWithAfiliadoCoins) {
        await refundAfiliadoCoins(
          supabase,
          gate.userId,
          AFILIADO_COINS_VIDEO_EDITOR_COPY_COST,
          "refund_video_editor_copy_coins",
        );
      }
      return NextResponse.json({ error: "productName é obrigatório" }, { status: 400 });
    }

    const durationSec = Math.round(videoDuration);
    const hasDuration = durationSec > 0;

    const durationGuide = hasDuration
      ? `- O vídeo tem ${durationSec} segundos. A narração DEVE caber em ${durationSec} segundos quando falada em velocidade normal (~2.5 palavras por segundo). Isso significa no máximo ~${Math.round(durationSec * 2.5)} palavras.`
      : `- Linguagem falada, como se fosse uma narração de vídeo curto (30-60s).\n- Máximo 200 palavras.`;

    const systemPrompt = `Você é um copywriter expert em e-commerce e vídeos de venda para redes sociais. Gere uma narração/copy em português do Brasil.
Regras:
- Tom direto, urgência, escassez e benefícios do produto.
- Frases curtas e impactantes para manter a atenção.
${durationGuide}
- NÃO inclua preço nem link.
- Responda APENAS com o texto da narração, sem títulos ou explicações extras.`;

    const durationLabel = hasDuration ? ` de ${durationSec} segundos` : " curto";
    const userPrompt = style === "humor"
      ? `Gere uma narração engraçada e viral para vídeo${durationLabel} de venda deste produto: "${productName}".`
      : style === "urgencia"
        ? `Gere uma narração com muita urgência e escassez para vídeo${durationLabel} de venda deste produto: "${productName}".`
        : `Gere uma narração de venda persuasiva para vídeo${durationLabel} deste produto: "${productName}".`;

    const res = await fetch(GROK_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (paidWithAfiliadoCoins) {
        await refundAfiliadoCoins(
          supabase,
          gate.userId,
          AFILIADO_COINS_VIDEO_EDITOR_COPY_COST,
          "refund_video_editor_copy_coins",
        );
      }
      return NextResponse.json(
        { error: `Grok ${res.status}: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const copy = json?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!copy) {
      if (paidWithAfiliadoCoins) {
        await refundAfiliadoCoins(
          supabase,
          gate.userId,
          AFILIADO_COINS_VIDEO_EDITOR_COPY_COST,
          "refund_video_editor_copy_coins",
        );
      }
      return NextResponse.json({ error: "Resposta vazia do Grok" }, { status: 502 });
    }

    if (!paidWithAfiliadoCoins) {
      const { error: insErr } = await supabase.from("video_editor_copy_usage").insert({
        user_id: gate.userId,
        usage_day: today,
      });
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      copy,
      copyGenerationsUsedToday: paidWithAfiliadoCoins ? n : n + 1,
      copyGenerationsLimit: copyDailyLimit,
      paidWithAfiliadoCoins,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar copy" },
      { status: 500 }
    );
  }
}
