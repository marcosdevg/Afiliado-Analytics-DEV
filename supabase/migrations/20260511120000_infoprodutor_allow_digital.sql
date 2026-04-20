-- Modo de entrega digital (ebook / conteúdo enviado por WhatsApp ou e-mail).
-- Exclusivo: quando allow_digital = true, allow_shipping e allow_pickup têm que ser false
-- (produto digital não mistura com envio físico nem retirada).

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS allow_digital boolean NOT NULL DEFAULT false;

ALTER TABLE public.produtos_infoprodutor
  DROP CONSTRAINT IF EXISTS produtos_infoprodutor_has_delivery_check;
ALTER TABLE public.produtos_infoprodutor
  ADD CONSTRAINT produtos_infoprodutor_has_delivery_check
  CHECK (
    (allow_digital = true AND allow_shipping = false AND allow_pickup = false)
    OR
    (allow_digital = false AND (allow_shipping = true OR allow_pickup = true))
  );
