-- ATI: colunas Meta no profiles e tabela de criativos validados
-- Execute no SQL Editor do Supabase (Dashboard)

-- 1) Colunas para token do Meta Ads (igual Shopee)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS meta_access_token text,
ADD COLUMN IF NOT EXISTS meta_access_token_last4 text;

-- 2) Tabela de criativos validados (escala)
CREATE TABLE IF NOT EXISTS ati_validated_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_id text NOT NULL,
  ad_name text,
  campaign_id text,
  campaign_name text,
  scaled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ati_validated_user_id ON ati_validated_creatives(user_id);

-- RLS: usuário só vê os próprios
ALTER TABLE ati_validated_creatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ati_validated_creatives_select_own" ON ati_validated_creatives;
CREATE POLICY "ati_validated_creatives_select_own"
  ON ati_validated_creatives FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ati_validated_creatives_insert_own" ON ati_validated_creatives;
CREATE POLICY "ati_validated_creatives_insert_own"
  ON ati_validated_creatives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ati_validated_creatives_delete_own" ON ati_validated_creatives;
CREATE POLICY "ati_validated_creatives_delete_own"
  ON ati_validated_creatives FOR DELETE
  USING (auth.uid() = user_id);
