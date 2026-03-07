CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  auth0_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'starter',
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
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
