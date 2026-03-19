import { execSync } from "node:child_process";

/** Pasta gerada por `npm run remotion:bundle` — enviada ao Sandbox. */
export const REMOTION_BUNDLE_DIR = "remotion/static-bundle";

export function bundleRemotionProject(): void {
  try {
    execSync(
      `npx remotion bundle remotion/Root.tsx --out-dir ${REMOTION_BUNDLE_DIR}`,
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: process.env,
      },
    );
  } catch (e) {
    const stderr = (e as { stderr?: Buffer }).stderr?.toString() ?? "";
    throw new Error(`Remotion bundle falhou: ${stderr || String(e)}`);
  }
}

export type RenderProgress =
  | { type: "phase"; phase: string; progress: number; subtitle?: string }
  | { type: "done"; url: string; size: number }
  | { type: "error"; message: string };

export function formatSSE(message: RenderProgress): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}
