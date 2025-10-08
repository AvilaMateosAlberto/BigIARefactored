-- ========================
-- Roles
-- ========================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255) NOT NULL
);

-- ========================
-- Usuarios
-- ========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  icon TEXT DEFAULT NULL
);

-- ========================
-- Permisos
-- ========================
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

-- ========================
-- Plantilla de rol-permisos
-- ========================
CREATE TABLE IF NOT EXISTS rol_permissions (
  role_id INTEGER REFERENCES roles(id),
  permission_id INTEGER REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- ========================
-- Menú
-- ========================
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  url TEXT,
  route VARCHAR(100) UNIQUE,
  icon TEXT,
  position INTEGER NOT NULL,
  permission_id INTEGER REFERENCES permissions(id),
  type VARCHAR(10) NOT NULL DEFAULT 'link',
  parent_id INTEGER NULL REFERENCES menu_items(id) ON DELETE SET NULL
);

-- ========================
-- Configuración global de la app
-- ========================
CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  topbar_color VARCHAR(20) NOT NULL DEFAULT '#c40000',
  topbar_text VARCHAR(100) NOT NULL DEFAULT 'BigIA 2.0',
  document_title VARCHAR(100) NOT NULL DEFAULT 'BigIA 2.0',
  login_message TEXT NOT NULL DEFAULT 'Acceso a BigIA 2.0'
);

-- ========================
-- Sesiones
-- ========================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip INET,
  user_agent TEXT,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- Datos iniciales
-- ========================
INSERT INTO roles (name, description) VALUES
  ('user', 'Acceso como usuario'),
  ('admin', 'Acceso como administrador')
ON CONFLICT DO NOTHING;

INSERT INTO permissions (name) VALUES
  ('can_view_user_dashboards'),
  ('can_view_admin_dashboards'),
  ('can_view_reports'),
  ('can_view_users'),
  ('can_create_users'),
  ('can_delete_users'),
  ('can_manage_endpoints')
ON CONFLICT DO NOTHING;

-- Plantilla de permisos
INSERT INTO rol_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name IN ('can_view_user_dashboards','can_view_reports')
ON CONFLICT DO NOTHING;

INSERT INTO rol_permissions (role_id, permission_id)
SELECT 2, id FROM permissions
ON CONFLICT DO NOTHING;

-- Usuario admin
INSERT INTO users (username, password, role_id)
SELECT 'admin', '$2b$10$J6q9SDwPzCDCODXyGUciX.hGd7P/siYBl/GGRj12QHFbqdc5xAT6u', id
FROM roles WHERE name='admin'
ON CONFLICT DO NOTHING;

-- Menú inicial
INSERT INTO public.menu_items
(label, url, route, icon, "position", permission_id, type, parent_id) VALUES
('Fortigate 100F', NULL, NULL, 'FireExtinguisher', 2, 1, 'folder', NULL),
('Reportes', '/revealjs/', '/reportes', 'BarChart', 3, 2, 'link', NULL),
('Kibana', '/kibana', '/kbmain', 'AutoAwesomeMosaicSharp', 4, 2, 'link', NULL),
('SOAR', '/n8nsoar', '/soar', 'AutoFixHigh', 5, 2, 'link', NULL),
('Configuración', NULL, NULL, 'Settings', 6, 2, 'folder', NULL),
('FG100F Ingress Events', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/4dbc62c0-831c-11f0-8232-87d9605708a2?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/dashboards/fg100fingev', 'ArrowDownward', 4, 1, 'link', 1),
('Gestor endpoints', NULL, '/configuracion/endpoints', 'Tune', 1, 7, 'link', 5),
('Usuarios', NULL, '/configuracion/usuarios', 'People', 2, 4, 'link', 5),
('Personalización', NULL, '/configuracion/personalizacion', 'Palette', 3, 2, 'link', 5),
('Inicio', 'https://www.geserisk.es/', '/inicio', 'Home', 1, 1, 'link', NULL),
('FG100F Events', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/a0b097fb-5eab-4b6d-9155-8b83974087f8?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/dashboards/fg100fevents', 'EmojiEvents', 2, 1, 'link', 1),
('FG100F Egress Events', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/263b7880-831c-11f0-8232-87d9605708a2?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/dashboards/mfegressevents', 'ArrowUpward', 3, 1, 'link', 1),
('Mashfrog Firewall Overview', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/fortinet_fortigate-d0cd8230-0c8b-11ed-bb95-158df2ca77e4?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/fortigate-100f/mfover', 'RemoveRedEyeOutlined', 1, 1, 'link', 1);
 
-- Configuración app
INSERT INTO app_config (id, topbar_color, topbar_text, document_title, login_message)
VALUES (1, '#c40000', 'BigIA 2.0', 'BigIA 2.0', 'Acceso a BigIA 2.0')
ON CONFLICT DO NOTHING;
