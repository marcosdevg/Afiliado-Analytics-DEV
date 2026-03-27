import { NextResponse } from "next/server";

/**
 * A chave da ElevenLabs deve vir só de ELEVENLABS_API_KEY (.env.local / Vercel).
 * Antes existia um fallback hardcoded no repositório — removido por segurança e porque expira/revoga.
 */
export function requireElevenLabsApiKey():
  | { ok: true; key: string }
  | { ok: false; response: NextResponse } {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Configure ELEVENLABS_API_KEY no ambiente (ex.: .env.local e variáveis na Vercel). Reinicie o servidor de desenvolvimento após alterar o .env.",
        },
        { status: 503 }
      ),
    };
  }
  return { ok: true, key };
}
