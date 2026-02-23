import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";

type InspectionFilters = {
  tenantId: string;
  userId?: string;
  restrictToCreator: boolean;
  startDate?: string;
  endDate?: string;
  driverId?: string;
  vehicleId?: string;
  createdBy?: string;
  status?: string;
};

type Pagination = {
  page: number;
  pageSize: number;
};

type Frequency = "daily" | "weekly" | "monthly";

export type InspectionRow = {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  driver_id: string;
  created_by: string;
  inspection_date: string;
  status: string;
  payload: unknown;
  created_at: string;
  updated_at: string | null;
  driver_name: string | null;
  vehicle_label: string | null;
  creator_name: string | null;
};

type DriverOptionRow = {
  driver_id: string;
  driver_name: string;
};

type TenantScheduledReportRow = {
  tenant_id: string;
  recipient_emails: string[];
};

@Injectable()
export class ReportsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  // `inspecciones.diarias` no tiene driver_id; generamos un id estable basado en conductor+cedula.
  private driverKeyExpr(alias = "i") {
    return `md5(lower(coalesce(${alias}.conductor, '')) || '|' || coalesce(${alias}.cedula, ''))`;
  }

  private creatorNameExpr() {
    return `
      COALESCE(
        NULLIF(btrim(concat_ws(' ', p.nombres, p.apellidos)), ''),
        NULLIF(u.email, ''),
        CASE WHEN i.created_by IS NOT NULL THEN CONCAT('Usuario #', i.created_by::text) ELSE NULL END
      )
    `;
  }

  private buildFilters(filters: InspectionFilters) {
    const clauses: string[] = ["i.tenant_id::text = $1"];
    const params: unknown[] = [filters.tenantId];

    if (filters.restrictToCreator && filters.userId) {
      params.push(filters.userId);
      clauses.push(`i.created_by::text = $${params.length}`);
    } else if (filters.createdBy) {
      params.push(filters.createdBy);
      clauses.push(`i.created_by::text = $${params.length}`);
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      clauses.push(`i.fecha::date >= $${params.length}::date`);
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      clauses.push(`i.fecha::date <= $${params.length}::date`);
    }
    if (filters.driverId) {
      params.push(filters.driverId);
      clauses.push(`${this.driverKeyExpr("i")} = $${params.length}`);
    }
    if (filters.vehicleId) {
      params.push(filters.vehicleId);
      clauses.push(
        `(i.id::text = $${params.length} OR i.placa ILIKE '%' || $${params.length} || '%')`
      );
    }
    if (filters.status) {
      params.push(filters.status);
      clauses.push(`i.estado = $${params.length}`);
    }

    return { whereSql: clauses.join(" AND "), params };
  }

  private baseInspectionSelect() {
    return `
      SELECT
        i.id::text AS id,
        i.tenant_id::text AS tenant_id,
        COALESCE(NULLIF(btrim(i.placa), ''), i.id::text) AS vehicle_id,
        ${this.driverKeyExpr("i")} AS driver_id,
        COALESCE(i.created_by::text, '') AS created_by,
        i.fecha::date::text AS inspection_date,
        i.estado AS status,
        jsonb_strip_nulls(
          jsonb_build_object(
            'placa', i.placa,
            'conductor', i.conductor,
            'cedula', i.cedula,
            'fecha', i.fecha::date::text,
            'numeroManifiesto', i.numero_manifiesto,
            'destino', i.destino,
            'puntoCritico', i.punto_critico,
            'hallazgos', i.hallazgos,
            'accionesCorrectivas', i.acciones_correctivas,
            'respuestas', COALESCE(resp.respuestas, '[]'::jsonb)
          )
        ) AS payload,
        i.created_at::text AS created_at,
        i.updated_at::text AS updated_at,
        NULLIF(btrim(i.conductor), '') AS driver_name,
        NULLIF(btrim(i.placa), '') AS vehicle_label,
        ${this.creatorNameExpr()} AS creator_name
      FROM inspecciones.diarias i
      LEFT JOIN public.users u
        ON u.id = i.created_by
       AND u.tenant_id = i.tenant_id
      LEFT JOIN public.personas p
        ON p.id = u.persona_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'seccion', it.seccion,
              'codigo', it.codigo,
              'label', it.descripcion,
              'answer', r.respuesta,
              'observacion', r.observacion
            )
          )
          ORDER BY it.seccion, it.orden, it.codigo
        ) AS respuestas
        FROM inspecciones.diarias_respuestas r
        INNER JOIN inspecciones.items it ON it.id = r.item_id
        WHERE r.diarias_id = i.id
      ) resp ON TRUE
    `;
  }

  async listInspections(filters: InspectionFilters, pagination: Pagination) {
    const { whereSql, params } = this.buildFilters(filters);
    const page = Math.max(1, pagination.page);
    const pageSize = Math.max(1, Math.min(100, pagination.pageSize));
    const offset = (page - 1) * pageSize;

    const total = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM inspecciones.diarias i WHERE ${whereSql}`,
      params as any[]
    );

    const rows = await this.db.query<InspectionRow>(
      `
      ${this.baseInspectionSelect()}
      WHERE ${whereSql}
      ORDER BY i.fecha DESC, i.created_at DESC, i.id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, pageSize, offset] as any[]
    );

    return {
      total: Number(total.rows?.[0]?.count ?? 0),
      rows: rows.rows ?? [],
      page,
      pageSize,
    };
  }

  async listDriverOptions(filters: Pick<InspectionFilters, "tenantId" | "restrictToCreator" | "userId">) {
    const scopedFilters: InspectionFilters = {
      ...filters,
      startDate: undefined,
      endDate: undefined,
      driverId: undefined,
      vehicleId: undefined,
      createdBy: undefined,
      status: undefined,
    };
    const { whereSql, params } = this.buildFilters(scopedFilters);
    const result = await this.db.query<DriverOptionRow>(
      `
      SELECT
        ${this.driverKeyExpr("i")} AS driver_id,
        COALESCE(NULLIF(MAX(btrim(i.conductor)), ''), 'Conductor') AS driver_name
      FROM inspecciones.diarias i
      WHERE ${whereSql}
      GROUP BY ${this.driverKeyExpr("i")}
      ORDER BY driver_name ASC
      `,
      params as any[]
    );
    return result.rows ?? [];
  }

  async findInspectionById(
    filters: Pick<InspectionFilters, "tenantId" | "restrictToCreator" | "userId">,
    id: string
  ) {
    const scopedFilters: InspectionFilters = {
      ...filters,
      startDate: undefined,
      endDate: undefined,
      driverId: undefined,
      vehicleId: undefined,
      createdBy: undefined,
      status: undefined,
    };
    const { whereSql, params } = this.buildFilters(scopedFilters);
    const result = await this.db.query<InspectionRow>(
      `
      ${this.baseInspectionSelect()}
      WHERE ${whereSql} AND i.id::text = $${params.length + 1}
      LIMIT 1
      `,
      [...params, id] as any[]
    );
    return result.rows?.[0] ?? null;
  }

  async getUserDashboardStats(tenantId: string, userId: string) {
    const totals = await this.db.query<{
      total: string;
      finalized_count: string;
      avg_status_score: string | null;
    }>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE estado = 'FINALIZED')::text AS finalized_count,
        AVG(CASE estado WHEN 'FINALIZED' THEN 1 WHEN 'REPORTED' THEN 0.5 ELSE 0 END) AS avg_status_score
      FROM inspecciones.diarias
      WHERE tenant_id::text = $1
        AND created_by::text = $2
      `,
      [tenantId, userId]
    );

    const lastInspection = await this.db.query<InspectionRow>(
      `
      ${this.baseInspectionSelect()}
      WHERE i.tenant_id::text = $1 AND i.created_by::text = $2
      ORDER BY i.fecha DESC, i.created_at DESC, i.id DESC
      LIMIT 1
      `,
      [tenantId, userId]
    );

    const statuses = await this.db.query<{ status: string; count: string }>(
      `
      SELECT estado AS status, COUNT(*)::text AS count
      FROM inspecciones.diarias
      WHERE tenant_id::text = $1 AND created_by::text = $2
      GROUP BY estado
      ORDER BY estado ASC
      `,
      [tenantId, userId]
    );

    return {
      totals: totals.rows?.[0] ?? { total: "0", finalized_count: "0", avg_status_score: null },
      lastInspection: lastInspection.rows?.[0] ?? null,
      statuses: statuses.rows ?? [],
    };
  }

  async getTenantDashboardTotals(tenantId: string) {
    const result = await this.db.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM inspecciones.diarias
      WHERE tenant_id::text = $1
      `,
      [tenantId]
    );
    return Number(result.rows?.[0]?.total ?? 0);
  }

  async getTenantInspectionsByStatus(tenantId: string) {
    const result = await this.db.query<{ status: string; count: string }>(
      `
      SELECT estado AS status, COUNT(*)::text AS count
      FROM inspecciones.diarias
      WHERE tenant_id::text = $1
      GROUP BY estado
      ORDER BY estado ASC
      `,
      [tenantId]
    );
    return result.rows ?? [];
  }

  async getTenantInspectionsByDay(tenantId: string, days: number) {
    const result = await this.db.query<{ day: string; count: string }>(
      `
      SELECT i.fecha::date::text AS day, COUNT(*)::text AS count
      FROM inspecciones.diarias i
      WHERE i.tenant_id::text = $1
        AND i.fecha::date >= CURRENT_DATE - ($2::int - 1)
      GROUP BY i.fecha::date
      ORDER BY i.fecha::date ASC
      `,
      [tenantId, days]
    );
    return result.rows ?? [];
  }

  async getTopDrivers(tenantId: string, limit = 5) {
    const result = await this.db.query<{ driver_id: string; driver_name: string; count: string }>(
      `
      SELECT
        ${this.driverKeyExpr("i")} AS driver_id,
        COALESCE(NULLIF(MAX(btrim(i.conductor)), ''), 'Conductor') AS driver_name,
        COUNT(*)::text AS count
      FROM inspecciones.diarias i
      WHERE i.tenant_id::text = $1
      GROUP BY ${this.driverKeyExpr("i")}
      ORDER BY COUNT(*) DESC, driver_name ASC
      LIMIT $2
      `,
      [tenantId, limit]
    );
    return result.rows ?? [];
  }

  async getWeeklyCompliance(tenantId: string) {
    const result = await this.db.query<{ week_start: string; total: string; finalized: string }>(
      `
      SELECT
        date_trunc('week', i.fecha)::date::text AS week_start,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE i.estado = 'FINALIZED')::text AS finalized
      FROM inspecciones.diarias i
      WHERE i.tenant_id::text = $1
        AND i.fecha::date >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      [tenantId]
    );
    return result.rows ?? [];
  }

  async getMonthlyTrend(tenantId: string) {
    const result = await this.db.query<{ month: string; total: string; finalized: string }>(
      `
      SELECT
        to_char(date_trunc('month', i.fecha), 'YYYY-MM') AS month,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE i.estado = 'FINALIZED')::text AS finalized
      FROM inspecciones.diarias i
      WHERE i.tenant_id::text = $1
        AND i.fecha::date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      [tenantId]
    );
    return result.rows ?? [];
  }

  async listInspectionsForRange(tenantId: string, startDate: string, endDate: string) {
    const result = await this.db.query<InspectionRow>(
      `
      ${this.baseInspectionSelect()}
      WHERE i.tenant_id::text = $1
        AND i.fecha::date BETWEEN $2::date AND $3::date
      ORDER BY i.fecha DESC, i.created_at DESC, i.id DESC
      `,
      [tenantId, startDate, endDate]
    );
    return result.rows ?? [];
  }

  async insertEmailLog(payload: {
    tenantId: string;
    inspectionId?: string | null;
    frequency: Frequency;
    emails: string[];
  }) {
    await this.db.query(
      `
      INSERT INTO inspection_email_logs (tenant_id, inspection_id, frequency, emails)
      VALUES ($1, $2, $3, $4::text[])
      `,
      [payload.tenantId, payload.inspectionId ?? null, payload.frequency, payload.emails]
    );
  }

  async getScheduledTenantReports(frequency: Frequency) {
    const column =
      frequency === "daily"
        ? "enabled_daily"
        : frequency === "weekly"
          ? "enabled_weekly"
          : "enabled_monthly";
    const result = await this.db.query<TenantScheduledReportRow>(
      `
      SELECT tenant_id::text, recipient_emails
      FROM tenant_report_settings
      WHERE ${column} = TRUE
        AND cardinality(recipient_emails) > 0
      ORDER BY tenant_id ASC
      `
    );
    return result.rows ?? [];
  }

  async getTenantName(tenantId: string) {
    const result = await this.db.query<{ nombre: string | null; slug: string | null }>(
      `SELECT nombre, slug FROM public.tenants WHERE id::text = $1 LIMIT 1`,
      [tenantId]
    );
    return result.rows?.[0] ?? null;
  }
}
