/**
 * Gerar áudio com ElevenLabs TTS + timestamps para legendas sincronizadas.
 * Usa o endpoint with-timestamps que retorna character-level timing.
 * POST { text, voiceId } → { audioBase64, captions: { text, startMs, endMs }[] }
 */

import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_ee8e7c34a6083c306e7840b42cfcc65d6748619bed210fa0";

type CharAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type CaptionWord = { text: string; startMs: number; endMs: number };

function charsToWords(alignment: CharAlignment): CaptionWord[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  if (!characters?.length) return [];

  const words: CaptionWord[] = [];
  let wordChars: string[] = [];
  let wordStart = -1;
  let wordEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    const start = character_start_times_seconds[i] ?? 0;
    const end = character_end_times_seconds[i] ?? start;

    if (ch === " " || ch === "\n" || ch === "\t") {
      if (wordChars.length > 0) {
        words.push({
          text: wordChars.join(""),
          startMs: Math.round(wordStart * 1000),
          endMs: Math.round(wordEnd * 1000),
        });
        wordChars = [];
        wordStart = -1;
      }
      continue;
    }

    if (wordStart < 0) wordStart = start;
    wordEnd = end;
    wordChars.push(ch);
  }

  if (wordChars.length > 0) {
    words.push({
      text: wordChars.join(""),
      startMs: Math.round(wordStart * 1000),
      endMs: Math.round(wordEnd * 1000),
    });
  }

  return words;
}

export async function POST(req: Request) {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    const voiceId = String(body?.voiceId ?? "").trim();

    if (!text) return NextResponse.json({ error: "text é obrigatório" }, { status: 400 });
    if (!voiceId) return NextResponse.json({ error: "voiceId é obrigatório" }, { status: 400 });

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          language_code: "pt",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `ElevenLabs ${res.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const json = await res.json();

    const audioBase64: string = json.audio_base64 ?? "";
    const alignment: CharAlignment | undefined = json.alignment;

    let captions: CaptionWord[] = [];
    if (alignment) {
      captions = charsToWords(alignment);
    }

    return NextResponse.json({ audioBase64, captions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar áudio" },
      { status: 500 }
    );
  }
}
