ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'supplies' CHECK(kind IN ('supplies','handmade'));
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES customers(id),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('slow','journey','memory','tips')),
  cover_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','hidden','deleted')),
  version INTEGER NOT NULL DEFAULT 0,
  seed_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);
CREATE TABLE post_likes (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(post_id,customer_id)
);
CREATE TABLE post_comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  content TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
  seed_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX posts_feed ON posts(status,published_at DESC,id DESC);
CREATE INDEX posts_author ON posts(author_id,status,updated_at DESC);
CREATE INDEX comments_post ON post_comments(post_id,hidden,id DESC);
PRAGMA user_version = 3;
