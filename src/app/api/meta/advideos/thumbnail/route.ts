/**
 * Redireciona para a miniatura do vídeo no Meta.
 * GET /api/meta/advideos/thumbnail?video_id=xxx
 * Útil quando a lista de advideos não retorna picture (ex.: vídeo recém-enviado).
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function GET(req: Request) {
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
    if (!token) return NextResponse.json({ error: "Token não configurado" }, { status: 400 });

    const url = new URL(req.url);
    const video_id = url.searchParams.get("video_id")?.trim();
    if (!video_id) return NextResponse.json({ error: "video_id é obrigatório" }, { status: 400 });

    const pictureUrl = `${GRAPH_BASE}/${video_id}/picture?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(pictureUrl, { redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status === 302 && location) {
      return NextResponse.redirect(location);
    }
    const json = (await res.json()) as { data?: { url?: string }; error?: { message: string } };
    if (json?.data?.url) return NextResponse.redirect(json.data.url);
    if (json?.error) throw new Error(json.error.message);
    return NextResponse.json({ error: "Miniatura não disponível" }, { status: 404 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao obter miniatura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
