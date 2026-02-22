BEGIN;

INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions,
  created_at
)
SELECT
  t.id AS tenant_id,
  r.id AS role_id,
  mi.id AS menu_item_id,
  p.access_level,
  '{}'::jsonb AS actions,
  p.created_at
FROM public.tenants t
JOIN (
  VALUES
    ('USUARIOS_TENANT_USUARIOS', 'READ',  '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('CONFIGURACION_TENANT_CONFIGURACION', 'READ', '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('ROLES_TENANT_ROLES', 'READ', '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('DASHBOARD_TENANT_DASHBOARD', 'READ', '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('CONFIG_MENU', 'WRITE', '2026-02-21 07:13:59.217301-06'::timestamptz)
) AS p(menu_key, access_level, created_at)
  ON true
JOIN public.roles r
  ON r.nombre = 'SUPER_ADMIN'
JOIN public.menu_items mi
  ON mi.tenant_id = t.id
 AND mi.key = p.menu_key
 AND mi.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;
