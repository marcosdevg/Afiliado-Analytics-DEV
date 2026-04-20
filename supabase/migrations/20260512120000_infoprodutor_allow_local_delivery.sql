-- Modo de entrega "Receber em casa" — afiliado leva o produto até o comprador.
-- Sem cálculo de frete: o afiliado define um valor fixo (pode ser 0 = grátis).
-- Regras de coexistência:
--   * pode conviver com allow_pickup (retirada na loja);
--   * NÃO pode conviver com allow_shipping (Correios) nem com allow_digital.

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS allow_local_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS local_delivery_cost  numeric(10,2);

ALTER TABLE public.produtos_infoprodutor
  DROP CONSTRAINT IF EXISTS produtos_infoprodutor_has_delivery_check;
ALTER TABLE public.produtos_infoprodutor
  ADD CONSTRAINT produtos_infoprodutor_has_delivery_check
  CHECK (
    -- Digital é exclusivo (nada mais pode estar ativo).
    (allow_digital = true
      AND allow_shipping = false
      AND allow_pickup = false
      AND allow_local_delivery = false)
    OR
    -- Sem digital: precisa de pelo menos 1 modo ativo; e "receber em casa"
    -- não convive com Correios (mas pode conviver com retirada).
    (allow_digital = false
      AND (allow_shipping = true OR allow_pickup = true OR allow_local_delivery = true)
      AND NOT (allow_shipping = true AND allow_local_delivery = true))
  );
