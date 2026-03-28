/**
 * Fallback curto quando ainda aparece 413 (ex.: sessão antiga). O aviso principal é no passo 1 ao escolher o arquivo.
 */
const LARGE_PAYLOAD_USER_MESSAGE =
  "O envio passou do limite do servidor (cerca de 4 a 5 MB). Escolha um arquivo menor no passo 1 ou use o link da Shopee.";

export function humanizeLargeRequestError(raw: string): string {
  const s = raw.trim();
  if (!s) return raw;
  const lower = s.toLowerCase();
  const tooLarge =
    raw.includes("FUNCTION_PAYLOAD_TOO_LARGE")
    || lower.includes("request entity too large")
    || lower.includes("function_payload_too_large")
    || lower.includes("payload too large")
    || /\b413\b/.test(raw);
  return tooLarge ? LARGE_PAYLOAD_USER_MESSAGE : raw;
}
