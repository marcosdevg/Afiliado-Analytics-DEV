-- ── Tendências Shopee (Fase 1) ──────────────────────────────────────────────
-- Tabelas globais (não escopadas por usuário) — os dados de tendências da Shopee
-- são iguais pra todo mundo (a Affiliate Open API expõe um catálogo único).
-- A conversão pra link afiliado é feita por usuário no momento do clique, não
-- aqui. Essas tabelas ficam acessíveis a todo profile assinante via RLS aberto
-- pra leitura; escrita só pelo cron (service role).

-- Estado atual da última varredura. Substituído (UPSERT) a cada cron run.
CREATE TABLE IF NOT EXISTS public.shopee_trend_snapshots (
  item_id            BIGINT PRIMARY KEY,
  shop_id            BIGINT,
  product_name       TEXT NOT NULL,
  image_url          TEXT,
  price              NUMERIC(12, 2),
  price_min          NUMERIC(12, 2),
  price_max          NUMERIC(12, 2),
  sales              INTEGER NOT NULL DEFAULT 0,
  commission_rate    NUMERIC(6, 4),
  rating_star        NUMERIC(3, 2),
  product_link       TEXT,
  offer_link         TEXT,
  shop_name          TEXT,
  category_ids       INTEGER[],
  -- Score 0-100 derivado de vendas, comissão, desconto e crescimento.
  viralization_score INTEGER,
  -- Posição no ranking decrescente de vendas (1 = mais vendido).
  rank_position      INTEGER,
  -- Indicador binário de "está em alta" (delta de vendas + score acima do limiar).
  is_viral           BOOLEAN NOT NULL DEFAULT false,
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopee_trend_snapshots_score_idx
  ON public.shopee_trend_snapshots (viralization_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS shopee_trend_snapshots_sales_idx
  ON public.shopee_trend_snapshots (sales DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS shopee_trend_snapshots_fetched_idx
  ON public.shopee_trend_snapshots (fetched_at DESC);

-- Log append-only de observações por produto/timestamp. Alimenta sparklines
-- (últimas 24h) e cálculos de delta entre runs do cron. TTL implícito de
-- 30 dias é gerenciado por cron de retenção (já existe pattern em
-- `espelhamento-payloads-retention`).
CREATE TABLE IF NOT EXISTS public.shopee_trend_observations (
  id           BIGSERIAL PRIMARY KEY,
  item_id      BIGINT NOT NULL,
  observed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sales        INTEGER NOT NULL,
  price        NUMERIC(12, 2),
  score        INTEGER,
  rank_position INTEGER
);

CREATE INDEX IF NOT EXISTS shopee_trend_observations_item_time_idx
  ON public.shopee_trend_observations (item_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS shopee_trend_observations_time_idx
  ON public.shopee_trend_observations (observed_at DESC);

-- RLS: leitura pública pra qualquer assinante autenticado, escrita restrita
-- ao service_role (usado pelo cron).
ALTER TABLE public.shopee_trend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_trend_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopee_trend_snapshots_select_authenticated ON public.shopee_trend_snapshots;
CREATE POLICY shopee_trend_snapshots_select_authenticated
  ON public.shopee_trend_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS shopee_trend_observations_select_authenticated ON public.shopee_trend_observations;
CREATE POLICY shopee_trend_observations_select_authenticated
  ON public.shopee_trend_observations
  FOR SELECT
  TO authenticated
  USING (true);
