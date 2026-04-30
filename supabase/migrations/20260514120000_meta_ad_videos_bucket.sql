-- ── Bucket público para vídeos enviados ao Meta Ads ───────────────────────────
-- O upload usa signed upload URL emitida pelo backend (browser sobe direto,
-- contornando o limite de 4.5MB de body em Route Handlers da Vercel).
-- A leitura é pública porque o Meta baixa o vídeo via parâmetro `file_url`
-- no endpoint POST /{ad-account-id}/advideos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('meta-ad-videos', 'meta-ad-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Meta ad videos public read" ON storage.objects;
CREATE POLICY "Meta ad videos public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'meta-ad-videos');
