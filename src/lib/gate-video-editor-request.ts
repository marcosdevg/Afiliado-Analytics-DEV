/**
 * Helper centralizado para gating de todas as APIs do editor de vídeo.
 */

import { NextResponse } from "next/server";
import { gateGeradorCriativos } from "./require-entitlements";

export async function assertVideoEditorPro(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const result = await gateGeradorCriativos();
  if (!result.allowed) {
    return { ok: false, response: result.response };
  }
  return { ok: true, userId: result.userId };
}
