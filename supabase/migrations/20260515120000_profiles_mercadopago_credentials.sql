-- ── Credenciais Mercado Pago por usuário (Infoprodutor) ──────────────────────
-- Substitui Stripe pelo Mercado Pago como gateway de pagamento. Suporta dois
-- caminhos de conexão:
--   1) OAuth (preferencial) — `mp_credentials_source = 'oauth'` e o app gerencia
--      o `access_token` (renovável via `refresh_token`).
--   2) Manual — `mp_credentials_source = 'manual'` quando o usuário cola direto
--      o `access_token` privado (TEST- ou APP_USR-) em /configuracoes.
--
-- Esta migration apenas adiciona colunas; não remove nada de Stripe ainda — a
-- limpeza acontece numa fase posterior depois que o fluxo MP estiver provado
-- end-to-end em produção.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mp_public_key TEXT,
  ADD COLUMN IF NOT EXISTS mp_user_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_credentials_source TEXT
    CHECK (mp_credentials_source IS NULL OR mp_credentials_source IN ('oauth','manual')),
  ADD COLUMN IF NOT EXISTS mp_secret_last4 TEXT,
  ADD COLUMN IF NOT EXISTS mp_live_mode BOOLEAN,
  ADD COLUMN IF NOT EXISTS mp_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mp_oauth_state TEXT,
  ADD COLUMN IF NOT EXISTS mp_oauth_state_expires_at TIMESTAMPTZ;

-- O `mp_user_id` (collector_id do MP) é a peça que liga uma notificação de
-- webhook ao vendedor correto — útil indexar pra lookup rápido.
CREATE INDEX IF NOT EXISTS idx_profiles_mp_user_id
  ON public.profiles (mp_user_id)
  WHERE mp_user_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.mp_access_token IS
  'Access token do Mercado Pago (TEST-... ou APP_USR-...). OAuth: ~6 meses, renovável via mp_refresh_token. Manual: validade do token que o usuário gerou.';
COMMENT ON COLUMN public.profiles.mp_user_id IS
  'collector_id do Mercado Pago — id numérico da conta MP do vendedor. Usado pra rotear webhooks ao usuário certo.';
COMMENT ON COLUMN public.profiles.mp_credentials_source IS
  '"oauth" quando conectado via fluxo Connect/OAuth; "manual" quando o usuário colou access_token + public_key em /configuracoes.';
