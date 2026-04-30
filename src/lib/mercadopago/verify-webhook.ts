/**
 * Validação de assinatura do webhook do Mercado Pago.
 *
 * O MP manda 2 headers no POST:
 *   - x-signature:  "ts=1704908010,v1=4ba6e6b4..."
 *   - x-request-id: "abc-123-..."
 *
 * O `v1` é HMAC-SHA256 de uma string composta:
 *   `id:{data.id};request-id:{x-request-id};ts:{ts};`
 *
 * A chave do HMAC é o `webhook secret` do app no painel do MP. Com mais de um
 * usuário usando o mesmo app (modelo Marketplace/Connect), TODOS compartilham
 * o mesmo `webhook secret` — ele identifica o APP, não a conta do vendedor.
 * Por isso usamos `process.env.MERCADO_PAGO_WEBHOOK_SECRET` (não da tabela).
 *
 * Doc oficial: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#bookmark_validate_origin
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type ParsedMpSignature = {
  ts: string;
  v1: string;
};

export function parseMpSignatureHeader(header: string | null): ParsedMpSignature | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.trim());
  let ts = "";
  let v1 = "";
  for (const p of parts) {
    const [k, v] = p.split("=", 2);
    if (k === "ts") ts = v?.trim() ?? "";
    if (k === "v1") v1 = v?.trim() ?? "";
  }
  if (!ts || !v1) return null;
  return { ts, v1 };
}

function computeHmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verifica a assinatura recebida pelo MP. Retorna `true` se válida.
 *
 * @param dataId      O `data.id` do evento (do JSON body OU do query string).
 * @param requestId   Header `x-request-id`.
 * @param signature   Header `x-signature` ainda em string.
 * @param secret      `MERCADO_PAGO_WEBHOOK_SECRET`.
 */
export function verifyMpWebhookSignature(opts: {
  dataId: string;
  requestId: string;
  signature: string | null;
  secret: string;
}): boolean {
  const parsed = parseMpSignatureHeader(opts.signature);
  if (!parsed || !opts.requestId || !opts.dataId || !opts.secret) return false;
  const payload = `id:${opts.dataId};request-id:${opts.requestId};ts:${parsed.ts};`;
  const expected = computeHmacHex(opts.secret, payload);
  return safeEqualHex(expected, parsed.v1);
}
