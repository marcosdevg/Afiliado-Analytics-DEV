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
import { gateGeradorCriativos } from "@/lib/require-entitlements";
import { createClient } from "../../../../../utils/supabase/server";
import { getEntitlementsForUser, getUsageSnapshot, recordVideoExportUsage } from "@/lib/plan-server";
import { REMOTION_COMPOSITION_ID } from "../../../../../remotion/constants";
import type { VideoInputProps } from "../../../../../remotion/types";
import { formatUploadError } from "../../../../lib/remotion/format-upload-error";
import {
  bundleRemotionProject,
  formatSSE,
  REMOTION_BUNDLE_DIR,
  type RenderProgress,
} from "./helpers";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Diretório base no filesystem do Sandbox onde o Remotion copia o bundle.
 * Deve coincidir com `REMOTION_SANDBOX_BUNDLE_DIR` em `@remotion/vercel` (addBundleToSandbox).
 * Sem criar este diretório antes, o primeiro `mkDir('remotion-bundle/public')` falha com
 * "No such file or directory" (pai `remotion-bundle` inexistente).
 */
const REMOTION_SANDBOX_BUNDLE_DIR = "remotion-bundle";

/** Mensagens curtas para o usuário (sem termos técnicos: sandbox, blob, dependências, etc.). */
function friendlyPrepPhase(progress: number): string {
  if (progress < 0.34) return "Preparando...";
  if (progress < 0.67) return "Só mais um instante...";
  return "Quase pronto...";
}

function assertBundleExists(): void {
  const abs = path.join(process.cwd(), REMOTION_BUNDLE_DIR);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Bundle Remotion não encontrado em ${REMOTION_BUNDLE_DIR}. Rode "npm run remotion:bundle" localmente ou confira o script de build na Vercel.`,
    );
  }
}

export async function POST(req: Request) {
  // Gate: apenas Pro pode exportar vídeos
  const gate = await gateGeradorCriativos();
  if (!gate.allowed) return gate.response;

  // Limite diário de exports
  const supabase = await createClient();
  const ent = await getEntitlementsForUser(supabase, gate.userId);
  if (ent.videoExportsPerDay !== null) {
    const usage = await getUsageSnapshot(supabase, gate.userId);
    if (usage.videoExportsToday >= ent.videoExportsPerDay) {
      return NextResponse.json(
        { error: `Limite de ${ent.videoExportsPerDay} exportação(ões) por dia atingido. Tente novamente amanhã.` },
        { status: 403 },
      );
    }
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
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
    await send({ type: "phase", phase: "Preparando...", progress: 0 });

    const sandbox = await createSandbox({
      onProgress: async ({ progress }) => {
        await send({
          type: "phase",
          phase: friendlyPrepPhase(progress),
          progress,
        });
      },
    });

    try {
      if (!process.env.VERCEL) {
        bundleRemotionProject();
      } else {
        assertBundleExists();
      }

      await sandbox.mkDir(REMOTION_SANDBOX_BUNDLE_DIR);

      await addBundleToSandbox({
        sandbox,
        bundleDir: REMOTION_BUNDLE_DIR,
      });

      await send({ type: "phase", phase: "Gerando vídeo...", progress: 0.05 });

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
                phase: "Carregando...",
                progress: update.overallProgress,
              });
              break;
            case "selecting-composition":
              await send({
                type: "phase",
                phase: "Montando o vídeo...",
                progress: update.overallProgress,
              });
              break;
            case "render-progress":
              await send({
                type: "phase",
                phase: "Gerando vídeo...",
                progress: update.overallProgress,
              });
              break;
            default:
              break;
          }
        },
      });

      await send({ type: "phase", phase: "Salvando seu vídeo...", progress: 1 });

      const { url, size } = await uploadToVercelBlob({
        sandbox,
        sandboxFilePath,
        contentType: contentType?.trim() || "video/mp4",
        blobToken,
        access: "public",
      });

      await recordVideoExportUsage(supabase, gate.userId);
      await send({ type: "done", url, size });
    } catch (err) {
      console.error("render-mp4", err);
      await send({
        type: "error",
        message: formatUploadError(err, "render-mp4"),
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
