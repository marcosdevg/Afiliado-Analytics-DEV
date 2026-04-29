-- ── Mercado Pago no Infoprodutor ────────────────────────────────────────────
-- Adiciona suporte ao provider "mercadopago" em produtos_infoprodutor.
-- A `preference_id` da última checkout-session do MP é guardada para reusar
-- quando o comprador volta à página (e pra debug). Os pedidos em si não são
-- persistidos: como no Stripe, são consultados via API do MP quando precisar.

ALTER TABLE public.produtos_infoprodutor
  DROP CONSTRAINT IF EXISTS produtos_infoprodutor_provider_check;
ALTER TABLE public.produtos_infoprodutor
  ADD CONSTRAINT produtos_infoprodutor_provider_check
  CHECK (provider IN ('manual', 'stripe', 'mercadopago'));

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS mp_preference_id  TEXT,
  ADD COLUMN IF NOT EXISTS mp_init_point     TEXT;

COMMENT ON COLUMN public.produtos_infoprodutor.mp_preference_id IS
  'Última preferência criada no Mercado Pago para este produto. Não é único — uma preferência é criada por checkout (com modo de entrega + frete específicos).';
