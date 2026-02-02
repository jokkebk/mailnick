CREATE TABLE cleanup_rules (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES tokens(id),
  name TEXT NOT NULL,
  match_criteria TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  color TEXT
);
