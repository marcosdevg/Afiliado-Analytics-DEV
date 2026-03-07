/**
 * Lista vídeos da biblioteca do Meta (Ad Videos) da conta.
 * GET /api/meta/advideos?ad_account_id=act_xxx
 *
 * Upload de vídeo para a biblioteca.
 * POST /api/meta/advideos
 * Body: multipart/form-data com "file" (vídeo) e "ad_account_id"
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

async function getToken(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("meta_access_token")
    .eq("id", userId)
    .single();
  return profile?.meta_access_token?.trim();
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const token = await getToken(user.id);
    if (!token) {
      return NextResponse.json(
        { error: "Token do Meta não configurado." },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const ad_account_id = url.searchParams.get("ad_account_id")?.trim();
    if (!ad_account_id) {
      return NextResponse.json(
        { error: "ad_account_id é obrigatório." },
        { status: 400 }
      );
    }

    const apiUrl = `${GRAPH_BASE}/${ad_account_id}/advideos?fields=id,title,source,length,picture&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(apiUrl);
    const json = (await res.json()) as {
      data?: Array<{ id: string; title?: string; source?: string; length?: number; picture?: string }>;
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message || "Meta API error");
    const videos = (json.data ?? []).map((v) => ({
      id: v.id,
      title: v.title || v.id,
      source: v.source || null,
      length: v.length ?? null,
      picture: v.picture || null,
    }));
    return NextResponse.json({ videos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar vídeos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const token = await getToken(user.id);
    if (!token) {
      return NextResponse.json(
        { error: "Token do Meta não configurado." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ad_account_id = formData.get("ad_account_id")?.toString()?.trim();

    if (!file || !ad_account_id) {
      return NextResponse.json(
        { error: "Envie 'file' (vídeo) e 'ad_account_id'." },
        { status: 400 }
      );
    }

    const contentType = file.type;
    const isVideo = contentType.startsWith("video/");
    if (!isVideo) {
      return NextResponse.json(
        { error: "O arquivo deve ser um vídeo (MP4, etc.)." },
        { status: 400 }
      );
    }

    const metaFormData = new FormData();
    metaFormData.set("access_token", token);
    metaFormData.set("source", file);

    const url = `${GRAPH_BASE}/${ad_account_id}/advideos`;
    const res = await fetch(url, {
      method: "POST",
      body: metaFormData,
    });
    const json = (await res.json()) as {
      id?: string;
      error?: { message: string; code?: number };
    };

    if (json.error) {
      throw new Error(json.error.message || "Erro no upload do vídeo");
    }
    if (!json.id) throw new Error("Meta não retornou ID do vídeo.");

    return NextResponse.json({ video_id: json.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao enviar vídeo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
