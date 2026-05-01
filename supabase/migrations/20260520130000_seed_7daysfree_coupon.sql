-- ====================================================================
-- Seed: cupom de trial 7DAYSFREE
--
-- Insere o novo cupom default (7 dias). Idempotente.
-- ====================================================================

INSERT INTO public.trial_coupons (code, duration_days, is_active, max_uses, uses_count)
VALUES ('7DAYSFREE', 7, true, 99999, 0)
ON CONFLICT (code) DO NOTHING;
