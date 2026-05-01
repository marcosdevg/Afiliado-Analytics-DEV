-- ====================================================================
-- Migration: novo tier 'inicial' + bug fix p/ 'trial'
--
-- O que faz:
--   1. Atualiza CHECK em profiles.plan_tier pra incluir 'inicial' e 'trial'
--      ('trial' ja era usado em codigo mas nao estava no CHECK — bug latente)
--   2. Migra usuarios existentes 'padrao' e 'legacy' -> 'inicial'
--      (preserva exatamente os limites que esses usuarios contrataram, ja que
--       os antigos limites de 'padrao' viram os novos limites de 'inicial')
--
-- Pos-migration o tier 'padrao' fica disponivel para novos clientes,
-- mas com features expandidas (definidas em src/lib/plan-entitlements.ts).
--
-- Idempotente. Seguro para rodar em producao.
-- ====================================================================

-- 1) Atualiza o CHECK constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY[
    'legacy'::text,
    'inicial'::text,
    'padrao'::text,
    'pro'::text,
    'staff'::text,
    'trial'::text
  ]));

-- 2) Migra usuarios existentes para o novo tier 'inicial'
--    'padrao' atual = 'inicial' novo (mesmas features)
--    'legacy' historicamente = features ainda mais simples; tratamos como 'inicial'
UPDATE public.profiles
SET plan_tier = 'inicial'
WHERE plan_tier IN ('padrao', 'legacy');
