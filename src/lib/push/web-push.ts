/**
 * Helpers para enviar Web Push usando VAPID + service role do Supabase.
 *
 * - O service worker (`public/sw.js`) recebe `event.data.json()` e chama
 *   `registration.showNotification(title, options)` com o payload entregue
 *   por estas funções.
 * - Subscrições com endpoint inválido (404/410) são removidas automaticamente
 *   pra evitar disparos repetidos.
 *
 * Variáveis de ambiente exigidas (todas no servidor):
 *   - VAPID_PUBLIC_KEY            — chave VAPID pública (também exposta ao
 *                                   browser via /api/push/vapid-public-key).
 *   - VAPID_PRIVATE_KEY           — chave VAPID privada (NUNCA exposta ao
 *                                   browser).
 *   - VAPID_SUBJECT               — `mailto:` ou URL pública do site (default:
 *                                   `mailto:contato@afiliadoanalytics.com.br`).
 *   - NEXT_PUBLIC_SUPABASE_URL    — URL do projeto Supabase.
 *   - SUPABASE_SERVICE_ROLE_KEY   — service role pra ler subscrições e fazer
 *                                   prune fora do RLS.
 *
 * Use `npx web-push generate-vapid-keys --json` pra gerar o par de chaves.
 */

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase-admin";

let configured = false;

function ensureConfigured(): { ok: true } | { ok: false; reason: string } {
  if (configured) return { ok: true };
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = (process.env.VAPID_SUBJECT?.trim() || "mailto:contato@afiliadoanalytics.com.br");
  if (!publicKey || !privateKey) {
    return { ok: false, reason: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes no servidor." };
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Falha ao configurar VAPID.",
    };
  }
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  url?: string;
  /** Marcadores Markdown-like que o SW interpreta. Use **texto** pra negrito. */
  renderHints?: { boldTitle?: boolean };
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type SubscriptionRowWithUser = SubscriptionRow & { user_id: string };

/**
 * Limite de envios paralelos por batch. Sem limite, com 500+ users (1000+
 * subscriptions) o `Promise.all` abre conexões demais e o cron estoura
 * 60s/300s. Com 50 paralelos, 1000 subs ÷ 50 × ~300ms = ~6s.
 */
const PUSH_CONCURRENCY = 50;

/**
 * Slug usado em `push_send_log` quando a função é chamada sem contexto
 * (ex.: `sendPushToUser` chamada por handler manual de teste). O caller
 * pode sobrescrever passando `logSlug` no `SendOptions`.
 */
const DEFAULT_LOG_SLUG = "manual";

export type SendOptions = {
  /** Identifica o tipo de envio no `push_send_log` (`comissao-total`, `teste`, etc.). */
  logSlug?: string;
};

function rowToWebPushSubscription(row: SubscriptionRow): WebPushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function deleteSubscriptionByEndpoint(endpoint: string) {
  try {
    const admin = createAdminClient();
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch (err) {
    console.error("[push] falha ao remover subscription expirada:", err);
  }
}

/**
 * Persiste resultado de cada tentativa de envio em `push_send_log`.
 * Retenção: 30 dias (cron de limpeza separado).
 *
 * Falhas no insert são apenas logadas (não bloqueiam o envio do push).
 */
type LogEntry = {
  user_id: string;
  slug: string;
  endpoint_tail: string;
  success: boolean;
  status_code: number | null;
  error_message: string | null;
};

async function persistSendLogs(entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("push_send_log").insert(entries);
    if (error) {
      console.error("[push] falha ao gravar push_send_log:", error.message);
    }
  } catch (err) {
    console.error("[push] erro inesperado em persistSendLogs:", err);
  }
}

/**
 * Executa N tarefas async com no máximo `concurrency` em paralelo. Mais
 * eficiente que `Promise.all` puro pra envios massivos: protege contra
 * rate-limit do FCM/APNS e mantém memória previsível.
 *
 * Implementação simples sem dependência externa: array de "workers" que
 * pegam tarefas em sequência.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers: Promise<void>[] = [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  for (let w = 0; w < limit; w++) {
    workers.push(
      (async () => {
        while (true) {
          const idx = nextIndex++;
          if (idx >= items.length) return;
          results[idx] = await worker(items[idx], idx);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

export type SendResult = {
  total: number;
  ok: number;
  failed: number;
  pruned: number;
};

/**
 * Envia o mesmo payload pra TODAS as subscrições de um usuário.
 * Use isto pra disparos individuais (ex.: nova venda do Mercado Pago, teste).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  options: SendOptions = {},
): Promise<SendResult> {
  const cfg = ensureConfigured();
  if (!cfg.ok) {
    console.error("[push] config inválida:", cfg.reason);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] falha ao listar subscrições do usuário:", error.message);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const rowsWithUser: SubscriptionRowWithUser[] = (rows ?? []).map((r) => ({
    ...(r as SubscriptionRow),
    user_id: userId,
  }));
  return sendPushToRows(payload, rowsWithUser, options.logSlug ?? DEFAULT_LOG_SLUG);
}

/**
 * Envia o mesmo payload pra TODAS as subscrições da base. Use com cuidado —
 * é o que os crons globais (`bom-dia`, `bom-almoco`, etc.) fazem.
 */
export async function sendPushBroadcast(
  payload: PushPayload,
  options: SendOptions = {},
): Promise<SendResult> {
  const cfg = ensureConfigured();
  if (!cfg.ok) {
    console.error("[push] config inválida:", cfg.reason);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id");

  if (error) {
    console.error("[push] falha ao listar subscrições:", error.message);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  return sendPushToRows(
    payload,
    (rows ?? []) as SubscriptionRowWithUser[],
    options.logSlug ?? DEFAULT_LOG_SLUG,
  );
}

/**
 * Envia payload personalizado por usuário. `getPayload` pode retornar `null`
 * pra pular um usuário (ex.: sem dados de comissão). Útil pro cron das 08:10.
 *
 * Aceita também `userIdsFilter` — quando passado, ignora subscriptions de
 * users fora dessa lista. Usado pelo cron de retry noturno (manda só pra
 * quem não recebeu durante o dia).
 */
export async function sendPushPerUser(
  getPayload: (userId: string) => Promise<PushPayload | null> | PushPayload | null,
  options: SendOptions & { userIdsFilter?: string[] } = {},
): Promise<SendResult> {
  const cfg = ensureConfigured();
  if (!cfg.ok) {
    console.error("[push] config inválida:", cfg.reason);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const admin = createAdminClient();
  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id");
  if (options.userIdsFilter && options.userIdsFilter.length > 0) {
    query = query.in("user_id", options.userIdsFilter);
  }
  const { data: rows, error } = await query;

  if (error) {
    console.error("[push] falha ao listar subscrições:", error.message);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  // Agrupa por user_id pra computar payload uma vez por usuário e juntar
  // todas as subscriptions do user num único batch (preserva ordem natural).
  const byUser = new Map<string, SubscriptionRowWithUser[]>();
  for (const r of rows ?? []) {
    const row = r as SubscriptionRowWithUser;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  // Monta lista plana mantendo só os users com payload válido.
  const flatRows: SubscriptionRowWithUser[] = [];
  for (const [userId, subs] of byUser) {
    const payload = await getPayload(userId);
    if (!payload) continue;
    // Truque: passamos o payload "via closure" no map abaixo. Como o payload
    // pode variar por user, agrupamos as rows mas precisamos do payload
    // associado — fazemos isso em 2 passos: primeiro coleta, depois envia.
    for (const s of subs) flatRows.push(s);
    // Stash do payload por user via cache externa (do caller).
    payloadCache.set(userId, payload);
  }

  const result: SendResult = { total: 0, ok: 0, failed: 0, pruned: 0 };
  // Processa em batches por user (mantém compatibilidade com SendResult).
  for (const [userId, subs] of byUser) {
    const payload = payloadCache.get(userId);
    if (!payload) continue;
    const sub = await sendPushToRows(payload, subs, options.logSlug ?? DEFAULT_LOG_SLUG);
    result.total += sub.total;
    result.ok += sub.ok;
    result.failed += sub.failed;
    result.pruned += sub.pruned;
  }
  payloadCache.clear();
  return result;
}

// Cache efêmero de payloads por user durante uma chamada de `sendPushPerUser`.
// Limpa no fim da função.
const payloadCache = new Map<string, PushPayload>();

async function sendPushToRows(
  payload: PushPayload,
  rows: SubscriptionRowWithUser[],
  logSlug: string,
): Promise<SendResult> {
  const json = JSON.stringify(payload);
  const result: SendResult = { total: rows.length, ok: 0, failed: 0, pruned: 0 };
  const logs: LogEntry[] = [];

  await runWithConcurrency(rows, PUSH_CONCURRENCY, async (row) => {
    let success = false;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    try {
      await webpush.sendNotification(rowToWebPushSubscription(row), json, {
        TTL: 60 * 60 * 24,
      });
      result.ok += 1;
      success = true;
      statusCode = 201;
    } catch (err: unknown) {
      result.failed += 1;
      statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode ?? 0) || null
          : null;
      errorMessage = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
      if (statusCode === 404 || statusCode === 410) {
        await deleteSubscriptionByEndpoint(row.endpoint);
        result.pruned += 1;
      } else {
        console.error("[push] erro ao enviar:", statusCode, err);
      }
    }
    logs.push({
      user_id: row.user_id,
      slug: logSlug,
      // Últimos 80 chars: identifica unique sem expor token completo.
      endpoint_tail: row.endpoint.slice(-80),
      success,
      status_code: statusCode,
      error_message: errorMessage,
    });
  });

  // Persiste todos os logs do batch em uma única query (mais rápido que N inserts).
  await persistSendLogs(logs);
  return result;
}
