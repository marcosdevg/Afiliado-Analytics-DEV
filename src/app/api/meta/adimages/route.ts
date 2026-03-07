/**
 * Upload de imagem para a biblioteca do Meta (Ad Images).
 * POST /api/meta/adimages
 * Body: multipart/form-data com "file" (imagem) e "ad_account_id"
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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ad_account_id = formData.get("ad_account_id")?.toString()?.trim();

    if (!file || !ad_account_id) {
      return NextResponse.json(
        { error: "Envie 'file' (imagem) e 'ad_account_id'." },
        { status: 400 }
      );
    }

    const contentType = file.type;
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "O arquivo deve ser uma imagem (JPEG, PNG, etc.)." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const safeName = `image.${ext}`.replace(/[^a-zA-Z0-9._-]/g, "_");

    const metaFormData = new FormData();
    metaFormData.set("access_token", token);
    metaFormData.set(safeName, file);

    const url = `${GRAPH_BASE}/${ad_account_id}/adimages`;
    const res = await fetch(url, {
      method: "POST",
      body: metaFormData,
    });
    const json = (await res.json()) as {
      images?: Record<string, { hash: string }>;
      error?: { message: string; code?: number; error_subcode?: number };
    };

    if (json.error) {
      const err = json.error;
      const detail = [err.message];
      if (err.code != null) detail.push(`(código: ${err.code})`);
      if (err.error_subcode != null) detail.push(`(subcódigo: ${err.error_subcode})`);
      throw new Error(detail.join(" "));
    }

    const firstKey = json.images && Object.keys(json.images)[0];
    const hash = firstKey ? json.images![firstKey].hash : null;
    if (!hash) throw new Error("Meta não retornou hash da imagem.");

    return NextResponse.json({ hash, name: safeName });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao enviar imagem";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Lista imagens da biblioteca do Meta (Ad Images) da conta.
 * GET /api/meta/adimages?ad_account_id=act_xxx
 */
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

    const apiUrl = `${GRAPH_BASE}/${ad_account_id}/adimages?fields=hash,url,id&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(apiUrl);
    const json = (await res.json()) as {
      data?: Array<{ hash: string; url?: string; id?: string }>;
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message || "Meta API error");
    const images = (json.data ?? []).map((img) => ({
      hash: img.hash,
      url: img.url || null,
      id: img.id || null,
    }));
    return NextResponse.json({ images });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar imagens";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
