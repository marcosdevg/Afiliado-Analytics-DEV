/**
 * URL pública do app — usada pra montar links absolutos de checkout, callbacks
 * OAuth e webhooks. Tenta `NEXT_PUBLIC_APP_URL` primeiro; cai pra `APP_URL`,
 * `NEXT_PUBLIC_VERCEL_URL` ou `VERCEL_URL`.
 *
 * Retorna string vazia se nenhuma estiver configurada (chamador valida).
 */
export function getAppPublicUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter((v): v is string => !!v && v.trim().length > 0);
  return (candidates[0] ?? "").replace(/\/+$/, "");
}
