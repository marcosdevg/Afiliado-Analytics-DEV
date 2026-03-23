import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { NextResponse } from "next/server";
import { scrape } from "../../../../server/shopee-scraper-light";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VIDEO_RE = /\.(mp4|m3u8|webm|ts)(\?|$)/i;

export async function POST(req: Request) {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const shopeeUrl = String(body?.url ?? "").trim();
    const mode = String(body?.mode ?? "scrape");

    if (!shopeeUrl) {
      return NextResponse.json({ error: "URL é obrigatória" }, { status: 400 });
    }

    if (mode === "proxy") {
      try {
        const res = await fetch(shopeeUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (!res.ok) return NextResponse.json({ error: `Erro ${res.status}` }, { status: 502 });
        const buf = await res.arrayBuffer();
        const ct = res.headers.get("content-type") || "application/octet-stream";
        const isVideo = VIDEO_RE.test(shopeeUrl) || ct.includes("video");
        return new NextResponse(buf, {
          headers: { "Content-Type": ct, "X-Media-Type": isVideo ? "video" : "image" },
        });
      } catch {
        return NextResponse.json({ error: "Falha ao baixar mídia" }, { status: 502 });
      }
    }

    const result = await scrape(shopeeUrl);

    if (result.error && (!result.media || result.media.length === 0)) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    if (!result.media || result.media.length === 0) {
      return NextResponse.json({ error: "Nenhuma mídia encontrada neste produto." }, { status: 404 });
    }

    return NextResponse.json({
      productName: result.productName,
      media: result.media,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao processar" },
      { status: 500 }
    );
  }
}
