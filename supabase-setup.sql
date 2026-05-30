-- UFU Decide — Schema Setup
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================================
-- ENUM
-- ============================================================
CREATE TYPE vote_choice AS ENUM ('favor', 'contra', 'abstencao');

-- ============================================================
-- TABELAS
-- ============================================================

CREATE TABLE IF NOT EXISTS votes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash  text        UNIQUE NOT NULL,
  choice      vote_choice NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash       text        NOT NULL,
  code             text        NOT NULL,
  expires_at       timestamptz NOT NULL,
  attempts         integer     NOT NULL DEFAULT 0,
  used             boolean     NOT NULL DEFAULT false,
  verified_token   text,                          -- preenchido após verify-code
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip          text        NOT NULL,
  action      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_hash ON verification_codes(email_hash);
CREATE INDEX IF NOT EXISTS idx_verification_codes_verified_token ON verification_codes(verified_token);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_action ON rate_limits(ip, action, created_at);

-- ============================================================
-- ROW LEVEL SECURITY — nenhum acesso direto pelo client anon
-- ============================================================
ALTER TABLE votes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits        ENABLE ROW LEVEL SECURITY;

-- Sem policies públicas — toda leitura/escrita é feita via service_role no backend.
-- O service_role bypassa RLS por padrão no Supabase.

-- ============================================================
-- VIEW PÚBLICA DE RESULTADOS
-- ============================================================
CREATE OR REPLACE VIEW public_results AS
SELECT
  COALESCE(SUM(CASE WHEN choice = 'favor'     THEN 1 ELSE 0 END), 0) AS favor,
  COALESCE(SUM(CASE WHEN choice = 'contra'    THEN 1 ELSE 0 END), 0) AS contra,
  COALESCE(SUM(CASE WHEN choice = 'abstencao' THEN 1 ELSE 0 END), 0) AS abstencao,
  COUNT(*)                                                             AS total
FROM votes;
