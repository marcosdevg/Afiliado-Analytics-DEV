import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { formatUploadError } from "../../../../lib/remotion/format-upload-error";
import { RENDER_PUBLISH_BLOB_MAX_BYTES } from "../../../../lib/remotion/render-limits";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await assertVideoEditorPro();
  if (!gate.ok) return gate.response;

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN não configurado." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Campo 'file' é obrigatório" }, { status: 400 });
  }

  if (file.size > RENDER_PUBLISH_BLOB_MAX_BYTES) {
    const mb = Math.round(RENDER_PUBLISH_BLOB_MAX_BYTES / (1024 * 1024));
    return NextResponse.json(
      {
        error: `Arquivo acima de ~${mb}MB neste passo. Para vídeos maiores, importe da Shopee (link público) ou comprima o arquivo.`,
      },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const nameHint =
    typeof (file as File).name === "string" && (file as File).name
      ? (file as File).name.replace(/[^a-zA-Z0-9._-]/g, "_")
      : "media.bin";
  const pathname = `render-temp/${Date.now()}-${Math.random().toString(36).slice(2)}-${nameHint}`;

  try {
    const result = await put(pathname, buf, {
      access: "public",
      token,
      addRandomSuffix: true,
    });
    return NextResponse.json({ url: result.url });
  } catch (e) {
    const message = formatUploadError(e, "publish-blob-for-render");
    console.error("publish-blob-for-render", {
      message,
      pathname,
      sizeBytes: buf.length,
      nameHint,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
