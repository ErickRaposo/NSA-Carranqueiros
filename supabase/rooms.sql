-- ============================================================================
-- Earth Jukebox · Registro Oficial de Salas (?room=XXXXXX) no Supabase
-- Rode este script no menu "SQL Editor" -> "New query" -> "Run" do Supabase.
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
