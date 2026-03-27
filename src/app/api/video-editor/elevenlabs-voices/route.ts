/**
 * Lista vozes disponíveis no ElevenLabs.
 * GET → { voices: [{ voice_id, name, preview_url, labels }] }
 */

import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { requireElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const keyRes = requireElevenLabsApiKey();
    if (!keyRes.ok) return keyRes.response;

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": keyRes.key },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `ElevenLabs ${res.status}` }, { status: 502 });
    }

    const json = await res.json();
    const voices = (json?.voices ?? []).map(
      (v: { voice_id: string; name: string; preview_url?: string; labels?: Record<string, string> }) => ({
        voice_id: v.voice_id,
        name: v.name,
        preview_url: v.preview_url ?? null,
        labels: v.labels ?? {},
      })
    );

    return NextResponse.json({ voices });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao listar vozes" },
      { status: 500 }
    );
  }
}
