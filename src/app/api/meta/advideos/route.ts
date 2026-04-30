/**
 * Lista vídeos da biblioteca do Meta (Ad Videos) da conta.
 * GET /api/meta/advideos?ad_account_id=act_xxx
 *
 * Cria um vídeo na biblioteca a partir de uma URL pública.
 * O upload do arquivo em si acontece direto do browser para o Supabase Storage
 * (signed upload URL emitida em /api/meta/advideos/signed-upload), evitando o
 * limite de 4.5MB no body de Route Handlers da Vercel. Aqui só passamos a
 * `file_url` para o Meta, que faz o download de forma assíncrona.
 *
 * POST /api/meta/advideos
 * Body: JSON { ad_account_id: string, file_url: string, title?: string }
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

    // `status` traz `video_status` ("processing" | "ready" | "error" | etc.).
    // O Meta entrega `picture` mesmo durante processamento (placeholder preto),
    // então só `picture` não basta para detectar quando o vídeo está pronto.
    const apiUrl = `${GRAPH_BASE}/${ad_account_id}/advideos?fields=id,title,source,length,picture,status&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(apiUrl);
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        title?: string;
        source?: string;
        length?: number;
        picture?: string;
        status?: { video_status?: string };
      }>;
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message || "Meta API error");
    const videos = (json.data ?? []).map((v) => {
      const videoStatus = v.status?.video_status ?? null;
      return {
        id: v.id,
        title: v.title || v.id,
        source: v.source || null,
        length: v.length ?? null,
        picture: v.picture || null,
        status: videoStatus,
        ready: videoStatus === "ready",
      };
    });
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

    const body = (await req.json().catch(() => ({}))) as {
      ad_account_id?: string;
      file_url?: string;
      title?: string;
    };

    const ad_account_id = body.ad_account_id?.trim();
    const file_url = body.file_url?.trim();

    if (!ad_account_id || !file_url) {
      return NextResponse.json(
        { error: "Envie 'ad_account_id' e 'file_url'." },
        { status: 400 }
      );
    }

    if (!/^https:\/\//i.test(file_url)) {
      return NextResponse.json(
        { error: "file_url precisa ser HTTPS." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.set("access_token", token);
    params.set("file_url", file_url);
    if (body.title?.trim()) params.set("title", body.title.trim());

    const url = `${GRAPH_BASE}/${ad_account_id}/advideos`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
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
