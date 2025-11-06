-- Migration: Complete Tickets System
-- Date: 2025-06-29
-- Description: Full implementation of the tickets system with tiers (amateur, master, apex)

-- ==============================================
-- 1. CREATE ENUM FOR TICKET TYPES
-- ==============================================

CREATE TYPE public.ticket_type AS ENUM ('amateur', 'master', 'apex');

-- ==============================================
-- 2. CREATE USER_TICKETS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.user_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticket_type public.ticket_type NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  used_for_challenge_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_reason TEXT NOT NULL DEFAULT 'reward',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================
-- 3. CREATE INDEXES
-- ==============================================

CREATE INDEX idx_user_tickets_user_id ON public.user_tickets(user_id);
CREATE INDEX idx_user_tickets_ticket_type ON public.user_tickets(ticket_type);
CREATE INDEX idx_user_tickets_is_used ON public.user_tickets(is_used);
CREATE INDEX idx_user_tickets_expires_at ON public.user_tickets(expires_at);
CREATE INDEX idx_user_tickets_user_type_active ON public.user_tickets(user_id, ticket_type, is_used, expires_at);

-- ==============================================
-- 4. CREATE TICKET_TRANSACTIONS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.ticket_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.user_tickets(id) ON DELETE SET NULL,
  ticket_type public.ticket_type NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('granted', 'used', 'expired')),
  granted_reason TEXT,
  used_for_challenge_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_transactions_user_id ON public.ticket_transactions(user_id);
CREATE INDEX idx_ticket_transactions_ticket_id ON public.ticket_transactions(ticket_id);
CREATE INDEX idx_ticket_transactions_type ON public.ticket_transactions(transaction_type);
CREATE INDEX idx_ticket_transactions_created_at ON public.ticket_transactions(created_at);

-- ==============================================
-- 5. HELPER FUNCTION: GET TICKET RULES
-- ==============================================

CREATE OR REPLACE FUNCTION public.get_ticket_rules(p_ticket_type public.ticket_type)
RETURNS TABLE(tier public.ticket_type, expiry_days INTEGER, max_quantity INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_ticket_type as tier,
    CASE p_ticket_type
      WHEN 'amateur' THEN 30
      WHEN 'master' THEN 45
      WHEN 'apex' THEN 60
    END as expiry_days,
    CASE p_ticket_type
      WHEN 'amateur' THEN 5
      WHEN 'master' THEN 3
      WHEN 'apex' THEN 2
    END as max_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 6. FUNCTION: GRANT A TICKET
-- ==============================================

CREATE OR REPLACE FUNCTION public.grant_ticket(
  p_user_id UUID,
  p_ticket_type public.ticket_type,
  p_granted_reason TEXT DEFAULT 'reward'
)
RETURNS TABLE(ticket_id UUID, success BOOLEAN, message TEXT) AS $$
DECLARE
  v_rules RECORD;
  v_current_count INTEGER;
  v_expiry_date TIMESTAMPTZ;
  v_new_ticket_id UUID;
BEGIN
  -- Get ticket rules
  SELECT * INTO v_rules FROM public.get_ticket_rules(p_ticket_type);

  -- Count current unused, non-expired tickets of this type
  SELECT COUNT(*) INTO v_current_count
  FROM public.user_tickets
  WHERE user_id = p_user_id
    AND ticket_type = p_ticket_type
    AND is_used = false
    AND expires_at > now();

  -- Check if user has reached max quantity
  IF v_current_count >= v_rules.max_quantity THEN
    RETURN QUERY SELECT NULL::UUID, false, format('Maximum %s tickets (%s) already owned', p_ticket_type, v_rules.max_quantity);
    RETURN;
  END IF;

  -- Calculate expiry date
  v_expiry_date := now() + (v_rules.expiry_days || ' days')::INTERVAL;

  -- Insert the new ticket
  INSERT INTO public.user_tickets (user_id, ticket_type, expires_at, granted_reason)
  VALUES (p_user_id, p_ticket_type, v_expiry_date, p_granted_reason)
  RETURNING id INTO v_new_ticket_id;

  -- Log the transaction
  INSERT INTO public.ticket_transactions (user_id, ticket_id, ticket_type, transaction_type, granted_reason)
  VALUES (p_user_id, v_new_ticket_id, p_ticket_type, 'granted', p_granted_reason);

  -- Return success
  RETURN QUERY SELECT v_new_ticket_id, true, format('%s ticket granted, expires in %s days', p_ticket_type, v_rules.expiry_days);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 7. FUNCTION: USE A TICKET
-- ==============================================

CREATE OR REPLACE FUNCTION public.use_ticket(
  p_user_id UUID,
  p_ticket_id UUID,
  p_challenge_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket
  FROM public.user_tickets
  WHERE id = p_ticket_id AND user_id = p_user_id;

  -- Check if ticket exists
  IF v_ticket IS NULL THEN
    RETURN QUERY SELECT false, 'Ticket not found or does not belong to you';
    RETURN;
  END IF;

  -- Check if already used
  IF v_ticket.is_used THEN
    RETURN QUERY SELECT false, 'Ticket already used';
    RETURN;
  END IF;

  -- Check if expired
  IF v_ticket.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'Ticket has expired';
    RETURN;
  END IF;

  -- Mark ticket as used
  UPDATE public.user_tickets
  SET is_used = true,
      used_at = now(),
      used_for_challenge_id = p_challenge_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Log the transaction
  INSERT INTO public.ticket_transactions (user_id, ticket_id, ticket_type, transaction_type, used_for_challenge_id)
  VALUES (p_user_id, p_ticket_id, v_ticket.ticket_type, 'used', p_challenge_id);

  RETURN QUERY SELECT true, 'Ticket used successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 8. FUNCTION: GET USER'S TICKETS
-- ==============================================

CREATE OR REPLACE FUNCTION public.get_user_tickets(
  p_user_id UUID,
  p_ticket_type public.ticket_type DEFAULT NULL,
  p_include_expired BOOLEAN DEFAULT false,
  p_include_used BOOLEAN DEFAULT false
)
RETURNS TABLE(
  id UUID,
  ticket_type public.ticket_type,
  is_used BOOLEAN,
  used_at TIMESTAMPTZ,
  used_for_challenge_id UUID,
  expires_at TIMESTAMPTZ,
  granted_reason TEXT,
  created_at TIMESTAMPTZ,
  is_expired BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.ticket_type,
    t.is_used,
    t.used_at,
    t.used_for_challenge_id,
    t.expires_at,
    t.granted_reason,
    t.created_at,
    (t.expires_at <= now()) as is_expired
  FROM public.user_tickets t
  WHERE t.user_id = p_user_id
    AND (p_ticket_type IS NULL OR t.ticket_type = p_ticket_type)
    AND (p_include_used OR t.is_used = false)
    AND (p_include_expired OR t.expires_at > now())
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 9. FUNCTION: GET TICKET COUNTS
-- ==============================================

CREATE OR REPLACE FUNCTION public.get_ticket_counts(p_user_id UUID)
RETURNS TABLE(ticket_type public.ticket_type, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.ticket_type,
    COUNT(*) as count
  FROM public.user_tickets t
  WHERE t.user_id = p_user_id
    AND t.is_used = false
    AND t.expires_at > now()
  GROUP BY t.ticket_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 10. FUNCTION: CLEANUP EXPIRED TICKETS
-- ==============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_tickets()
RETURNS TABLE(expired_count BIGINT) AS $$
DECLARE
  v_expired_tickets RECORD;
  v_count BIGINT := 0;
BEGIN
  -- Log all expired tickets to transactions
  FOR v_expired_tickets IN
    SELECT id, user_id, ticket_type
    FROM public.user_tickets
    WHERE is_used = false
      AND expires_at <= now()
  LOOP
    INSERT INTO public.ticket_transactions (user_id, ticket_id, ticket_type, transaction_type)
    VALUES (v_expired_tickets.user_id, v_expired_tickets.id, v_expired_tickets.ticket_type, 'expired');

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 11. TRIGGER: AUTO-UPDATE updated_at
-- ==============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_tickets_updated_at
  BEFORE UPDATE ON public.user_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS
ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for user_tickets
CREATE POLICY "Users can view their own tickets"
  ON public.user_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tickets"
  ON public.user_tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets"
  ON public.user_tickets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for ticket_transactions
CREATE POLICY "Users can view their own ticket transactions"
  ON public.ticket_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ticket transactions"
  ON public.ticket_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==============================================
-- 13. GRANT PERMISSIONS
-- ==============================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON public.user_tickets TO authenticated;
GRANT ALL ON public.ticket_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_rules TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.grant_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_tickets TO authenticated;

-- ==============================================
-- MIGRATION COMPLETE
-- ==============================================
