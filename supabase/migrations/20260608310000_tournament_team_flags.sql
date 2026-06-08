-- Country flags for tournament teams (flagcdn.com by ISO 3166-1 alpha-2).
UPDATE public.tq_teams t
SET flag_url = 'https://flagcdn.com/w80/' || m.iso || '.png'
FROM (VALUES
  ('Morocco','ma'),('Spain','es'),('France','fr'),('Brazil','br'),('Argentina','ar'),
  ('Portugal','pt'),('England','gb-eng'),('Germany','de'),('Netherlands','nl'),('Italy','it'),
  ('Croatia','hr'),('Belgium','be'),('Uruguay','uy'),('Senegal','sn'),('Japan','jp'),('USA','us'),
  ('Mexico','mx'),('Colombia','co'),('Denmark','dk'),('Switzerland','ch'),('Nigeria','ng'),
  ('Cameroon','cm'),('Ghana','gh'),('Egypt','eg'),('Korea Rep','kr'),('Serbia','rs'),('Poland','pl'),
  ('Ecuador','ec'),('Canada','ca'),('Australia','au'),('Tunisia','tn'),('Ivory Coast','ci')
) AS m(name, iso)
WHERE t.name = m.name;
