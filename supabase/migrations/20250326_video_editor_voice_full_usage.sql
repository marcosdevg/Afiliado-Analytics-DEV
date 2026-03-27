-- Limite diário de gerações "Voz + Legendas" (TTS com timestamps) no Gerador de Criativos.
CREATE TABLE IF NOT EXISTS public.video_editor_voice_full_usage (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_day  date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_editor_voice_full_user_day
  ON public.video_editor_voice_full_usage (user_id, usage_day);

ALTER TABLE public.video_editor_voice_full_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own voice full usage" ON public.video_editor_voice_full_usage;
CREATE POLICY "Users select own voice full usage"
  ON public.video_editor_voice_full_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own voice full usage" ON public.video_editor_voice_full_usage;
CREATE POLICY "Users insert own voice full usage"
  ON public.video_editor_voice_full_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);
