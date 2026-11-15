-- ============================================================================
-- MINEIRØ / EARTHSONG — FASE 4: SCHEMA POSTGRES + SUPABASE REALTIME
-- Regra Áurea: 1 Pessoa = 1 Camada por Região | Coautoria Justa 5/5 | Ranking Real
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PERFIL DO EXPLORADOR (Sincronizado com Supabase Auth ou Auth Próprio)
CREATE TABLE IF NOT EXISTS public.users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 2 AND 32),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 64),
  origin_country_code CHAR(2) NOT NULL DEFAULT 'BR',
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  discovered_regions_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_regions_count >= 0),
  completed_symphonies_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_symphonies_count >= 0),
  achievements_count INTEGER NOT NULL DEFAULT 0 CHECK (achievements_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CONTRIBUIÇÕES COLETIVAS POR REGIÃO (1 VOZ POR PESSOA POR REGIÃO, 5 CAMADAS ÚNICAS)
CREATE TABLE IF NOT EXISTS public.region_stem_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key TEXT NOT NULL,           -- Ex.: 'country:BRA', 'country:PRT'
  region_label TEXT NOT NULL,         -- Ex.: 'Brasil', 'Portugal'
  stem_id TEXT NOT NULL CHECK (stem_id IN ('melody', 'harmony', 'rhythm', 'bass', 'fx')),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  contributor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Garante que cada instrumento só seja aceso 1 vez por região
  CONSTRAINT uq_region_stem UNIQUE (region_key, stem_id),
  -- Garante honestamente a regra central: 1 pessoa = 1 camada por região
  CONSTRAINT uq_region_single_voice_per_user UNIQUE (region_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_region_contributions_region_key
  ON public.region_stem_contributions (region_key);

CREATE INDEX IF NOT EXISTS idx_region_contributions_created_at
  ON public.region_stem_contributions (created_at DESC);

-- 3. CRIAÇÕES VISUAIS COMPARTILHADAS (ESTÚDIO VISUAL GENERATIVO)
CREATE TABLE IF NOT EXISTS public.shared_art_mixes (
  slug TEXT PRIMARY KEY,
  author_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  author_username TEXT NOT NULL DEFAULT 'explorador',
  title TEXT NOT NULL DEFAULT 'Arte Planetária NASA',
  visual_style TEXT NOT NULL CHECK (visual_style IN ('bioluminescent', 'infrared', 'blueprint', 'satellite')),
  view_mode TEXT NOT NULL DEFAULT '3d' CHECK (view_mode IN ('3d', '2d')),
  country_iso TEXT,
  layers_payload JSONB NOT NULL,      -- Ordem da pilha, enabled, opacidade e blendMode
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. GATILHO DE XP + RECONCILIAÇÃO JUSTA DE COAUTORIA 5/5 (TODOS OS 5 RECEBEM CRÉDITO!)
CREATE OR REPLACE FUNCTION public.fn_award_collective_contribution_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_region_count INTEGER;
BEGIN
  -- +35 XP imediatos para quem acendeu esta camada
  UPDATE public.users_profile
  SET xp = xp + 35,
      updated_at = now()
  WHERE id = NEW.user_id;

  -- Conta quantas camadas já foram acesas nesta região
  SELECT COUNT(*) INTO v_region_count
  FROM public.region_stem_contributions
  WHERE region_key = NEW.region_key;

  -- Quando a 5ª camada fecha 5/5, TODOS os 5 coautores ganham +50 XP e +1 Constelação 5/5!
  IF v_region_count = 5 THEN
    UPDATE public.users_profile
    SET xp = xp + 50,
        completed_symphonies_count = completed_symphonies_count + 1,
        updated_at = now()
    WHERE id IN (
      SELECT user_id
      FROM public.region_stem_contributions
      WHERE region_key = NEW.region_key
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_collective_contribution_xp ON public.region_stem_contributions;
CREATE TRIGGER trg_award_collective_contribution_xp
  AFTER INSERT ON public.region_stem_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_award_collective_contribution_xp();

-- 5. VIEW OFICIAL DO RANKING GLOBAL (SEM DADOS FICTÍCIOS)
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT
  ROW_NUMBER() OVER (ORDER BY p.xp DESC, p.completed_symphonies_count DESC, p.created_at ASC) AS position,
  p.id AS user_id,
  p.display_name,
  p.username,
  p.origin_country_code AS country_code,
  p.xp,
  COALESCE(c.contributions_count, 0)::INTEGER AS contributions,
  p.completed_symphonies_count,
  p.achievements_count
FROM public.users_profile p
LEFT JOIN (
  SELECT user_id, COUNT(*) AS contributions_count
  FROM public.region_stem_contributions
  GROUP BY user_id
) c ON c.user_id = p.id
ORDER BY p.xp DESC, p.completed_symphonies_count DESC;

-- 6. ROW LEVEL SECURITY (RLS) + REALTIME PARA O TOAST DA ÓRBITA COLETIVA
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_stem_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_art_mixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de perfis"
  ON public.users_profile FOR SELECT USING (true);

CREATE POLICY "Usuário atualiza próprio perfil"
  ON public.users_profile FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Leitura pública da Constelação Viva"
  ON public.region_stem_contributions FOR SELECT USING (true);

CREATE POLICY "Usuário autenticado acende 1 camada por região"
  ON public.region_stem_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Leitura pública de artes compartilhadas"
  ON public.shared_art_mixes FOR SELECT USING (true);

CREATE POLICY "Qualquer explorador salva link curto de arte"
  ON public.shared_art_mixes FOR INSERT WITH CHECK (true);

-- Habilitar transmissão ao vivo (Supabase Realtime) para o Toast da Órbita Coletiva:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.region_stem_contributions;


-- ============================================================================
-- 7. REGISTRO OFICIAL DE SALAS ATIVAS (?room=XXXXXX) — SETUP / PROJETORES / MOBILE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  code TEXT PRIMARY KEY CHECK (char_length(code) BETWEEN 3 AND 24),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_active_updated_at
  ON public.rooms (active, updated_at DESC);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active rooms" ON public.rooms;
CREATE POLICY "Public read active rooms"
  ON public.rooms
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Host create rooms" ON public.rooms;
CREATE POLICY "Host create rooms"
  ON public.rooms
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (char_length(code) BETWEEN 3 AND 24);

DROP POLICY IF EXISTS "Host update rooms" ON public.rooms;
CREATE POLICY "Host update rooms"
  ON public.rooms
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (char_length(code) BETWEEN 3 AND 24);
