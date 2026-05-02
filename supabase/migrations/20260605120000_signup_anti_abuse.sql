-- Anti-abuso de criação de contas trial:
--   1) Coluna `cpf` em `profiles` com UNIQUE — bloqueia quem já fez trial
--      de criar nova conta com mesmo CPF.
--   2) Tabela `signup_rate_limits` — limita N tentativas de signup por IP
--      em uma janela deslizante.
--
-- O signup faz validação algorítmica do CPF (dígitos verificadores) antes
-- de gravar; o UNIQUE aqui é a última linha de defesa.

-- ──────────────────────────────────────────────────────────────────────
-- 1) profiles.cpf
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf text;

-- UNIQUE só nos não-nulos (perfis pré-existentes ficam NULL e podem
-- coexistir; novos signups exigirão CPF e ele tem que ser único).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique
  ON profiles(cpf)
  WHERE cpf IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 2) signup_rate_limits
-- Janela deslizante simples: cada IP guarda contador + timestamp da
-- janela. Quando a janela expira, contador zera no próximo signup.
--
-- Acesso: APENAS service role (via API route /api/auth/signup-trial).
-- RLS habilitada SEM policies = nenhum cliente público (anon/authenticated)
-- consegue ler ou escrever; service role bypassa RLS e continua acessando
-- normal. Isso impede que um atacante via REST automática do Supabase zere
-- o contador dele mesmo ou liste IPs já tentaram signup.
CREATE TABLE IF NOT EXISTS signup_rate_limits (
  ip text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signup_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_window
  ON signup_rate_limits(window_start);
