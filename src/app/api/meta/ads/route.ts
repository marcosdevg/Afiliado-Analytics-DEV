/**
 * Cria anúncio no Meta Ads: primeiro cria o criativo (link + imagem + texto), depois o ad.
 * POST /api/meta/ads
 * Body: { ad_account_id, adset_id, name, page_id, link, message, image_url?, image_hash?, video_id?, call_to_action?, title? }
 * Para criativo com vídeo: video_id é obrigatório e image_hash ou image_url (thumbnail do vídeo) também.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

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
    const ad_account_id = body?.ad_account_id?.trim();
    const adset_id = body?.adset_id?.trim();
    const name = body?.name?.trim();
    const page_id = body?.page_id?.trim();
    const link = body?.link?.trim();
    const message = body?.message?.trim();
    const image_url = body?.image_url?.trim();
    const image_hash = body?.image_hash?.trim();
    const video_id = body?.video_id?.trim();
    const call_to_action = (body?.call_to_action?.trim() || "LEARN_MORE").toUpperCase();
    const title = body?.title?.trim() || "";

    if (!ad_account_id || !adset_id || !name || !page_id || !link || !message) {
      return NextResponse.json(
        { error: "ad_account_id, adset_id, name, page_id, link e message são obrigatórios." },
        { status: 400 }
      );
    }
    const hasImage = image_hash || image_url;
    if (!video_id && !hasImage) {
      return NextResponse.json(
        { error: "Envie image_hash, image_url ou video_id para o criativo." },
        { status: 400 }
      );
    }
    if (video_id && !hasImage) {
      return NextResponse.json(
        { error: "Anúncio com vídeo exige imagem de capa (thumbnail). Envie image_hash ou image_url da biblioteca." },
        { status: 400 }
      );
    }

    let objectStorySpec: Record<string, unknown>;

    if (video_id) {
      const videoData: Record<string, unknown> = {
        video_id,
        message,
        call_to_action: { type: call_to_action, value: { link } },
        ...(title ? { title } : {}),
      };
      if (image_hash) videoData.image_hash = image_hash;
      else if (image_url) videoData.image_url = image_url;
      objectStorySpec = {
        page_id,
        video_data: videoData,
      };
    } else {
      const linkData: Record<string, unknown> = {
        link,
        message,
        name: title || undefined,
        call_to_action: { type: call_to_action },
      };
      if (image_hash) linkData.image_hash = image_hash;
      else if (image_url) linkData.picture = image_url;
      objectStorySpec = {
        page_id,
        link_data: linkData,
      };
    }
    const creativeParams = new URLSearchParams({
      access_token: token,
      name: name.slice(0, 100),
      object_story_spec: JSON.stringify(objectStorySpec),
    });
    const creativeUrl = `${GRAPH_BASE}/${ad_account_id}/adcreatives`;
    const creativeRes = await fetch(creativeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: creativeParams.toString(),
    });
    const creativeJson = (await creativeRes.json()) as {
      id?: string;
      error?: {
        message: string;
        code?: number;
        error_subcode?: number;
        error_user_msg?: string;
      };
    };
    if (creativeJson.error) {
      const err = creativeJson.error;
      if (err.error_subcode === 1885183) {
        throw new Error(
          "O token do Meta foi gerado quando o app estava em modo de desenvolvimento. " +
          "Com o app já em modo Ao vivo, vá em Configurações e gere/cole um novo token (reautorize o app no Meta for Developers) para criar anúncios."
        );
      }
      if (err.code === 200 && err.error_subcode === 1487194) {
        throw new Error(
          "Permissões: o Meta recusou o criativo (objeto não visível ou ação restrita). Confira: (1) Use o botão 'Ver permissões que o Meta enxerga neste token' abaixo para ver se o token em Configurações tem pages_manage_ads. Se não tiver, gere um novo token no Graph API Explorer com pages_manage_ads e cole em Configurações. (2) A Página e a conta de anúncios precisam estar vinculadas (ex.: mesma empresa no Business Manager). (3) Use a conta de anúncios em que você já cria anúncios para essa Página."
        );
      }
      const detail = [`Criativo: ${err.message}`];
      if (err.error_user_msg) detail.push(err.error_user_msg);
      if (err.code != null) detail.push(`(código: ${err.code})`);
      if (err.error_subcode != null) detail.push(`(subcódigo: ${err.error_subcode})`);
      throw new Error(detail.join(" "));
    }
    const creative_id = creativeJson.id;
    if (!creative_id) throw new Error("Resposta do Meta sem creative_id");

    // 2) Criar anúncio com o criativo
    const adParams = new URLSearchParams({
      access_token: token,
      name: name.slice(0, 100),
      adset_id,
      creative: JSON.stringify({ creative_id }),
      status: "PAUSED",
    });
    const adUrl = `${GRAPH_BASE}/${ad_account_id}/ads`;
    const adRes = await fetch(adUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: adParams.toString(),
    });
    const adJson = (await adRes.json()) as {
      id?: string;
      error?: {
        message: string;
        code?: number;
        error_subcode?: number;
        error_user_msg?: string;
      };
    };
    if (adJson.error) {
      const err = adJson.error;
      if (err.code === 200 && err.error_subcode === 1487194) {
        throw new Error(
          "Permissões: o Meta recusou (objeto não visível). Use 'Ver permissões que o Meta enxerga neste token' na mensagem de erro para confirmar se o token tem pages_manage_ads. A Página e a conta de anúncios devem estar vinculadas."
        );
      }
      const detail = [`Anúncio: ${err.message}`];
      if (err.error_user_msg) detail.push(err.error_user_msg);
      if (err.code != null) detail.push(`(código: ${err.code})`);
      if (err.error_subcode != null) detail.push(`(subcódigo: ${err.error_subcode})`);
      throw new Error(detail.join(" "));
    }
    return NextResponse.json({ ad_id: adJson.id, creative_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar anúncio";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
