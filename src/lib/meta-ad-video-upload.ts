/**
 * Faz o upload de um vídeo de anúncio do Meta em três etapas (lado do navegador):
 *   1) Pede uma signed upload URL ao backend (/api/meta/advideos/signed-upload),
 *      que devolve token + path do Supabase Storage.
 *   2) O navegador envia o arquivo direto para o Supabase via `uploadToSignedUrl`,
 *      contornando o limite de 4.5MB do body em Route Handlers da Vercel.
 *   3) Avisa o backend para registrar o vídeo no Meta a partir da URL pública
 *      (POST /api/meta/advideos com { ad_account_id, file_url }).
 *
 * Retorna o `video_id` que o Meta atribuiu ao vídeo na biblioteca da conta.
 */

import { createClient } from "../../utils/supabase/client";

const BUCKET = "meta-ad-videos";

export type UploadMetaAdVideoResult = {
  videoId: string;
  fileUrl: string;
  storagePath: string;
};

export async function uploadMetaAdVideo(
  file: File,
  adAccountId: string
): Promise<UploadMetaAdVideoResult> {
  if (!adAccountId) throw new Error("ad_account_id é obrigatório.");
  if (!file.type.startsWith("video/")) {
    throw new Error("O arquivo deve ser um vídeo (MP4, etc.).");
  }

  const signRes = await fetch("/api/meta/advideos/signed-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, content_type: file.type }),
  });
  const signJson = (await signRes.json()) as {
    token?: string;
    publicUrl?: string;
    path?: string;
    error?: string;
  };
  if (!signRes.ok || !signJson.token || !signJson.publicUrl || !signJson.path) {
    throw new Error(signJson.error || "Falha ao obter URL de upload.");
  }

  const supabase = createClient();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(signJson.path, signJson.token, file, {
      contentType: file.type || "video/mp4",
      upsert: false,
    });
  if (upErr) {
    throw new Error(`Falha no upload para o storage: ${upErr.message}`);
  }

  const metaRes = await fetch("/api/meta/advideos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ad_account_id: adAccountId,
      file_url: signJson.publicUrl,
    }),
  });
  const metaJson = (await metaRes.json()) as { video_id?: string; error?: string };
  if (!metaRes.ok || !metaJson.video_id) {
    throw new Error(metaJson.error || "Meta recusou o vídeo.");
  }

  return {
    videoId: metaJson.video_id,
    fileUrl: signJson.publicUrl,
    storagePath: signJson.path,
  };
}
