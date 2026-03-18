-- ATI: Sub ID Shopee (Sub1 do gerador) por anúncio Meta — cruzamento vendas × criativo
CREATE TABLE IF NOT EXISTS ati_ad_shopee_sub (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_id text NOT NULL,
  shopee_sub_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_id),
  UNIQUE (user_id, shopee_sub_id)
);

CREATE INDEX IF NOT EXISTS idx_ati_ad_shopee_sub_user ON ati_ad_shopee_sub(user_id);

ALTER TABLE ati_ad_shopee_sub ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ati_ad_shopee_sub_select" ON ati_ad_shopee_sub;
CREATE POLICY "ati_ad_shopee_sub_select" ON ati_ad_shopee_sub FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ati_ad_shopee_sub_insert" ON ati_ad_shopee_sub;
CREATE POLICY "ati_ad_shopee_sub_insert" ON ati_ad_shopee_sub FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ati_ad_shopee_sub_update" ON ati_ad_shopee_sub;
CREATE POLICY "ati_ad_shopee_sub_update" ON ati_ad_shopee_sub FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ati_ad_shopee_sub_delete" ON ati_ad_shopee_sub;
CREATE POLICY "ati_ad_shopee_sub_delete" ON ati_ad_shopee_sub FOR DELETE USING (auth.uid() = user_id);
