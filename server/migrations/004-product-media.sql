ALTER TABLE products ADD COLUMN media TEXT NOT NULL DEFAULT '[]';
PRAGMA user_version = 4;
