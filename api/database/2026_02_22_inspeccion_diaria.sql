CREATE SCHEMA IF NOT EXISTS inspecciones;

CREATE TABLE IF NOT EXISTS inspecciones.diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  placa VARCHAR(20) NOT NULL,
  conductor VARCHAR(200) NOT NULL,
  cedula VARCHAR(50),
  fecha TIMESTAMPTZ NOT NULL,
  numero_manifiesto VARCHAR(100),
  destino VARCHAR(200),
  estado VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (estado IN ('DRAFT', 'FINALIZED', 'REPORTED')),
  punto_critico BOOLEAN NOT NULL DEFAULT FALSE,
  hallazgos TEXT,
  acciones_correctivas TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inspecciones_diarias_tenant_fecha_idx
  ON inspecciones.diarias (tenant_id, fecha DESC);

CREATE TABLE IF NOT EXISTS inspecciones.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seccion VARCHAR(50) NOT NULL,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  orden INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS inspecciones_items_seccion_orden_idx
  ON inspecciones.items (seccion, orden);

CREATE TABLE IF NOT EXISTS inspecciones.diarias_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diarias_id UUID NOT NULL REFERENCES inspecciones.diarias(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inspecciones.items(id),
  respuesta VARCHAR(5) NOT NULL CHECK (respuesta IN ('SI', 'NO', 'NA')),
  observacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (diarias_id, item_id)
);

CREATE INDEX IF NOT EXISTS inspecciones_diarias_respuestas_diaria_idx
  ON inspecciones.diarias_respuestas (diarias_id);

CREATE TABLE IF NOT EXISTS inspecciones.archivos_pdf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diarias_id UUID NOT NULL REFERENCES inspecciones.diarias(id) ON DELETE CASCADE,
  archivo BYTEA NOT NULL,
  generado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generado_por UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS inspecciones_archivos_pdf_diaria_idx
  ON inspecciones.archivos_pdf (diarias_id, generado_at DESC);

INSERT INTO inspecciones.items (seccion, codigo, descripcion, orden, activo)
VALUES
  ('DOCUMENTOS', 'DOC_LICENCIA_CONDUCCION', 'Licencia de conduccion', 1, TRUE),
  ('DOCUMENTOS', 'DOC_SOAT', 'SOAT', 2, TRUE),
  ('DOCUMENTOS', 'DOC_REVISION_TECNOMECANICA', 'Revision tecnomecanica', 3, TRUE),

  ('LUCES', 'LUC_FRONTALES', 'Luces frontales de servicio (altas y bajas)', 1, TRUE),
  ('LUCES', 'LUC_ESTACIONARIAS', 'Luces estacionarias (parqueo)', 2, TRUE),
  ('LUCES', 'LUC_DIRECCIONALES_DELANTERAS', 'Direccionales delanteras de parqueo', 3, TRUE),
  ('LUCES', 'LUC_DIRECCIONALES_TRASERAS', 'Direccionales traseras de parqueo', 4, TRUE),
  ('LUCES', 'LUC_DIRECCIONALES_LATERALES', 'Direccionales laterales', 5, TRUE),
  ('LUCES', 'LUC_ESPEJOS_LATERALES', 'Espejos laterales', 6, TRUE),
  ('LUCES', 'LUC_RETROVISORES', 'Retrovisores', 7, TRUE),

  ('CABINA', 'CAB_ALARMA_RETROCESO', 'Alarma de retroceso', 1, TRUE),
  ('CABINA', 'CAB_PITO', 'Pito', 2, TRUE),
  ('CABINA', 'CAB_FRENO_SERVICIO', 'Freno de servicio', 3, TRUE),
  ('CABINA', 'CAB_FRENO_SEGURIDAD', 'Freno de seguridad', 4, TRUE),
  ('CABINA', 'CAB_DIRECCION_SUSPENSION', 'Direccion/suspension (terminales)', 5, TRUE),
  ('CABINA', 'CAB_CINTURON_SEGURIDAD', 'Cinturon de seguridad', 6, TRUE),
  ('CABINA', 'CAB_VIDRIOS', 'Vidrios (en buen estado)', 7, TRUE),
  ('CABINA', 'CAB_LIMPIABRISAS', 'Limpia brisas', 8, TRUE),
  ('CABINA', 'CAB_EQUIPO_CARRETERA', 'Equipo de carretera', 9, TRUE),
  ('CABINA', 'CAB_BOTIQUIN', 'Botiquin de primeros auxilios', 10, TRUE),

  ('LLANTAS', 'LLA_ESTADO_GENERAL', 'En buen estado (sin cortaduras profundas y sin abultamientos)', 1, TRUE),
  ('LLANTAS', 'LLA_REPUESTO', 'Repuesto', 2, TRUE),

  ('ESTADO_MECANICO', 'MEC_CONTROL_FUGAS', 'Control de fugas hidraulicas', 1, TRUE),
  ('ESTADO_MECANICO', 'MEC_PASADORES_SUSPENSION', 'Pasadores, suspension', 2, TRUE),
  ('ESTADO_MECANICO', 'MEC_RESORTES_AMORTIGUADORES', 'Resortes y amortiguadores', 3, TRUE),
  ('ESTADO_MECANICO', 'MEC_GRAPAS_CHASIS', 'Grapas y anclaje de chasis', 4, TRUE),
  ('ESTADO_MECANICO', 'MEC_CADENA_CARDAN', 'Cadena cardan', 5, TRUE),
  ('ESTADO_MECANICO', 'MEC_NIVEL_FLUIDOS_FRENO', 'Nivel fluidos de freno', 6, TRUE),
  ('ESTADO_MECANICO', 'MEC_NIVEL_FLUIDOS_ACEITE', 'Nivel fluidos de aceite', 7, TRUE),
  ('ESTADO_MECANICO', 'MEC_NIVEL_FLUIDOS_REFRIGERANTE', 'Nivel fluidos de refrigerante', 8, TRUE),
  ('ESTADO_MECANICO', 'MEC_NIVEL_COMBUSTIBLE', 'Nivel de combustible', 9, TRUE),

  ('SEGURIDAD_SOCIAL', 'SOC_ARL', 'ARL', 1, TRUE),
  ('SEGURIDAD_SOCIAL', 'SOC_EPS', 'EPS', 2, TRUE),
  ('SEGURIDAD_SOCIAL', 'SOC_PENSION', 'PENSION', 3, TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO menu_items (tenant_id, key, module, label, route, visible, metadata)
SELECT t.id, 'INSPECCION_DIARIA', 'operaciones', 'Inspeccion diaria', '/{tenant}/inspeccion-diaria', TRUE, '{}'::jsonb
FROM tenants t
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  visible = EXCLUDED.visible,
  metadata = EXCLUDED.metadata,
  deleted_at = NULL,
  updated_at = NOW();

INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level, actions)
SELECT t.id, r.id, mi.id, 'WRITE', jsonb_build_object('read', true, 'write', true)
FROM tenants t
INNER JOIN roles r ON UPPER(r.nombre) IN ('ADMIN','SUPER_ADMIN','USER')
INNER JOIN menu_items mi ON mi.tenant_id = t.id AND mi.key = 'INSPECCION_DIARIA' AND mi.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;
