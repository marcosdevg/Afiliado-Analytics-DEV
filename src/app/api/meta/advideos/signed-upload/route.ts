/**
 * Emite uma Signed Upload URL do Supabase Storage para que o navegador suba
 * o vídeo direto, contornando o limite de 4.5MB do body em Route Handlers
 * da Vercel. O caminho fica em `meta-ad-videos/{user_id}/...`.
 *
 * POST /api/meta/advideos/signed-upload
 * Body: JSON { filename?: string, content_type?: string }
 * Resposta: { signedUrl, token, path, publicUrl }
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "../../../../../../utils/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";

const BUCKET = "meta-ad-videos";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function supabaseAdmin() {
  return createAdminSupabase(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

function extFromName(name: string): string {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : "mp4";
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      filename?: string;
      content_type?: string;
    };

    if (body.content_type && !body.content_type.startsWith("video/")) {
      return NextResponse.json(
        { error: "content_type deve ser de vídeo (video/*)." },
        { status: 400 }
      );
    }

    const ext = extFromName(body.filename || "video.mp4");
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${user.id}/${ts}-${rand}.${ext}`;

    const admin = supabaseAdmin();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Falha ao criar URL de upload." },
        { status: 500 }
      );
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl: pub.publicUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
