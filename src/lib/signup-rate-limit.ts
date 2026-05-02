/**
 * Rate limit de signup por IP.
 *
 * Estratégia: janela deslizante simples persistida em Postgres
 * (`signup_rate_limits`). Cada IP guarda um contador + início da janela.
 * Quando a janela expira, o contador zera na próxima tentativa.
 *
 * Limitação intencional: usa o IP visto pelo servidor (`x-forwarded-for`).
 * Ataques distribuídos (botnets, proxies residenciais) ignoram. É um
 * filtro contra abuso casual + scripts ingênuos. Combina com CPF unique
 * pra ter defesa real.
 *
 * Não usa lib externa (Upstash, etc.) — projeto não tinha. Rodar
 * `signup_rate_limits` direto via Supabase admin é suficiente pro volume
 * típico de signups.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SignupRateLimitConfig = {
  /** Máximo de signups permitidos por IP dentro da janela. */
  maxAttempts: number;
  /** Tamanho da janela em minutos. */
  windowMinutes: number;
};

export type SignupRateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

/** Defaults razoáveis: 5 signups por IP a cada 1 hora. Ajusta conforme observa o tráfego. */
export const DEFAULT_SIGNUP_RATE_LIMIT: SignupRateLimitConfig = {
  maxAttempts: 5,
  windowMinutes: 60,
};

/**
 * Lê o IP do cliente a partir dos headers do Next request. Aceita lista
 * em `x-forwarded-for` (pega o primeiro), fallback em `x-real-ip`.
 *
 * Retorna string vazia se não conseguiu identificar — caller decide como
 * lidar (recomendado: aplicar limit de qualquer jeito, IP "" tem sua
 * própria entrada na tabela).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "";
}

/**
 * Verifica e incrementa o contador de tentativas pro IP. Retorna
 * `allowed: true` quando ainda dentro do limite, ou `allowed: false`
 * com `retryAfterSeconds` quando estourou.
 *
 * NÃO usa transação — race condition entre 2 requests do mesmo IP no
 * mesmo segundo pode contar 1 a menos. Aceitável: o objetivo é frear
 * abuso, não ser 100% preciso.
 */
export async function checkAndIncrementSignupRateLimit(
  supabaseAdmin: SupabaseClient,
  ip: string,
  config: SignupRateLimitConfig = DEFAULT_SIGNUP_RATE_LIMIT,
): Promise<SignupRateLimitResult> {
  const now = new Date();
  const windowMs = config.windowMinutes * 60 * 1000;

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("signup_rate_limits")
    .select("ip, attempt_count, window_start")
    .eq("ip", ip)
    .maybeSingle();
  if (selErr) {
    // Falha de leitura (tabela inexistente, RLS, etc.) — log e libera.
    // Preferimos liberar a errar 500 em todo signup.
    // eslint-disable-next-line no-console
    console.error("[signup-rate-limit] select error:", selErr.message);
    return { allowed: true, remaining: config.maxAttempts };
  }

  const windowStart = existing?.window_start ? new Date(existing.window_start) : null;
  const windowExpired =
    !windowStart || now.getTime() - windowStart.getTime() > windowMs;

  if (windowExpired) {
    // Reseta janela: 1ª tentativa do IP nesta nova janela.
    await supabaseAdmin.from("signup_rate_limits").upsert(
      {
        ip,
        attempt_count: 1,
        window_start: now.toISOString(),
        last_attempt_at: now.toISOString(),
      },
      { onConflict: "ip" },
    );
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  const currentCount = existing?.attempt_count ?? 0;
  if (currentCount >= config.maxAttempts) {
    const elapsedMs = now.getTime() - windowStart.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsedMs) / 1000));
    // Atualiza last_attempt_at pra histórico (sem mexer no contador).
    await supabaseAdmin
      .from("signup_rate_limits")
      .update({ last_attempt_at: now.toISOString() })
      .eq("ip", ip);
    return { allowed: false, retryAfterSeconds };
  }

  // Dentro do limite — incrementa.
  const nextCount = currentCount + 1;
  await supabaseAdmin
    .from("signup_rate_limits")
    .update({ attempt_count: nextCount, last_attempt_at: now.toISOString() })
    .eq("ip", ip);
  return { allowed: true, remaining: config.maxAttempts - nextCount };
}
