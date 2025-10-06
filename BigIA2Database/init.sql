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
  role_id INTEGER REFERENCES roles(id)
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
-- Datos iniciales
-- ========================
INSERT INTO roles (name, description) VALUES
  ('user', "Acceso como usuario"),
  ('admin', "Acceso como administrador")
ON CONFLICT DO NOTHING;

INSERT INTO permissions (name) VALUES
  ('can_view_dashboards'),
  ('can_view_reports'),
  ('can_view_users'),
  ('can_create_users'),
  ('can_delete_users'),
  ('can_manage_endpoints')
ON CONFLICT DO NOTHING;

-- Plantilla de permisos
INSERT INTO rol_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name IN ('can_view_dashboards','can_view_reports')
ON CONFLICT DO NOTHING;

INSERT INTO rol_permissions (role_id, permission_id)
SELECT 2, id FROM permissions
ON CONFLICT DO NOTHING;

-- Usuario admin
INSERT INTO users (username, password, role_id)
SELECT 'admin', '$2b$10$J6q9SDwPzCDCODXyGUciX.hGd7P/siYBl/GGRj12QHFbqdc5xAT6u', id
FROM roles WHERE nombre='admin'
ON CONFLICT DO NOTHING;

-- Menú inicial
INSERT INTO menu_items (label, url, route, icon, position, nivel_requerido, type)
VALUES
  ('Inicio', 'https://www.geserisk.es/', '/inicio', 'Home', 1, 1, 'link'),
  ('Reportes', '/revealjs/', '/reportes', 'BarChart', 2, 1, 'link'),
  ('Configuración', NULL, NULL, 'Settings', 3, 2, 'folder')
ON CONFLICT DO NOTHING;

-- Configuración app
INSERT INTO app_config (id, topbar_color, theme_mode, topbar_text, document_title, login_message)
VALUES (1, '#c40000', 'light', 'BigIA 2.0', 'BigIA 2.0', 'Acceso a BigIA 2.0')
ON CONFLICT DO NOTHING;
