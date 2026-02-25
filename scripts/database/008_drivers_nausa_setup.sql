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

ALTER TABLE IF EXISTS public.conductores
  ADD COLUMN IF NOT EXISTS vehiculo_placa varchar(20),
  ADD COLUMN IF NOT EXISTS vehiculo_tipo varchar(50),
  ADD COLUMN IF NOT EXISTS vehiculo_marca varchar(80),
  ADD COLUMN IF NOT EXISTS vehiculo_modelo varchar(80);

CREATE INDEX IF NOT EXISTS idx_conductores_tenant ON public.conductores (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conductores_user ON public.conductores (user_id);
CREATE INDEX IF NOT EXISTS idx_conductores_tenant_vehiculo_placa
  ON public.conductores (tenant_id, vehiculo_placa)
  WHERE vehiculo_placa IS NOT NULL;

WITH base AS (
  INSERT INTO public.tenants (slug, nombre, config, activo)
  VALUES (
    'transportes-nausa',
    'TRANSPORTES NAUSA LTDA',
    jsonb_build_object('timezone', 'America/Bogota', 'estado', 'A'),
    true
  )
  ON CONFLICT (slug)
  DO UPDATE SET
    nombre = EXCLUDED.nombre,
    config = COALESCE(public.tenants.config, '{}'::jsonb) || EXCLUDED.config,
    activo = true
  RETURNING id
)
SELECT id FROM base;

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
  tenant_id,
  razon_social,
  nit,
  tipo_persona,
  estado,
  direccion_principal,
  ciudad,
  departamento,
  pais,
  telefono,
  email_corporativo,
  pais_id,
  departamento_id,
  municipio_id
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
ON CONFLICT (tenant_id) DO UPDATE SET
  razon_social = EXCLUDED.razon_social,
  nit = EXCLUDED.nit,
  direccion_principal = EXCLUDED.direccion_principal,
  ciudad = EXCLUDED.ciudad,
  departamento = EXCLUDED.departamento,
  pais = EXCLUDED.pais,
  telefono = EXCLUDED.telefono,
  email_corporativo = EXCLUDED.email_corporativo,
  pais_id = COALESCE(EXCLUDED.pais_id, public.tenants_detalles.pais_id),
  departamento_id = COALESCE(EXCLUDED.departamento_id, public.tenants_detalles.departamento_id),
  municipio_id = COALESCE(EXCLUDED.municipio_id, public.tenants_detalles.municipio_id),
  updated_at = now();

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
  tenant_id,
  codigo,
  nombre,
  descripcion,
  es_principal,
  direccion,
  ciudad,
  departamento,
  pais,
  telefono,
  email,
  estado,
  metadata,
  pais_id,
  departamento_id,
  municipio_id
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
ON CONFLICT (tenant_id, codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  es_principal = EXCLUDED.es_principal,
  direccion = EXCLUDED.direccion,
  ciudad = EXCLUDED.ciudad,
  departamento = EXCLUDED.departamento,
  pais = EXCLUDED.pais,
  telefono = EXCLUDED.telefono,
  email = EXCLUDED.email,
  estado = EXCLUDED.estado,
  metadata = EXCLUDED.metadata,
  updated_at = now();

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
role_target AS (
  SELECT id, nombre FROM public.roles WHERE nombre IN ('SUPER_ADMIN', 'ADMIN', 'USER')
),
users_data AS (
  SELECT * FROM (VALUES
    ('superadmin.nausa', 'superadmin@nausa.com', 'SUPER_ADMIN', 'Super', 'Admin Nausa', '100000001', 'Gerencia General'),
    ('admin.nausa', 'admin@nausa.com', 'ADMIN', 'Admin', 'Nausa', '100000002', 'Administrador Operativo'),
    ('conductor.nausa', 'conductor@nausa.com', 'USER', 'Conductor', 'Demo Nausa', '100000003', 'Conductor')
  ) AS v(username, email, role_name, nombres, apellidos, documento, cargo)
),
persona_insert AS (
  INSERT INTO public.personas (
    tenant_id,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero,
    telefono,
    direccion,
    email_personal,
    cargo_nombre
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
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.personas p
    WHERE p.tenant_id = t.id
      AND p.documento_numero = u.documento
  )
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
users_upsert AS (
  INSERT INTO public.users (tenant_id, persona_id, email, password_hash, estado)
  SELECT
    p.tenant_id,
    p.id,
    lower(p.email_personal),
    crypt('Nausa123*', gen_salt('bf')),
    'ACTIVE'
  FROM persona_final p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.tenant_id = p.tenant_id
      AND lower(u.email) = lower(p.email_personal)
  )
  RETURNING id, tenant_id, email
),
users_final AS (
  SELECT id, tenant_id, email FROM users_upsert
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
  tenant_id,
  user_id,
  licencia_numero,
  licencia_categoria,
  licencia_vencimiento,
  telefono,
  direccion,
  vehiculo_placa,
  vehiculo_tipo,
  vehiculo_marca,
  vehiculo_modelo,
  estado
)
SELECT
  c.tenant_id,
  c.user_id,
  '123456789',
  'C2',
  (CURRENT_DATE + INTERVAL '2 years')::date,
  '3135316370',
  'Carrera 39 #8-59 Malambo – Atlántico',
  'TMY381',
  'Camion',
  'Chevrolet',
  'NKR III',
  'A'
FROM conductor_user c
ON CONFLICT (user_id)
DO UPDATE SET
  licencia_numero = EXCLUDED.licencia_numero,
  licencia_categoria = EXCLUDED.licencia_categoria,
  licencia_vencimiento = EXCLUDED.licencia_vencimiento,
  telefono = EXCLUDED.telefono,
  direccion = EXCLUDED.direccion,
  vehiculo_placa = UPPER(EXCLUDED.vehiculo_placa),
  vehiculo_tipo = EXCLUDED.vehiculo_tipo,
  vehiculo_marca = EXCLUDED.vehiculo_marca,
  vehiculo_modelo = EXCLUDED.vehiculo_modelo,
  estado = EXCLUDED.estado,
  updated_at = now();

UPDATE public.conductores
SET vehiculo_placa = UPPER(BTRIM(vehiculo_placa))
WHERE vehiculo_placa IS NOT NULL;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
ensure_parent_menu AS (
  INSERT INTO public.menu_items (
    tenant_id,
    key,
    module,
    label,
    route,
    icon,
    parent_id,
    sort_order,
    visible,
    below_main_menu,
    metadata
  )
  SELECT
    t.id,
    'CONFIGURACION_TENANT_CONFIGURACION',
    'configuracion',
    'Configuración',
    '/{tenant}/configuracion',
    NULL::text,
    NULL::uuid,
    0,
    true,
    false,
    '{}'::jsonb
  FROM tenant_target t
  ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
  DO UPDATE SET
    deleted_at = NULL,
    updated_at = now()
  RETURNING id, tenant_id
),
parent_menu AS (
  SELECT id, tenant_id
  FROM ensure_parent_menu
  LIMIT 1
)
INSERT INTO public.menu_items (
  tenant_id,
  key,
  module,
  label,
  route,
  icon,
  parent_id,
  sort_order,
  visible,
  below_main_menu,
  metadata
)
SELECT p.tenant_id, x.key, x.module, x.label, x.route, x.icon, x.parent_id, x.sort_order, true, false, '{}'::jsonb
FROM parent_menu p
JOIN LATERAL (
  VALUES
    ('USUARIOS_TENANT_USUARIOS', 'usuarios', 'Usuarios', '/{tenant}/usuarios', 'User', p.id, 5),
    ('ROLES_TENANT_ROLES', 'roles', 'Roles', '/{tenant}/roles', 'Users', p.id, 6),
    ('CONFIG_CONDUCTORES', 'configuracion', 'Conductores', '/{tenant}/configuracion/conductores', 'IdCard', p.id, 10),
    ('INSPECCION_DIARIA', 'inspeccion', 'Inspección Diaria', '/{tenant}/inspeccion-diaria', 'ClipboardCheck', NULL::uuid, 20),
    ('PERFIL_PROPIO', 'perfil', 'Mi Perfil', '/{tenant}/mi-perfil', 'User', NULL::uuid, 21)
) AS x(key, module, label, route, icon, parent_id, sort_order) ON true
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  visible = EXCLUDED.visible,
  below_main_menu = EXCLUDED.below_main_menu,
  metadata = EXCLUDED.metadata,
  updated_at = now(),
  deleted_at = NULL;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'transportes-nausa' LIMIT 1
),
permission_matrix AS (
  SELECT * FROM (VALUES
    ('SUPER_ADMIN', 'USUARIOS_TENANT_USUARIOS', 'READ'),
    ('SUPER_ADMIN', 'ROLES_TENANT_ROLES', 'READ'),
    ('SUPER_ADMIN', 'CONFIG_MENU', 'WRITE'),
    ('SUPER_ADMIN', 'CONFIG_CONDUCTORES', 'WRITE'),
    ('SUPER_ADMIN', 'INSPECCION_DIARIA', 'WRITE'),
    ('ADMIN', 'CONFIGURACION_TENANT_CONFIGURACION', 'WRITE'),
    ('ADMIN', 'USUARIOS_TENANT_USUARIOS', 'WRITE'),
    ('ADMIN', 'ROLES_TENANT_ROLES', 'WRITE'),
    ('ADMIN', 'CONFIG_CONDUCTORES', 'WRITE'),
    ('ADMIN', 'INSPECCION_DIARIA', 'WRITE'),
    ('USER', 'INSPECCION_DIARIA', 'WRITE'),
    ('USER', 'PERFIL_PROPIO', 'WRITE')
  ) AS pm(role_name, menu_key, access_level)
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
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
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;


WITH tenant_target AS (
  SELECT id
  FROM public.tenants
  WHERE slug = 'transportes-nausa'
  LIMIT 1
),
report_parent AS (
  SELECT
    t.id AS tenant_id,
    (
      SELECT mi.id
      FROM public.menu_items mi
      WHERE mi.tenant_id = t.id
        AND mi.deleted_at IS NULL
        AND mi.key IN ('REPORTES_TENANT_REPORTES', 'REPORTE_TENANT_REPORTE')
      ORDER BY CASE mi.key
        WHEN 'REPORTES_TENANT_REPORTES' THEN 1
        WHEN 'REPORTE_TENANT_REPORTE' THEN 2
        ELSE 99
      END
      LIMIT 1
    ) AS parent_id
  FROM tenant_target t
)
INSERT INTO public.menu_items (
  tenant_id,
  key,
  module,
  label,
  route,
  icon,
  parent_id,
  sort_order,
  visible,
  below_main_menu,
  metadata
)
SELECT
  t.id,
  x.key,
  x.module,
  x.label,
  x.route,
  x.icon,
  rp.parent_id,
  x.sort_order,
  true,
  false,
  '{}'::jsonb
FROM tenant_target t
LEFT JOIN report_parent rp ON rp.tenant_id = t.id
JOIN LATERAL (
  VALUES
    ('REPORTE_DASHBOARD', 'reporte', 'Inspecciones Dashboard', '/{tenant}/reporte-deshboard', 'LayoutDashboard', 0),
    ('REPORTE_INSPENCCIONES', 'reportes', 'Reportes Inspecciones', '/{tenant}/reporte-inspecciones', 'FileText', 1)
) AS x(key, module, label, route, icon, sort_order) ON true
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  visible = EXCLUDED.visible,
  below_main_menu = EXCLUDED.below_main_menu,
  metadata = EXCLUDED.metadata,
  updated_at = now(),
  deleted_at = NULL;

WITH tenant_target AS (
  SELECT id
  FROM public.tenants
  WHERE slug = 'transportes-nausa'
  LIMIT 1
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  t.id,
  r.id,
  mi.id,
  'WRITE',
  jsonb_build_object('read', true, 'write', true)
FROM tenant_target t
JOIN public.roles r ON r.nombre = 'SUPER_ADMIN'
JOIN public.menu_items mi
  ON mi.tenant_id = t.id
 AND mi.key IN ('REPORTE_DASHBOARD', 'REPORTE_INSPENCCIONES')
 AND mi.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;