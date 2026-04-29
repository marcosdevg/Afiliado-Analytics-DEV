/**
 * Configuração do Mercado Pago — leitura centralizada de envs e endpoints.
 *
 * Variáveis usadas (todas obrigatórias para o fluxo OAuth):
 *   - MERCADO_PAGO_CLIENT_ID         (público do app, OAuth client_id)
 *   - MERCADO_PAGO_CLIENT_SECRET     (privado do app)
 *   - NEXT_PUBLIC_APP_URL            (origem do redirect URI)
 *
 * Opcionais (apenas para fluxo manual / fallback):
 *   - MERCADO_PAGO_ACCESS_TOKEN_TEST (sandbox dev)
 *   - MERCADO_PAGO_ACCESS_TOKEN_PROD (produção)
 *   - MERCADO_PAGO_PUBLIC_KEY_TEST
 *   - MERCADO_PAGO_PUBLIC_KEY_PROD
 *   - MERCADO_PAGO_WEBHOOK_SECRET    (validar assinatura de webhook)
 */

export const MP_AUTH_BASE = "https://auth.mercadopago.com";
export const MP_API_BASE = "https://api.mercadopago.com";

export const MP_OAUTH_CALLBACK_PATH = "/api/mercadopago/oauth/callback";

export function getMercadoPagoClientId(): string {
  const v = process.env.MERCADO_PAGO_CLIENT_ID?.trim();
  if (!v) throw new Error("MERCADO_PAGO_CLIENT_ID não configurado.");
  return v;
}

export function getMercadoPagoClientSecret(): string {
  const v = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim();
  if (!v) throw new Error("MERCADO_PAGO_CLIENT_SECRET não configurado.");
  return v;
}

export function getMercadoPagoAppOrigin(): string {
  const v = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_APP_URL não configurada.");
  return v.replace(/\/+$/, "");
}

export function getMercadoPagoRedirectUri(): string {
  return `${getMercadoPagoAppOrigin()}${MP_OAUTH_CALLBACK_PATH}`;
}

/**
 * Monta a URL de autorização Connect do Mercado Pago. O usuário é mandado pra
 * essa URL; depois de autorizar, o MP redireciona pro `redirect_uri` com `code`
 * e `state` na query.
 */
export function buildMercadoPagoAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getMercadoPagoClientId(),
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: getMercadoPagoRedirectUri(),
  });
  return `${MP_AUTH_BASE}/authorization?${params.toString()}`;
}
