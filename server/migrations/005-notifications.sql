CREATE TABLE announcements (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recipients INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  kind TEXT NOT NULL CHECK(kind IN ('like','comment','announcement')),
  actor_id INTEGER REFERENCES customers(id),
  post_id INTEGER REFERENCES posts(id),
  comment_id INTEGER REFERENCES post_comments(id),
  announcement_id INTEGER REFERENCES announcements(id),
  event_key TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id,event_key)
);
CREATE INDEX notifications_customer ON notifications(customer_id,id DESC);
CREATE INDEX notifications_unread ON notifications(customer_id,read_at);
PRAGMA user_version = 5;
