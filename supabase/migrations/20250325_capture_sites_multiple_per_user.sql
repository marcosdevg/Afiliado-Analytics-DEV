-- Vários sites de captura por usuário (Pro/Staff).
-- Esquemas antigos costumavam ter UNIQUE só em userid — o 2º insert falha com 23505
-- e a API interpretava como "slug em uso".

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'capture_sites'
      AND con.contype = 'u'
      AND (
        pg_get_constraintdef(con.oid) ~* 'UNIQUE\s*\(\s*userid\s*\)'
        OR pg_get_constraintdef(con.oid) ~* 'UNIQUE\s*\(\s*user_id\s*\)'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.capture_sites DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- URL pública: um slug por domínio (já esperado pelo app em /capture/[slug]).
CREATE UNIQUE INDEX IF NOT EXISTS capture_sites_domain_slug_unique
  ON public.capture_sites (domain, slug);
