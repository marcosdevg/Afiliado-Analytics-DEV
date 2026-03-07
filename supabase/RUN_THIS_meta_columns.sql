-- Cole este SQL no Supabase: Dashboard → SQL Editor → New query → Cole abaixo → Run
-- Isso adiciona as colunas necessárias para salvar o token do Meta no perfil do usuário.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS meta_access_token text,
ADD COLUMN IF NOT EXISTS meta_access_token_last4 text;
