-- Add unique constraint to player_transfers for upsert to work
-- This allows the Edge Function to use onConflict: 'player_id,transfer_date'

-- Check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'player_transfers_player_id_transfer_date_key'
  ) THEN
    -- Add unique constraint
    ALTER TABLE public.player_transfers
    ADD CONSTRAINT player_transfers_player_id_transfer_date_key
    UNIQUE (player_id, transfer_date);

    RAISE NOTICE 'Added unique constraint to player_transfers';
  ELSE
    RAISE NOTICE 'Constraint already exists';
  END IF;
END $$;

-- Verify constraint
SELECT
  'Constraint verification' as info,
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'public.player_transfers'::regclass
  AND conname = 'player_transfers_player_id_transfer_date_key';

SELECT '✅ player_transfers constraint added!' as status;
