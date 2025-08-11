-- Adaptive.ai database schema (Postgres + pgvector)
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS vector;

-- Config per account
CREATE TABLE IF NOT EXISTS configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  lookback_days INT NOT NULL DEFAULT 21,
  daily_cap INT NOT NULL DEFAULT 8,
  similarity NUMERIC(4,3) NOT NULL DEFAULT 0.7,
  publish_mode TEXT NOT NULL DEFAULT 'drafts',
  auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
  placements TEXT[],
  objective TEXT NOT NULL DEFAULT 'PPM',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_configs_account ON configs(account_id);

-- Creatives & assets
CREATE TABLE IF NOT EXISTS creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id TEXT,
  creative_id TEXT,
  name TEXT,
  page_id TEXT,
  headline TEXT,
  body TEXT,
  description TEXT,
  cta_type TEXT,
  image_hash TEXT,
  image_url TEXT,
  aspect_ratio TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creatives_ad ON creatives(ad_id);
CREATE INDEX IF NOT EXISTS idx_creatives_creative ON creatives(creative_id);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID REFERENCES creatives(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('image','headline','body','description','cta')),
  value TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_creative ON assets(creative_id);

-- Performance
CREATE TABLE IF NOT EXISTS performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT CHECK (scope IN ('ad','asset_combo')) NOT NULL,
  ref_id TEXT NOT NULL, -- ad_id or composite key
  window_since DATE NOT NULL,
  window_until DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  purchases BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC(18,6) NOT NULL DEFAULT 0,
  revenue NUMERIC(18,6) NOT NULL DEFAULT 0,
  ctr NUMERIC(12,8),
  roas NUMERIC(12,4),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_ref_window ON performance_metrics(ref_id, window_since, window_until);

-- Embeddings
-- Choose dimension to match OPENAI_EMBEDDING_MODEL (1536 for text-embedding-3-small)
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_table TEXT NOT NULL,
  ref_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','text')),
  model TEXT NOT NULL,
  vector VECTOR(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_embeddings_ref ON embeddings(ref_table, ref_id);
-- Optional IVF index (tune lists based on data scale)
-- CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);

-- Clusters
CREATE TABLE IF NOT EXISTS clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT,
  method TEXT,
  centroid VECTOR(1536),
  angle_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clusters_account ON clusters(account_id);

-- Generation jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT,
  inputs JSONB,
  similarity NUMERIC(4,3),
  outputs JSONB,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Validation results
CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES generation_jobs(id) ON DELETE CASCADE,
  flags JSONB,
  recommendations JSONB,
  pass BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_validation_job ON validation_results(job_id);

-- Bandit policies
CREATE TABLE IF NOT EXISTS bandit_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'PPM',
  params JSONB,
  posterior_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bandit_account ON bandit_policies(account_id);

-- Tokens (OAuth)
CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'meta',
  account_id TEXT,
  user_id TEXT,
  access_token TEXT NOT NULL,
  token_type TEXT,
  expires_at TIMESTAMPTZ,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tokens_provider ON tokens(provider);
