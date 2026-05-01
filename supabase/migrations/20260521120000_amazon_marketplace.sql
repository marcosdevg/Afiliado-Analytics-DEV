-- Estrutura completa do marketplace Amazon — espelho de Mercado Livre.
-- Cria:
--   • listas_ofertas_amazon         (catálogo de listas)
--   • minha_lista_ofertas_amazon    (itens dentro das listas)
--   • amazon_link_history           (histórico de links de afiliado gerados)
--   • profiles.amazon_*             (credenciais opcionais — espelha mercadolivre_*)
--   • grupos_venda_continuo.lista_ofertas_amazon_id  (uso em automações WhatsApp)
--
-- Mantém o mesmo padrão de RLS/colunas das tabelas ML: cada usuário só enxerga as próprias linhas.

-- ─────────────────────────────────────────────────────────────────────────────
-- listas_ofertas_amazon
CREATE TABLE IF NOT EXISTS listas_ofertas_amazon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listas_ofertas_amazon_user
  ON listas_ofertas_amazon(user_id);

ALTER TABLE listas_ofertas_amazon ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listas_ofertas_amazon_select_own" ON listas_ofertas_amazon;
CREATE POLICY "listas_ofertas_amazon_select_own"
  ON listas_ofertas_amazon FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_ofertas_amazon_insert_own" ON listas_ofertas_amazon;
CREATE POLICY "listas_ofertas_amazon_insert_own"
  ON listas_ofertas_amazon FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_ofertas_amazon_update_own" ON listas_ofertas_amazon;
CREATE POLICY "listas_ofertas_amazon_update_own"
  ON listas_ofertas_amazon FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_ofertas_amazon_delete_own" ON listas_ofertas_amazon;
CREATE POLICY "listas_ofertas_amazon_delete_own"
  ON listas_ofertas_amazon FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- minha_lista_ofertas_amazon
CREATE TABLE IF NOT EXISTS minha_lista_ofertas_amazon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lista_id uuid NOT NULL REFERENCES listas_ofertas_amazon(id) ON DELETE CASCADE,
  image_url text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  price_original numeric(10,2),
  price_promo numeric(10,2),
  discount_rate numeric(5,2),
  converter_link text NOT NULL DEFAULT '',
  product_page_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_amazon_lista
  ON minha_lista_ofertas_amazon(lista_id);
CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_amazon_user
  ON minha_lista_ofertas_amazon(user_id);
CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_amazon_created
  ON minha_lista_ofertas_amazon(lista_id, created_at DESC);

ALTER TABLE minha_lista_ofertas_amazon ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minha_lista_ofertas_amazon_select_own" ON minha_lista_ofertas_amazon;
CREATE POLICY "minha_lista_ofertas_amazon_select_own"
  ON minha_lista_ofertas_amazon FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "minha_lista_ofertas_amazon_insert_own" ON minha_lista_ofertas_amazon;
CREATE POLICY "minha_lista_ofertas_amazon_insert_own"
  ON minha_lista_ofertas_amazon FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "minha_lista_ofertas_amazon_update_own" ON minha_lista_ofertas_amazon;
CREATE POLICY "minha_lista_ofertas_amazon_update_own"
  ON minha_lista_ofertas_amazon FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "minha_lista_ofertas_amazon_delete_own" ON minha_lista_ofertas_amazon;
CREATE POLICY "minha_lista_ofertas_amazon_delete_own"
  ON minha_lista_ofertas_amazon FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- amazon_link_history (espelha mercadolivre_link_history)
CREATE TABLE IF NOT EXISTS amazon_link_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_link text NOT NULL,
  origin_url text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  -- ASIN da Amazon (B0XXXXXXXX). Mantemos como texto pra tolerar variações regionais.
  item_id text NOT NULL DEFAULT '',
  price_promo numeric(12,2),
  price_original numeric(12,2),
  discount_rate numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amazon_link_history_user_created
  ON amazon_link_history(user_id, created_at DESC);

ALTER TABLE amazon_link_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amazon_link_history_select_own" ON amazon_link_history;
CREATE POLICY "amazon_link_history_select_own"
  ON amazon_link_history FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "amazon_link_history_insert_own" ON amazon_link_history;
CREATE POLICY "amazon_link_history_insert_own"
  ON amazon_link_history FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "amazon_link_history_delete_own" ON amazon_link_history;
CREATE POLICY "amazon_link_history_delete_own"
  ON amazon_link_history FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles: credenciais Amazon (espelha mercadolivre_*).
-- Usadas pra Associate ID/PA-API quando/se for plugado no futuro;
-- por enquanto a app armazena o token da extensão em localStorage como ML.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_associate_tag text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_access_key text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_secret_key text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_secret_key_last4 text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_secret_key_updated_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- grupos_venda_continuo: nova FK pra lista Amazon, segue o padrão das colunas
-- lista_ofertas_id (Shopee), lista_ofertas_ml_id, lista_ofertas_info_id.
ALTER TABLE grupos_venda_continuo
  ADD COLUMN IF NOT EXISTS lista_ofertas_amazon_id uuid
  REFERENCES listas_ofertas_amazon(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grupos_venda_continuo_lista_ofertas_amazon
  ON grupos_venda_continuo(lista_ofertas_amazon_id)
  WHERE lista_ofertas_amazon_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- telegram_grupos_venda_continuo: idem para Telegram (espelha o WhatsApp).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'telegram_grupos_venda_continuo'
  ) THEN
    EXECUTE 'ALTER TABLE telegram_grupos_venda_continuo ADD COLUMN IF NOT EXISTS lista_ofertas_amazon_id uuid REFERENCES listas_ofertas_amazon(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tg_grupos_venda_continuo_lista_ofertas_amazon ON telegram_grupos_venda_continuo(lista_ofertas_amazon_id) WHERE lista_ofertas_amazon_id IS NOT NULL';
  END IF;
END$$;
