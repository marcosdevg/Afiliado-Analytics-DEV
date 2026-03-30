-- Índice sequencial por keyword no pool de até 30 produtos (cron disparação), em vez de sorteio aleatório.
ALTER TABLE grupos_venda_continuo
ADD COLUMN IF NOT EXISTS keyword_pool_indices jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN grupos_venda_continuo.keyword_pool_indices IS
  'Mapa keyword -> contador (não negativo): produto escolhido = pool[n % pool.length] a cada disparo.';
