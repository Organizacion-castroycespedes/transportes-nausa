# Modulo de Inspeccion Diaria

## Modelo de datos
- `inspecciones.diarias`: encabezado por tenant y estado (`DRAFT`, `FINALIZED`, `REPORTED`).
- `inspecciones.items`: catalogo dinamico por seccion para chequeo preoperacional.
- `inspecciones.diarias_respuestas`: respuestas `SI/NO/NA` con observacion opcional.
- `inspecciones.archivos_pdf`: historial de binarios PDF por inspeccion.

## Endpoints
- `GET /api/inspecciones/items`
- `GET /api/inspecciones/diarias`
- `POST /api/inspecciones/diarias`
- `GET /api/inspecciones/diarias/:id`
- `PUT /api/inspecciones/diarias/:id`
- `POST /api/inspecciones/diarias/:id/finalizar`
- `GET /api/inspecciones/diarias/:id/pdf`

Integracion reportes:
- `GET /api/reports/inspections/:id/pdf` reutiliza el mismo generador de `inspecciones`.

## Flujo de negocio
1. Usuario crea inspeccion en estado `DRAFT`.
2. El wizard autosalva cambios mientras este en `DRAFT`.
3. Finalizacion valida respuestas completas y observaciones para respuestas `NO`.
4. Al finalizar:
   - cambia estado a `FINALIZED`;
   - genera PDF con plantilla vigente;
   - guarda PDF en `inspecciones.archivos_pdf`.
5. Al descargar (`GET /pdf`):
   - se regenera el PDF con la plantilla vigente (evita devolver formatos viejos);
   - se inserta una nueva version en `inspecciones.archivos_pdf`;
   - se retorna el binario regenerado.

## Reglas de validacion
- Todas las operaciones filtran por `tenant_id` (derivado de JWT).
- UUID obligatorio para `:id` e `itemId`.
- No se puede editar inspecciones en `FINALIZED`/`REPORTED`.
- PDF solo se descarga si estado `FINALIZED`.

## PDF (implementacion actual)
- Motor: `HTML + Puppeteer` en backend NestJS.
- Formato de impresion:
  - `letter`
  - `landscape`
  - `printBackground: true`
  - margenes de `10mm`
- Layout:
  - encabezado corporativo compacto (logo, codigo, estado, datos principales);
  - secciones en bloques visuales (grid de 2 columnas);
  - tabla compacta por seccion: `Concepto | ✔ | ✖ | N/A`;
  - bloques de `Punto Critico`, `Hallazgos`, `Acciones Correctivas` y firmas.

## Seguridad y auditoria
- RBAC por `MENU_KEYS.INSPECCION_DIARIA` (`READ`/`WRITE`).
- Guarda auditoria en `security_audit_logs` para:
  - creacion,
  - actualizacion,
  - finalizacion,
  - descarga PDF.

## Consideraciones para reporte al Ministerio
- Mantener catalogo `inspecciones.items` versionado para trazabilidad historica.
- Si se exige firma digital, extender `inspecciones.diarias` con firma y hash verificable.
- Para interoperabilidad oficial, considerar exportacion JSON/XML ademas de PDF.
