import type { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const EXEC_TIMEOUT_MS = 240_000;

function getVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error("Não foi possível ler a duração do vídeo."));
        return;
      }
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir este vídeo no navegador."));
    };
    v.src = url;
  });
}

function safeInputExt(name: string): string {
  const raw = (name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["mp4", "webm", "mov", "m4v", "mkv", "avi"].includes(raw)) return raw;
  return "mp4";
}

function readFileAsUint8(data: Uint8Array | string): Uint8Array {
  if (typeof data === "string") {
    throw new Error("Saída inválida do conversor de vídeo.");
  }
  return data;
}

/**
 * Carrega FFmpeg.wasm uma vez (proxy same-origin em /ffmpeg-core/* — ver next.config).
 */
export async function ensureFfmpegLoaded(): Promise<FFmpeg> {
  if (typeof window === "undefined") {
    throw new Error("Compressão de vídeo só funciona no navegador.");
  }
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    const origin = window.location.origin;
    const coreURL = await toBlobURL(`${origin}/ffmpeg-core/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${origin}/ffmpeg-core/ffmpeg-core.wasm`, "application/wasm");
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegSingleton = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    ffmpegSingleton = null;
    throw e;
  }
}

export type VideoCompressProgress =
  | { phase: "load" }
  | { phase: "encode"; attempt: number; label: string };

/**
 * Reencoda no navegador até caber em maxBytes (H.264 + AAC ou sem áudio).
 */
export async function compressVideoFileToMaxBytes(
  file: File,
  maxBytes: number,
  onProgress?: (p: VideoCompressProgress) => void,
): Promise<Blob> {
  const durationSec = await getVideoDurationSec(file);
  const minTotalKbps = (maxBytes * 8) / 1000 / durationSec;
  if (minTotalKbps < 90) {
    throw new Error(
      "Este vídeo é longo demais para caber em ~4 MB com qualidade usável. Tente um clipe mais curto ou grave em resolução menor.",
    );
  }

  onProgress?.({ phase: "load" });
  const ffmpeg = await ensureFfmpegLoaded();
  const { fetchFile } = await import("@ffmpeg/util");

  const inName = `in.${safeInputExt(file.name)}`;
  const outName = "out.mp4";

  await ffmpeg.writeFile(inName, await fetchFile(file));

  const audioKbps = 64;
  const plan: { maxW: number; fudge: number; audio: boolean }[] = [
    { maxW: 720, fudge: 0.82, audio: true },
    { maxW: 720, fudge: 0.62, audio: true },
    { maxW: 540, fudge: 0.78, audio: true },
    { maxW: 540, fudge: 0.58, audio: true },
    { maxW: 480, fudge: 0.72, audio: true },
    { maxW: 480, fudge: 0.52, audio: true },
    { maxW: 360, fudge: 0.68, audio: true },
    { maxW: 360, fudge: 0.48, audio: true },
    { maxW: 360, fudge: 0.42, audio: false },
    { maxW: 320, fudge: 0.38, audio: false },
  ];

  const targetVideoKbps = (fudge: number, withAudio: boolean) => {
    const totalKbps = ((maxBytes * 8) / 1000 / durationSec) * fudge;
    const v = totalKbps - (withAudio ? audioKbps : 0);
    return Math.max(40, Math.floor(v));
  };

  let attemptLabel = "";
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.({
      phase: "encode",
      attempt: 0,
      label: attemptLabel ? `${attemptLabel} · ${Math.round(progress * 100)}%` : `${Math.round(progress * 100)}%`,
    });
  };

  ffmpeg.on("progress", progressHandler);

  try {
    for (let i = 0; i < plan.length; i++) {
      const { maxW, fudge, audio } = plan[i];
      attemptLabel = `${maxW}px · ${i + 1}/${plan.length}`;
      onProgress?.({
        phase: "encode",
        attempt: i + 1,
        label: attemptLabel,
      });

      try {
        await ffmpeg.deleteFile(outName);
      } catch {
        /* ok */
      }

      const vk = targetVideoKbps(fudge, audio);
      const bufsize = Math.max(vk * 2, 200);
      const vf = `scale='min(${maxW},iw)':-2`;

      const args: string[] = [
        "-i",
        inName,
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-b:v",
        `${vk}k`,
        "-maxrate",
        `${vk}k`,
        "-bufsize",
        `${bufsize}k`,
        ...(audio ? ["-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "44100"] : ["-an"]),
        "-movflags",
        "+faststart",
        outName,
      ];

      const code = await ffmpeg.exec(args, EXEC_TIMEOUT_MS);
      if (code !== 0) continue;

      const data = readFileAsUint8(await ffmpeg.readFile(outName));
      if (data.byteLength <= maxBytes && data.byteLength > 0) {
        await ffmpeg.deleteFile(inName);
        await ffmpeg.deleteFile(outName);
        return new Blob([new Uint8Array(data)], { type: "video/mp4" });
      }
    }
  } finally {
    ffmpeg.off("progress", progressHandler);
  }

  try {
    await ffmpeg.deleteFile(inName);
  } catch {
    /* ignore */
  }
  try {
    await ffmpeg.deleteFile(outName);
  } catch {
    /* ignore */
  }

  throw new Error(
    "Não deu para reduzir o vídeo o suficiente neste aparelho. Tente um arquivo mais curto, menor resolução ou use o link da Shopee.",
  );
}
