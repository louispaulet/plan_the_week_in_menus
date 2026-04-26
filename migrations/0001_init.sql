CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_size INTEGER,
  default_budget REAL,
  default_diet_style TEXT,
  locale TEXT DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  scope TEXT NOT NULL DEFAULT 'global',
  status TEXT NOT NULL DEFAULT 'active',
  tags_json TEXT,
  structured_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reusable_blocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  display_summary TEXT NOT NULL,
  hidden_context TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  active_rules_json TEXT,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ingredients_json TEXT,
  tags_json TEXT,
  nutrition_estimate_json TEXT,
  source TEXT DEFAULT 'generated',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS warnings (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  rule_id TEXT,
  day TEXT,
  slot TEXT,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  actions_json TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interface_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  component TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  default_props_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rules_user_status ON rules(user_id, status);
CREATE INDEX IF NOT EXISTS idx_blocks_user_type ON reusable_blocks(user_id, type);
CREATE INDEX IF NOT EXISTS idx_plans_user_week ON meal_plans(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_warnings_plan_status ON warnings(plan_id, status);
