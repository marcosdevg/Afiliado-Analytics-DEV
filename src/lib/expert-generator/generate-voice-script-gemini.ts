/**
 * Roteiro falado para Veo — texto via Gemini (GEMINI_API_KEY), modelo só texto.
 * `gemini-2.0-flash` deixou de estar disponível para contas novas; usamos 2.5 por defeito.
 */

export type VoiceScriptGeminiResult =
  | { ok: true; script: string; modelUsed: string }
  | { ok: false; error: string; detail?: string };

type GeminiTextResponse = {
  error?: { message?: string; code?: number; status?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
};

const DEFAULT_TEXT_MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
] as const;

function extractText(json: GeminiTextResponse): string | null {
  const parts = json.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;
  const t = parts.map((p) => p.text ?? "").join("").trim();
  return t || null;
}

/**
 * Teto de palavras pós-IA (~2–2,5 palavras/s em PT-BR).
 * Chão no prompt: a IA deve preencher o tempo do vídeo, não responder com 3–5 palavras.
 */
const VOICE_SCRIPT_WORD_RANGE: Record<
  4 | 6 | 8 | 12,
  { min: number; max: number }
> = {
  4: { min: 7, max: 11 },
  6: { min: 12, max: 16 },
  8: { min: 18, max: 22 },
  12: { min: 24, max: 30 },
};

function buildPrompt(params: {
  productBrief: string;
  durationSeconds: 4 | 6 | 8 | 12;
  motionSummary: string;
  voiceGender: "female" | "male";
}): string {
  const { min, max } = VOICE_SCRIPT_WORD_RANGE[params.durationSeconds];

  const genderPt =
    params.voiceGender === "female"
      ? "voz feminina, tom natural de influencer"
      : "voz masculina, tom natural de influencer";

  return `És copywriter para vídeos curtos verticais (UGC / direct response) em português do Brasil.

O vídeo tem EXATAMENTE ${params.durationSeconds} segundos. Em fala natural de anúncio (PT-BR) cabem cerca de 2 a 2,5 palavras por segundo.

REGRA DE COMPRIMENTO (obrigatória):
- O monólogo deve ter ENTRE ${min} e ${max} palavras, inclusive. Conta as palavras antes de responder.
- Para ${params.durationSeconds}s, mira o teto (${max} palavras): usa quase todo o tempo com 2 frases curtas ou uma frase + complemento (benefício, prova social leve ou CTA), sempre com frases COMPLETAS.
- PROIBIDO: respostas ridiculamente curtas (ex.: 3 a 6 palavras). PROIBIDO: mais de ${max} palavras ou blocos longos tipo 35+ palavras.

Produto (descrição breve do anunciante):
${params.productBrief.trim()}

Contexto de movimento/cena do vídeo (se útil):
${params.motionSummary.trim() || "(não especificado)"}

Escreve APENAS o texto que a pessoa vai FALAR em voz alta — primeira pessoa, conversacional, convincente, sem saudações genéricas longas, sem indicações de encenação entre parênteses, sem numeração, sem título.
Tom: ${genderPt}.
Não menciones duração, segundos, "este vídeo" ou a palavra "roteiro".
Responde só com o monólogo (${min}–${max} palavras, frases completas).`;
}

function truncateScriptToMaxWords(script: string, maxWords: number): string {
  const trimmed = script.trim();
  if (!trimmed) return trimmed;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return trimmed;
  return words.slice(0, maxWords).join(" ");
}

function countWords(script: string): number {
  const t = script.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function buildExpandPrompt(params: {
  durationSeconds: 4 | 6 | 8 | 12;
  tooShortScript: string;
  min: number;
  max: number;
}): string {
  return `O roteiro abaixo tem poucas palavras para um vídeo de ${params.durationSeconds} segundos de voz. Reescreve sobre o MESMO produto/ideia, em português do Brasil, primeira pessoa, tom de influencer.

Requisitos:
- Entre ${params.min} e ${params.max} palavras (conta antes de responder).
- Frases completas; não cortes a meio.
- Não menciones duração, segundos ou "roteiro".

Texto demasiado curto (expande e melhora):
${params.tooShortScript.trim()}

Responde só com o monólogo novo (${params.min}–${params.max} palavras).`;
}

/** Modelos 2.5 podem usar orçamento interno; 512 corta a meio da palavra ("Perfe…"). */
const GEMINI_TEXT_MAX_OUTPUT_TOKENS = 8192;

type GenerateOnceOk = {
  ok: true;
  script: string;
  modelUsed: string;
  finishReason: string;
};
type GenerateOnceFail = { ok: false; error: string; detail?: string };
type GenerateOnceResult = GenerateOnceOk | GenerateOnceFail;

function finishReasonHitLimit(reason: string): boolean {
  const r = (reason || "").toUpperCase();
  return r.includes("MAX") && r.includes("TOKEN");
}

/** Texto que parece cortado a meio (ex.: termina em "Perfe" sem ponto). */
function looksLikeCutMidSentence(script: string): boolean {
  const t = script.trim();
  if (t.length < 8) return false;
  if (/[.!?…]["']?\s*$/.test(t)) return false;
  const parts = t.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  /** Corte típico deixa radical curto (ex.: "Perfe"); palavras completas comuns no fim costumam ter 7+ letras. */
  if (last.length < 4 || last.length > 6) return false;
  if (!/^[A-Za-zÀ-ÿ-]+$/.test(last)) return false;
  return true;
}

function buildRepairTruncationPrompt(script: string, maxWords: number): string {
  return `O monólogo abaixo foi CORTADO no fim — a última palavra pode estar incompleta (ex.: "Perfe" em vez de "Perfeito") ou falta ponto final.

Reescreve o monólogo COMPLETO em português do Brasil, primeira pessoa, tom de influencer/UGC, com frases fechadas e ponto final. No máximo ${maxWords} palavras no total. Mantém a mesma ideia e produto; não cries saudação nova.

Texto cortado:
${script.trim()}

Responde só com o monólogo final completo.`;
}

async function generateOnce(
  model: string,
  apiKey: string,
  prompt: string,
  maxWords: number
): Promise<GenerateOnceResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_ONLY_HIGH" },
      ],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: GEMINI_TEXT_MAX_OUTPUT_TOKENS,
      },
    }),
  });

  const raw = await res.text();
  let json: GeminiTextResponse;
  try {
    json = JSON.parse(raw) as GeminiTextResponse;
  } catch {
    return {
      ok: false,
      error: "Resposta inválida do Gemini (não é JSON).",
      detail: raw.slice(0, 400),
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: json.error?.message ?? `HTTP ${res.status} ao gerar roteiro.`,
      detail: raw.slice(0, 500),
    };
  }

  const scriptRaw = extractText(json);
  if (!scriptRaw) {
    return {
      ok: false,
      error: "O Gemini não devolveu texto utilizável.",
      detail: raw.slice(0, 600),
    };
  }

  const finishReason = String(json.candidates?.[0]?.finishReason ?? "");
  const script = truncateScriptToMaxWords(scriptRaw, maxWords);

  return { ok: true, script, modelUsed: model, finishReason };
}

async function repairTruncatedScriptIfNeeded(
  model: string,
  apiKey: string,
  script: string,
  maxWords: number,
  finishReason: string
): Promise<string> {
  const need =
    finishReasonHitLimit(finishReason) || looksLikeCutMidSentence(script);
  if (!need) return script;

  const repair = await generateOnce(
    model,
    apiKey,
    buildRepairTruncationPrompt(script, maxWords),
    maxWords
  );
  if (!repair.ok) return script;
  return repair.script;
}

function isModelNotFound(r: VoiceScriptGeminiResult): boolean {
  if (r.ok) return false;
  const m = `${r.error}\n${r.detail ?? ""}`;
  return /404|NOT_FOUND|no longer available|not found/i.test(m);
}

export async function generateVoiceScriptWithGemini(params: {
  productBrief: string;
  durationSeconds: 4 | 6 | 8 | 12;
  motionSummary: string;
  voiceGender: "female" | "male";
}): Promise<VoiceScriptGeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "GEMINI_API_KEY não configurada (necessária para gerar roteiro com IA).",
    };
  }

  const envModel = process.env.GEMINI_TEXT_MODEL?.trim();
  const prompt = buildPrompt(params);
  const maxWords = VOICE_SCRIPT_WORD_RANGE[params.durationSeconds].max;

  const ordered: string[] = envModel
    ? [
        envModel,
        ...DEFAULT_TEXT_MODEL_CANDIDATES.filter((m) => m !== envModel),
      ]
    : [...DEFAULT_TEXT_MODEL_CANDIDATES];

  const errors: string[] = [];
  const { min } = VOICE_SCRIPT_WORD_RANGE[params.durationSeconds];

  for (const model of ordered) {
    const gen = await generateOnce(model, apiKey, prompt, maxWords);
    if (!gen.ok) {
      errors.push(`[${model}] ${gen.error}`);
      if (
        /API key not valid|invalid api key|PERMISSION_DENIED/i.test(gen.error)
      ) {
        return gen;
      }
      if (!isModelNotFound(gen)) {
        return gen;
      }
      continue;
    }

    let script = await repairTruncatedScriptIfNeeded(
      model,
      apiKey,
      gen.script,
      maxWords,
      gen.finishReason
    );
    script = truncateScriptToMaxWords(script, maxWords);

    if (countWords(script) < min) {
      const expandPrompt = buildExpandPrompt({
        durationSeconds: params.durationSeconds,
        tooShortScript: script,
        min,
        max: maxWords,
      });
      const expanded = await generateOnce(model, apiKey, expandPrompt, maxWords);
      if (expanded.ok) {
        let s2 = await repairTruncatedScriptIfNeeded(
          model,
          apiKey,
          expanded.script,
          maxWords,
          expanded.finishReason
        );
        s2 = truncateScriptToMaxWords(s2, maxWords);
        if (countWords(s2) >= min) {
          script = s2;
        }
      }
    }

    return { ok: true, script, modelUsed: gen.modelUsed };
  }

  return {
    ok: false,
    error:
      "Nenhum modelo Gemini texto respondeu. Defina GEMINI_TEXT_MODEL (ex.: gemini-2.5-flash) ou verifique a chave.",
    detail: errors.join("\n"),
  };
}
