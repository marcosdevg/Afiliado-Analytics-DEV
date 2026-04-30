/**
 * Cron diário: apaga objetos do bucket `meta-ad-videos` com mais de 24 horas.
 *
 * Uma vez que o Meta processa o vídeo a partir de `file_url`, o arquivo no
 * Supabase Storage só precisa ficar acessível durante o download inicial do
 * Meta (que ocorre logo após o POST /advideos). 24h é folga mais que
 * suficiente; depois disso fica só ocupando storage.
 *
 * Auth: em produção exige `Authorization: Bearer ${CRON_SECRET}`.
 * Acionamento: configurado em vercel.json (crons[]).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "meta-ad-videos";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 1000;
const REMOVE_BATCH = 100;

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function supabaseAdmin() {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) {
    const auth = req.headers.get("authorization") || "";
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const admin = supabaseAdmin();
    const cutoff = Date.now() - MAX_AGE_MS;
    const toRemove: string[] = [];
    let scannedFolders = 0;

    // Nível raiz: pastas por user_id (folders têm id === null no retorno).
    const { data: rootEntries, error: rootErr } = await admin.storage
      .from(BUCKET)
      .list("", { limit: LIST_LIMIT });
    if (rootErr) throw new Error(`list root: ${rootErr.message}`);

    for (const entry of rootEntries ?? []) {
      // Folders aparecem com id: null.
      if (entry.id != null) {
        // Caso raro: arquivo solto na raiz. Avalia direto.
        if (entry.created_at && new Date(entry.created_at).getTime() < cutoff) {
          toRemove.push(entry.name);
        }
        continue;
      }
      scannedFolders++;
      const folder = entry.name;
      let offset = 0;
      // Paginação defensiva caso um usuário tenha muitos arquivos.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: files, error: listErr } = await admin.storage
          .from(BUCKET)
          .list(folder, { limit: LIST_LIMIT, offset });
        if (listErr) throw new Error(`list ${folder}: ${listErr.message}`);
        if (!files || files.length === 0) break;
        for (const f of files) {
          if (!f.created_at) continue;
          if (new Date(f.created_at).getTime() < cutoff) {
            toRemove.push(`${folder}/${f.name}`);
          }
        }
        if (files.length < LIST_LIMIT) break;
        offset += LIST_LIMIT;
      }
    }

    let removed = 0;
    for (let i = 0; i < toRemove.length; i += REMOVE_BATCH) {
      const batch = toRemove.slice(i, i + REMOVE_BATCH);
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(batch);
      if (rmErr) {
        return NextResponse.json(
          { error: `remove: ${rmErr.message}`, removed, scannedFolders },
          { status: 500 }
        );
      }
      removed += batch.length;
    }

    return NextResponse.json({
      ok: true,
      scannedFolders,
      removed,
      cutoff: new Date(cutoff).toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
