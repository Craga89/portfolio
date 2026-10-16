-- D1 schema for the craga-ask Worker (database: craga-ask). Nothing here identifies a visitor.
CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), question TEXT NOT NULL, answered INTEGER NOT NULL, model TEXT, sources TEXT, country TEXT, via TEXT);
CREATE INDEX IF NOT EXISTS questions_at ON questions(at);
CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), path TEXT NOT NULL, referrer TEXT, country TEXT, device TEXT, sections TEXT, seconds INTEGER);
CREATE INDEX IF NOT EXISTS visits_at ON visits(at);
