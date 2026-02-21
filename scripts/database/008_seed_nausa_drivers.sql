BEGIN;

CREATE TABLE IF NOT EXISTS public.conductores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  licencia_numero varchar(50),
  licencia_categoria varchar(10),
  licencia_vencimiento date,
  telefono varchar(30),
  direccion text,
  estado varchar(1) NOT NULL DEFAULT 'A' CHECK (estado IN ('A', 'I')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conductores_tenant ON public.conductores (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conductores_user ON public.conductores (user_id);

INSERT INTO public.tenants (slug, nombre, config, activo)
VALUES (
  'transportes-nausa',
  'TRANSPORTES NAUSA LTDA',
  jsonb_build_object('timezone', 'America/Bogota', 'estado', 'A'),
  true
)
ON CONFLICT (slug) DO NOTHING;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
geo AS (
  SELECT
    p.id AS pais_id,
    d.id AS departamento_id,
    m.id AS municipio_id,
    m.nombre AS municipio_nombre,
    d.nombre AS departamento_nombre,
    p.nombre AS pais_nombre
  FROM public.paises p
  LEFT JOIN public.departamentos d ON d.pais_id = p.id AND d.codigo_dane = '08'
  LEFT JOIN public.municipios m ON m.departamento_id = d.id AND m.codigo_dane = '08433'
  WHERE p.codigo_iso2 = 'CO'
  LIMIT 1
)
INSERT INTO public.tenants_detalles (
  tenant_id, razon_social, nit, tipo_persona, estado, direccion_principal, ciudad,
  departamento, pais, telefono, email_corporativo, pais_id, departamento_id, municipio_id
)
SELECT
  t.id,
  'TRANSPORTES NAUSA LTDA',
  '900078756-1',
  'JURIDICA',
  'Activa',
  'Carrera 39 #8-59 Malambo – Atlántico',
  COALESCE(g.municipio_nombre, 'Malambo'),
  COALESCE(g.departamento_nombre, 'Atlántico'),
  COALESCE(g.pais_nombre, 'Colombia'),
  '3135316370',
  'transnausa@hotmail.com',
  g.pais_id,
  g.departamento_id,
  g.municipio_id
FROM tenant_target t
LEFT JOIN geo g ON true
ON CONFLICT (tenant_id) DO NOTHING;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
geo AS (
  SELECT
    p.id AS pais_id,
    d.id AS departamento_id,
    m.id AS municipio_id,
    m.nombre AS municipio_nombre,
    d.nombre AS departamento_nombre,
    p.nombre AS pais_nombre
  FROM public.paises p
  LEFT JOIN public.departamentos d ON d.pais_id = p.id AND d.codigo_dane = '08'
  LEFT JOIN public.municipios m ON m.departamento_id = d.id AND m.codigo_dane = '08433'
  WHERE p.codigo_iso2 = 'CO'
  LIMIT 1
)
INSERT INTO public.tenant_branches (
  tenant_id, codigo, nombre, descripcion, es_principal, direccion, ciudad,
  departamento, pais, telefono, email, estado, metadata, pais_id, departamento_id, municipio_id
)
SELECT
  t.id,
  'MAIN',
  'Sede Principal',
  'Sucursal principal TRANSPORTES NAUSA LTDA',
  true,
  'Carrera 39 #8-59 Malambo – Atlántico',
  COALESCE(g.municipio_nombre, 'Malambo'),
  COALESCE(g.departamento_nombre, 'Atlántico'),
  COALESCE(g.pais_nombre, 'Colombia'),
  '3135316370',
  'transnausa@hotmail.com',
  'ACTIVE',
  jsonb_build_object('timezone', 'America/Bogota', 'estado', 'A'),
  g.pais_id,
  g.departamento_id,
  g.municipio_id
FROM tenant_target t
LEFT JOIN geo g ON true
ON CONFLICT (tenant_id, codigo) DO NOTHING;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
role_target AS (
  SELECT id, nombre FROM public.roles WHERE nombre IN ('SUPER_ADMIN', 'ADMIN', 'USER')
),
users_data AS (
  SELECT * FROM (VALUES
    ('superadmin@nausa.com', 'SUPER_ADMIN', 'Super', 'Admin Nausa', '100000001', 'Gerencia General'),
    ('admin@nausa.com', 'ADMIN', 'Admin', 'Nausa', '100000002', 'Administrador Operativo'),
    ('conductor@nausa.com', 'USER', 'Conductor', 'Demo Nausa', '100000003', 'Conductor')
  ) AS v(email, role_name, nombres, apellidos, documento, cargo)
),
persona_insert AS (
  INSERT INTO public.personas (
    tenant_id, nombres, apellidos, documento_tipo, documento_numero,
    telefono, direccion, email_personal, cargo_nombre
  )
  SELECT
    t.id,
    u.nombres,
    u.apellidos,
    'CC',
    u.documento,
    '3135316370',
    'Carrera 39 #8-59 Malambo – Atlántico',
    u.email,
    u.cargo
  FROM tenant_target t
  JOIN users_data u ON true
  ON CONFLICT (tenant_id, documento_numero) DO NOTHING
  RETURNING id, tenant_id, email_personal
),
persona_final AS (
  SELECT id, tenant_id, email_personal FROM persona_insert
  UNION ALL
  SELECT p.id, p.tenant_id, p.email_personal
  FROM public.personas p
  JOIN tenant_target t ON t.id = p.tenant_id
  WHERE lower(p.email_personal) IN ('superadmin@nausa.com', 'admin@nausa.com', 'conductor@nausa.com')
),
users_insert AS (
  INSERT INTO public.users (tenant_id, persona_id, email, password_hash, estado)
  SELECT
    p.tenant_id,
    p.id,
    lower(p.email_personal),
    crypt('Nausa123*', gen_salt('bf')),
    'ACTIVE'
  FROM persona_final p
  ON CONFLICT (tenant_id, email) DO NOTHING
  RETURNING id, tenant_id, email
),
users_final AS (
  SELECT id, tenant_id, email FROM users_insert
  UNION ALL
  SELECT u.id, u.tenant_id, u.email
  FROM public.users u
  JOIN tenant_target t ON t.id = u.tenant_id
  WHERE lower(u.email) IN ('superadmin@nausa.com', 'admin@nausa.com', 'conductor@nausa.com')
)
INSERT INTO public.user_roles (user_id, role_id, tenant_id)
SELECT uf.id, r.id, uf.tenant_id
FROM users_final uf
JOIN users_data ud ON lower(ud.email) = lower(uf.email)
JOIN role_target r ON r.nombre = ud.role_name
ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
conductor_user AS (
  SELECT u.id AS user_id, u.tenant_id
  FROM public.users u
  JOIN tenant_target t ON t.id = u.tenant_id
  WHERE lower(u.email) = 'conductor@nausa.com'
  LIMIT 1
)
INSERT INTO public.conductores (
  tenant_id, user_id, licencia_numero, licencia_categoria, licencia_vencimiento, telefono, direccion, estado
)
SELECT
  c.tenant_id,
  c.user_id,
  '123456789',
  'C2',
  (CURRENT_DATE + INTERVAL '2 years')::date,
  '3135316370',
  'Carrera 39 #8-59 Malambo – Atlántico',
  'A'
FROM conductor_user c
ON CONFLICT (user_id) DO NOTHING;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
parent_menu AS (
  SELECT id, tenant_id
  FROM public.menu_items
  WHERE tenant_id = (SELECT id FROM tenant_target)
    AND key IN ('CONFIGURACION_TENANT_CONFIGURACION', 'CONFIG_GENERAL')
    AND deleted_at IS NULL
  ORDER BY key = 'CONFIGURACION_TENANT_CONFIGURACION' DESC
  LIMIT 1
)
INSERT INTO public.menu_items (
  tenant_id, key, module, label, route, icon, parent_id, sort_order, visible, below_main_menu, metadata
)
SELECT p.tenant_id, x.key, x.module, x.label, x.route, x.icon, x.parent_id, x.sort_order, true, false, '{}'::jsonb
FROM parent_menu p
JOIN (
  VALUES
    ('CONFIG_CONDUCTORES', 'configuracion', 'Conductores', '/{tenant}/configuracion/conductores', 'IdCard', p.id, 10),
    ('INSPECCION_DIARIA', 'inspeccion', 'Inspección Diaria', '/{tenant}/inspeccion-diaria', 'ClipboardCheck', NULL::uuid, 20),
    ('PERFIL_PROPIO', 'perfil', 'Mi Perfil', '/{tenant}/mi-perfil', 'User', NULL::uuid, 21)
) AS x(key, module, label, route, icon, parent_id, sort_order) ON true
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL DO NOTHING;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
permission_matrix AS (
  SELECT * FROM (VALUES
    ('SUPER_ADMIN', 'CONFIG_CONDUCTORES', 'WRITE'),
    ('SUPER_ADMIN', 'INSPECCION_DIARIA', 'WRITE'),
    ('ADMIN', 'CONFIG_CONDUCTORES', 'WRITE'),
    ('ADMIN', 'INSPECCION_DIARIA', 'WRITE'),
    ('USER', 'INSPECCION_DIARIA', 'WRITE'),
    ('USER', 'PERFIL_PROPIO', 'WRITE')
  ) AS pm(role_name, menu_key, access_level)
)
INSERT INTO public.role_menu_permissions (tenant_id, role_id, menu_item_id, access_level, actions)
SELECT
  t.id,
  r.id,
  mi.id,
  pm.access_level,
  jsonb_build_object('read', true, 'write', pm.access_level = 'WRITE')
FROM tenant_target t
JOIN permission_matrix pm ON true
JOIN public.roles r ON r.nombre = pm.role_name
JOIN public.menu_items mi ON mi.tenant_id = t.id AND mi.key = pm.menu_key AND mi.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id) DO NOTHING;

COMMIT;
