CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  auth0_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'starter',
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  domain VARCHAR(255),
  created_by INTEGER REFERENCES users(id),
  plan VARCHAR(50) DEFAULT 'starter',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  description TEXT,
  ga_property_id VARCHAR(20),
  domain VARCHAR(255),
  org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS agent_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  agent_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_reports (
  id SERIAL PRIMARY KEY,
  agent_assignment_id INTEGER REFERENCES agent_assignments(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  agent_type VARCHAR(100) NOT NULL,
  task_name VARCHAR(255),
  summary TEXT,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  agent_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,
  api_key TEXT NOT NULL,
  label VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, service)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  scopes TEXT[] DEFAULT '{"read"}',
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
