BEGIN;

WITH admin_role AS (
  SELECT id
  FROM public.roles
  WHERE nombre = 'ADMIN'
  LIMIT 1
),
target_keys AS (
  SELECT * FROM (
    VALUES
      ('CONFIG_GENERAL'),
      ('CONFIGURACION_TENANT_CONFIGURACION'),
      ('CONFIG_USUARIOS'),
      ('USUARIOS_TENANT_USUARIOS'),
      ('CONFIG_ROLES'),
      ('ROLES_TENANT_ROLES')
  ) AS k(menu_key)
),
target_menu AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id
  FROM public.menu_items mi
  JOIN target_keys tk ON tk.menu_key = mi.key
  WHERE mi.deleted_at IS NULL
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  tm.tenant_id,
  ar.id,
  tm.menu_item_id,
  'WRITE',
  jsonb_build_object('read', true, 'write', true)
FROM target_menu tm
CROSS JOIN admin_role ar
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET
  access_level = 'WRITE',
  actions = jsonb_build_object('read', true, 'write', true);

COMMIT;
