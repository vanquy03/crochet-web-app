CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);
CREATE INDEX orders_customer_created ON orders(customer_id, created_at DESC);
CREATE INDEX customer_sessions_expiry ON customer_sessions(expires_at);
PRAGMA user_version = 2;