-- Schema for the Gardners Hub tools API (Cloudflare D1).
-- Apply with: wrangler d1 execute gardners-hub --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id);

CREATE TABLE IF NOT EXISTS countdowns (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  target TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS house_tips (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  position INTEGER NOT NULL
);
