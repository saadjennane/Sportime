-- Enable Realtime for live betting tables
-- This allows real-time updates for bets and balance changes

-- Enable realtime on live_game_bets table
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_game_bets;

-- Enable realtime on live_game_entries table (for balance updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_game_entries;

-- Add index for efficient realtime filtering by entry and status
CREATE INDEX IF NOT EXISTS idx_live_game_bets_entry_status
  ON live_game_bets(entry_id, status);

-- Add index for efficient realtime filtering by entry
CREATE INDEX IF NOT EXISTS idx_live_game_entries_user
  ON live_game_entries(user_id, live_game_id);

COMMENT ON TABLE live_game_bets IS 'Live betting bets with realtime enabled for instant UI updates';
COMMENT ON TABLE live_game_entries IS 'Live betting entries with realtime enabled for balance updates';
