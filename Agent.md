# Agent.md - Transportes NAUSA Platform

## 1. Resumen del Proyecto
Proyecto SaaS multi-tenant con:
- Backend en NestJS dentro de `api/`
- Frontend en Next.js dentro de `web/`
- Base de datos PostgreSQL

El proyecto incluye autenticacion JWT, RBAC por roles/permisos, modulos administrativos y flujos operativos por tenant.

## 2. Arquitectura General (Estructura Real)
Diagrama textual (alto nivel):
```txt
[web/ Next.js] -> [api/ NestJS /api] -> [PostgreSQL]
  app/*            controllers            tablas multi-tenant
  domains/*        services               (tenants, users, roles, menu, etc.)
  components/*     modules/*
  store/*
```

Estructura actual relevante:
- `web/app` rutas Next.js (App Router)
- `web/domains` logica por dominio
- `web/components` UI reutilizable
- `web/components/design-system` componentes visuales base
- `web/styles/globals.css` tokens visuales globales (fuente de verdad visual)
- `api/src/modules` modulos backend NestJS
- `api/database` SQL/migraciones/seed historicos

## 3. Convenciones de Nombres
Backend:
- Modulos por dominio: `auth`, `users`, `roles`, `tenants`, `menu`, `branches`, `locations`, etc.
- DTOs: `CreateXDto`, `UpdateXDto`, `XResponseDto`
- Variables comunes: `tenantId`, `userId`, `roleId`, `permissionId`

Frontend:
- Dominios en `web/domains/*`
- Componentes base reutilizables en `web/components/design-system/*`
- Componentes de pantalla/feature fuera del design system cuando incluyan logica de negocio

Base de datos:
- Campos de auditoria: `created_at`, `updated_at`, `deleted_at`
- Siempre usar `tenant_id` en tablas multi-tenant cuando aplique

## 4. Multi-Tenant Strategy
Estandar observado:
- `tenant_id` viaja en JWT
- Frontend consume el tenant desde la sesion/token para routing y requests
- Existen rutas por tenant en `web/app/[tenant]/...`

Reglas obligatorias:
1. Para usuarios autenticados, el `tenant_id` debe derivarse del JWT (no del frontend como fuente primaria).
2. Toda query multi-tenant debe filtrar por `tenant_id`.
3. Evitar aceptar `tenant_id` enviado manualmente desde UI si el backend ya lo obtiene del token.
4. Las pantallas en `web/app/[tenant]/...` deben mantener coherencia entre slug en URL y tenant de sesion.

## 5. RBAC / Permisos
Modelo actual:
- Roles por usuario/tenant (`user_roles`)
- Roles como `SUPER_ADMIN`, `ADMIN`
- Permisos por menu y nivel (READ/WRITE) en `role_menu_permissions`

Buenas practicas:
- Guards en endpoints sensibles
- Validacion centralizada de permisos por menu
- No exponer operaciones cross-tenant sin guardas especiales

## 6. Autenticacion y Sesion
Estado general:
- JWT access token para autenticacion
- Frontend con manejo de sesion y rehidratacion de perfil/menu

Recomendaciones:
- Implementar/estandarizar refresh token seguro (idealmente cookie HttpOnly)
- No depender de headers manuales para roles/tenant en reemplazo de validacion JWT real

## 7. Base de Datos
Motor:
- PostgreSQL (`pg`)

Activos relevantes:
- SQL en `api/database/*`
- Scripts operativos en `scripts/database/*`
- Deploy DB remoto en `scripts/ssh/*`

## 8. Sistema Visual (PRIORIDAD ALTA)
Esta seccion es obligatoria para cualquier implementacion en frontend.

### 8.1 Fuente de Verdad Visual
La fuente de verdad visual del proyecto es:
1. `web/styles/globals.css` (tokens globales Tailwind v4 via `@theme inline`)
2. `web/components/design-system/*` (componentes base reutilizables)

Regla:
- Las nuevas pantallas y componentes deben construirse usando los tokens definidos en `web/styles/globals.css` y componiendo `web/components/design-system`.
- No introducir paletas nuevas hardcodeadas si ya existe token equivalente.

### 8.2 Tokens Globales Actuales (`web/styles/globals.css`)
Tokens disponibles (usar estos nombres en clases Tailwind):
- Colores:
  - `primary` / `primary-foreground`
  - `secondary` / `secondary-foreground`
  - `background` / `foreground`
  - `muted` / `muted-foreground`
  - `accent` / `accent-foreground`
  - `card` / `card-foreground`
  - `border`
  - `ring`
- Radio:
  - `--radius` (base visual del sistema)
- Tipografia:
  - `--font-sans` (Inter + fallback)

Aplicacion esperada:
- Fondos generales: `bg-background`
- Texto principal: `text-foreground`
- Cards/containers: `bg-card text-card-foreground border-border`
- Enfoque/focus: `focus-visible:ring-ring`
- Inputs: `border-border`, `focus:border-primary`, `focus:ring-ring`

### 8.3 Estructura del Design System (`web/components/design-system`)
Componentes base actuales:
- `Button.tsx`
- `Input.tsx`
- `Select.tsx`
- `Textarea.tsx`
- `Modal.tsx`
- `Toast.tsx`
- `SearchFilters.tsx`
- `TenantListItem.tsx`
- `theme.ts` (tema legacy / referencia parcial)

Uso recomendado por capas:
1. `design-system/*`: primitives y componentes visuales reutilizables (sin logica de negocio pesada)
2. `domains/*`: composicion con estado, fetch, validaciones y reglas del caso de uso
3. `app/*`: layout/ruta, wiring de pagina, providers

### 8.4 Patrones Visuales que SI deben replicarse
Patrones correctos ya presentes:
- Botones con variantes (`primary`, `secondary`, `outline`, `ghost`)
- Estados de focus/hover con `ring` y transiciones suaves
- Inputs con label + hint + estado requerido
- Modales con overlay y card (`bg-card`, `text-card-foreground`)
- Bordes y sombras suaves (`border-border`, `shadow-sm`, `rounded-lg/xl`)

Reglas de composicion:
- Preferir `className` extensible sobre duplicar componentes.
- Mantener naming de variantes (`primary`, `secondary`, `outline`, `ghost`) para consistencia.
- Reutilizar `Input`, `Select`, `Textarea`, `Button` antes de crear controles custom.
- Crear nuevos componentes del design system cuando el patron se repita en 2+ pantallas.

### 8.5 Patrones a Evitar (Muy Importante)
Se detectan inconsistencias actuales en algunos componentes (`Select`, `Textarea`, `Toast`, `TenantListItem`) con colores hardcodeados (`slate-*`, `blue-*`, `emerald-*`, `rose-*`).

Regla para nuevas implementaciones:
- No usar colores hardcodeados (`text-slate-*`, `border-blue-*`, etc.) cuando exista token del sistema.
- Si un estado semantico nuevo es necesario (success/error/warning), definir primero token o convencion reutilizable antes de replicar clases directas por componente.

Nota de compatibilidad:
- Los componentes existentes con hardcode no se consideran referencia visual primaria.
- La referencia primaria es `globals.css` + componentes ya tokenizados (`Button`, `Input`, `Modal`).

### 8.6 `theme.ts` vs `globals.css` (Aclaracion)
`web/components/design-system/theme.ts` contiene una paleta distinta (azules/grises) que no coincide con los tokens actuales de `web/styles/globals.css` (rojo/verde/blancos).

Regla oficial:
- Para nuevas implementaciones, usar `web/styles/globals.css` como fuente de verdad.
- `theme.ts` debe tratarse como legado o utilitario secundario hasta que se alinee con `globals.css`.

### 8.7 Checklist Visual para Nuevas Implementaciones
Antes de cerrar una tarea de frontend, validar:
1. Usa componentes de `web/components/design-system` cuando aplica.
2. Usa tokens de `web/styles/globals.css` en lugar de colores hardcodeados.
3. Mantiene `focus-visible` y estados de accesibilidad.
4. Respeta `rounded-*`, sombras y espaciados coherentes con el sistema actual.
5. No introduce una variante visual nueva sin documentarla/estandarizarla.

## 9. Estandares de Desarrollo
General:
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`)
- Branching: `feature/`, `release/`, `hotfix/`
- PR checklist: lint, pruebas, migraciones, seguridad, impacto visual

Frontend:
- Priorizar reutilizacion del design system
- Mantener consistencia con tokens globales
- Evitar UI ad hoc por pagina si el patron puede ser reusable

Backend:
- Validacion de DTOs
- Guards en endpoints sensibles
- Filtrado por tenant en servicios

## 10. Runbook de Arranque
Backend (`api/`):
- Instalar: `npm install`
- Dev: `npm run start:dev`
- Build: `npm run build`
- Start: `npm run start`

Frontend (`web/`):
- Instalar: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`

Migraciones / seeds:
- Ver `scripts/database/*`
- Ver `docs/database-runbook.md`

## 11. Riesgos y Mejoras Prioritarias
Tecnico/seguridad:
- Validacion JWT/guards inconsistentes (revisar endpoints)
- Refresh token y rotacion pendientes de robustecer
- Validacion global DTOs y headers de seguridad por reforzar

Frontend visual:
- Alinear componentes legacy de `design-system` a tokens (`Select`, `Textarea`, `Toast`, `TenantListItem`)
- Unificar `theme.ts` con `globals.css` o deprecarlos explicitamente
- Documentar nuevas variantes semanticas antes de adoptarlas en masa

## 12. Regla de Oro para Nuevas Features Web
Si una implementacion nueva necesita UI:
1. Revisar primero `web/components/design-system`
2. Reutilizar y extender componentes existentes
3. Aplicar tokens de `web/styles/globals.css`
4. Solo despues crear estilos nuevos, manteniendolos compatibles con el sistema visual actual

