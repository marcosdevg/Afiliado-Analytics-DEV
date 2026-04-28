/**
 * Orquestra a geração de um vídeo de 12s no navegador, gerando dois clipes de
 * 6s no Veo e concatenando-os com FFmpeg.wasm. O Veo 3.1 fast só aceita 4/6/8s
 * por geração, então não há um caminho "nativo" para 12s — esse pipeline é a
 * forma de oferecer essa duração.
 *
 * Fluxo:
 *   1) `veo-start` (6s) com a imagem inicial do usuário; faz polling até
 *      receber bytes/GCS URI; baixa o clipe 1 como Blob.
 *   2) Extrai o último frame do clipe 1 num <canvas> e usa como `image` da
 *      próxima chamada (continuidade visual).
 *   3) `veo-start` (6s) com o último frame do clipe 1; faz polling; baixa
 *      o clipe 2.
 *   4) Concatena os dois MP4 com FFmpeg.wasm. Tenta primeiro `concat demuxer`
 *      com `-c copy` (rápido, zero re-encode); se falhar (codecs/timebases
 *      incompatíveis) faz fallback re-encodando.
 *
 * Custo: cada `veo-start` consome `AFILIADO_COINS_VIDEO_COST` no backend,
 * portanto 12s = 2× o custo de 6s. Não há cobrança extra na concatenação.
 *
 * Cancelamento / falhas:
 * - Stage 1 falha → backend já dá refund automático.
 * - Stage 2 falha → coins do stage 1 ficam consumidas (vídeo 1 não é
 *   entregável sozinho neste pipeline).
 * - Concatenação falha → exposta no erro; chamador pode oferecer fallback.
 */

import { ensureFfmpegLoaded } from "../compress-video-client";

export type Generate12sStage = 1 | 2 | "concat";

export type Generate12sProgress = {
  stage: Generate12sStage;
  /** Mensagem curta para a UI (ex.: "Gerando clipe 1 de 2…"). */
  message: string;
};

export type Generate12sParams = {
  imageBase64: string;
  imageMimeType: string;
  aspectRatio: "9:16" | "16:9";
  resolution: "720p" | "1080p";
  /** Se true, gera fala em ambos os clipes. */
  generateAudio: boolean;
  /** Roteiro completo (até ~30 palavras). É dividido ao meio entre os 2 clipes. */
  voiceScript?: string;
  voiceGender: "female" | "male";
  advancedVideoPrompt?: string;
  advancedImagePrompt?: string;
  productDescription?: string;
  options: unknown;
};

export type Generate12sResult = {
  blob: Blob;
  /** Mime do blob final (sempre `video/mp4`). */
  mime: "video/mp4";
};

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 60;

type VeoStartResponse = {
  operationName?: string;
  error?: string;
  code?: string;
};

type VeoPollVideo = {
  bytesBase64Encoded?: string;
  gcsUri?: string;
  mimeType?: string;
};

type VeoPollResponse = {
  done?: boolean;
  error?: string | { message?: string };
  videos?: VeoPollVideo[];
  raiMediaFilteredCount?: number;
};

function splitVoiceScriptInHalf(script: string): { first: string; second: string } {
  const trimmed = script.trim();
  if (!trimmed) return { first: "", second: "" };
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { first: trimmed, second: "" };
  const mid = Math.ceil(words.length / 2);
  return {
    first: words.slice(0, mid).join(" "),
    second: words.slice(mid).join(" "),
  };
}

async function startVeoStage(params: {
  imageBase64: string;
  imageMimeType: string;
  aspectRatio: "9:16" | "16:9";
  resolution: "720p" | "1080p";
  generateAudio: boolean;
  voiceScript?: string;
  voiceGender: "female" | "male";
  advancedVideoPrompt?: string;
  advancedImagePrompt?: string;
  productDescription?: string;
  options: unknown;
}): Promise<string> {
  const res = await fetch("/api/expert-generator/veo-start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: params.imageBase64,
      imageMimeType: params.imageMimeType,
      aspectRatio: params.aspectRatio,
      durationSeconds: 6,
      resolution: params.resolution,
      generateAudio: params.generateAudio,
      voiceScript: params.voiceScript || undefined,
      voiceGender: params.voiceGender,
      advancedVideoPrompt: params.advancedVideoPrompt,
      advancedImagePrompt: params.advancedImagePrompt,
      productDescription: params.productDescription,
      options: params.options,
    }),
  });
  const data = (await res.json()) as VeoStartResponse;
  if (!res.ok || !data.operationName) {
    throw new Error(data.error || "Falha ao iniciar geração no Veo.");
  }
  return data.operationName;
}

async function pollVeoUntilReady(operationName: string): Promise<VeoPollVideo> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const res = await fetch("/api/expert-generator/veo-poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationName }),
    });
    const j = (await res.json()) as VeoPollResponse;
    if (!res.ok) {
      const msg = typeof j.error === "string" ? j.error : j.error?.message ?? "Falha no poll Veo.";
      throw new Error(msg);
    }
    const errObj = j.error;
    if (errObj && typeof errObj === "object" && errObj.message) {
      throw new Error(errObj.message);
    }
    if (j.done) {
      const v = j.videos?.[0];
      if (v && (v.bytesBase64Encoded || v.gcsUri)) {
        return v;
      }
      if (j.raiMediaFilteredCount) {
        throw new Error(
          "O Veo filtrou o vídeo por políticas de segurança. As coins foram devolvidas. Tente ajustar o prompt ou a imagem."
        );
      }
      throw new Error("Vídeo concluído mas sem bytes nem URI pública.");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Tempo esgotado ao aguardar o Veo.");
}

async function fetchVeoVideoAsBlob(v: VeoPollVideo): Promise<Blob> {
  if (v.bytesBase64Encoded) {
    const bin = atob(v.bytesBase64Encoded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: v.mimeType || "video/mp4" });
  }
  if (v.gcsUri) {
    const res = await fetch(v.gcsUri);
    if (!res.ok) throw new Error(`Falha ao baixar vídeo (${res.status}).`);
    return await res.blob();
  }
  throw new Error("Vídeo sem fonte (sem bytes e sem URI).");
}

/**
 * Carrega o vídeo num <video> oculto, vai até quase o fim e desenha o frame
 * num <canvas>. Retorna como base64 (image/jpeg) pronto para enviar ao Veo.
 */
async function extractLastFrameBase64(blob: Blob): Promise<{ base64: string; mime: string }> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Falha ao ler o vídeo do clipe 1."));
    });

    const targetTime = Math.max(0, (Number.isFinite(video.duration) ? video.duration : 6) - 0.05);
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Falha ao posicionar o último frame."));
      video.currentTime = targetTime;
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error("Dimensões do clipe 1 indisponíveis.");

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível neste navegador.");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.split(",")[1] ?? "";
    if (!base64) throw new Error("Falha ao codificar o último frame.");
    return { base64, mime: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function concatTwoMp4WithFfmpeg(blob1: Blob, blob2: Blob): Promise<Blob> {
  const ffmpeg = await ensureFfmpegLoaded();

  const buf1 = new Uint8Array(await blob1.arrayBuffer());
  const buf2 = new Uint8Array(await blob2.arrayBuffer());
  const list = new TextEncoder().encode("file 'clip1.mp4'\nfile 'clip2.mp4'\n");

  await ffmpeg.writeFile("clip1.mp4", buf1);
  await ffmpeg.writeFile("clip2.mp4", buf2);
  await ffmpeg.writeFile("list.txt", list);

  // 1ª tentativa: concat demuxer com -c copy (zero re-encode, rápido).
  let okCopy = false;
  try {
    const code = await ffmpeg.exec([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "list.txt",
      "-c",
      "copy",
      "out.mp4",
    ]);
    okCopy = code === 0;
  } catch {
    okCopy = false;
  }

  // 2ª tentativa: re-encodar (codecs/timebases divergentes do Veo).
  if (!okCopy) {
    try {
      await ffmpeg.deleteFile("out.mp4");
    } catch {
      // sem out.mp4 prévio — segue
    }
    const code = await ffmpeg.exec([
      "-y",
      "-i",
      "clip1.mp4",
      "-i",
      "clip2.mp4",
      "-filter_complex",
      "[0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[v][a]",
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "out.mp4",
    ]);
    if (code !== 0) {
      throw new Error("Falha ao concatenar os clipes (FFmpeg retornou erro).");
    }
  }

  const out = await ffmpeg.readFile("out.mp4");
  const outBytes =
    typeof out === "string"
      ? new TextEncoder().encode(out)
      : (out as Uint8Array).slice();
  return new Blob([outBytes], { type: "video/mp4" });
}

export async function generate12sVideo(
  params: Generate12sParams,
  onProgress: (p: Generate12sProgress) => void
): Promise<Generate12sResult> {
  const { first: scriptStage1, second: scriptStage2 } = splitVoiceScriptInHalf(
    params.voiceScript ?? ""
  );

  // ── Stage 1 ──────────────────────────────────────────────────────────────
  onProgress({ stage: 1, message: "Gerando clipe 1 de 2…" });
  const op1 = await startVeoStage({
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    generateAudio: params.generateAudio,
    voiceScript: scriptStage1 || undefined,
    voiceGender: params.voiceGender,
    advancedVideoPrompt: params.advancedVideoPrompt,
    advancedImagePrompt: params.advancedImagePrompt,
    productDescription: params.productDescription,
    options: params.options,
  });
  const v1 = await pollVeoUntilReady(op1);
  const blob1 = await fetchVeoVideoAsBlob(v1);

  // ── Stage 2 ──────────────────────────────────────────────────────────────
  onProgress({ stage: 2, message: "Gerando clipe 2 de 2…" });
  const lastFrame = await extractLastFrameBase64(blob1);
  const op2 = await startVeoStage({
    imageBase64: lastFrame.base64,
    imageMimeType: lastFrame.mime,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    generateAudio: params.generateAudio,
    voiceScript: scriptStage2 || undefined,
    voiceGender: params.voiceGender,
    advancedVideoPrompt: params.advancedVideoPrompt,
    advancedImagePrompt: params.advancedImagePrompt,
    productDescription: params.productDescription,
    options: params.options,
  });
  const v2 = await pollVeoUntilReady(op2);
  const blob2 = await fetchVeoVideoAsBlob(v2);

  // ── Concat ───────────────────────────────────────────────────────────────
  onProgress({ stage: "concat", message: "Finalizando…" });
  const finalBlob = await concatTwoMp4WithFfmpeg(blob1, blob2);
  return { blob: finalBlob, mime: "video/mp4" };
}
