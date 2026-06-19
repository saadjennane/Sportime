-- Admin-editable spin wheel content (segments per tier). The client draw can
-- read these instead of the hard-coded spinConstants.ts.
CREATE TABLE IF NOT EXISTS public.spin_segments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier         TEXT NOT NULL,                  -- free | amateur | master | apex | premium
  segment_key  TEXT NOT NULL,                  -- e.g. ticket_amateur, boost_50
  label        TEXT NOT NULL,
  base_chance  NUMERIC NOT NULL DEFAULT 0,     -- relative probability (normalised at draw)
  category     TEXT NOT NULL,                  -- ticket | spin | masterpass | xp | premium | gift_card
  value        INTEGER,                        -- xp amount / gift card value / etc.
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spin_segments_tier ON public.spin_segments(tier, sort_order);
ALTER TABLE public.spin_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spin_segments_read ON public.spin_segments;
CREATE POLICY spin_segments_read ON public.spin_segments FOR SELECT USING (true);
DROP POLICY IF EXISTS spin_segments_admin ON public.spin_segments;
CREATE POLICY spin_segments_admin ON public.spin_segments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.spin_segments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.spin_segments TO authenticated;

INSERT INTO public.spin_segments (tier, segment_key, label, base_chance, category, value, sort_order)
VALUES
  ('amateur','ticket_amateur','Amateur Ticket',0.28,'ticket',NULL,0),
  ('amateur','extra_spin','Extra Spin',0.28,'spin',NULL,1),
  ('amateur','masterpass_amateur','Amateur MasterPass',0.10,'masterpass',NULL,2),
  ('amateur','boost_50','XP +50',0.12,'xp',50,3),
  ('amateur','boost_100','XP +100',0.10,'xp',100,4),
  ('amateur','boost_200','XP +200',0.09,'xp',200,5),
  ('amateur','ticket_master','Master Ticket',0.03,'ticket',NULL,6),
  ('master','ticket_master','Master Ticket',0.24,'ticket',NULL,0),
  ('master','extra_spin','Extra Spin',0.24,'spin',NULL,1),
  ('master','boost_200','XP +200',0.18,'xp',200,2),
  ('master','boost_400','XP +400',0.16,'xp',400,3),
  ('master','masterpass_master','Master MasterPass',0.08,'masterpass',NULL,4),
  ('master','ticket_apex','Apex Ticket',0.06,'ticket',NULL,5),
  ('master','premium_3d','Premium (3 days)',0.04,'premium',3,6),
  ('apex','ticket_apex','Apex Ticket',0.25,'ticket',NULL,0),
  ('apex','extra_spin','Extra Spin',0.25,'spin',NULL,1),
  ('apex','masterpass_apex','Apex MasterPass',0.15,'masterpass',NULL,2),
  ('apex','boost_1200','XP +1200',0.14,'xp',1200,3),
  ('apex','boost_800','XP +800',0.11,'xp',800,4),
  ('apex','gift_card','Gift Card $5',0.06,'gift_card',5,5),
  ('apex','premium_7d','Premium (7 days)',0.04,'premium',7,6),
  ('premium','masterpass_master','Master MasterPass',0.20,'masterpass',NULL,0),
  ('premium','gift_card_10','Gift Card $10',0.05,'gift_card',10,1),
  ('premium','premium_30d','Premium (30 days)',0.10,'premium',30,2),
  ('premium','boost_2000','XP +2000',0.25,'xp',2000,3),
  ('premium','ticket_apex_pack','2x Apex Tickets',0.15,'ticket',NULL,4),
  ('premium','extra_spin_premium','Extra Premium Spin',0.25,'spin',NULL,5)
ON CONFLICT DO NOTHING;
