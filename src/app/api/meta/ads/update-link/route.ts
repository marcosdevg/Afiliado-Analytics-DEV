/**
 * Atualiza o link do anúncio (URL exata enviada pelo cliente — sem injetar utm).
 * POST /api/meta/ads/update-link
 * Body: { ad_id: string, link: string }
 *
 * ad_id no ATI é sempre o "display" (id estável). Se já houve troca de link antes,
 * o anúncio que roda no Meta é uma cópia: resolvemos display → delivering via meta_ad_display_mapping.
 *
 * O Meta não permite mudar o link do criativo in-place:
 * cópia com novo link, ativar, apagar o anúncio que estava entregando, mapear cópia → mesmo display_ad_id.
 * Cruzamento Shopee no ATI é por Sub ID salvo por anúncio (ati_ad_shopee_sub), não por utm_content.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function setLinkInObjectStorySpec(spec: Record<string, unknown>, newLink: string): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  if (out.link_data && typeof out.link_data === "object") {
    (out.link_data as Record<string, unknown>).link = newLink;
  }
  if (out.video_data && typeof out.video_data === "object") {
    const vd = out.video_data as Record<string, unknown>;
    if (vd.call_to_action && typeof vd.call_to_action === "object") {
      const cta = vd.call_to_action as Record<string, unknown>;
      if (!cta.value || typeof cta.value !== "object") cta.value = {};
      (cta.value as Record<string, unknown>).link = newLink;
    }
  }
  return out;
}

function normalizeSpecForCreate(spec: Record<string, unknown>): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  if (out.video_data && typeof out.video_data === "object") {
    const vd = out.video_data as Record<string, unknown>;
    const hasHash = vd.image_hash && String(vd.image_hash).trim();
    const hasUrl = vd.image_url && String(vd.image_url).trim();
    if (hasHash && hasUrl) delete vd.image_url;
    else if (hasUrl && !hasHash) delete vd.image_hash;
    else if (hasHash) delete vd.image_url;
  }
  if (out.link_data && typeof out.link_data === "object") {
    const ld = out.link_data as Record<string, unknown>;
    const hasHash = ld.image_hash && String(ld.image_hash).trim();
    const hasPicture = ld.picture && String(ld.picture).trim();
    if (hasHash && hasPicture) delete ld.picture;
    else if (hasPicture && !hasHash) delete ld.image_hash;
    else if (hasHash) delete ld.picture;
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("meta_access_token")
      .eq("id", user.id)
      .single();

    const token = profile?.meta_access_token?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "Token do Meta não configurado." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const ad_id = body?.ad_id?.trim();
    const link = body?.link?.trim();

    if (!ad_id || !link) {
      return NextResponse.json(
        { error: "ad_id e link são obrigatórios." },
        { status: 400 }
      );
    }

    const displayAdId = ad_id;
    let effectiveAdId = ad_id;
    const { data: mapRow } = await supabase
      .from("meta_ad_display_mapping")
      .select("delivering_ad_id")
      .eq("user_id", user.id)
      .eq("display_ad_id", displayAdId)
      .maybeSingle();
    if (mapRow?.delivering_ad_id) {
      effectiveAdId = String(mapRow.delivering_ad_id);
    }

    const adUrl = `${GRAPH_BASE}/${effectiveAdId}?fields=account_id,creative,adset_id,campaign_id,name&access_token=${encodeURIComponent(token)}`;
    const adRes = await fetch(adUrl);
    const adJson = (await adRes.json()) as {
      account_id?: string;
      creative?: { id: string };
      adset_id?: string;
      campaign_id?: string;
      name?: string;
      error?: { message: string; code?: number };
    };
    if (adJson.error || !adJson.account_id) {
      const err = adJson.error;
      const msg = (err as { error_user_msg?: string })?.error_user_msg || err?.message ?? "Anúncio não encontrado ou sem permissão.";
      return NextResponse.json(
        { error: msg, step: "buscar_anuncio", meta_error: err },
        { status: adRes.ok ? 400 : 500 }
      );
    }
    const creativeId = typeof adJson.creative === "object" && adJson.creative?.id
      ? adJson.creative.id
      : (adJson as { creative?: string }).creative;
    if (!creativeId) {
      return NextResponse.json({ error: "Anúncio sem criativo associado." }, { status: 400 });
    }
    let accountId = adJson.account_id;
    if (!String(accountId).startsWith("act_")) accountId = `act_${accountId}`;

    const creativeUrl = `${GRAPH_BASE}/${creativeId}?fields=object_story_spec,name&access_token=${encodeURIComponent(token)}`;
    const creativeRes = await fetch(creativeUrl);
    const creativeJson = (await creativeRes.json()) as {
      object_story_spec?: Record<string, unknown>;
      name?: string;
      error?: { message: string };
    };
    if (creativeJson.error || !creativeJson.object_story_spec) {
      const err = creativeJson.error;
      const msg = (err as { error_user_msg?: string })?.error_user_msg || err?.message ?? "Criativo não encontrado.";
      return NextResponse.json(
        { error: msg, step: "buscar_criativo", meta_error: err },
        { status: creativeRes.ok ? 400 : 500 }
      );
    }

    let newSpec = setLinkInObjectStorySpec(creativeJson.object_story_spec, link);
    newSpec = normalizeSpecForCreate(newSpec);

    const copyParams = new URLSearchParams({
      access_token: token,
      creative_parameters: JSON.stringify({ object_story_spec: newSpec }),
      status_option: "ACTIVE",
      rename_strategy: "NO_RENAME",
    });
    const copyRes = await fetch(`${GRAPH_BASE}/${effectiveAdId}/copies`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: copyParams.toString(),
    });
    const copyJson = (await copyRes.json()) as {
      copied_ad_id?: string;
      error?: { message: string; error_user_msg?: string; code?: number };
    };

    if (copyJson.error || !copyJson.copied_ad_id) {
      const createParams = new URLSearchParams({
        access_token: token,
        name: (creativeJson.name || "Criativo").slice(0, 100),
        object_story_spec: JSON.stringify(newSpec),
      });
      const createRes = await fetch(`${GRAPH_BASE}/${accountId}/adcreatives`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createParams.toString(),
      });
      const createJson = (await createRes.json()) as {
        id?: string;
        error?: { message: string; error_user_msg?: string; code?: number };
      };
      if (createJson.error || !createJson.id) {
        const err = createJson.error;
        const parts = [
          err?.error_user_msg || err?.message || "Erro ao criar criativo com o novo link.",
          err?.code != null ? `Código Meta: ${err.code}` : "",
        ].filter(Boolean);
        return NextResponse.json(
          { error: parts.join(" "), step: "criar_criativo", meta_error: err },
          { status: 500 }
        );
      }
      const adsetIdForNew = adJson.adset_id;
      if (!adsetIdForNew) {
        return NextResponse.json(
          { error: "Não foi possível obter o conjunto do anúncio." },
          { status: 500 }
        );
      }
      const originalName = (adJson.name ?? creativeJson.name ?? "Anúncio").slice(0, 200);
      const newAdParams = new URLSearchParams({
        access_token: token,
        adset_id: adsetIdForNew,
        creative: JSON.stringify({ creative_id: createJson.id }),
        name: originalName,
        status: "ACTIVE",
      });
      const newAdRes = await fetch(`${GRAPH_BASE}/${accountId}/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: newAdParams.toString(),
      });
      const newAdJson = (await newAdRes.json()) as { id?: string; error?: { message: string } };
      if (newAdJson.error || !newAdJson.id) {
        return NextResponse.json(
          {
            error: newAdJson.error?.message ?? "Erro ao criar anúncio com o novo link.",
            step: "criar_anuncio",
            meta_error: (newAdJson as { error?: unknown }).error,
          },
          { status: 500 }
        );
      }
      const deleteParams = new URLSearchParams({ access_token: token, status: "DELETED" });
      await fetch(`${GRAPH_BASE}/${effectiveAdId}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: deleteParams.toString(),
      });
      const adsetId = adJson.adset_id;
      const campaignId = adJson.campaign_id;
      const statusParams = new URLSearchParams({ access_token: token, status: "ACTIVE" });
      if (adsetId) {
        await fetch(`${GRAPH_BASE}/${adsetId}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: statusParams.toString(),
        });
      }
      if (campaignId) {
        await fetch(`${GRAPH_BASE}/${campaignId}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: statusParams.toString(),
        });
      }
      await supabase.from("meta_ad_display_mapping").upsert(
        { user_id: user.id, delivering_ad_id: newAdJson.id, display_ad_id: displayAdId },
        { onConflict: "user_id,delivering_ad_id" }
      );
      return NextResponse.json({ success: true, message: "Link atualizado com sucesso." });
    }

    const deleteParams = new URLSearchParams({ access_token: token, status: "DELETED" });
    await fetch(`${GRAPH_BASE}/${effectiveAdId}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: deleteParams.toString(),
    });
    const originalName = (adJson.name ?? creativeJson.name ?? "Anúncio").slice(0, 200);
    const nameUpdateParams = new URLSearchParams({ access_token: token, name: originalName });
    await fetch(`${GRAPH_BASE}/${copyJson.copied_ad_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: nameUpdateParams.toString(),
    });
    const adsetId = adJson.adset_id;
    const campaignId = adJson.campaign_id;
    const statusParams = new URLSearchParams({ access_token: token, status: "ACTIVE" });
    if (adsetId) {
      await fetch(`${GRAPH_BASE}/${adsetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: statusParams.toString(),
      });
    }
    if (campaignId) {
      await fetch(`${GRAPH_BASE}/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: statusParams.toString(),
      });
    }
    await supabase.from("meta_ad_display_mapping").upsert(
      { user_id: user.id, delivering_ad_id: copyJson.copied_ad_id, display_ad_id: displayAdId },
      { onConflict: "user_id,delivering_ad_id" }
    );
    return NextResponse.json({ success: true, message: "Link atualizado com sucesso." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar link";
    console.error("[update-link] Erro:", msg, e instanceof Error ? e.stack : "");
    return NextResponse.json(
      { error: msg, step: "exceção" },
      { status: 500 }
    );
  }
}
