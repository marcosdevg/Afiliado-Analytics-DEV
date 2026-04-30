/**
 * Adapter de envio Telegram. Centraliza a lógica de:
 *  - escolher entre sendMessage (texto) e sendPhoto (texto + imagem)
 *  - aplicar rate limit defensivo entre mensagens
 *  - retornar resultado por chat (ok/erro)
 *
 * Reutilizado por:
 *  - /api/telegram/disparar (manual)
 *  - /api/telegram/cron-disparo (automação contínua, próxima PR)
 *
 * Telegram Bot API permite ~30 mensagens/segundo globais por bot. Default 50ms
 * entre envios (~20 msg/s) deixa margem confortável e cabe em ~1200 mensagens
 * dentro do limite de 60s do Vercel.
 */

import { sendMessage, sendPhoto, type TelegramApiResult } from "./api";

export type TelegramParseMode = "HTML" | "MarkdownV2";

export type TelegramSendPayload = {
  text: string;
  imageUrl?: string;
  parseMode?: TelegramParseMode;
};

export type TelegramSendResult = {
  chat_id: string;
  ok: boolean;
  error?: string;
};

export type TelegramSendOptions = {
  /** Delay em ms entre envios sucessivos. Default 50ms (~20 msg/s). */
  delayMs?: number;
  /** Sleep até `retry_after` segundos quando Telegram retornar 429. Default true. */
  honorRateLimitRetry?: boolean;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia o mesmo payload pra cada chat_id em sequência. Não para no primeiro erro
 * — agrega resultado de cada um.
 */
export async function sendPayloadToChats(
  botToken: string,
  chatIds: string[],
  payload: TelegramSendPayload,
  options: TelegramSendOptions = {}
): Promise<TelegramSendResult[]> {
  const delayMs = options.delayMs ?? 50;
  const honorRateLimit = options.honorRateLimitRetry ?? true;
  const results: TelegramSendResult[] = [];

  for (let i = 0; i < chatIds.length; i++) {
    const chatId = chatIds[i];

    let r = await sendOne(botToken, chatId, payload);

    // 429 Too Many Requests: respeita retry_after e tenta uma vez
    if (!r.ok && r.error_code === 429 && honorRateLimit) {
      const retryAfterMatch = r.description?.match(/retry after (\d+)/i);
      const retryAfter = retryAfterMatch ? Number(retryAfterMatch[1]) : 1;
      await sleep(Math.min(retryAfter, 30) * 1000);
      r = await sendOne(botToken, chatId, payload);
    }

    results.push({
      chat_id: chatId,
      ok: r.ok,
      error: r.ok ? undefined : `${r.error_code}: ${r.description}`,
    });

    if (i < chatIds.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

function sendOne(
  botToken: string,
  chatId: string,
  payload: TelegramSendPayload
): Promise<TelegramApiResult<unknown>> {
  if (payload.imageUrl) {
    return sendPhoto(botToken, chatId, payload.imageUrl, payload.text, {
      parse_mode: payload.parseMode,
    });
  }
  return sendMessage(botToken, chatId, payload.text, {
    parse_mode: payload.parseMode,
  });
}
