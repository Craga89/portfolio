-- D1 schema for the craga-ask Worker (database: craga-ask). Nothing here identifies a visitor.
CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), question TEXT NOT NULL, answered INTEGER NOT NULL, model TEXT, sources TEXT, country TEXT, via TEXT);
CREATE INDEX IF NOT EXISTS questions_at ON questions(at);
CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), path TEXT NOT NULL, referrer TEXT, country TEXT, device TEXT, sections TEXT, seconds INTEGER, lang TEXT, offer TEXT);
-- Added later (on-device translation): ALTER TABLE visits ADD COLUMN lang TEXT; ALTER TABLE visits ADD COLUMN offer TEXT;
CREATE INDEX IF NOT EXISTS visits_at ON visits(at);
-- Workers AI spending per UTC day and share (ask, speak, test), so the site stays inside the free allowance (src/budget.js).
CREATE TABLE IF NOT EXISTS ai_budget (day TEXT NOT NULL, kind TEXT NOT NULL, neurons REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, kind));
