-- ========================
-- Tabla de roles
-- ========================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) UNIQUE NOT NULL,
  nivel INTEGER NOT NULL
);
 
-- ========================
-- Tabla de usuarios
-- ========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  icon TEXT
);
 
-- ========================
-- Tabla de permisos
-- ========================
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);
 
-- ========================
-- Tabla de plantilla de permisos por nivel
-- ========================
CREATE TABLE IF NOT EXISTS nivel_permisos (
  nivel INTEGER NOT NULL,
  permission_id INTEGER REFERENCES permissions(id),
  PRIMARY KEY (nivel, permission_id)
);
 
-- ========================
-- Tabla de ítems del menú (con carpetas)
-- ========================
-- Reglas:
--  * type: 'link' | 'folder'
--  * Si type='folder' => route IS NULL y url IS NULL
--  * Si type='link'   => route IS NOT NULL
--  * parent_id referencia a una carpeta; NULL = top-level
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  url TEXT,
  route VARCHAR(100) UNIQUE,            -- ampliado a 100 por rutas /carpeta/slug
  icon TEXT,
  position INTEGER NOT NULL,
  permission_id INTEGER REFERENCES permissions(id),
  nivel_requerido INTEGER NOT NULL DEFAULT 1,
  type VARCHAR(10) NOT NULL DEFAULT 'link' CHECK (type IN ('link','folder')),
  parent_id INTEGER NULL REFERENCES menu_items(id) ON DELETE SET NULL,
  CHECK (
    (type = 'folder' AND route IS NULL AND url IS NULL) OR
    (type = 'link'   AND route IS NOT NULL)
  ),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
 
-- Índices para rendimiento / orden
CREATE INDEX IF NOT EXISTS menu_items_parent_idx ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS menu_items_level_idx ON menu_items(nivel_requerido);
 
-- Unicidad de posición por grupo
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_top_level_position_uidx
  ON menu_items(position)
  WHERE parent_id IS NULL;
 
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_child_position_uidx
  ON menu_items(parent_id, position)
  WHERE parent_id IS NOT NULL;
 
-- Trigger: parent_id debe referir a una carpeta
CREATE OR REPLACE FUNCTION menu_items_validate_parent()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    PERFORM 1 FROM menu_items m WHERE m.id = NEW.parent_id AND m.type = 'folder';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent_id % must reference a folder', NEW.parent_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
 
DROP TRIGGER IF EXISTS trg_menu_items_validate_parent ON menu_items;
CREATE TRIGGER trg_menu_items_validate_parent
BEFORE INSERT OR UPDATE OF parent_id, type
ON menu_items
FOR EACH ROW EXECUTE FUNCTION menu_items_validate_parent();
 
-- ========================
-- Insertar roles iniciales
-- ========================
DO $$
BEGIN
  INSERT INTO roles (nombre, nivel) VALUES
    ('user', 1),
    ('admin', 2)
  ON CONFLICT DO NOTHING;
END
$$;
 
-- ========================
-- Insertar permisos iniciales
-- ========================
DO $$
BEGIN
  INSERT INTO permissions (name) VALUES
    ('can_view_dashboards'),
    ('can_view_reports'),
    ('can_view_users'),
    ('can_create_users'),
    ('can_delete_users'),
    ('can_manage_endpoints')
  ON CONFLICT DO NOTHING;
END
$$;
 
-- ========================
-- Plantilla de permisos por nivel
-- ========================
DO $$
BEGIN
  -- Nivel 1: user
  INSERT INTO nivel_permisos (nivel, permission_id)
  SELECT 1, id FROM permissions
  WHERE name IN ('can_view_dashboards', 'can_view_reports')
  ON CONFLICT DO NOTHING;
 
  -- Nivel 2: admin (todos)
  INSERT INTO nivel_permisos (nivel, permission_id)
  SELECT 2, id FROM permissions
  ON CONFLICT DO NOTHING;
END
$$;
 
-- ============================================
-- Usuario admin por defecto
-- ============================================
DO $$
DECLARE
  rid INTEGER;
BEGIN
  SELECT id INTO rid FROM roles WHERE nombre = 'admin';
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
    INSERT INTO users (username, password, role_id, icon)
    VALUES (
      'admin',
      '$2b$10$J6q9SDwPzCDCODXyGUciX.hGd7P/siYBl/GGRj12QHFbqdc5xAT6u',  -- admin1234
      rid,
      'AdminPanelSettingsIcon'
    );
  END IF;
END
$$;
 
-- ============================================
-- Triggers de permisos -> admin
-- ============================================
CREATE OR REPLACE FUNCTION tg_assign_admin_on_new_permission()
RETURNS trigger AS $$
BEGIN
  INSERT INTO nivel_permisos (nivel, permission_id)
  VALUES (2, NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
DROP TRIGGER IF EXISTS tr_assign_admin_on_new_permission ON permissions;
CREATE TRIGGER tr_assign_admin_on_new_permission
AFTER INSERT ON permissions
FOR EACH ROW
EXECUTE FUNCTION tg_assign_admin_on_new_permission();
 
CREATE OR REPLACE FUNCTION tg_replicate_level1_to_admin()
RETURNS trigger AS $$
BEGIN
  IF NEW.nivel = 1 THEN
    INSERT INTO nivel_permisos (nivel, permission_id)
    VALUES (2, NEW.permission_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
DROP TRIGGER IF EXISTS tr_replicate_level1_to_admin ON nivel_permisos;
CREATE TRIGGER tr_replicate_level1_to_admin
AFTER INSERT ON nivel_permisos
FOR EACH ROW
EXECUTE FUNCTION tg_replicate_level1_to_admin();
 

-- Sesiones para refresh-token con rotación
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_family ON sessions(family_id);



-- ============================================
-- Configuración global de la app (una sola fila)
-- ============================================
CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  topbar_color VARCHAR(20) NOT NULL DEFAULT '#c40000',
  theme_mode VARCHAR(10) NOT NULL DEFAULT 'light', -- 'dark' | 'light'
  topbar_text VARCHAR(100) NOT NULL DEFAULT 'BigIA 2.0',
  document_title VARCHAR(100) NOT NULL DEFAULT 'BigIA 2.0',
  login_message TEXT NOT NULL DEFAULT 'Acceso a BigIA 2.0'
);
 
-- Soporte idempotente si la tabla existía sin la columna nueva
ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS login_message TEXT NOT NULL DEFAULT 'Acceso a BigIA 2.0';
 
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_config WHERE id = 1) THEN
    INSERT INTO app_config (id, topbar_color, theme_mode, topbar_text, document_title, login_message)
    VALUES (1, '#c40000', 'light', 'BigIA 2.0', 'BigIA 2.0', 'Acceso a BigIA 2.0');
  ELSE
    -- Garantiza un valor válido si venías de una versión anterior
    UPDATE app_config
      SET login_message = COALESCE(NULLIF(login_message, ''), 'Acceso a BigIA 2.0')
    WHERE id = 1;
  END IF;
END
$$;
 
-- =========================================================
-- 🌳 ESTRUCTURA BASE DEL MENÚ (carpetas + páginas iniciales)
-- =========================================================
INSERT INTO public.menu_items
(id, label, url, route, icon, "position", permission_id, nivel_requerido, type, parent_id) VALUES
(1,  'Fortigate 100F', NULL, NULL, 'FireExtinguisher', 2, NULL, 1, 'folder', NULL),
(3,  'Reportes', '/revealjs/', '/reportes', 'BarChart', 3, 2, 1, 'link', NULL),
(2,  'Kibana', '/kibana', '/kbmain', 'AutoAwesomeMosaicSharp', 4, 1, 1, 'link', NULL),
(9,  'SOAR', '/n8nsoar', '/soar', 'AutoFixHigh', 5, NULL, 2, 'link', NULL),
(4,  'Configuración', NULL, NULL, 'Settings', 6, NULL, 2, 'folder', NULL),
(14, 'FG100F Ingress Events', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/4dbc62c0-831c-11f0-8232-87d9605708a2?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/dashboards/fg100fingev', 'ArrowDownward', 4, NULL, 1, 'link', 1),
(5,  'Gestor endpoints', NULL, '/configuracion/gestor-endpoints', 'Tune', 1, 6, 2, 'link', 4),
(6,  'Usuarios', NULL, '/configuracion/usuarios', 'People', 2, 3, 2, 'link', 4),
(7,  'Personalización', NULL, '/configuracion/personalizacion', 'Palette', 3, NULL, 2, 'link', 4),
(8,  'Inicio', 'https://www.geserisk.es/', '/inicio', 'Home', 1, NULL, 1, 'link', NULL),
(11, 'FG100F Events', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/a0b097fb-5eab-4b6d-9155-8b83974087f8?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/dashboards/fg100fevents', 'EmojiEvents', 2, NULL, 1, 'link', 1),
(12, 'FG100F Egress Events', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/263b7880-831c-11f0-8232-87d9605708a2?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/dashboards/mfegressevents', 'ArrowUpward', 3, NULL, 1, 'link', 1),
(10, 'Mashfrog Firewall Overview', '/kibana/app/dashboards?auth_provider_hint=publicaccess#/view/fortinet_fortigate-d0cd8230-0c8b-11ed-bb95-158df2ca77e4?embed=true&_g=%28refreshInterval%3A%28pause%3A%21t%2Cvalue%3A60000%29%2Ctime%3A%28from%3Anow-15m%2Cto%3Anow%29%29&show-query-input=true&show-time-filter=true', '/fortigate-100f/mfover', 'RemoveRedEyeOutlined', 1, NULL, 1, 'link', 1);
 
-- =========================================================
-- 🏠 Añadir "Inicio" en top-level (posición 1) de forma idempotente
--    usando desplazamiento en 2 fases para evitar colisiones
-- =========================================================
DO $$
DECLARE
  exists_inicio BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM menu_items WHERE route = '/inicio') INTO exists_inicio;
 
  IF NOT exists_inicio THEN
    -- 1) Desplazar temporalmente muy arriba para no chocar con el índice único
    UPDATE menu_items
    SET position = position + 1000000
    WHERE parent_id IS NULL;
 
    -- 2) Traer de vuelta con +1 neto
    UPDATE menu_items
    SET position = position - 999999
    WHERE parent_id IS NULL;
 
    -- 3) Insertar "Inicio" en posición 1 (página interna)
    INSERT INTO menu_items (label, url, route, icon, position, permission_id, nivel_requerido, type, parent_id)
    VALUES ('Inicio', NULL, '/inicio', 'Home', 1, NULL, 1, 'link', NULL);
  END IF;
END
$$;

-- === Re-sincroniza secuencias con los datos sembrados (idempotente) ===
DO $$
DECLARE
  seq text;
BEGIN
  SELECT pg_get_serial_sequence('menu_items','id') INTO seq;
  EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM menu_items),0), TRUE);', seq);

  SELECT pg_get_serial_sequence('roles','id') INTO seq;
  EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM roles),0), TRUE);', seq);

  SELECT pg_get_serial_sequence('users','id') INTO seq;
  EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM users),0), TRUE);', seq);

  SELECT pg_get_serial_sequence('permissions','id') INTO seq;
  EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM permissions),0), TRUE);', seq);
END $$;