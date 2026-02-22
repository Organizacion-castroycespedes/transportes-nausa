# Módulo de Inspección Diaria

## Modelo de datos
- `inspecciones.diarias`: encabezado por tenant y estado (`DRAFT`, `FINALIZED`, `REPORTED`).
- `inspecciones.items`: catálogo dinámico por sección para chequeo preoperacional.
- `inspecciones.diarias_respuestas`: respuestas SI/NO/NA con observación opcional.
- `inspecciones.archivos_pdf`: binario PDF generado al finalizar.

## Endpoints
- `GET /api/inspecciones/items`
- `GET /api/inspecciones/diarias`
- `POST /api/inspecciones/diarias`
- `GET /api/inspecciones/diarias/:id`
- `PUT /api/inspecciones/diarias/:id`
- `POST /api/inspecciones/diarias/:id/finalizar`
- `GET /api/inspecciones/diarias/:id/pdf`

## Flujo de negocio
1. Usuario crea inspección en estado `DRAFT`.
2. El wizard autosalva cambios (update) mientras esté en `DRAFT`.
3. Finalización valida respuestas completas y observaciones para `NO`.
4. Al finalizar:
   - cambia estado a `FINALIZED`;
   - genera PDF;
   - guarda PDF en `inspecciones.archivos_pdf`.

## Reglas de validación
- Todas las operaciones filtran por `tenant_id` (obtenido de JWT).
- UUID obligatorio para `:id` e `itemId`.
- No se puede editar inspecciones en `FINALIZED`/`REPORTED`.
- PDF sólo se descarga si estado `FINALIZED`.

## PDF
- Se genera un PDF con encabezado, secciones, respuestas y hallazgos.
- Se persiste en base de datos para trazabilidad.

## Seguridad y auditoría
- RBAC por `MENU_KEYS.INSPECCION_DIARIA` (`READ`/`WRITE`).
- Guarda auditoría en `security_audit_logs` para:
  - creación,
  - actualización,
  - finalización,
  - descarga PDF.

## Consideraciones para reporte al Ministerio
- Mantener catálogo `inspecciones.items` versionado para trazabilidad histórica.
- Si se exige firma digital, extender `inspecciones.diarias` con firma y hash.
- Para interoperabilidad oficial, agregar exportación JSON/XML además de PDF.
