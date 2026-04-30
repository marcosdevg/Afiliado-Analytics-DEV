-- Slug público para URLs de checkout custom (/checkout/[slug]).
-- Diferente do stripe_subid (que é escolhido pelo afiliado pra tracking interno Stripe
-- e pode colidir entre usuários), o public_slug é globalmente único e gerado
-- automaticamente a partir do nome do produto + sufixo aleatório.

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS public_slug text;

-- Backfill: gera slug determinístico dos produtos existentes a partir do UUID
-- (12 chars hex, garantidamente únicos). Produtos novos usarão slug legível.
UPDATE public.produtos_infoprodutor
SET public_slug = substring(replace(id::text, '-', ''), 1, 12)
WHERE public_slug IS NULL;

ALTER TABLE public.produtos_infoprodutor
  ALTER COLUMN public_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS produtos_infoprodutor_public_slug_key
  ON public.produtos_infoprodutor (public_slug);
