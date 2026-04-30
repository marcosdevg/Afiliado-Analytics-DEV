-- ── Limpeza Stripe (Fase 5C) ─────────────────────────────────────────────────
-- Mercado Pago é o único gateway suportado. Esta migration:
--   1) Apaga produtos legados com `provider='stripe'` (não há mais checkout
--      que aceite eles; manter no banco só polui a UI).
--   2) Renomeia `produtos_infoprodutor.stripe_subid` → `subid`
--      (rastreamento ATI continua igual, só o nome da coluna muda).
--   3) Reaperta a CHECK constraint de `provider` para `('manual','mercadopago')`.
--   4) DROP COLUMN das colunas Stripe em `produtos_infoprodutor` e `profiles`.
--
-- Tudo idempotente (IF EXISTS / DROP CONSTRAINT IF EXISTS) — pode rodar mais
-- de uma vez sem quebrar.

BEGIN;

-- 1) Apaga produtos Stripe legados.
DELETE FROM public.produtos_infoprodutor WHERE provider = 'stripe';

-- 2) Renomeia stripe_subid → subid.
ALTER TABLE public.produtos_infoprodutor
  RENAME COLUMN stripe_subid TO subid;

-- 3) CHECK constraint do provider (após DELETE acima).
ALTER TABLE public.produtos_infoprodutor
  DROP CONSTRAINT IF EXISTS produtos_infoprodutor_provider_check;
ALTER TABLE public.produtos_infoprodutor
  ADD CONSTRAINT produtos_infoprodutor_provider_check
  CHECK (provider IN ('manual', 'mercadopago'));

-- 4) DROP COLUMN das colunas Stripe.
ALTER TABLE public.produtos_infoprodutor
  DROP COLUMN IF EXISTS stripe_product_id,
  DROP COLUMN IF EXISTS stripe_price_id,
  DROP COLUMN IF EXISTS stripe_payment_link_id,
  DROP COLUMN IF EXISTS stripe_account_id;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS stripe_secret_key,
  DROP COLUMN IF EXISTS stripe_secret_key_last4,
  DROP COLUMN IF EXISTS stripe_secret_key_updated_at,
  DROP COLUMN IF EXISTS stripe_publishable_key,
  DROP COLUMN IF EXISTS stripe_webhook_endpoint_id,
  DROP COLUMN IF EXISTS stripe_webhook_secret,
  DROP COLUMN IF EXISTS stripe_account_id;

COMMIT;
