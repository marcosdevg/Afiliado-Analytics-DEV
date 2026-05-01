/**
 * Token copiado da extensão Amazon: base64 do cookie de sessão da Amazon
 * (ex.: `session-id=...`, `session-token=...`, `at-acbbr=...`). Aceita também
 * a string já decodificada como header `Cookie:`.
 *
 * Espelha o módulo `lib/mercadolivre/ml-session-cookie.ts`. Quando o user
 * conectar a extensão Amazon, ela vai gravar o token nessas chaves.
 */

export const AMAZON_EXT_SESSION_LS_KEY = "aa_amazon_ext_session_token";
/** Tag do Associate (ex.: meutag-20). Usada nos links de afiliado. */
export const AMAZON_EXT_AFFILIATE_TAG_LS_KEY = "aa_amazon_ext_affiliate_tag";

const MAX_INPUT_LEN = 24_000;

export function parseAmazonExtensionSessionToCookieHeader(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t.length || t.length > MAX_INPUT_LEN) return null;

  // Se já vier no formato "k1=v1; k2=v2; ...", usa direto.
  if (/=/.test(t) && /;/.test(t)) {
    return t;
  }

  // Tenta base64 → utf8 ou latin1, igual ao parser do ML.
  try {
    const buf = Buffer.from(t, "base64");
    const utf8 = buf.toString("utf8").trim();
    if (utf8.includes("=")) return utf8;
    const latin1 = buf.toString("latin1").trim();
    if (latin1.includes("=")) return latin1;
  } catch {
    /* swallow */
  }
  return null;
}
