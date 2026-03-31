/**
 * Pipeline chamado pelo n8n (Evolution → processar texto → webhook disparo WhatsApp).
 * Authorization: Bearer ESPELHAMENTO_N8N_SECRET
 *
 * Body JSON:
 * - instanceName (obrigatório)
 * - grupoOrigemJid (obrigatório)
 * - textoBruto (obrigatório)
 * - idMensagem (opcional)
 * - userId (opcional, se houver mais de uma instância com o mesmo nome_instancia)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeGroupJid } from "@/lib/espelhamento-limits";
import { extractShopeeUrlsFromText, replaceShopeeUrlsWithAffiliateLinks } from "@/lib/espelhamento-shopee";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Webhook n8n só para disparo WhatsApp do espelhamento (Grupos de Venda usa outro URL). Sobrescreva com ESPELHAMENTO_N8N_WEBHOOK_URL se precisar. */
const DEFAULT_ESPELHAMENTO_DISPARO_WEBHOOK =
  "https://n8n.codenxtdesenvolvimento.online/webhook/Disparo-de-espelhamento";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
  }
  return createClient(url, key);
}

function verifyN8nSecret(req: NextRequest): boolean {
  const expected = (process.env.ESPELHAMENTO_N8N_SECRET ?? "").trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyN8nSecret(req)) {
      return NextResponse.json({ error: "Não autorizado. Defina ESPELHAMENTO_N8N_SECRET e envie Authorization: Bearer <segredo>." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const instanceName = typeof body.instanceName === "string" ? body.instanceName.trim() : "";
    const grupoOrigemJidRaw = typeof body.grupoOrigemJid === "string" ? body.grupoOrigemJid.trim() : "";
    const textoBruto = typeof body.textoBruto === "string" ? body.textoBruto : "";
    const idMensagem = typeof body.idMensagem === "string" ? body.idMensagem.trim() : null;
    const userIdFilter = typeof body.userId === "string" ? body.userId.trim() : "";
    const imagemBase64Raw =
      typeof body.imagemBase64 === "string"
        ? body.imagemBase64
        : typeof body.base64 === "string"
          ? body.base64
          : typeof body.imageBase64 === "string"
            ? body.imageBase64
            : "";
    const imagemMimeTypeRaw =
      typeof body.imagemMimeType === "string"
        ? body.imagemMimeType
        : typeof body.imageMimeType === "string"
          ? body.imageMimeType
          : "";
    const imagemUrlRaw =
      typeof body.imagem === "string"
        ? body.imagem
        : typeof body.imageUrl === "string"
          ? body.imageUrl
          : typeof body?.imageMessage?.url === "string"
            ? body.imageMessage.url
            : "";

    if (!instanceName || !grupoOrigemJidRaw || !textoBruto) {
      return NextResponse.json(
        { error: "instanceName, grupoOrigemJid e textoBruto são obrigatórios." },
        { status: 400 }
      );
    }

    const grupoOrigemNorm = normalizeGroupJid(grupoOrigemJidRaw);
    const supabase = getServiceSupabase();

    let instQuery = supabase
      .from("evolution_instances")
      .select("id, user_id, nome_instancia, hash")
      .eq("nome_instancia", instanceName);
    if (userIdFilter) instQuery = instQuery.eq("user_id", userIdFilter);
    const { data: instList, error: instErr } = await instQuery;
    if (instErr) return NextResponse.json({ error: instErr.message }, { status: 500 });
    if (!instList?.length) {
      return NextResponse.json({ action: "skip", reason: "instance_not_found" }, { status: 200 });
    }
    if (instList.length > 1 && !userIdFilter) {
      return NextResponse.json(
        {
          error: "Ambíguo: mais de uma instância com este nome. Envie userId no body.",
          count: instList.length,
        },
        { status: 400 }
      );
    }

    const inst = instList[0] as { id: string; user_id: string; nome_instancia: string; hash: string | null };
    const userId = inst.user_id;

    const { data: configs, error: cfgErr } = await supabase
      .from("espelhamento_config")
      .select(
        "id, grupo_origem_jid, grupo_destino_jid, sub_id_1, sub_id_2, sub_id_3, ativo"
      )
      .eq("user_id", userId)
      .eq("instance_id", inst.id)
      .eq("ativo", true);

    if (cfgErr) return NextResponse.json({ error: cfgErr.message }, { status: 500 });

    const config = (configs ?? []).find(
      (c: { grupo_origem_jid: string }) => normalizeGroupJid(c.grupo_origem_jid) === grupoOrigemNorm
    ) as
      | {
          id: string;
          grupo_destino_jid: string;
          sub_id_1: string;
          sub_id_2: string;
          sub_id_3: string;
        }
      | undefined;

    const now = new Date().toISOString();

    const insertPayload = async (partial: Record<string, unknown>) => {
      await supabase.from("espelhamento_payloads").insert({
        user_id: userId,
        updated_at: now,
        ...partial,
      });
    };

    if (!config) {
      await insertPayload({
        config_id: null,
        id_mensagem_externa: idMensagem,
        instancia_nome: instanceName,
        grupo_origem_jid: grupoOrigemNorm,
        texto_entrada: textoBruto,
        status: "ignorado",
        erro_detalhe: "no_active_config_for_group",
      });
      return NextResponse.json({ action: "skip", reason: "no_active_config_for_group" }, { status: 200 });
    }

    const urls = extractShopeeUrlsFromText(textoBruto);
    if (urls.length === 0) {
      await insertPayload({
        config_id: config.id,
        id_mensagem_externa: idMensagem,
        instancia_nome: instanceName,
        grupo_origem_jid: grupoOrigemNorm,
        texto_entrada: textoBruto,
        status: "ignorado",
        erro_detalhe: "no_shopee_links",
      });
      return NextResponse.json({ action: "skip", reason: "no_shopee_links" }, { status: 200 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("shopee_app_id, shopee_api_key")
      .eq("id", userId)
      .maybeSingle();
    const appId = profile?.shopee_app_id?.trim();
    const secret = profile?.shopee_api_key?.trim();
    if (!appId || !secret) {
      await insertPayload({
        config_id: config.id,
        id_mensagem_externa: idMensagem,
        instancia_nome: instanceName,
        grupo_origem_jid: grupoOrigemNorm,
        texto_entrada: textoBruto,
        status: "erro",
        erro_detalhe: "shopee_not_configured",
      });
      return NextResponse.json({ action: "error", reason: "shopee_not_configured" }, { status: 200 });
    }

    const subIds = [config.sub_id_1, config.sub_id_2, config.sub_id_3].filter(Boolean) as string[];
    const replaced = await replaceShopeeUrlsWithAffiliateLinks(textoBruto, appId, secret, subIds);
    if ("error" in replaced) {
      await insertPayload({
        config_id: config.id,
        id_mensagem_externa: idMensagem,
        instancia_nome: instanceName,
        grupo_origem_jid: grupoOrigemNorm,
        texto_entrada: textoBruto,
        status: "erro",
        erro_detalhe: replaced.error.slice(0, 2000),
      });
      return NextResponse.json({ action: "error", reason: "shopee_replace_failed", detail: replaced.error }, { status: 200 });
    }

    const textoSaida = replaced.text;
    const outUrls = extractShopeeUrlsFromText(textoSaida);
    const linkOut = outUrls[0] ?? "";

    const base64Clean = imagemBase64Raw.trim();
    const mimeClean = imagemMimeTypeRaw.trim();
    const imageBase64Only = base64Clean.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
    const imageDataUri =
      imageBase64Only && mimeClean ? `data:${mimeClean};base64,${imageBase64Only}` : "";

    const webhookUrl =
      (process.env.ESPELHAMENTO_N8N_WEBHOOK_URL ?? "").trim() || DEFAULT_ESPELHAMENTO_DISPARO_WEBHOOK;
    const hash = inst.hash ?? "";
    const groupIds = [config.grupo_destino_jid];
    const disparoPayload = {
      instanceName: inst.nome_instancia,
      hash,
      groupIds,
      imagem: imageDataUri || imageBase64Only || imagemUrlRaw.trim(),
      imagemBase64: imageBase64Only || null,
      imagemMimeType: mimeClean || null,
      descricao: textoSaida,
      valor: 0,
      linkAfiliado: linkOut,
      desconto: null,
      precoRiscado: null,
      precoPor: null,
    };

    let webhookOk = false;
    let webhookStatus: number | null = null;
    if (webhookUrl) {
      const whRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(disparoPayload),
      });
      webhookOk = whRes.ok;
      webhookStatus = whRes.status;
      if (!whRes.ok) {
        const t = await whRes.text();
        await insertPayload({
          config_id: config.id,
          id_mensagem_externa: idMensagem,
          instancia_nome: instanceName,
          grupo_origem_jid: grupoOrigemNorm,
          texto_entrada: textoBruto,
          texto_saida: textoSaida,
          status: "erro",
          erro_detalhe: `webhook_${whRes.status}: ${t.slice(0, 500)}`,
        });
        return NextResponse.json(
          {
            action: "error",
            reason: "webhook_failed",
            webhookStatus,
            disparoPayload,
            detail: t.slice(0, 200),
          },
          { status: 200 }
        );
      }
    }

    await insertPayload({
      config_id: config.id,
      id_mensagem_externa: idMensagem,
      instancia_nome: instanceName,
      grupo_origem_jid: grupoOrigemNorm,
      texto_entrada: textoBruto,
      texto_saida: textoSaida,
      status: "enviado",
      erro_detalhe: null,
    });

    return NextResponse.json({
      action: "sent",
      webhookDelivered: webhookOk || !webhookUrl,
      webhookStatus,
      disparoPayload,
      textoSaida,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
