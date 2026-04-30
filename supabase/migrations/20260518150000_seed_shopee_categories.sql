-- ── Seed: nomes conhecidos da taxonomia Shopee Brasil ──────────────────────
-- IDs observados em `productCatIds` de produtos reais nos snapshots. Nomes
-- baseados em conhecimento público da taxonomia Shopee BR + categoria típica
-- dos produtos vistos em cada cluster (ex.: 100636 = utensílios de cozinha →
-- "Casa e Cozinha").
--
-- Estratégia ON CONFLICT: SOBRESCREVE entries existentes. O cron de tendências
-- também escreve nesta tabela via `shopeeOfferV2`, mas aquela query devolve
-- IDs de Mall (categoria-pai) que **não casam** com `productCatIds` dos
-- produtos. Os nomes deste seed são mais precisos pros IDs do snapshot real.
--
-- IDs novos que aparecerem fora desta lista continuam aparecendo como
-- "Categoria #X" na UI até serem adicionados aqui (basta rodar uma nova
-- migration ou ALTER manual).
--
-- Self-contained: cria a tabela + RLS se ainda não existirem (idempotente
-- com a migration `20260518140000_shopee_category_directory.sql`).

BEGIN;

-- ── Tabela + RLS (no-op quando já criadas) ──
CREATE TABLE IF NOT EXISTS public.shopee_category_directory (
  category_id BIGINT PRIMARY KEY,
  name        TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shopee_category_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopee_category_directory_select_authenticated ON public.shopee_category_directory;
CREATE POLICY shopee_category_directory_select_authenticated
  ON public.shopee_category_directory
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.shopee_category_directory (category_id, name, updated_at) VALUES
  -- Categorias-pai (Mall)
  (100009, 'Móveis',                      now()),
  (100010, 'Bagagens e Viagem',           now()),
  (100016, 'Mercado',                     now()),
  (100017, 'Casa e Construção',           now()),
  (100018, 'Casa e Decoração',            now()),
  (100041, 'Pet Shop',                    now()),
  (100099, 'Comida e Bebidas',            now()),
  (100110, 'Bebês e Crianças',            now()),
  (100378, 'Saúde',                       now()),
  (100532, 'Esporte e Lazer',             now()),
  (100561, 'Hobbies e Coleções',          now()),
  (100630, 'Beleza',                      now()),
  (100631, 'Saúde · Cuidado Pessoal',     now()),
  (100636, 'Casa e Cozinha',              now()),
  (100637, 'Bebê e Maternidade',          now()),
  (100710, 'Eletroportáteis',             now()),
  (100711, 'Eletrodomésticos',            now()),
  (100713, 'Moda Feminina',               now()),
  (100714, 'Eletrodomésticos · Cozinha',  now()),
  (100715, 'Áudio e Som',                 now()),
  (100716, 'Telefonia e Acessórios',      now()),
  (100717, 'Eletrônicos',                 now()),
  (100718, 'Câmeras e Drones',            now()),
  (100719, 'Games e Consoles',            now()),
  (100720, 'Mercado e Alimentação',       now()),
  (100721, 'Joias e Bijuterias',          now()),
  -- IDs altos (101xxx) — subcategorias específicas. Os nomes são best-guess
  -- baseados na frequência observada em snapshots; staff pode atualizar.
  (101146, 'Casa · Decoração e Utilidades',    now()),
  (101169, 'Cozinha · Utensílios',             now()),
  (101174, 'Casa · Banho e Cama',              now()),
  (101220, 'Beleza · Cabelo',                  now()),
  (101237, 'Casa · Limpeza',                   now())
ON CONFLICT (category_id) DO UPDATE
SET name       = EXCLUDED.name,
    updated_at = EXCLUDED.updated_at;

COMMIT;
