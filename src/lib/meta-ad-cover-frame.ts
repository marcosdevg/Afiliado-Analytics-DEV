/**
 * Extrai um frame "representativo" de um File de vídeo no navegador (canvas)
 * para servir como capa (thumbnail) automática de anúncios do Meta.
 *
 * O Meta exige `image_hash` ou `image_url` em ad creatives com vídeo. Pedir o
 * usuário enviar uma capa separada confunde — aqui geramos automaticamente um
 * frame do meio do vídeo (~30% da duração, costuma ter melhor enquadramento
 * que o frame 0 que pode estar em fade-in/preto).
 */

export async function extractVideoCoverFrame(file: File): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("Extração de capa só funciona no navegador.");
  }
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Falha ao ler metadados do vídeo."));
    });

    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6;
    const target = Math.min(Math.max(0.05, dur * 0.3), Math.max(0, dur - 0.05));

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Falha ao posicionar o frame da capa."));
      video.currentTime = target;
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error("Dimensões do vídeo indisponíveis.");

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível neste navegador.");
    ctx.drawImage(video, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Falha ao codificar a capa do vídeo."));
        },
        "image/jpeg",
        0.92
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sobe a capa gerada para a biblioteca de imagens do Meta (POST /adimages) e
 * devolve o `hash` retornado, junto com uma `previewUrl` local (objectURL do
 * blob) que dá pra usar imediatamente como thumbnail no UI antes mesmo do Meta
 * processar.
 */
export async function uploadCoverBlobToMetaLibrary(
  coverBlob: Blob,
  adAccountId: string
): Promise<{ hash: string; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(coverBlob);
  try {
    const file = new File([coverBlob], `auto-cover-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    const form = new FormData();
    form.set("file", file);
    form.set("ad_account_id", adAccountId);
    const res = await fetch("/api/meta/adimages", { method: "POST", body: form });
    const json = (await res.json()) as { hash?: string; error?: string };
    if (!res.ok || !json.hash) {
      throw new Error(json.error || "Falha ao subir capa automática.");
    }
    return { hash: json.hash, previewUrl };
  } catch (e) {
    URL.revokeObjectURL(previewUrl);
    throw e;
  }
}
