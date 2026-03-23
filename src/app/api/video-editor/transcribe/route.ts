/**
 * Transcreve áudio via Grok (xAI) ou OpenAI Whisper API (word-level timestamps).
 * Prioriza GROK_API_KEY. Fallback para OPENAI_API_KEY.
 * POST FormData { audio: File } → { words: { text, startMs, endMs }[] }
 */

import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "Campo 'audio' é obrigatório" }, { status: 400 });
    }

    const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!grokKey && !openaiKey) {
      return NextResponse.json(
        { error: "Nenhuma chave de transcrição configurada (GROK_API_KEY ou OPENAI_API_KEY)" },
        { status: 500 }
      );
    }

    // Prioriza Grok (xAI), fallback OpenAI
    const apiKey = grokKey || openaiKey!;
    const apiUrl = grokKey
      ? "https://api.x.ai/v1/audio/transcriptions"
      : "https://api.openai.com/v1/audio/transcriptions";

    const body = new FormData();
    body.append("file", audioFile, audioFile.name || "audio.mp3");
    body.append("model", "whisper-1");
    body.append("response_format", "verbose_json");
    body.append("timestamp_granularities[]", "word");
    body.append("language", "pt");

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Whisper ${res.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const words: { text: string; startMs: number; endMs: number }[] = [];

    // Tenta extrair de json.words (formato padrão Whisper verbose_json com word timestamps)
    if (Array.isArray(json.words)) {
      for (const w of json.words) {
        const txt = String(w.word ?? w.text ?? "").trim();
        if (!txt) continue;
        words.push({
          text: txt,
          startMs: Math.round((w.start ?? 0) * 1000),
          endMs: Math.round((w.end ?? 0) * 1000),
        });
      }
    }

    // Fallback: tenta extrair dos segments
    if (words.length === 0 && Array.isArray(json.segments)) {
      for (const seg of json.segments) {
        if (Array.isArray(seg.words)) {
          for (const w of seg.words) {
            const txt = String(w.word ?? w.text ?? "").trim();
            if (!txt) continue;
            words.push({
              text: txt,
              startMs: Math.round((w.start ?? 0) * 1000),
              endMs: Math.round((w.end ?? 0) * 1000),
            });
          }
        }
      }
    }

    return NextResponse.json({ words, text: json.text ?? "" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro na transcrição" },
      { status: 500 }
    );
  }
}
