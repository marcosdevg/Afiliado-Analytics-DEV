-- Vista para administradores: ledger de coins com email (join auth.users).
-- Use no SQL Editor ou "New view" apontando para esta definição.
CREATE OR REPLACE VIEW public.afiliado_coins_ledger_with_email AS
SELECT
  l.id,
  l.user_id,
  u.email AS user_email,
  l.delta,
  l.balance_after,
  l.reason,
  l.meta,
  l.created_at
FROM public.afiliado_coins_ledger l
LEFT JOIN auth.users u ON u.id = l.user_id;

COMMENT ON VIEW public.afiliado_coins_ledger_with_email IS
  'Ledger Afiliado Coins com email do utilizador (auth.users). Para consulta em backoffice / SQL Editor.';

-- Rastreia operações Veo após débito de coins, para reembolso idempotente se o vídeo falhar no poll.
CREATE TABLE IF NOT EXISTS public.expert_veo_coin_holds (
  operation_name text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  coins integer NOT NULL CHECK (coins > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_veo_coin_holds_user_created
  ON public.expert_veo_coin_holds (user_id, created_at DESC);

ALTER TABLE public.expert_veo_coin_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expert_veo_coin_holds_select_own" ON public.expert_veo_coin_holds;
CREATE POLICY "expert_veo_coin_holds_select_own"
  ON public.expert_veo_coin_holds FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "expert_veo_coin_holds_insert_own" ON public.expert_veo_coin_holds;
CREATE POLICY "expert_veo_coin_holds_insert_own"
  ON public.expert_veo_coin_holds FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "expert_veo_coin_holds_update_own" ON public.expert_veo_coin_holds;
CREATE POLICY "expert_veo_coin_holds_update_own"
  ON public.expert_veo_coin_holds FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.afiliado_coins_ledger_with_email FROM PUBLIC;
GRANT SELECT ON public.afiliado_coins_ledger_with_email TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE ON public.expert_veo_coin_holds TO authenticated;
