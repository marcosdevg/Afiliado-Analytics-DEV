/**
 * ElevenLabs TTS para o Gerador de Criativos.
 * - mode "preview": TTS simples (sem timestamps) — economiza custo; só áudio.
 * - mode "full": with-timestamps + legendas; limite diário por plano (UTC).
 *
 * GET → { fullGenerationsUsedToday, fullGenerationsLimit }
 * POST { text, voiceId, mode?: "preview" | "full" }
 */

import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { requireElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { getEntitlementsForUser } from "@/lib/plan-server";
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

function utcTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const supabase = await createClient();
    const ent = await getEntitlementsForUser(supabase, gate.userId);
    const voiceFullDailyLimit = ent.voicegenerate ?? 0;
    const today = utcTodayString();
    const { count, error } = await supabase
      .from("video_editor_voice_full_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", gate.userId)
      .eq("usage_day", today);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      fullGenerationsUsedToday: count ?? 0,
      fullGenerationsLimit: voiceFullDailyLimit,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao consultar limite" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const keyRes = requireElevenLabsApiKey();
    if (!keyRes.ok) return keyRes.response;
    const supabase = await createClient();
    const ent = await getEntitlementsForUser(supabase, gate.userId);
    const voiceFullDailyLimit = ent.voicegenerate ?? 0;

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    const voiceId = String(body?.voiceId ?? "").trim();
    const mode = body?.mode === "full" ? "full" : "preview";

    if (!text) return NextResponse.json({ error: "text é obrigatório" }, { status: 400 });
    if (!voiceId) return NextResponse.json({ error: "voiceId é obrigatório" }, { status: 400 });

    const ttsBody = {
      text,
      model_id: "eleven_multilingual_v2",
      language_code: "pt",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    };

    if (mode === "preview") {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": keyRes.key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify(ttsBody),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `ElevenLabs ${res.status}: ${errText.slice(0, 300)}` },
          { status: 502 }
        );
      }

      const buf = Buffer.from(await res.arrayBuffer());
      const audioBase64 = buf.toString("base64");

      return NextResponse.json({
        mode: "preview",
        audioBase64,
        captions: [] as CaptionWord[],
      });
    }

    // full — com timestamps + limite diário por plano
    const today = utcTodayString();

    const { count: usedCount, error: countErr } = await supabase
      .from("video_editor_voice_full_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", gate.userId)
      .eq("usage_day", today);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const n = usedCount ?? 0;
    if (n >= voiceFullDailyLimit) {
      return NextResponse.json(
        {
          error: `Limite diário atingido: ${voiceFullDailyLimit} gerações de voz + legendas por dia. Volte amanhã ou use só a prévia (Ouvir voz).`,
          limitReached: true,
          fullGenerationsUsedToday: n,
          fullGenerationsLimit: voiceFullDailyLimit,
        },
        { status: 429 }
      );
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": keyRes.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ttsBody),
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

    const { error: insErr } = await supabase.from("video_editor_voice_full_usage").insert({
      user_id: gate.userId,
      usage_day: today,
    });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      mode: "full",
      audioBase64,
      captions,
      fullGenerationsUsedToday: n + 1,
      fullGenerationsLimit: voiceFullDailyLimit,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar áudio" },
      { status: 500 }
    );
  }
}
