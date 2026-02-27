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
import { InspeccionesService } from "../inspecciones/inspecciones.service";
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
    @Inject(ReportsRepository) private readonly repository: ReportsRepository,
    @Inject(InspeccionesService) private readonly inspeccionesService: InspeccionesService
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
    return this.inspeccionesService.getPdf(id, {
      userId: actor.userId,
      tenantId: actor.tenantId,
      roles: actor.roles,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
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
    const companyName = process.env.REPORTS_COMPANY_NAME || "TRANSPORTES NAUSA LTDA.";
    const companyNit = process.env.REPORTS_COMPANY_NIT || "NIT 900078756-1";
    const companyPhone = process.env.REPORTS_COMPANY_PHONE || "+57 313 531 6370";
    const companyEmail = process.env.REPORTS_COMPANY_EMAIL || "transnausa@hotmail.com";
    const companyAddress =
      process.env.REPORTS_COMPANY_ADDRESS || "Cra 39 #8-59, Malambo, Atlantico";
    const pageWidth = doc.page.width;
    const margin = 40;
    const headerTop = 28;
    const headerHeight = 95;
    const headerLeft = margin;
    const headerWidth = pageWidth - margin * 2;

    doc.save();
    doc.roundedRect(headerLeft, headerTop, headerWidth, headerHeight, 10).fill("#F8FAFC");
    doc
      .lineWidth(1)
      .strokeColor("#D1D5DB")
      .roundedRect(headerLeft, headerTop, headerWidth, headerHeight, 10)
      .stroke();
    doc
      .roundedRect(headerLeft, headerTop, headerWidth, 26, 10)
      .fill("#0F766E");
    doc.restore();

    const logoPath = this.resolveLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, 52, 48, { fit: [62, 62], align: "center", valign: "center" });
      } catch {
        // ignore invalid image
      }
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#FFFFFF")
      .text(companyName, headerLeft + 14, headerTop + 8, { width: headerWidth - 28, align: "left" });
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#111827")
      .text(title, 126, 48, { width: 250 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#374151")
      .text(`${companyNit}`, 126, 70)
      .text(`Tel: ${companyPhone}`, 126, 84);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#374151")
      .text(`Email: ${companyEmail}`, 360, 48, { width: 180, align: "left" })
      .text(`Direccion: ${companyAddress}`, 360, 62, { width: 180, align: "left" })
      .text(`Generado: ${new Date().toLocaleString("es-CO")}`, 360, 84, {
        width: 180,
        align: "left",
      });

    doc.y = headerTop + headerHeight + 18;
    doc.strokeColor("#E5E7EB").moveTo(margin, doc.y - 8).lineTo(pageWidth - margin, doc.y - 8).stroke();
    doc.fillColor("#111827");
  }

  private ensureDocSpace(doc: any, minY = 720) {
    if (doc.y > minY) {
      doc.addPage();
    }
  }

  private drawSectionTitle(doc: any, title: string) {
    this.ensureDocSpace(doc, 700);
    const x = 40;
    const y = doc.y;
    const w = doc.page.width - 80;
    doc.save();
    doc.roundedRect(x, y, w, 20, 6).fill("#E0F2FE");
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#0C4A6E")
      .text(title, x + 10, y + 5, { width: w - 20 });
    doc.fillColor("#111827");
    doc.y = y + 28;
  }

  private drawInfoRow(doc: any, label: string, value: string, shaded = false) {
    this.ensureDocSpace(doc, 730);
    const x = 40;
    const width = doc.page.width - 80;
    const labelWidth = 150;
    const valueWidth = width - labelWidth - 20;
    const rowY = doc.y;
    const valueText = value || "N/A";
    const labelHeight = doc.heightOfString(label, { width: labelWidth, align: "left" });
    const valueHeight = doc.heightOfString(valueText, { width: valueWidth, align: "left" });
    const rowHeight = Math.max(20, labelHeight, valueHeight) + 8;

    if (shaded) {
      doc.save();
      doc.roundedRect(x, rowY - 2, width, rowHeight, 4).fill("#F9FAFB");
      doc.restore();
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#374151")
      .text(label, x + 8, rowY + 3, { width: labelWidth });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#111827")
      .text(valueText, x + labelWidth + 12, rowY + 3, { width: valueWidth });

    doc.y = rowY + rowHeight + 2;
  }

  private drawChecklistTable(doc: any, checklistLines: Array<{ label: string; value: string }>) {
    const x = 40;
    const width = doc.page.width - 80;
    const labelWidth = Math.floor(width * 0.58);
    const valueWidth = width - labelWidth - 2;

    this.ensureDocSpace(doc, 690);
    const headerY = doc.y;
    doc.save();
    doc.roundedRect(x, headerY, width, 22, 6).fill("#0F172A");
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#FFFFFF")
      .text("ITEM", x + 8, headerY + 7, { width: labelWidth - 10 });
    doc.text("VALOR", x + labelWidth + 8, headerY + 7, { width: valueWidth - 10 });
    doc.fillColor("#111827");
    doc.y = headerY + 26;

    if (checklistLines.length === 0) {
      this.drawInfoRow(doc, "Checklist", "Sin items en payload.");
      return;
    }

    checklistLines.slice(0, 200).forEach((line, index) => {
      this.ensureDocSpace(doc, 730);
      const rowY = doc.y;
      const labelText = line.label || "-";
      const valueText = line.value || "-";
      const lh = doc.heightOfString(labelText, { width: labelWidth - 12 });
      const vh = doc.heightOfString(valueText, { width: valueWidth - 12 });
      const rowHeight = Math.max(18, lh, vh) + 8;

      if (index % 2 === 0) {
        doc.save();
        doc.rect(x, rowY - 1, width, rowHeight).fill("#F8FAFC");
        doc.restore();
      }

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#111827")
        .text(labelText, x + 6, rowY + 3, { width: labelWidth - 12 });
      doc.text(valueText, x + labelWidth + 6, rowY + 3, { width: valueWidth - 12 });

      doc
        .strokeColor("#E5E7EB")
        .moveTo(x, rowY + rowHeight)
        .lineTo(x + width, rowY + rowHeight)
        .stroke();
      doc.y = rowY + rowHeight + 2;
    });
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
    this.drawSectionTitle(doc, "Datos generales");
    this.drawInfoRow(doc, "Conductor", row.driver_name ?? "N/A", true);
    this.drawInfoRow(doc, "Vehiculo", row.vehicle_label ?? "N/A");
    this.drawInfoRow(doc, "Fecha de inspeccion", row.inspection_date, true);
    this.drawInfoRow(doc, "Estado final", row.status);
    this.drawInfoRow(doc, "Creado por", row.creator_name ?? row.created_by, true);
    doc.moveDown(0.4);

    this.drawSectionTitle(doc, "Checklist de inspeccion");
    const checklistLines = this.extractChecklistLines(row.payload);
    this.drawChecklistTable(doc, checklistLines);

    const signature = this.getSignatureValue(row.payload);
    if (signature) {
      this.ensureDocSpace(doc, 680);
      doc.moveDown();
      this.drawSectionTitle(doc, "Firma digital");
      this.drawInfoRow(doc, "Firma", signature);
    }

    return this.finalizePdf(doc);
  }

  private async buildConsolidatedPdf(
    inspections: InspectionRow[],
    metadata: { tenantId: string; startDate: string; endDate: string; frequency: Frequency }
  ) {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    this.addDocumentHeader(doc, "Reporte consolidado de inspecciones");

    this.drawSectionTitle(doc, "Resumen del reporte");
    this.drawInfoRow(doc, "Tenant", metadata.tenantId, true);
    this.drawInfoRow(doc, "Frecuencia", metadata.frequency);
    this.drawInfoRow(doc, "Rango", `${metadata.startDate} a ${metadata.endDate}`, true);
    this.drawInfoRow(doc, "Total inspecciones", String(inspections.length));
    doc.moveDown(0.4);

    if (inspections.length === 0) {
      this.drawInfoRow(doc, "Resultado", "No se encontraron inspecciones para el rango indicado.");
      return this.finalizePdf(doc);
    }

    inspections.forEach((row, index) => {
      this.ensureDocSpace(doc, 650);
      this.drawSectionTitle(doc, `${index + 1}. Inspeccion #${row.id} - ${row.inspection_date}`);
      this.drawInfoRow(doc, "Conductor", row.driver_name ?? "N/A", true);
      this.drawInfoRow(doc, "Vehiculo", row.vehicle_label ?? "N/A");
      this.drawInfoRow(doc, "Estado", row.status, true);

      const checklistPreview = this.extractChecklistLines(row.payload).slice(0, 12);
      if (checklistPreview.length > 0) {
        this.drawChecklistTable(doc, checklistPreview);
      }
      doc.moveDown(0.6);
    });

    return this.finalizePdf(doc);
  }
}
