import {
  addBundleToSandbox,
  createSandbox,
  renderMediaOnVercel,
  uploadToVercelBlob,
} from "@remotion/vercel";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { REMOTION_COMPOSITION_ID } from "../../../../../remotion/constants";
import type { VideoInputProps } from "../../../../../remotion/types";
import {
  bundleRemotionProject,
  formatSSE,
  REMOTION_BUNDLE_DIR,
  type RenderProgress,
} from "./helpers";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function assertBundleExists(): void {
  const abs = path.join(process.cwd(), REMOTION_BUNDLE_DIR);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Bundle Remotion não encontrado em ${REMOTION_BUNDLE_DIR}. Rode "npm run remotion:bundle" localmente ou confira o script de build na Vercel.`,
    );
  }
}

export async function POST(req: Request) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN não configurado. No Vercel: Storage → Blob → Connect to Project → redeploy.",
      },
      { status: 500 },
    );
  }

  let body: { inputProps?: VideoInputProps };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const inputProps = body.inputProps;
  if (!inputProps || typeof inputProps !== "object") {
    return NextResponse.json({ error: "inputProps é obrigatório" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (message: RenderProgress) => {
    await writer.write(encoder.encode(formatSSE(message)));
  };

  const runRender = async () => {
    await send({ type: "phase", phase: "Criando sandbox...", progress: 0 });

    const sandbox = await createSandbox({
      onProgress: async ({ progress, message }) => {
        await send({
          type: "phase",
          phase: message ?? "Preparando ambiente...",
          progress,
          subtitle: process.env.VERCEL ? undefined : "Desenvolvimento local pode ser mais lento.",
        });
      },
    });

    try {
      if (!process.env.VERCEL) {
        bundleRemotionProject();
      } else {
        assertBundleExists();
      }

      await addBundleToSandbox({
        sandbox,
        bundleDir: REMOTION_BUNDLE_DIR,
      });

      await send({ type: "phase", phase: "Renderizando vídeo...", progress: 0.05 });

      const { sandboxFilePath, contentType } = await renderMediaOnVercel({
        sandbox,
        compositionId: REMOTION_COMPOSITION_ID,
        inputProps,
        codec: "h264",
        onProgress: async (update) => {
          switch (update.stage) {
            case "opening-browser":
              await send({
                type: "phase",
                phase: "Abrindo navegador...",
                progress: update.overallProgress,
              });
              break;
            case "selecting-composition":
              await send({
                type: "phase",
                phase: "Selecionando composição...",
                progress: update.overallProgress,
              });
              break;
            case "render-progress":
              await send({
                type: "phase",
                phase: "Renderizando frames...",
                progress: update.overallProgress,
              });
              break;
            default:
              break;
          }
        },
      });

      await send({ type: "phase", phase: "Enviando para o Blob...", progress: 1 });

      const { url, size } = await uploadToVercelBlob({
        sandbox,
        sandboxFilePath,
        contentType,
        blobToken,
        access: "public",
      });

      await send({ type: "done", url, size });
    } catch (err) {
      console.error(err);
      await send({
        type: "error",
        message: err instanceof Error ? err.message : "Erro no render",
      });
    } finally {
      await sandbox.stop().catch(() => {});
      await writer.close();
    }
  };

  waitUntil(runRender());

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
