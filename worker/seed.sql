-- One-time seed migrating the current data from the Claude Artifact
-- versions of these tools, so the switch to the native pages doesn't
-- lose anything. Apply once, after schema.sql, on a fresh database:
--   wrangler d1 execute gardners-hub --remote --file=worker/seed.sql

INSERT INTO shopping_lists (id, name, position) VALUES
  ('l1', 'Groceries', 1),
  ('l2', 'Costco', 2);

INSERT INTO shopping_items (id, list_id, text, done, position) VALUES
  ('i1', 'l1', 'Milk', 1, 1),
  ('i2', 'l1', 'Eggs', 1, 2),
  ('i3', 'l1', 'Coffee', 1, 3),
  ('imt9g6iyx7o52k', 'l1', 'yogurt', 0, 4),
  ('imt9ghrzo0exio', 'l1', 'honey', 0, 5);

INSERT INTO countdowns (id, label, target, position) VALUES
  ('c1', 'Rochelle''s birthday', '2027-08-22T00:00', 1),
  ('c2', 'New Year''s Eve', '2026-12-31T18:00', 2),
  ('cmt9gl03qakyob', 'Raven''s birthday', '2027-02-12T08:00', 3),
  ('cmt9glu9juqvbu', 'Tanner''s birthday', '2027-02-25T08:00', 4),
  ('cmt9gmmkyqr36e', 'Thanksgiving', '2026-11-26T10:00', 5),
  ('cmt9gn42g370hb', 'Christmas', '2026-12-25T10:00', 6),
  ('cmt9gnx8v3m2f2', '4 Day Weekend', '2026-08-28T17:00', 7);

INSERT INTO house_tips (id, text, position) VALUES
  ('t1', 'Filter''s due — check the furnace closet.', 1),
  ('t2', 'Bins go out Wednesday night, not Thursday morning.', 2),
  ('t4', 'Garage code resets the 1st of the month — check the Secretary app.', 3),
  ('t5', 'Gutter check before the fall storms roll in.', 4),
  ('tmt9g752ir0niy', 'clean gutters', 5);
