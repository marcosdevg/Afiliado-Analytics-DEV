-- Correção de segurança: substitui a view `v_push_user_state_emails`
-- (criada na migration 20260610120000) por uma coluna direta em
-- `push_user_state`.
--
-- Por que: views no PostgreSQL bypassam RLS das tabelas base por default
-- (executam com permissão do criador). Como a view foi criada via
-- migration (role superuser), qualquer usuário authenticated que fizesse
-- `select * from v_push_user_state_emails` via PostgREST veria todos os
-- emails + comissões da base — vazamento crítico.
--
-- Solução: dropar a view e mover o email pra coluna direta em
-- `push_user_state`. Como a tabela já tem RLS com policies select/insert/
-- update_own (somente próprio user_id), a coluna fica automaticamente
-- protegida sob as mesmas regras de `comissao_total` / `comissao_ontem`.

-- 1) Remove a view insegura.
DROP VIEW IF EXISTS public.v_push_user_state_emails;

-- 2) Adiciona coluna direta. Nullable porque há linhas pré-existentes
-- sem email; o backfill abaixo preenche-as. Novos inserts no cron de
-- coleta passam o email explicitamente (ver
-- /api/cron/push-coletar-comissao-ontem).
ALTER TABLE public.push_user_state
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.push_user_state.email IS
  'Email do usuário denormalizado de profiles.email. Mantido pelo cron de coleta a cada execução (upsert). Uso: facilitar conferência manual no Table Editor sem precisar JOIN com profiles.';

-- 3) Backfill: preenche emails dos registros existentes a partir de
-- profiles. Idempotente (pode rodar de novo sem efeito colateral).
UPDATE public.push_user_state pus
SET email = p.email
FROM public.profiles p
WHERE p.id = pus.user_id
  AND pus.email IS DISTINCT FROM p.email;
