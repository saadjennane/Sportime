-- Allow the new entry transaction types used by join_fantasy_game / join_live_game.
ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'shop_purchase', 'daily_streak', 'spin_wheel', 'challenge_entry', 'challenge_refund',
    'challenge_reward', 'premium_bonus', 'referral_reward', 'admin_adjustment', 'initial_bonus',
    'fantasy_entry', 'live_game_entry'
  ));
