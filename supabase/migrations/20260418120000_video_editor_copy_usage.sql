-- Limite diário de gerações «Copy com IA» (Grok) no Gerador de Criativos; após a quota, cobram-se coins na API.
CREATE TABLE IF NOT EXISTS public.video_editor_copy_usage (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  usage_day  date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_editor_copy_user_day
  ON public.video_editor_copy_usage (user_id, usage_day);

ALTER TABLE public.video_editor_copy_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own copy usage" ON public.video_editor_copy_usage;
CREATE POLICY "Users select own copy usage"
  ON public.video_editor_copy_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own copy usage" ON public.video_editor_copy_usage;
CREATE POLICY "Users insert own copy usage"
  ON public.video_editor_copy_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
