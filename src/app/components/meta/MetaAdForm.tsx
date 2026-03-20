"use client";

import { useState, useEffect } from "react";
import { Image as ImageIcon, Loader2, Upload, ImagePlus, Video, HelpCircle } from "lucide-react";
import { META_CALL_TO_ACTIONS } from "@/lib/meta-ads-constants";
import { MetaFormLabel } from "@/app/components/meta/MetaFormLabel";

type Page = { id: string; name: string };
type LibraryImage = { hash: string; url: string | null; id: string | null };
type LibraryVideo = { id: string; title: string; source: string | null; length: number | null; picture: string | null };

export type MetaAdFormBody = {
  name: string;
  page_id: string;
  link: string;
  message: string;
  title?: string;
  call_to_action: string;
  image_hash?: string;
  image_url?: string;
  video_id?: string;
};

type Props = {
  adAccountId: string;
  adsetId: string;
  adsetName?: string;
  defaultName?: string;
  defaultLink?: string;
  defaultMessage?: string;
  defaultTitle?: string;
  defaultCallToAction?: string;
  defaultPageId?: string;
  /** No modo edição só atualizamos nome e link; mídia não é obrigatória. */
  isEditMode?: boolean;
  /** Rótulo do botão de envio (ex.: "Salvar edição" no modo editar). */
  submitLabel?: string;
  onSubmit: (body: MetaAdFormBody) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
};

export default function MetaAdForm({
  adAccountId,
  adsetId,
  adsetName,
  defaultName = "",
  defaultLink = "",
  defaultMessage = "",
  defaultTitle = "",
  defaultCallToAction = "LEARN_MORE",
  defaultPageId = "",
  isEditMode = false,
  submitLabel,
  onSubmit,
  onCancel,
  saving,
  error,
}: Props) {
  const [pageId, setPageId] = useState(defaultPageId);
  const [pages, setPages] = useState<Page[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [adName, setAdName] = useState(defaultName);
  const [adLink, setAdLink] = useState(defaultLink);
  const [adMessage, setAdMessage] = useState(defaultMessage);
  const [adTitle, setAdTitle] = useState(defaultTitle);
  const [callToAction, setCallToAction] = useState(defaultCallToAction);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [imageHash, setImageHash] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => {
    if (!adAccountId) return;
    setLoadingPages(true);
    const query = new URLSearchParams({ ad_account_id: adAccountId });
    fetch(`/api/meta/promote-pages?${query.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.pages?.length) {
          setPages(json.pages);
          if (!pageId && json.pages[0]) setPageId(json.pages[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPages(false));
  }, [adAccountId]);

  useEffect(() => {
    if (!adAccountId) return;
    Promise.all([
      fetch(`/api/meta/adimages?ad_account_id=${encodeURIComponent(adAccountId)}`).then((r) => r.json()),
      fetch(`/api/meta/advideos?ad_account_id=${encodeURIComponent(adAccountId)}`).then((r) => r.json()),
    ]).then(([imgJson, vidJson]) => {
      if (imgJson.images) setLibraryImages(imgJson.images);
      if (vidJson.videos) setLibraryVideos(vidJson.videos);
    }).catch(() => {});
  }, [adAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasImage = imageHash.trim() || imageUrl.trim();
    const hasVideo = mediaType === "video" && videoId.trim();
    if (!adMessage.trim()) return;
    if (!isEditMode) {
      if (mediaType === "image" && !hasImage) return;
      if (mediaType === "video" && (!hasVideo || !hasImage)) return;
    }
    if (!pageId) return;
    onSubmit({
      name: adName.trim() || "Anúncio",
      page_id: pageId,
      link: adLink.trim(),
      message: adMessage.trim(),
      title: adTitle.trim() || undefined,
      call_to_action: callToAction,
      ...(mediaType === "video"
        ? { video_id: videoId, image_hash: imageHash || undefined, image_url: imageUrl || undefined }
        : { image_hash: imageHash || undefined, image_url: imageUrl || undefined }),
    });
  };

  const canSubmit =
    adMessage.trim() &&
    pageId &&
    (mediaType === "image" ? (imageHash.trim() || imageUrl.trim()) : (videoId.trim() && (imageHash.trim() || imageUrl.trim())));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 gap-0">
      <div className="flex items-start gap-2 mb-1">
        <h3 className="text-base md:text-lg font-semibold text-text-primary flex items-center gap-2 min-w-0 flex-1">
          <ImageIcon className="h-5 w-5 text-shopee-orange shrink-0" />
          <span>{isEditMode ? "Editar anúncio" : "Novo anúncio"}</span>
          {!isEditMode && (
            <span
              className="inline-flex shrink-0"
              title="Criativo com link (imagem ou vídeo + texto)."
              aria-label="Ajuda"
            >
              <HelpCircle className="h-4 w-4 text-text-secondary/45 hover:text-shopee-orange cursor-help" />
            </span>
          )}
        </h3>
      </div>
      {adsetName && (
        <p className="text-xs md:text-sm text-text-secondary mb-2">
          Conjunto: <strong className="text-text-primary">{adsetName}</strong>
        </p>
      )}

      <div className="flex-1 min-h-0 max-md:max-h-[min(70dvh,560px)] max-md:overflow-y-auto max-md:scrollbar-shopee max-md:pr-1 md:overflow-visible space-y-3 md:space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-3 gap-3">
          <div>
            <MetaFormLabel htmlFor="ad-page">Página do Facebook</MetaFormLabel>
            {loadingPages ? (
              <p className="text-xs text-text-secondary">Carregando páginas...</p>
            ) : (
              <select
                id="ad-page"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm"
              >
                <option value="">Selecione a página</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {!loadingPages && pages.length === 0 && adAccountId && (
              <p className="text-[10px] text-amber-500 mt-1">Nenhuma página na conta. Vincule no Meta.</p>
            )}
          </div>
          <div>
            <MetaFormLabel htmlFor="ad-name">Nome do anúncio</MetaFormLabel>
            <input
              id="ad-name"
              type="text"
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              placeholder="Ex: Anúncio 1 - Shopee"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
          </div>
        </div>

        <div>
          <MetaFormLabel
            htmlFor="ad-link"
            hint="Opcional. Você pode gerar ou colar o link depois no ATI."
          >
            Link de destino
          </MetaFormLabel>
          <input
            id="ad-link"
            type="url"
            value={adLink}
            onChange={(e) => setAdLink(e.target.value)}
            placeholder="https:// ou deixe em branco"
            className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
          />
        </div>
        <div>
          <MetaFormLabel
            htmlFor="ad-message"
            hint="Campo principal do texto do anúncio no Meta (message)."
          >
            Texto do anúncio
          </MetaFormLabel>
          <textarea
            id="ad-message"
            value={adMessage}
            onChange={(e) => setAdMessage(e.target.value)}
            placeholder="Descrição ou chamada para ação..."
            rows={2}
            className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60 resize-none"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-3 gap-3">
          <div>
            <MetaFormLabel htmlFor="ad-title" hint="Título opcional exibido no link.">
              Título
            </MetaFormLabel>
            <input
              id="ad-title"
              type="text"
              value={adTitle}
              onChange={(e) => setAdTitle(e.target.value)}
              placeholder="Título do link"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
            />
          </div>
          <div>
            <MetaFormLabel htmlFor="ad-cta">Chamada para ação</MetaFormLabel>
            <select
              id="ad-cta"
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm"
            >
              {META_CALL_TO_ACTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <MetaFormLabel hint="Tipo de mídia principal do criativo.">Tipo de mídia</MetaFormLabel>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMediaType("image"); setVideoId(""); }}
              className={`flex items-center gap-2 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg border text-sm font-medium ${mediaType === "image" ? "bg-shopee-orange border-shopee-orange text-white" : "border-dark-border text-text-primary hover:bg-dark-bg"}`}
            >
              <ImageIcon className="h-4 w-4" /> Imagem
            </button>
            <button
              type="button"
              onClick={() => { setMediaType("video"); setVideoId(""); }}
              className={`flex items-center gap-2 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg border text-sm font-medium ${mediaType === "video" ? "bg-shopee-orange border-shopee-orange text-white" : "border-dark-border text-text-primary hover:bg-dark-bg"}`}
            >
              <Video className="h-4 w-4" /> Vídeo
            </button>
          </div>
        </div>

      {mediaType === "image" && (
        <>
          <div className="rounded-lg border border-dark-border bg-dark-bg/50 p-2.5 md:p-3 space-y-2">
            <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-shopee-orange" />
              Imagem do anúncio
            </h4>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploadingImage ? "Enviando..." : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingImage || !adAccountId}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !adAccountId) return;
                    setUploadingImage(true);
                    try {
                      const form = new FormData();
                      form.set("file", f);
                      form.set("ad_account_id", adAccountId);
                      const res = await fetch("/api/meta/adimages", { method: "POST", body: form });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json?.error ?? "Erro");
                      setImageHash(json.hash);
                      setImageUrl("");
                      setLibraryImages((prev) => [{ hash: json.hash, url: null, id: null }, ...prev]);
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <div className="flex-1 min-w-[180px]">
                <select
                  value={imageHash}
                  onChange={(e) => { setImageHash(e.target.value); if (e.target.value) setImageUrl(""); }}
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                >
                  <option value="">Escolher da biblioteca...</option>
                  {libraryImages.map((img) => (
                    <option key={img.hash} value={img.hash}>{img.hash.slice(0, 16)}…</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <MetaFormLabel htmlFor="ad-img-url" hint="Alternativa ao upload ou biblioteca.">
                URL da imagem
              </MetaFormLabel>
              <input
                id="ad-img-url"
                type="url"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageHash(""); }}
                placeholder="https://..."
                className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm"
              />
            </div>
          </div>
        </>
      )}

      {mediaType === "video" && (
        <div className="rounded-lg border border-dark-border bg-dark-bg/50 p-2.5 md:p-3 space-y-2">
          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Video className="h-4 w-4 text-shopee-orange" />
            Vídeo e imagem de capa
          </h4>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg cursor-pointer">
              <Upload className="h-4 w-4" />
              {uploadingVideo ? "Enviando..." : "Enviar vídeo"}
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                disabled={uploadingVideo || !adAccountId}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !adAccountId) return;
                  setUploadingVideo(true);
                  try {
                    const form = new FormData();
                    form.set("file", f);
                    form.set("ad_account_id", adAccountId);
                    const res = await fetch("/api/meta/advideos", { method: "POST", body: form });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json?.error ?? "Erro");
                    setVideoId(json.video_id);
                    setLibraryVideos((prev) => [{ id: json.video_id, title: json.video_id, source: null, length: null, picture: null }, ...prev]);
                  } finally {
                    setUploadingVideo(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <div className="flex-1 min-w-[180px]">
              <select
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
              >
                <option value="">Escolher vídeo da biblioteca...</option>
                {libraryVideos.map((v) => (
                  <option key={v.id} value={v.id}>{v.title} {v.length != null ? `(${Math.round(v.length)}s)` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs font-medium text-text-primary flex items-center gap-1">
            Capa do vídeo
            <span title="Obrigatório para anúncio em vídeo." aria-label="Ajuda">
              <HelpCircle className="h-3.5 w-3.5 text-text-secondary/45 hover:text-shopee-orange cursor-help" />
            </span>
          </p>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <label className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-dark-bg cursor-pointer">
              <Upload className="h-4 w-4" />
              Enviar imagem
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingImage || !adAccountId}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !adAccountId) return;
                  setUploadingImage(true);
                  try {
                    const form = new FormData();
                    form.set("file", f);
                    form.set("ad_account_id", adAccountId);
                    const res = await fetch("/api/meta/adimages", { method: "POST", body: form });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json?.error ?? "Erro");
                    setImageHash(json.hash);
                    setImageUrl("");
                    setLibraryImages((prev) => [{ hash: json.hash, url: null, id: null }, ...prev]);
                  } finally {
                    setUploadingImage(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <select
              value={imageHash}
              onChange={(e) => { setImageHash(e.target.value); if (e.target.value) setImageUrl(""); }}
              className="rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            >
              <option value="">Biblioteca...</option>
              {libraryImages.map((img) => (
                <option key={img.hash} value={img.hash}>{img.hash.slice(0, 12)}…</option>
              ))}
            </select>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageHash(""); }}
              placeholder="URL da capa"
              className="flex-1 min-w-[120px] rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            />
          </div>
        </div>
      )}

      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-400 shrink-0">{error}</div>
      )}
      <div className="flex gap-3 pt-2 md:pt-1.5 mt-1 border-t border-dark-border/50 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-dark-border px-3 py-1.5 md:px-4 md:py-2 text-sm font-medium text-text-primary hover:bg-dark-bg"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="flex items-center gap-2 rounded-md bg-shopee-orange px-3 py-1.5 md:px-4 md:py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel ?? "Criar anúncio"}
        </button>
      </div>
    </form>
  );
}
