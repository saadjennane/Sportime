-- Create live_match_events table to store real-time match events
-- Events include: goals, cards, substitutions, VAR decisions, penalties

CREATE TABLE IF NOT EXISTS live_match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id INT NOT NULL, -- API-Football fixture ID
  api_event_id INT, -- Unique event ID from API-Football (for deduplication)
  minute INT NOT NULL,
  minute_extra INT, -- Extra time minutes (e.g., 90+3)
  team_id INT, -- API-Football team ID
  team_name TEXT,
  player_id INT,
  player_name TEXT,
  assist_id INT,
  assist_name TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'Goal', 'Card', 'subst', 'Var', 'Penalty', 'Missed Penalty'
  )),
  event_detail TEXT, -- e.g., 'Yellow Card', 'Red Card', 'Normal Goal', 'Own Goal', 'Penalty'
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate events
  UNIQUE(fixture_id, event_type, minute, COALESCE(player_id, 0))
);

-- Indexes for efficient queries
CREATE INDEX idx_live_match_events_fixture ON live_match_events(fixture_id);
CREATE INDEX idx_live_match_events_type ON live_match_events(event_type);
CREATE INDEX idx_live_match_events_fixture_minute ON live_match_events(fixture_id, minute);
CREATE INDEX idx_live_match_events_created ON live_match_events(created_at);

-- Enable realtime for match events
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_match_events;

-- RLS policies
ALTER TABLE live_match_events ENABLE ROW LEVEL SECURITY;

-- Everyone can read events
CREATE POLICY "live_match_events_select_all" ON live_match_events
  FOR SELECT USING (true);

-- Only service role can insert/update (via edge functions)
CREATE POLICY "live_match_events_insert_service" ON live_match_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "live_match_events_update_service" ON live_match_events
  FOR UPDATE USING (true);

COMMENT ON TABLE live_match_events IS 'Real-time match events from API-Football (goals, cards, subs, VAR)';

-- Function to refund voided bets
CREATE OR REPLACE FUNCTION refund_voided_bet(p_entry_id UUID, p_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE live_game_entries
  SET balance = balance + p_amount
  WHERE id = p_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to credit bet winnings
CREATE OR REPLACE FUNCTION credit_bet_winnings(p_entry_id UUID, p_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE live_game_entries
  SET
    balance = balance + p_amount,
    total_gains = total_gains + p_amount
  WHERE id = p_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
