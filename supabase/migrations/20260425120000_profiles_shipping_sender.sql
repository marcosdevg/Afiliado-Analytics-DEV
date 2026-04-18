-- Endereço do remetente para etiqueta de envio (Correios) dos pedidos Stripe.
-- Campos nullable — usuário pode preencher depois de conectar Stripe.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shipping_sender_name         text,
  ADD COLUMN IF NOT EXISTS shipping_sender_document     text,
  ADD COLUMN IF NOT EXISTS shipping_sender_phone        text,
  ADD COLUMN IF NOT EXISTS shipping_sender_cep          text,
  ADD COLUMN IF NOT EXISTS shipping_sender_street       text,
  ADD COLUMN IF NOT EXISTS shipping_sender_number       text,
  ADD COLUMN IF NOT EXISTS shipping_sender_complement   text,
  ADD COLUMN IF NOT EXISTS shipping_sender_neighborhood text,
  ADD COLUMN IF NOT EXISTS shipping_sender_city         text,
  ADD COLUMN IF NOT EXISTS shipping_sender_uf           text;
