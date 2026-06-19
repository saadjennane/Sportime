-- =====================================================
-- Add 'premium' to the ticket_type enum — a universal/wildcard tournament ticket
-- that can enter ANY tier. Must be its own migration: Postgres can't use a newly
-- added enum value in the same transaction that adds it. The join RPCs + the daily
-- grant that USE 'premium' live in the next migration (20260618140000).
-- =====================================================

ALTER TYPE public.ticket_type ADD VALUE IF NOT EXISTS 'premium';
