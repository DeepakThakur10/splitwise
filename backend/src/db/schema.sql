-- ============================================================
-- SPLITWISE CLONE — DATABASE SCHEMA
-- ============================================================

-- Users who can log in
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,             -- bcrypt hash
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- A group of flatmates (e.g. "The Flat")
CREATE TABLE IF NOT EXISTS groups (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks who is in which group AND when they joined/left.
-- This is how we handle Meera leaving and Sam joining.
-- left_at NULL means they are still active.
CREATE TABLE IF NOT EXISTS group_members (
  id          SERIAL PRIMARY KEY,
  group_id    INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id),
  joined_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  left_at     DATE,                      -- NULL = still a member
  UNIQUE(group_id, user_id, joined_at)   -- allow re-joining
);

-- An expense paid by one person
CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL PRIMARY KEY,
  group_id     INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount       NUMERIC(12, 2) NOT NULL,  -- always stored in INR
  currency     TEXT NOT NULL DEFAULT 'INR',
  fx_rate      NUMERIC(10, 4) DEFAULT 1, -- rate used if currency != INR
  paid_by      INT NOT NULL REFERENCES users(id),
  split_type   TEXT NOT NULL,            -- equal | unequal | percentage | share
  expense_date DATE NOT NULL,
  notes        TEXT,
  is_deleted   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- One row per person per expense — how much each person owes for that expense
CREATE TABLE IF NOT EXISTS expense_splits (
  id          SERIAL PRIMARY KEY,
  expense_id  INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id),
  amount      NUMERIC(12, 2) NOT NULL    -- the share this person owes
);

-- A direct payment from one person to another (settles debt)
CREATE TABLE IF NOT EXISTS settlements (
  id          SERIAL PRIMARY KEY,
  group_id    INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by     INT NOT NULL REFERENCES users(id),
  paid_to     INT NOT NULL REFERENCES users(id),
  amount      NUMERIC(12, 2) NOT NULL,
  settled_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Stores the result of a CSV import so we can show the anomaly report
CREATE TABLE IF NOT EXISTS import_logs (
  id            SERIAL PRIMARY KEY,
  group_id      INT REFERENCES groups(id),
  filename      TEXT,
  total_rows    INT,
  imported      INT,
  skipped       INT,
  flagged       INT,
  anomalies     JSONB,                   -- array of anomaly objects
  imported_at   TIMESTAMPTZ DEFAULT NOW()
);

-- A lookup table mapping raw CSV names to real user ids
-- (e.g. "Priya S" -> user_id 3, "priya" -> user_id 3)
CREATE TABLE IF NOT EXISTS name_aliases (
  id          SERIAL PRIMARY KEY,
  raw_name    TEXT NOT NULL,
  user_id     INT NOT NULL REFERENCES users(id),
  UNIQUE(raw_name)
);
