import type { VideoInputProps } from "../../../remotion/types";
import { humanizeLargeRequestError } from "../humanize-fetch-error";

/**
 * O render no Vercel Sandbox não acessa URLs `blob:` do navegador.
 * Converte cada `blob:` em URL pública (Vercel Blob) antes do POST de render.
 */
async function uploadBlobUrlToPublic(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new Error("Não foi possível ler mídia local (blob).");
  const blob = await res.blob();
  const fd = new FormData();
  const ext =
    blob.type?.includes("mp4") ? "mp4"
    : blob.type?.includes("webm") ? "webm"
    : blob.type?.includes("jpeg") || blob.type?.includes("jpg") ? "jpg"
    : blob.type?.includes("png") ? "png"
    : blob.type?.includes("webp") ? "webp"
    : blob.type?.includes("mpeg") || blob.type?.includes("mp3") ? "mp3"
    : "bin";
  fd.append("file", blob, `upload.${ext}`);

  const up = await fetch("/api/video-editor/publish-blob-for-render", {
    method: "POST",
    body: fd,
  });

  const text = await up.text();
  let json: { url?: string; error?: string };
  try {
    json = JSON.parse(text) as { url?: string; error?: string };
  } catch {
    throw new Error(
      humanizeLargeRequestError(text.slice(0, 400) || `Upload falhou (${up.status})`),
    );
  }

  if (!up.ok || !json.url) {
    const detail = json.error ?? (text ? text.slice(0, 500) : "");
    throw new Error(
      humanizeLargeRequestError(
        detail ? `[Publicar mídia] ${detail}` : `Upload falhou (${up.status})`,
      ),
    );
  }
  return json.url;
}

function needsPublicUrl(src: string): boolean {
  return src.startsWith("blob:") || src.startsWith("data:");
}

export async function resolveInputPropsForRender(
  props: VideoInputProps,
): Promise<VideoInputProps> {
  const media = await Promise.all(
    props.media.map(async (m) => {
      if (!needsPublicUrl(m.src)) return m;
      const src = await uploadBlobUrlToPublic(m.src);
      return { ...m, src };
    }),
  );

  let voiceoverSrc = props.voiceoverSrc;
  if (voiceoverSrc && needsPublicUrl(voiceoverSrc)) {
    voiceoverSrc = await uploadBlobUrlToPublic(voiceoverSrc);
  }

  let musicSrc = props.musicSrc;
  if (musicSrc && needsPublicUrl(musicSrc)) {
    musicSrc = await uploadBlobUrlToPublic(musicSrc);
  }

  return {
    ...props,
    media,
    voiceoverSrc,
    musicSrc,
  };
}
