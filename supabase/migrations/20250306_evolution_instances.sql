-- Evolution API: webhook n8n no perfil e tabela de instâncias conectadas
-- Execute no SQL Editor do Supabase (Dashboard)

-- URL do webhook n8n (ex: https://n8n.iacodenxt.online/webhook/INSTANCIAEVO2)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS evolution_n8n_webhook_url text;

-- Instâncias Evolution (uma por nome; usuário pode ter várias)
CREATE TABLE IF NOT EXISTS evolution_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_instancia text NOT NULL,
  numero_whatsapp text,
  hash text,
  get_participants boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome_instancia)
);

CREATE INDEX IF NOT EXISTS idx_evolution_instances_user_id ON evolution_instances(user_id);

ALTER TABLE evolution_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evolution_instances_select_own" ON evolution_instances;
CREATE POLICY "evolution_instances_select_own"
  ON evolution_instances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "evolution_instances_insert_own" ON evolution_instances;
CREATE POLICY "evolution_instances_insert_own"
  ON evolution_instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "evolution_instances_update_own" ON evolution_instances;
CREATE POLICY "evolution_instances_update_own"
  ON evolution_instances FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "evolution_instances_delete_own" ON evolution_instances;
CREATE POLICY "evolution_instances_delete_own"
  ON evolution_instances FOR DELETE
  USING (auth.uid() = user_id);
