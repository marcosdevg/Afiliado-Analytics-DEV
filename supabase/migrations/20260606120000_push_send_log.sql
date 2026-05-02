-- Auditoria de envios de Web Push.
--
-- Cada tentativa de entrega (sucesso ou falha) é registrada com:
--   • slug do payload (`comissao-total`, `bom-dia`, `teste`, etc.)
--   • user_id alvo
--   • endpoint da subscription (último 80 chars — pra debug sem expor credenciais)
--   • status HTTP retornado pelo push service (FCM/APNS/Mozilla)
--   • timestamp
--
-- Usado pra:
--   1. Catch-up: quando user abre dashboard, checar se já recebeu hoje
--      `comissao-total`. Se não → manda agora.
--   2. Diagnóstico: investigar caso a caso por que fulano não recebeu.
--   3. Cron noturno de retry: quem não tem entrada bem-sucedida do dia.
--
-- Retenção: 30 dias. Cron `/api/cron/cleanup-push-logs` apaga registros antigos.

CREATE TABLE IF NOT EXISTS push_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL,
  endpoint_tail text,           -- últimos chars do endpoint pra debug (sem credenciais)
  success boolean NOT NULL,
  status_code integer,
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Catch-up consulta: "user X recebeu slug Y hoje com sucesso?"
CREATE INDEX IF NOT EXISTS idx_push_send_log_user_slug_sent
  ON push_send_log(user_id, slug, sent_at DESC);

-- Cron noturno consulta: "quem NÃO tem sucesso pra slug Y hoje?"
CREATE INDEX IF NOT EXISTS idx_push_send_log_slug_sent
  ON push_send_log(slug, sent_at DESC)
  WHERE success = true;

-- Retenção: índice por sent_at pra cleanup eficiente.
CREATE INDEX IF NOT EXISTS idx_push_send_log_sent_at
  ON push_send_log(sent_at);

-- RLS: apenas service role acessa via API. Habilita sem policies = bloqueia
-- qualquer cliente público (anon/authenticated) e service role passa por cima.
ALTER TABLE push_send_log ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────
-- View: taxa de entrega das últimas 24h por slug.
-- Útil pra checar saúde do sistema de push direto no SQL editor:
--   SELECT * FROM v_push_delivery_today;
CREATE OR REPLACE VIEW v_push_delivery_today AS
SELECT
  slug,
  COUNT(*) FILTER (WHERE success = true) AS sucessos,
  COUNT(*) FILTER (WHERE success = false) AS falhas,
  COUNT(*) AS total,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
    1
  ) AS taxa_sucesso_pct,
  MIN(sent_at) AS primeiro_envio,
  MAX(sent_at) AS ultimo_envio
FROM push_send_log
WHERE sent_at >= now() - interval '24 hours'
GROUP BY slug
ORDER BY ultimo_envio DESC;
