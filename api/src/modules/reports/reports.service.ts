import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as fs from "node:fs";
import * as path from "node:path";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import type { SendBulkInspectionsReportDto } from "./dto/send-bulk-inspections-report.dto";
import type { ListReportInspectionsQueryDto } from "./dto/list-report-inspections-query.dto";
import { ReportsRepository, type InspectionRow } from "./reports.repository";

type ActorContext = {
  userId?: string;
  tenantId?: string;
  roles: string[];
  ip?: string;
  userAgent?: string;
};

type Frequency = "daily" | "weekly" | "monthly";

type DateRange = {
  startDate: string;
  endDate: string;
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(ReportsRepository) private readonly repository: ReportsRepository
  ) {}

  private requireTenant(actor: ActorContext) {
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    return actor.tenantId;
  }

  private requireUser(actor: ActorContext) {
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }
    return actor.userId;
  }

  private isAdmin(actor: ActorContext) {
    return actor.roles.includes("ADMIN") || actor.roles.includes("SUPER_ADMIN");
  }

  private isSuperAdmin(actor: ActorContext) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private toIsoDate(date: Date) {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${date.getUTCDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private addDays(base: Date, delta: number) {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + delta);
    return next;
  }

  private normalizeDateRange(startDate?: string, endDate?: string): DateRange | null {
    if (!startDate && !endDate) {
      return null;
    }
    if (!startDate || !endDate) {
      throw new BadRequestException("startDate y endDate son requeridos juntos");
    }
    if (startDate > endDate) {
      throw new BadRequestException("startDate no puede ser mayor que endDate");
    }
    return { startDate, endDate };
  }

  private resolveScheduledRange(frequency: Frequency): DateRange {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (frequency === "daily") {
      const target = this.addDays(todayUtc, -1);
      const date = this.toIsoDate(target);
      return { startDate: date, endDate: date };
    }

    if (frequency === "weekly") {
      const day = todayUtc.getUTCDay(); // 0 Sun, 1 Mon
      const daysSinceMonday = (day + 6) % 7;
      const currentWeekMonday = this.addDays(todayUtc, -daysSinceMonday);
      const lastWeekMonday = this.addDays(currentWeekMonday, -7);
      const lastWeekSunday = this.addDays(currentWeekMonday, -1);
      return {
        startDate: this.toIsoDate(lastWeekMonday),
        endDate: this.toIsoDate(lastWeekSunday),
      };
    }

    const firstDayCurrentMonth = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1));
    const lastDayPreviousMonth = this.addDays(firstDayCurrentMonth, -1);
    const firstDayPreviousMonth = new Date(
      Date.UTC(lastDayPreviousMonth.getUTCFullYear(), lastDayPreviousMonth.getUTCMonth(), 1)
    );
    return {
      startDate: this.toIsoDate(firstDayPreviousMonth),
      endDate: this.toIsoDate(lastDayPreviousMonth),
    };
  }

  private buildInspectionScope(actor: ActorContext) {
    const tenantId = this.requireTenant(actor);
    const restrictToCreator = !this.isAdmin(actor);
    const userId = restrictToCreator ? this.requireUser(actor) : actor.userId;
    return { tenantId, userId, restrictToCreator };
  }

  private mapInspection(row: InspectionRow) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      vehicleId: row.vehicle_id,
      driverId: row.driver_id,
      createdBy: row.created_by,
      inspectionDate: row.inspection_date,
      status: row.status,
      payload: row.payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      driverName: row.driver_name,
      vehicleLabel: row.vehicle_label,
      creatorName: row.creator_name,
    };
  }

  async getDashboard(actor: ActorContext) {
    const tenantId = this.requireTenant(actor);
    const userId = this.requireUser(actor);

    if (!this.isAdmin(actor)) {
      const snapshot = await this.repository.getUserDashboardStats(tenantId, userId);
      const total = Number(snapshot.totals.total ?? 0);
      const finalizedCount = Number(snapshot.totals.finalized_count ?? 0);
      const avgScore = snapshot.totals.avg_status_score
        ? Number(snapshot.totals.avg_status_score)
        : 0;
      const statusCounts = Object.fromEntries(
        snapshot.statuses.map((item: { status: string; count: string }) => [
          item.status,
          Number(item.count),
        ])
      );

      return {
        scope: "USER",
        totalInspeccionesPropias: total,
        ultimaInspeccion: snapshot.lastInspection ? this.mapInspection(snapshot.lastInspection) : null,
        estadoPromedio: {
          score: Number(avgScore.toFixed(2)),
          cumplimientoPorcentaje: total > 0 ? Number(((finalizedCount / total) * 100).toFixed(2)) : 0,
        },
        distribucionEstados: statusCounts,
      };
    }

    const [total, byStatus, byDay, topDrivers, weeklyCompliance, monthlyTrend] = await Promise.all([
      this.repository.getTenantDashboardTotals(tenantId),
      this.repository.getTenantInspectionsByStatus(tenantId),
      this.repository.getTenantInspectionsByDay(tenantId, 30),
      this.repository.getTopDrivers(tenantId, 5),
      this.isSuperAdmin(actor) ? this.repository.getWeeklyCompliance(tenantId) : Promise.resolve([]),
      this.isSuperAdmin(actor) ? this.repository.getMonthlyTrend(tenantId) : Promise.resolve([]),
    ]);

    return {
      scope: this.isSuperAdmin(actor) ? "SUPER_ADMIN" : "ADMIN",
      totalInspeccionesTenant: total,
      inspeccionesPorEstado: byStatus.map((row: { status: string; count: string }) => ({
        status: row.status,
        count: Number(row.count),
      })),
      inspeccionesPorDia: byDay.map((row: { day: string; count: string }) => ({
        date: row.day,
        count: Number(row.count),
      })),
      topConductores: topDrivers.map((row: { driver_id: string; driver_name: string; count: string }) => ({
        driverId: row.driver_id,
        driverName: row.driver_name,
        count: Number(row.count),
      })),
      cumplimientoSemanal: weeklyCompliance.map((row: any) => ({
        weekStart: row.week_start,
        total: Number(row.total),
        finalized: Number(row.finalized),
        complianceRate: Number(
          (Number(row.total) > 0 ? (Number(row.finalized) / Number(row.total)) * 100 : 0).toFixed(2)
        ),
      })),
      tendenciaMensual: monthlyTrend.map((row: any) => ({
        month: row.month,
        total: Number(row.total),
        finalized: Number(row.finalized),
      })),
    };
  }

  async listInspections(query: ListReportInspectionsQueryDto, actor: ActorContext) {
    const tenantId = this.requireTenant(actor);
    const scope = this.buildInspectionScope(actor);
    const dateRange = this.normalizeDateRange(query.startDate, query.endDate);

    if (!this.isAdmin(actor) && query.createdBy && query.createdBy !== actor.userId) {
      throw new ForbiddenException("USER solo puede consultar sus propias inspecciones");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const filters = {
      ...scope,
      tenantId,
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
      driverId: query.driverId,
      vehicleId: query.vehicleId,
      createdBy: this.isAdmin(actor) ? query.createdBy : undefined,
      status: query.status,
    };

    const [listResult, driverOptions] = await Promise.all([
      this.repository.listInspections(filters, { page, pageSize }),
      this.repository.listDriverOptions(scope),
    ]);

    return {
      items: listResult.rows.map((row: InspectionRow) => this.mapInspection(row)),
      page: listResult.page,
      pageSize: listResult.pageSize,
      total: listResult.total,
      totalPages: Math.max(1, Math.ceil(listResult.total / listResult.pageSize)),
      filters: {
        driverOptions: driverOptions.map((row: { driver_id: string; driver_name: string }) => ({
          value: row.driver_id,
          label: row.driver_name,
        })),
        statusOptions: ["DRAFT", "FINALIZED", "REPORTED"],
      },
    };
  }

  async getInspectionPdf(id: string, actor: ActorContext) {
    const row = await this.repository.findInspectionById(this.buildInspectionScope(actor), id);
    if (!row) {
      throw new NotFoundException("Inspeccion no encontrada");
    }
    return this.buildSingleInspectionPdf(row);
  }

  async sendBulkInspections(payload: SendBulkInspectionsReportDto, actor: ActorContext) {
    const tenantId = this.requireTenant(actor);
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede enviar correos masivos");
    }

    const scheduledFallbackRange =
      payload.frequency === "daily" && !payload.startDate && !payload.endDate
        ? this.resolveScheduledRange("daily")
        : null;
    const explicitRange = this.normalizeDateRange(payload.startDate, payload.endDate);
    const range = explicitRange ?? scheduledFallbackRange;
    if (!range) {
      throw new BadRequestException("Debe enviar startDate y endDate para esta frecuencia");
    }

    const inspections = await this.repository.listInspectionsForRange(
      tenantId,
      range.startDate,
      range.endDate
    );
    const pdfBuffer = await this.buildConsolidatedPdf(inspections, {
      tenantId,
      startDate: range.startDate,
      endDate: range.endDate,
      frequency: payload.frequency,
    });

    await this.sendEmailWithAttachment({
      tenantId,
      emails: payload.emails,
      frequency: payload.frequency,
      subject:
        payload.subject?.trim() ||
        `Reporte ${payload.frequency} de inspecciones (${range.startDate} a ${range.endDate})`,
      pdfBuffer,
      filename: `reporte-inspecciones-${payload.frequency}-${range.startDate}-${range.endDate}.pdf`,
    });

    await this.repository.insertEmailLog({
      tenantId,
      inspectionId: null,
      frequency: payload.frequency,
      emails: payload.emails,
    });

    return {
      ok: true,
      sentTo: payload.emails.length,
      inspectionCount: inspections.length,
      range,
      frequency: payload.frequency,
    };
  }

  @Cron("0 6 * * *")
  async runDailyScheduledReports() {
    await this.runScheduledFrequency("daily");
  }

  @Cron("0 7 * * 1")
  async runWeeklyScheduledReports() {
    await this.runScheduledFrequency("weekly");
  }

  @Cron("0 7 1 * *")
  async runMonthlyScheduledReports() {
    await this.runScheduledFrequency("monthly");
  }

  private async runScheduledFrequency(frequency: Frequency) {
    const smtpReady = this.hasSmtpConfig();
    if (!smtpReady) {
      this.logger.warn(`SMTP no configurado; se omite cron de reportes ${frequency}`);
      return;
    }

    const tenants = await this.repository.getScheduledTenantReports(frequency);
    if (tenants.length === 0) {
      return;
    }

    const range = this.resolveScheduledRange(frequency);
    for (const tenant of tenants) {
      try {
        const inspections = await this.repository.listInspectionsForRange(
          tenant.tenant_id,
          range.startDate,
          range.endDate
        );
        const pdfBuffer = await this.buildConsolidatedPdf(inspections, {
          tenantId: tenant.tenant_id,
          startDate: range.startDate,
          endDate: range.endDate,
          frequency,
        });

        await this.sendEmailWithAttachment({
          tenantId: tenant.tenant_id,
          emails: tenant.recipient_emails,
          frequency,
          subject: `Reporte ${frequency} de inspecciones (${range.startDate} a ${range.endDate})`,
          pdfBuffer,
          filename: `reporte-inspecciones-${frequency}-${range.startDate}-${range.endDate}.pdf`,
        });

        await this.repository.insertEmailLog({
          tenantId: tenant.tenant_id,
          inspectionId: null,
          frequency,
          emails: tenant.recipient_emails,
        });
      } catch (error) {
        this.logger.error(
          `Error ejecutando cron ${frequency} para tenant ${tenant.tenant_id}`,
          error instanceof Error ? error.stack : String(error)
        );
      }
    }
  }

  private hasSmtpConfig() {
    return Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM
    );
  }

  private createTransporter() {
    if (!this.hasSmtpConfig()) {
      throw new ServiceUnavailableException("SMTP no configurado");
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private async sendEmailWithAttachment(options: {
    tenantId: string;
    emails: string[];
    frequency: Frequency;
    subject: string;
    pdfBuffer: Buffer;
    filename: string;
  }) {
    const transporter = this.createTransporter();
    const tenant = await this.repository.getTenantName(options.tenantId);
    const tenantName = tenant?.nombre || tenant?.slug || `Tenant ${options.tenantId}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: options.emails.join(", "),
      subject: options.subject,
      text: `Adjunto encontraras el reporte ${options.frequency} de inspecciones para ${tenantName}.`,
      attachments: [
        {
          filename: options.filename,
          content: options.pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  }

  private resolveLogoPath() {
    const configured = process.env.REPORTS_COMPANY_LOGO_PATH;
    if (!configured) {
      return null;
    }
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
    return fs.existsSync(resolved) ? resolved : null;
  }

  private getSignatureValue(payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    const record = payload as Record<string, unknown>;
    const direct = record.signature ?? record.firma;
    if (typeof direct === "string" && direct.trim()) {
      return direct.trim();
    }
    if (direct && typeof direct === "object") {
      const maybeUrl = (direct as Record<string, unknown>).url ?? (direct as Record<string, unknown>).dataUrl;
      if (typeof maybeUrl === "string" && maybeUrl.trim()) {
        return maybeUrl.trim();
      }
    }
    return null;
  }

  private extractChecklistLines(payload: unknown, prefix = ""): Array<{ label: string; value: string }> {
    const lines: Array<{ label: string; value: string }> = [];
    if (!payload || typeof payload !== "object") {
      return lines;
    }

    if (Array.isArray(payload)) {
      payload.forEach((item, index) => {
        lines.push(...this.extractChecklistLines(item, `${prefix}${prefix ? " " : ""}#${index + 1}`));
      });
      return lines;
    }

    const record = payload as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      const label = prefix ? `${prefix} / ${key}` : key;

      if (value == null) {
        continue;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        lines.push({ label, value: String(value) });
        continue;
      }
      if (Array.isArray(value)) {
        if (value.every((entry) => typeof entry !== "object")) {
          lines.push({ label, value: value.map(String).join(", ") });
        } else {
          lines.push(...this.extractChecklistLines(value, label));
        }
        continue;
      }
      if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const isChecklistItem = "label" in obj && ("value" in obj || "status" in obj || "answer" in obj);
        if (isChecklistItem) {
          const itemLabel = String(obj.label ?? label);
          const itemValue = String(obj.value ?? obj.status ?? obj.answer ?? "");
          lines.push({ label: itemLabel, value: itemValue });
        } else {
          lines.push(...this.extractChecklistLines(obj, label));
        }
      }
    }

    return lines;
  }

  private addDocumentHeader(doc: any, title: string) {
    const logoPath = this.resolveLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, 40, 36, { fit: [72, 72] });
      } catch {
        // ignore invalid image
      }
    }
    doc.fontSize(18).text(title, 120, 40);
    doc.fontSize(10).fillColor("black").text(`Generado: ${new Date().toISOString()}`, 120, 64);
    doc.moveDown(2);
  }

  private ensureDocSpace(doc: any, minY = 720) {
    if (doc.y > minY) {
      doc.addPage();
    }
  }

  private async finalizePdf(doc: any) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer | Uint8Array) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      );
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });
  }

  private async buildSingleInspectionPdf(row: InspectionRow) {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    this.addDocumentHeader(doc, `Inspeccion #${row.id}`);

    doc.fontSize(12).text(`Conductor: ${row.driver_name ?? "N/A"}`);
    doc.text(`Vehiculo: ${row.vehicle_label ?? "N/A"}`);
    doc.text(`Fecha: ${row.inspection_date}`);
    doc.text(`Estado final: ${row.status}`);
    doc.text(`Creado por: ${row.creator_name ?? row.created_by}`);
    doc.moveDown();

    doc.fontSize(13).text("Checklist", { underline: true });
    doc.moveDown(0.5);
    const checklistLines = this.extractChecklistLines(row.payload);
    if (checklistLines.length === 0) {
      doc.fontSize(10).text("Sin items en payload.");
    } else {
      checklistLines.slice(0, 200).forEach((line) => {
        this.ensureDocSpace(doc);
        doc.fontSize(10).text(`- ${line.label}: ${line.value}`);
      });
    }

    const signature = this.getSignatureValue(row.payload);
    if (signature) {
      this.ensureDocSpace(doc, 680);
      doc.moveDown();
      doc.fontSize(12).text("Firma digital", { underline: true });
      doc.fontSize(10).text(signature);
    }

    return this.finalizePdf(doc);
  }

  private async buildConsolidatedPdf(
    inspections: InspectionRow[],
    metadata: { tenantId: string; startDate: string; endDate: string; frequency: Frequency }
  ) {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    this.addDocumentHeader(doc, "Reporte consolidado de inspecciones");

    doc.fontSize(11).text(`Tenant: ${metadata.tenantId}`);
    doc.text(`Frecuencia: ${metadata.frequency}`);
    doc.text(`Rango: ${metadata.startDate} a ${metadata.endDate}`);
    doc.text(`Total inspecciones: ${inspections.length}`);
    doc.moveDown();

    if (inspections.length === 0) {
      doc.fontSize(11).text("No se encontraron inspecciones para el rango indicado.");
      return this.finalizePdf(doc);
    }

    inspections.forEach((row, index) => {
      this.ensureDocSpace(doc, 650);
      doc
        .fontSize(12)
        .text(`${index + 1}. Inspeccion #${row.id} - ${row.inspection_date}`, {
          underline: true,
        });
      doc.fontSize(10).text(`Conductor: ${row.driver_name ?? "N/A"}`);
      doc.text(`Vehiculo: ${row.vehicle_label ?? "N/A"}`);
      doc.text(`Estado: ${row.status}`);

      const checklistPreview = this.extractChecklistLines(row.payload).slice(0, 12);
      if (checklistPreview.length > 0) {
        doc.moveDown(0.3);
        checklistPreview.forEach((line) => {
          this.ensureDocSpace(doc);
          doc.text(`- ${line.label}: ${line.value}`);
        });
      }
      doc.moveDown();
    });

    return this.finalizePdf(doc);
  }
}
