import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import type {
  InspeccionDiariaResponseDto,
  InspeccionItemDto,
  InspeccionRespuestaDto,
  UpsertInspeccionDiariaDto,
} from "./dto/inspeccion-diaria.dto";

type Actor = {
  userId?: string;
  tenantId?: string;
  roles: string[];
  ip?: string | null;
  userAgent?: string | null;
};

type DiariaRecord = {
  id: string;
  tenant_id: string;
  placa: string;
  conductor: string;
  cedula: string | null;
  fecha: string;
  numero_manifiesto: string | null;
  destino: string | null;
  estado: "DRAFT" | "FINALIZED" | "REPORTED";
  punto_critico: boolean;
  hallazgos: string | null;
  acciones_correctivas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRecord = {
  id: string;
  seccion: string;
  codigo: string;
  descripcion: string;
  orden: number;
  activo: boolean;
};

@Injectable()
export class InspeccionesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private resolveTenant(actor: Actor) {
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    return actor.tenantId;
  }

  private ensureUuid(value: string, fieldName: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException(`${fieldName} inválido`);
    }
  }

  private mapInspeccion(
    diaria: DiariaRecord,
    respuestas: InspeccionRespuestaDto[]
  ): InspeccionDiariaResponseDto {
    return {
      id: diaria.id,
      tenantId: diaria.tenant_id,
      placa: diaria.placa,
      conductor: diaria.conductor,
      cedula: diaria.cedula,
      fecha: diaria.fecha,
      numeroManifiesto: diaria.numero_manifiesto,
      destino: diaria.destino,
      estado: diaria.estado,
      puntoCritico: diaria.punto_critico,
      hallazgos: diaria.hallazgos,
      accionesCorrectivas: diaria.acciones_correctivas,
      createdBy: diaria.created_by,
      createdAt: diaria.created_at,
      updatedAt: diaria.updated_at,
      respuestas,
    };
  }

  async list(actor: Actor) {
    const tenantId = this.resolveTenant(actor);
    const result = await this.db.query(
      `
      SELECT id, tenant_id, placa, conductor, cedula, fecha::text, numero_manifiesto,
             destino, estado, punto_critico, hallazgos, acciones_correctivas,
             created_by, created_at::text, updated_at::text
      FROM inspecciones.diarias
      WHERE tenant_id = $1
      ORDER BY fecha DESC, created_at DESC
      LIMIT 200
      `,
      [tenantId]
    );
    return result.rows;
  }

  async items() {
    const result = await this.db.query(
      `
      SELECT id, seccion, codigo, descripcion, orden, activo
      FROM inspecciones.items
      WHERE activo = TRUE
      ORDER BY seccion, orden
      `
    );
    return result.rows.map((row: ItemRecord): InspeccionItemDto => ({ ...row }));
  }

  private async getByIdForTenant(id: string, tenantId: string) {
    const diaria = await this.db.query(
      `
      SELECT id, tenant_id, placa, conductor, cedula, fecha::text, numero_manifiesto,
             destino, estado, punto_critico, hallazgos, acciones_correctivas,
             created_by, created_at::text, updated_at::text
      FROM inspecciones.diarias
      WHERE id = $1 AND tenant_id = $2
      `,
      [id, tenantId]
    );
    if (!diaria.rows[0]) {
      throw new NotFoundException("Inspección no encontrada");
    }

    const respuestas = await this.db.query(
      `
      SELECT item_id AS "itemId", respuesta, observacion
      FROM inspecciones.diarias_respuestas
      WHERE diarias_id = $1
      ORDER BY created_at
      `,
      [id]
    );

    return this.mapInspeccion(diaria.rows[0], respuestas.rows);
  }

  async getById(id: string, actor: Actor) {
    this.ensureUuid(id, "id");
    return this.getByIdForTenant(id, this.resolveTenant(actor));
  }

  private validatePayload(payload: UpsertInspeccionDiariaDto) {
    if (!payload.placa?.trim()) {
      throw new BadRequestException("Placa requerida");
    }
    if (!payload.conductor?.trim()) {
      throw new BadRequestException("Conductor requerido");
    }
    if (!payload.fecha) {
      throw new BadRequestException("Fecha requerida");
    }
    if (!Array.isArray(payload.respuestas)) {
      throw new BadRequestException("Respuestas requeridas");
    }
    payload.respuestas.forEach((respuesta) => {
      this.ensureUuid(respuesta.itemId, "itemId");
      if (!["SI", "NO", "NA"].includes(respuesta.respuesta)) {
        throw new BadRequestException("Respuesta inválida");
      }
      if (respuesta.respuesta === "NO" && !respuesta.observacion?.trim()) {
        throw new BadRequestException("Las respuestas NO requieren observación");
      }
    });
  }

  private async writeRespuestas(client: any, diariaId: string, payload: UpsertInspeccionDiariaDto) {
    await client.query(`DELETE FROM inspecciones.diarias_respuestas WHERE diarias_id = $1`, [diariaId]);
    for (const respuesta of payload.respuestas) {
      await client.query(
        `
        INSERT INTO inspecciones.diarias_respuestas (diarias_id, item_id, respuesta, observacion)
        VALUES ($1, $2, $3, $4)
        `,
        [
          diariaId,
          respuesta.itemId,
          respuesta.respuesta,
          respuesta.observacion?.trim() || null,
        ]
      );
    }
  }

  private async audit(action: string, entityId: string, actor: Actor, before?: unknown, after?: unknown) {
    const tenantId = this.resolveTenant(actor);
    await this.db.query(
      `
      INSERT INTO security_audit_logs (
        actor_user_id, tenant_id, action, entity, entity_id, before, after, ip, user_agent, created_at
      ) VALUES ($1,$2,$3,'inspecciones.diarias',$4,$5::jsonb,$6::jsonb,$7,$8,NOW())
      `,
      [
        actor.userId ?? null,
        tenantId,
        action,
        entityId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        actor.ip ?? null,
        actor.userAgent ?? null,
      ]
    );
  }

  async create(payload: UpsertInspeccionDiariaDto, actor: Actor) {
    this.validatePayload(payload);
    const tenantId = this.resolveTenant(actor);
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const insert = await client.query(
        `
        INSERT INTO inspecciones.diarias (
          tenant_id, placa, conductor, cedula, fecha, numero_manifiesto,
          destino, estado, punto_critico, hallazgos, acciones_correctivas, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9,$10,$11)
        RETURNING id
        `,
        [
          tenantId,
          payload.placa.trim(),
          payload.conductor.trim(),
          payload.cedula?.trim() || null,
          payload.fecha,
          payload.numeroManifiesto?.trim() || null,
          payload.destino?.trim() || null,
          payload.puntoCritico ?? false,
          payload.hallazgos?.trim() || null,
          payload.accionesCorrectivas?.trim() || null,
          actor.userId ?? null,
        ]
      );
      await this.writeRespuestas(client, insert.rows[0].id, payload);
      await client.query("COMMIT");
      const created = await this.getByIdForTenant(insert.rows[0].id, tenantId);
      await this.audit("INSPECCION_DIARIA_CREATE", created.id, actor, null, created);
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, payload: UpsertInspeccionDiariaDto, actor: Actor) {
    this.ensureUuid(id, "id");
    this.validatePayload(payload);
    const tenantId = this.resolveTenant(actor);
    const current = await this.getByIdForTenant(id, tenantId);
    if (current.estado !== "DRAFT") {
      throw new BadRequestException("No se puede editar una inspección finalizada o reportada");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        UPDATE inspecciones.diarias
        SET placa = $1, conductor = $2, cedula = $3, fecha = $4, numero_manifiesto = $5,
            destino = $6, punto_critico = $7, hallazgos = $8, acciones_correctivas = $9,
            updated_at = NOW()
        WHERE id = $10 AND tenant_id = $11
        `,
        [
          payload.placa.trim(),
          payload.conductor.trim(),
          payload.cedula?.trim() || null,
          payload.fecha,
          payload.numeroManifiesto?.trim() || null,
          payload.destino?.trim() || null,
          payload.puntoCritico ?? false,
          payload.hallazgos?.trim() || null,
          payload.accionesCorrectivas?.trim() || null,
          id,
          tenantId,
        ]
      );
      await this.writeRespuestas(client, id, payload);
      await client.query("COMMIT");
      const updated = await this.getByIdForTenant(id, tenantId);
      await this.audit("INSPECCION_DIARIA_UPDATE", id, actor, current, updated);
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async assertFinalizationRules(diariaId: string) {
    const itemCount = await this.db.query(
      `SELECT count(*)::text AS total FROM inspecciones.items WHERE activo = TRUE`
    );
    const answerCount = await this.db.query(
      `SELECT count(*)::text AS total FROM inspecciones.diarias_respuestas WHERE diarias_id = $1`,
      [diariaId]
    );
    if (Number(answerCount.rows[0]?.total ?? 0) < Number(itemCount.rows[0]?.total ?? 0)) {
      throw new BadRequestException("No se puede finalizar: faltan respuestas");
    }

    const noWithoutObservation = await this.db.query(
      `
      SELECT count(*)::text AS total
      FROM inspecciones.diarias_respuestas
      WHERE diarias_id = $1 AND respuesta = 'NO' AND (observacion IS NULL OR btrim(observacion) = '')
      `,
      [diariaId]
    );
    if (Number(noWithoutObservation.rows[0]?.total ?? 0) > 0) {
      throw new BadRequestException("No se puede finalizar: hay respuestas NO sin observación");
    }
  }

  private escapePdfText(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  private buildPdf(diaria: InspeccionDiariaResponseDto, items: InspeccionItemDto[]) {
    const grouped = new Map<string, InspeccionItemDto[]>();
    items.forEach((item) => {
      grouped.set(item.seccion, [...(grouped.get(item.seccion) ?? []), item]);
    });
    const answerMap = new Map(diaria.respuestas.map((r) => [r.itemId, r]));

    const lines: string[] = [
      `INSPECCIÓN DIARIA DE VEHÍCULOS`,
      `Fecha: ${diaria.fecha}`,
      `Placa: ${diaria.placa} | Conductor: ${diaria.conductor}`,
      `Manifiesto: ${diaria.numeroManifiesto ?? "-"} | Destino: ${diaria.destino ?? "-"}`,
      `Estado: ${diaria.estado}`,
      "",
    ];

    for (const [seccion, sectionItems] of grouped.entries()) {
      lines.push(`== ${seccion} ==`);
      sectionItems.forEach((item) => {
        const answer = answerMap.get(item.id);
        const res = answer?.respuesta ?? "-";
        const obs = answer?.observacion ? ` | Obs: ${answer.observacion}` : "";
        lines.push(`- ${item.descripcion}: ${res}${obs}`);
      });
      lines.push("");
    }

    lines.push(`Punto crítico: ${diaria.puntoCritico ? "SI" : "NO"}`);
    lines.push(`Hallazgos: ${diaria.hallazgos ?? "-"}`);
    lines.push(`Acciones correctivas: ${diaria.accionesCorrectivas ?? "-"}`);

    const escapedLines = lines.map((line) => `(${this.escapePdfText(line)}) Tj`).join(" T* ");
    const stream = `BT /F1 10 Tf 40 790 Td 12 TL ${escapedLines} ET`;
    const streamLength = Buffer.byteLength(stream, "utf8");

    const pdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000120 00000 n \n0000000246 00000 n \n0000000000 00000 n \ntrailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${246 + streamLength}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  async finalize(id: string, actor: Actor) {
    this.ensureUuid(id, "id");
    const tenantId = this.resolveTenant(actor);
    const current = await this.getByIdForTenant(id, tenantId);
    if (current.estado !== "DRAFT") {
      throw new BadRequestException("Solo se puede finalizar en estado DRAFT");
    }
    await this.assertFinalizationRules(id);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE inspecciones.diarias SET estado = 'FINALIZED', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      const finalized = await this.getByIdForTenant(id, tenantId);
      const items = await this.items();
      const pdf = this.buildPdf(finalized, items);
      await client.query(
        `
        INSERT INTO inspecciones.archivos_pdf (diarias_id, archivo, generado_por)
        VALUES ($1, $2, $3)
        `,
        [id, pdf, actor.userId ?? null]
      );
      await client.query("COMMIT");
      await this.audit("INSPECCION_DIARIA_FINALIZE", id, actor, current, finalized);
      return finalized;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPdf(id: string, actor: Actor) {
    this.ensureUuid(id, "id");
    const tenantId = this.resolveTenant(actor);
    const diaria = await this.getByIdForTenant(id, tenantId);
    if (diaria.estado !== "FINALIZED") {
      throw new BadRequestException("PDF disponible únicamente para inspecciones finalizadas");
    }
    const pdf = await this.db.query(
      `
      SELECT ap.archivo
      FROM inspecciones.archivos_pdf ap
      INNER JOIN inspecciones.diarias d ON d.id = ap.diarias_id
      WHERE ap.diarias_id = $1 AND d.tenant_id = $2
      ORDER BY ap.generado_at DESC
      LIMIT 1
      `,
      [id, tenantId]
    );
    if (!pdf.rows[0]) {
      throw new NotFoundException("PDF no encontrado");
    }
    await this.audit("INSPECCION_DIARIA_PDF_DOWNLOAD", id, actor, null, { downloadedAt: new Date() });
    return pdf.rows[0].archivo;
  }
}
