-- Integração Stripe no Infoprodutor:
--   * Produtos podem ser criados manualmente (como hoje) ou via API da Stripe
--     — nesse caso geramos product + price + payment_link automaticamente.
--   * Credenciais por usuário armazenadas em profiles (mesmo padrão de
--     mercadolivre_client_secret / shopee_api_key: plain text + last4 visível).

-- ── Coluna provider em produtos_infoprodutor ────────────────────────────────────
ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS provider             text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS stripe_product_id    text,
  ADD COLUMN IF NOT EXISTS stripe_price_id      text,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id text;

-- Garante valores válidos (evita lixo caso alguém insira direto no banco).
ALTER TABLE public.produtos_infoprodutor
  DROP CONSTRAINT IF EXISTS produtos_infoprodutor_provider_check;
ALTER TABLE public.produtos_infoprodutor
  ADD CONSTRAINT produtos_infoprodutor_provider_check
  CHECK (provider IN ('manual', 'stripe'));

-- ── Credenciais Stripe em profiles ──────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_secret_key           text,
  ADD COLUMN IF NOT EXISTS stripe_secret_key_last4     text,
  ADD COLUMN IF NOT EXISTS stripe_secret_key_updated_at timestamptz;
