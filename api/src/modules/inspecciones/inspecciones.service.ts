import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from "@nestjs/common";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import PDFDocument from "pdfkit";
import { DatabaseService } from "../../common/db/database.service";
import type {
  InspeccionDiariaResponseDto,
  InspeccionItemDto,
  InspeccionRespuestaDto,
  UpsertInspeccionDiariaDto,
} from "./dto/inspeccion-diaria.dto";

export type Actor = {
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
export class InspeccionesService implements OnModuleDestroy {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private readonly pdfNavigationTimeoutMs = 15_000;
  private readonly pdfRenderTimeoutMs = 20_000;
  private readonly pdfWaitForReadyTimeoutMs = 8_000;
  private browserPromise: Promise<any> | null = null;

  async onModuleDestroy() {
    if (!this.browserPromise) return;
    try {
      const browser = await this.browserPromise;
      await browser.close();
    } catch {
      // Ignore close errors during shutdown.
    } finally {
      this.browserPromise = null;
    }
  }

  private hasRole(actor: Actor, role: string) {
    return actor.roles.includes(role);
  }

  private isAdminLike(actor: Actor) {
    return this.hasRole(actor, "ADMIN") || this.hasRole(actor, "SUPER_ADMIN");
  }

  private isUserScoped(actor: Actor) {
    return this.hasRole(actor, "USER") && !this.isAdminLike(actor);
  }

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

  private normalizeIdentityValue(value: string | null | undefined) {
    return (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  }

  private async getUserDocumentoNumero(actor: Actor) {
    if (!actor.userId || !actor.tenantId) {
      return null;
    }

    const result = await this.db.query<{ documento_numero: string | null }>(
      `
      SELECT p.documento_numero
      FROM users u
      LEFT JOIN personas p ON p.id = u.persona_id
      WHERE u.id = $1 AND u.tenant_id = $2
      LIMIT 1
      `,
      [actor.userId, actor.tenantId]
    );

    return result.rows[0]?.documento_numero ?? null;
  }

  private async ensureUserCanAccessInspection(
    actor: Actor,
    diaria: Pick<DiariaRecord, "created_by" | "cedula"> | { createdBy?: string | null; cedula?: string | null }
  ) {
    if (!this.isUserScoped(actor)) {
      return;
    }
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }

    const createdBy =
      "created_by" in diaria ? (diaria.created_by ?? null) : (diaria.createdBy ?? null);
    if (createdBy && createdBy === actor.userId) {
      return;
    }

    const userDocumento = this.normalizeIdentityValue(await this.getUserDocumentoNumero(actor));
    const inspectionCedula = this.normalizeIdentityValue(diaria.cedula ?? null);
    if (userDocumento && inspectionCedula && userDocumento === inspectionCedula) {
      return;
    }

    throw new ForbiddenException("Solo puedes consultar tus propias inspecciones");
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
    if (this.isUserScoped(actor) && !actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }
    const params: unknown[] = [tenantId];
    const userScopedFilter =
      this.isUserScoped(actor) && actor.userId
        ? ` AND created_by = $${params.push(actor.userId)}`
        : "";
    const result = await this.db.query(
      `
      SELECT id, tenant_id, placa, conductor, cedula, fecha::text, numero_manifiesto,
             destino, estado, punto_critico, hallazgos, acciones_correctivas,
             created_by, created_at::text, updated_at::text
      FROM inspecciones.diarias
      WHERE tenant_id = $1${userScopedFilter}
      ORDER BY fecha DESC, created_at DESC
      LIMIT 200
      `,
      params as any[]
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
    const diaria = await this.getByIdForTenant(id, this.resolveTenant(actor));
    await this.ensureUserCanAccessInspection(actor, diaria);
    return diaria;
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

  private async assertUserDailyCreateLimit(actor: Actor, tenantId: string, fecha: string) {
    if (this.isAdminLike(actor) || !this.hasRole(actor, "USER")) {
      return;
    }
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido para registrar inspecciones");
    }

    const existing = await this.db.query(
      `
      SELECT id
      FROM inspecciones.diarias
      WHERE tenant_id = $1 AND created_by = $2 AND fecha = $3
      LIMIT 1
      `,
      [tenantId, actor.userId, fecha]
    );

    if (existing.rows[0]) {
      throw new BadRequestException("Ya registraste una inspección para esa fecha");
    }
  }

  async create(payload: UpsertInspeccionDiariaDto, actor: Actor) {
    this.validatePayload(payload);
    const tenantId = this.resolveTenant(actor);
    await this.assertUserDailyCreateLimit(actor, tenantId, payload.fecha);
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
    await this.ensureUserCanAccessInspection(actor, current);
    if (current.estado !== "DRAFT" && !(current.estado === "FINALIZED" && this.isAdminLike(actor))) {
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

  private resolveInspectionPdfLogoPath() {
    const configured = process.env.INSPECCIONES_PDF_LOGO_PATH || process.env.REPORTS_COMPANY_LOGO_PATH;
    if (!configured) return null;
    const resolved = path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
    return fs.existsSync(resolved) ? resolved : null;
  }

  private normalizePdfSectionLabel(seccion: string) {
    return seccion.replace(/_/g, " ").trim();
  }

  private resolvePuppeteerCacheDir() {
    const configured = process.env.PUPPETEER_CACHE_DIR?.trim();
    const cacheDir = configured
      ? path.isAbsolute(configured)
        ? configured
        : path.resolve(process.cwd(), configured)
      : path.resolve(process.cwd(), ".cache", "puppeteer");

    process.env.PUPPETEER_CACHE_DIR = cacheDir;
    return cacheDir;
  }

  private addChromeExecutableFromCache(cacheDir: string, addCandidate: (value: unknown) => void) {
    const chromeRoot = path.join(cacheDir, "chrome");
    if (!fs.existsSync(chromeRoot)) {
      return;
    }

    try {
      const versions = fs
        .readdirSync(chromeRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

      for (const version of versions) {
        addCandidate(path.join(chromeRoot, version, "chrome-linux64", "chrome"));
        addCandidate(path.join(chromeRoot, version, "chrome-win64", "chrome.exe"));
        addCandidate(path.join(chromeRoot, version, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"));
      }
    } catch {
      // Ignore cache read errors and continue with other candidates.
    }
  }

  private isChromeMissingError(error: unknown) {
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");
    return message.includes("Could not find Chrome");
  }

  private async installChromeForPuppeteer(cacheDir: string) {
    const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        npxCommand,
        ["puppeteer", "browsers", "install", "chrome", "--path", cacheDir],
        {
          stdio: "ignore",
          shell: false,
          env: process.env,
        }
      );

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`Chrome install failed with exit code ${code ?? "unknown"}`));
      });
    });
  }

  private async launchPdfBrowser(puppeteer: any) {
    const cacheDir = this.resolvePuppeteerCacheDir();
    const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
    const tryLaunch = async () => {
      const candidatePaths = new Set<string>();
      const addCandidate = (value: unknown) => {
        if (typeof value !== "string") return;
        const trimmed = value.trim();
        if (!trimmed) return;
        if (fs.existsSync(trimmed)) {
          candidatePaths.add(trimmed);
        }
      };

      addCandidate(process.env.PUPPETEER_EXECUTABLE_PATH);
      addCandidate(process.env.CHROME_BIN);
      addCandidate(process.env.CHROME_PATH);
      this.addChromeExecutableFromCache(cacheDir, addCandidate);

      try {
        if (typeof puppeteer?.executablePath === "function") {
          addCandidate(puppeteer.executablePath());
        }
      } catch {
        // Ignore and continue with environment/system candidates.
      }

      addCandidate("/usr/bin/google-chrome");
      addCandidate("/usr/bin/google-chrome-stable");
      addCandidate("/usr/bin/chromium-browser");
      addCandidate("/usr/bin/chromium");

      for (const executablePath of candidatePaths) {
        try {
          return await puppeteer.launch({
            headless: true,
            args,
            executablePath,
          });
        } catch {
          // Try next candidate.
        }
      }

      return puppeteer.launch({
        headless: true,
        args,
      });
    };

    try {
      return await tryLaunch();
    } catch (error) {
      if (!this.isChromeMissingError(error)) {
        throw error;
      }
      await this.installChromeForPuppeteer(cacheDir);
      return await tryLaunch();
    }
  }

  private async getOrCreatePdfBrowser() {
    if (this.browserPromise) {
      return this.browserPromise;
    }

    const importPuppeteer = new Function(
      "return import('puppeteer')"
    ) as () => Promise<any>;

    this.browserPromise = (async () => {
      const puppeteer = await importPuppeteer();
      return this.launchPdfBrowser(puppeteer);
    })();

    try {
      return await this.browserPromise;
    } catch (error) {
      this.browserPromise = null;
      throw error;
    }
  }

  private async configurePdfPage(page: any) {
    page.setDefaultNavigationTimeout(this.pdfNavigationTimeoutMs);
    page.setDefaultTimeout(this.pdfRenderTimeoutMs);
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request: any) => {
      const url = String(request.url() ?? "");
      const resourceType = String(request.resourceType() ?? "");
      const isDataUri = url.startsWith("data:");
      const isAboutBlank = url === "about:blank";
      const isExternalUrl = /^(https?|wss?|ftp):\/\//i.test(url);
      const isBlockableType =
        resourceType === "image" ||
        resourceType === "media" ||
        resourceType === "font" ||
        resourceType === "stylesheet";

      if (isExternalUrl || (isBlockableType && !isDataUri && !isAboutBlank)) {
        request.abort("blockedbyclient").catch(() => undefined);
        return;
      }

      request.continue().catch(() => undefined);
    });
  }

  private sortItemsForPdf(items: InspeccionItemDto[]) {
    const sectionOrder = new Map<string, number>([
      ["CABINA", 1],
      ["DOCUMENTOS", 2],
      ["ESTADO_MECANICO", 3],
      ["LLANTAS", 4],
      ["LUCES", 5],
      ["SEGURIDAD_SOCIAL", 6],
    ]);

    return [...items].sort((a, b) => {
      const sa = sectionOrder.get(a.seccion) ?? 999;
      const sb = sectionOrder.get(b.seccion) ?? 999;
      if (sa != sb) return sa - sb;
      if (a.seccion != b.seccion) return a.seccion.localeCompare(b.seccion);
      return a.orden - b.orden;
    });
  }

  private drawInspectionPdfWatermark(doc: any, estado: string) {
    const status = (estado || "").toUpperCase();
    const showDraft = status === "DRAFT";
    const showRejected = status === "RECHAZADO" || status === "REJECTED";
    if (!showDraft && !showRejected) return;

    const label = showRejected ? "RECHAZADO" : "BORRADOR";
    const color = showRejected ? "#DC2626" : "#94A3B8";

    doc.save();
    doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc
      .font("Helvetica-Bold")
      .fontSize(52)
      .fillColor(color)
      .opacity(0.12)
      .text(label, 70, doc.page.height / 2 - 40, {
        align: "center",
        width: doc.page.width - 140,
      });
    doc.opacity(1);
    doc.restore();
  }

  private hasInspectionPdfSpace(doc: any, minBottomMargin = 88) {
    return doc.y <= doc.page.height - minBottomMargin;
  }

  private addInspectionPdfPage(doc: any, diaria: InspeccionDiariaResponseDto) {
    doc.addPage();
    this.drawInspectionPdfWatermark(doc, diaria.estado);
    doc.y = 40;
  }

  private drawInspectionPdfHeader(doc: any, diaria: InspeccionDiariaResponseDto, generatedAt: Date) {
    const margin = 36;
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - margin * 2;
    const headerTop = 30;
    const headerHeight = 112;
    const companyName = process.env.INSPECCIONES_PDF_COMPANY_NAME || "TRANSPORTES NAUSA LTDA.";
    const companyNit = process.env.INSPECCIONES_PDF_COMPANY_NIT || "NIT 900078756-1";
    const companyPhone = process.env.INSPECCIONES_PDF_COMPANY_PHONE || "+57 313 531 6370";
    const companyEmail = process.env.INSPECCIONES_PDF_COMPANY_EMAIL || "transnausa@hotmail.com";
    const companyAddress =
      process.env.INSPECCIONES_PDF_COMPANY_ADDRESS || "Cra 39 #8-59, Malambo, Atlantico";

    doc.save();
    doc.roundedRect(margin, headerTop, contentWidth, headerHeight, 10).fill("#F8FAFC");
    doc
      .lineWidth(1)
      .strokeColor("#CBD5E1")
      .roundedRect(margin, headerTop, contentWidth, headerHeight, 10)
      .stroke();
    doc.roundedRect(margin, headerTop, contentWidth, 28, 10).fill("#0F172A");
    doc.restore();

    const logoBox = { x: margin + 12, y: headerTop + 38, w: 64, h: 64 };
    doc.save();
    doc.roundedRect(logoBox.x, logoBox.y, logoBox.w, logoBox.h, 8).fill("#FFFFFF");
    doc
      .lineWidth(1)
      .strokeColor("#E2E8F0")
      .roundedRect(logoBox.x, logoBox.y, logoBox.w, logoBox.h, 8)
      .stroke();
    doc.restore();

    const logoPath = this.resolveInspectionPdfLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, logoBox.x + 4, logoBox.y + 4, { fit: [logoBox.w - 8, logoBox.h - 8] });
      } catch {
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748B").text("LOGO", logoBox.x + 18, logoBox.y + 28);
      }
    } else {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748B").text("LOGO", logoBox.x + 18, logoBox.y + 28);
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#FFFFFF")
      .text(companyName, margin + 12, headerTop + 8, { width: contentWidth - 24 });

    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor("#0F172A")
      .text("INSPECCION DIARIA DE VEHICULO", margin + 88, headerTop + 40, { width: 270 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#334155")
      .text(companyNit, margin + 88, headerTop + 61)
      .text(`Tel: ${companyPhone}`, margin + 88, headerTop + 75)
      .text(`Email: ${companyEmail}`, margin + 88, headerTop + 89);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#334155")
      .text(`Dir: ${companyAddress}`, margin + 300, headerTop + 61, { width: 170 });

    const statusLabel = (diaria.estado || "SIN_ESTADO").toUpperCase();
    let statusBg = "#64748B";
    if (statusLabel === "FINALIZED" || statusLabel === "APROBADO" || statusLabel === "APPROVED") {
      statusBg = "#15803D";
    } else if (statusLabel === "REPORTED") {
      statusBg = "#1D4ED8";
    } else if (statusLabel === "RECHAZADO" || statusLabel === "REJECTED") {
      statusBg = "#B91C1C";
    }

    const statusX = pageWidth - margin - 132;
    const statusY = headerTop + 40;
    doc.save();
    doc.roundedRect(statusX, statusY, 120, 24, 12).fill(statusBg);
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#FFFFFF")
      .text(statusLabel, statusX, statusY + 7, { width: 120, align: "center" });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#334155")
      .text(`Generado: ${generatedAt.toLocaleString("es-CO")}`, pageWidth - margin - 192, headerTop + 75, {
        width: 180,
        align: "right",
      })
      .text(`ID: ${diaria.id}`, pageWidth - margin - 212, headerTop + 89, {
        width: 200,
        align: "right",
      });

    doc.y = headerTop + headerHeight + 14;
  }

  private drawInspectionPdfFieldGrid(doc: any, diaria: InspeccionDiariaResponseDto) {
    const x = 36;
    const width = doc.page.width - 72;
    const gap = 8;
    const colWidth = (width - gap) / 2;
    const rowHeight = 28;
    const fields = [
      { label: "Fecha", value: diaria.fecha || "-" },
      { label: "Placa", value: diaria.placa || "-" },
      { label: "Conductor", value: diaria.conductor || "-" },
      { label: "Cedula", value: diaria.cedula || "-" },
      { label: "Manifiesto", value: diaria.numeroManifiesto || "-" },
      { label: "Destino", value: diaria.destino || "-" },
      { label: "Punto Critico", value: diaria.puntoCritico ? "SI" : "NO" },
      { label: "Estado", value: diaria.estado || "-" },
    ];

    for (let i = 0; i < fields.length; i += 2) {
      if (!this.hasInspectionPdfSpace(doc, 115)) {
        this.addInspectionPdfPage(doc, diaria);
      }
      const rowY = doc.y;
      const rowFields = fields.slice(i, i + 2);
      rowFields.forEach((field, idx) => {
        const cellX = x + idx * (colWidth + gap);
        const isCritical = field.label === "Punto Critico" && field.value === "SI";
        doc.save();
        doc.roundedRect(cellX, rowY, colWidth, rowHeight, 6).fill(isCritical ? "#FEE2E2" : "#FFFFFF");
        doc
          .lineWidth(1)
          .strokeColor(isCritical ? "#FCA5A5" : "#E2E8F0")
          .roundedRect(cellX, rowY, colWidth, rowHeight, 6)
          .stroke();
        doc.restore();
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor(isCritical ? "#991B1B" : "#64748B")
          .text(field.label.toUpperCase(), cellX + 8, rowY + 5, { width: colWidth - 16 });
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(isCritical ? "#7F1D1D" : "#0F172A")
          .text(field.value, cellX + 8, rowY + 15, { width: colWidth - 16, ellipsis: true });
      });
      doc.y = rowY + rowHeight + 6;
    }
    doc.moveDown(0.2);
  }

  private drawInspectionPdfSectionTitle(doc: any, title: string) {
    const x = 36;
    const y = doc.y;
    const width = doc.page.width - 72;
    doc.save();
    doc.roundedRect(x, y, width, 22, 6).fill("#E2E8F0");
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#0F172A")
      .text(title, x + 10, y + 7, { width: width - 20 });
    doc.y = y + 28;
  }

  private drawInspectionPdfTableHeader(doc: any, x: number, widths: number[]) {
    const y = doc.y;
    const height = 22;
    const titles = ["ITEM", "CONCEPTO", "SI", "NO", "N/A"];
    let cursor = x;
    titles.forEach((title, index) => {
      doc.save();
      doc.rect(cursor, y, widths[index], height).fill("#0F172A");
      doc.restore();
      doc.lineWidth(1).strokeColor("#FFFFFF").rect(cursor, y, widths[index], height).stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#FFFFFF")
        .text(title, cursor, y + 7, { width: widths[index], align: "center" });
      cursor += widths[index];
    });
    doc.y = y + height;
  }

  private drawInspectionPdfMatrixCell(
    doc: any,
    x: number,
    y: number,
    width: number,
    height: number,
    selected: boolean,
    variant: "SI" | "NO" | "NA"
  ) {
    let fill = "#FFFFFF";
    if (selected && variant === "SI") fill = "#DCFCE7";
    if (selected && variant === "NO") fill = "#FEE2E2";
    if (selected && variant === "NA") fill = "#FEF3C7";
    doc.save();
    doc.rect(x, y, width, height).fill(fill);
    doc.restore();
    doc.lineWidth(1).strokeColor("#CBD5E1").rect(x, y, width, height).stroke();

    const boxSize = 10;
    const boxX = x + Math.round((width - boxSize) / 2);
    const boxY = y + Math.round((height - boxSize) / 2);
    doc.lineWidth(1).strokeColor("#334155").rect(boxX, boxY, boxSize, boxSize).stroke();
    if (!selected) return;

    if (variant === "SI") {
      doc
        .lineWidth(1.6)
        .strokeColor("#15803D")
        .moveTo(boxX + 2, boxY + 5)
        .lineTo(boxX + 4, boxY + 8)
        .lineTo(boxX + 8, boxY + 2)
        .stroke();
      return;
    }
    if (variant === "NO") {
      doc
        .lineWidth(1.4)
        .strokeColor("#B91C1C")
        .moveTo(boxX + 2, boxY + 2)
        .lineTo(boxX + 8, boxY + 8)
        .moveTo(boxX + 8, boxY + 2)
        .lineTo(boxX + 2, boxY + 8)
        .stroke();
      return;
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#92400E")
      .text("-", x, y + Math.max(0, (height - 7) / 2), { width, align: "center" });
  }

  private drawInspectionPdfSectionTable(
    doc: any,
    diaria: InspeccionDiariaResponseDto,
    sectionName: string,
    sectionItems: InspeccionItemDto[],
    answerMap: Map<string, InspeccionRespuestaDto>
  ) {
    const x = 36;
    const widths = [56, 317, 50, 50, 50];
    const totalWidth = widths.reduce((sum, current) => sum + current, 0);

    if (!this.hasInspectionPdfSpace(doc, 175)) {
      this.addInspectionPdfPage(doc, diaria);
    }

    this.drawInspectionPdfSectionTitle(doc, this.normalizePdfSectionLabel(sectionName));
    this.drawInspectionPdfTableHeader(doc, x, widths);

    sectionItems.forEach((item, index) => {
      const answer = answerMap.get(item.id);
      const selected = answer?.respuesta ?? null;
      const observation = (answer?.observacion ?? "").trim();
      const code = item.codigo?.trim() || String(index + 1);

      const descHeight = doc.heightOfString(item.descripcion, { width: widths[1] - 12 });
      const obsHeight = observation
        ? doc.heightOfString(`Obs: ${observation}`, { width: widths[1] - 12 })
        : 0;
      const rowHeight = Math.max(22, Math.ceil(descHeight + (observation ? obsHeight + 2 : 0)) + 8);

      if (doc.y + rowHeight > doc.page.height - 100) {
        this.addInspectionPdfPage(doc, diaria);
        this.drawInspectionPdfSectionTitle(
          doc,
          `${this.normalizePdfSectionLabel(sectionName)} (cont.)`
        );
        this.drawInspectionPdfTableHeader(doc, x, widths);
      }

      const rowY = doc.y;
      doc.save();
      doc.rect(x, rowY, totalWidth, rowHeight).fill(index % 2 === 0 ? "#FFFFFF" : "#F8FAFC");
      doc.restore();

      let cursor = x;
      widths.forEach((w) => {
        doc.lineWidth(1).strokeColor("#CBD5E1").rect(cursor, rowY, w, rowHeight).stroke();
        cursor += w;
      });

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#0F172A")
        .text(code, x + 4, rowY + 7, { width: widths[0] - 8, align: "center" });

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#0F172A")
        .text(item.descripcion, x + widths[0] + 6, rowY + 4, { width: widths[1] - 12 });
      if (observation) {
        const obsY = rowY + 4 + Math.ceil(descHeight) + 2;
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#991B1B")
          .text(`Obs: ${observation}`, x + widths[0] + 6, obsY, { width: widths[1] - 12 });
      }

      const optionX = x + widths[0] + widths[1];
      this.drawInspectionPdfMatrixCell(doc, optionX, rowY, widths[2], rowHeight, selected === "SI", "SI");
      this.drawInspectionPdfMatrixCell(doc, optionX + widths[2], rowY, widths[3], rowHeight, selected === "NO", "NO");
      this.drawInspectionPdfMatrixCell(doc, optionX + widths[2] + widths[3], rowY, widths[4], rowHeight, selected === "NA", "NA");

      doc.y = rowY + rowHeight;
    });

    doc.moveDown(0.6);
  }

  private drawInspectionPdfTextBlock(
    doc: any,
    diaria: InspeccionDiariaResponseDto,
    options: { title: string; body: string; tone?: "default" | "danger" | "warning" }
  ) {
    if (!this.hasInspectionPdfSpace(doc, 175)) {
      this.addInspectionPdfPage(doc, diaria);
    }

    const x = 36;
    const width = doc.page.width - 72;
    const body = options.body?.trim() ? options.body.trim() : "Sin informacion registrada.";
    const textHeight = doc.heightOfString(body, { width: width - 16 });
    const height = Math.max(44, Math.ceil(textHeight) + 28);
    const palette =
      options.tone === "danger"
        ? { border: "#FCA5A5", fill: "#FEF2F2", title: "#991B1B", text: "#7F1D1D" }
        : options.tone === "warning"
          ? { border: "#FCD34D", fill: "#FFFBEB", title: "#92400E", text: "#78350F" }
          : { border: "#CBD5E1", fill: "#FFFFFF", title: "#334155", text: "#0F172A" };

    const y = doc.y;
    doc.save();
    doc.roundedRect(x, y, width, height, 8).fill(palette.fill);
    doc
      .lineWidth(1)
      .strokeColor(palette.border)
      .roundedRect(x, y, width, height, 8)
      .stroke();
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(palette.title)
      .text(options.title.toUpperCase(), x + 8, y + 7, { width: width - 16 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(palette.text)
      .text(body, x + 8, y + 20, { width: width - 16 });
    doc.y = y + height + 8;
  }

  private drawInspectionPdfSignatures(doc: any, diaria: InspeccionDiariaResponseDto, generatedAt: Date) {
    if (!this.hasInspectionPdfSpace(doc, 210)) {
      this.addInspectionPdfPage(doc, diaria);
    }

    this.drawInspectionPdfSectionTitle(doc, "Firmas y control");
    const x = 36;
    const width = doc.page.width - 72;
    const y = doc.y;
    const gap = 20;
    const colWidth = (width - gap) / 2;

    doc
      .lineWidth(1)
      .strokeColor("#64748B")
      .moveTo(x + 10, y + 40)
      .lineTo(x + colWidth - 10, y + 40)
      .stroke()
      .moveTo(x + colWidth + gap + 10, y + 40)
      .lineTo(x + width - 10, y + 40)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#475569")
      .text("Firma del conductor", x + 10, y + 45, { width: colWidth - 20, align: "center" })
      .text("Firma del inspector", x + colWidth + gap + 10, y + 45, {
        width: colWidth - 20,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#334155")
      .text(`Fecha de generacion: ${generatedAt.toLocaleString("es-CO")}`, x + 10, y + 70)
      .text(`Codigo unico de inspeccion: ${diaria.id}`, x + 10, y + 82)
      .text("Documento apto para auditoria interna y trazabilidad.", x + 10, y + 94);

    if (process.env.INSPECCIONES_PDF_QR_ENABLED === "true") {
      const qrX = x + width - 86;
      const qrY = y + 62;
      doc.save();
      doc.roundedRect(qrX, qrY, 76, 76, 6).fill("#FFFFFF");
      doc.lineWidth(1).strokeColor("#CBD5E1").roundedRect(qrX, qrY, 76, 76, 6).stroke();
      doc.restore();
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor("#64748B")
        .text("QR OPCIONAL", qrX, qrY + 23, { width: 76, align: "center" });
      doc
        .font("Helvetica")
        .fontSize(6)
        .fillColor("#64748B")
        .text(diaria.id.slice(0, 10), qrX + 4, qrY + 39, { width: 68, align: "center" });
    }

    doc.y = y + 150;
  }

  private drawInspectionPdfPageFooters(doc: any, diaria: InspeccionDiariaResponseDto, generatedAt: Date) {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 34;
      doc
        .lineWidth(1)
        .strokeColor("#E2E8F0")
        .moveTo(36, footerY - 5)
        .lineTo(doc.page.width - 36, footerY - 5)
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#64748B")
        .text(`Inspeccion: ${diaria.id}`, 36, footerY, { width: 190 })
        .text(`Generado: ${generatedAt.toLocaleString("es-CO")}`, 190, footerY, {
          width: 220,
          align: "center",
        })
        .text(`Pagina ${i + 1} de ${range.count}`, doc.page.width - 156, footerY, {
          width: 120,
          align: "right",
        });
    }
  }

  private finalizeInspectionPdf(doc: any) {
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

  private async buildPdf(diaria: InspeccionDiariaResponseDto, items: InspeccionItemDto[]) {
    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const logoToDataUri = () => {
      const logoPath = this.resolveInspectionPdfLogoPath();
      if (!logoPath) return null;
      try {
        const ext = path.extname(logoPath).toLowerCase();
        const mime =
          ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".webp"
                ? "image/webp"
                : null;
        if (!mime) return null;
        const bytes = fs.readFileSync(logoPath);
        return `data:${mime};base64,${bytes.toString("base64")}`;
      } catch {
        return null;
      }
    };

    const grouped = new Map<string, InspeccionItemDto[]>();
    this.sortItemsForPdf(items).forEach((item) => {
      grouped.set(item.seccion, [...(grouped.get(item.seccion) ?? []), item]);
    });
    const answerMap = new Map(diaria.respuestas.map((r) => [r.itemId, r]));
    const estadoActual = String(diaria.estado ?? "").toUpperCase();
    const generatedAt = new Date();
    const logoDataUri = logoToDataUri();
    const companyName = process.env.INSPECCIONES_PDF_COMPANY_NAME || "TRANSPORTES NAUSA LTDA.";
    const companyNit = process.env.INSPECCIONES_PDF_COMPANY_NIT || "NIT 900078756-1";
    const companyPhone = process.env.INSPECCIONES_PDF_COMPANY_PHONE || "+57 313 531 6370";
    const companyEmail = process.env.INSPECCIONES_PDF_COMPANY_EMAIL || "transnausa@hotmail.com";
    const companyAddress =
      process.env.INSPECCIONES_PDF_COMPANY_ADDRESS || "Cra 39 #8-59, Malambo, Atlantico";

    const sectionLayoutClass = (sectionName: string) => {
      if (sectionName === "ESTADO_MECANICO") return "card section-compact section-mecanico";
      if (sectionName === "SEGURIDAD_SOCIAL") return "card section-compact";
      return "card";
    };

    const renderMatrixCell = (selected: boolean, kind: "SI" | "NO" | "NA") => {
      const label = kind === "SI" ? "✔" : kind === "NO" ? "✖" : "N/A";
      const className = selected
        ? kind === "SI"
          ? "mark ok selected"
          : kind === "NO"
            ? "mark no selected"
            : "mark na selected"
        : "mark";
      return `<td class="answer-cell"><span class="${className}">${label}</span></td>`;
    };

    const renderSection = (sectionName: string, sectionItems: InspeccionItemDto[]) => {
      const rows = sectionItems
        .map((item, index) => {
          const answer = answerMap.get(item.id);
          const observation = (answer?.observacion ?? "").trim();
          const selected = answer?.respuesta ?? "";
          const code = String(index + 1);
          const desc = escapeHtml(item.descripcion);
          const obsHtml = observation
            ? `<div class="obs-line"><strong>Obs:</strong> ${escapeHtml(observation)}</div>`
            : "";
          return `
            <tr>
              <td class="code-cell">${code}</td>
              <td class="concept-cell">
                <div class="concept-main">${desc}</div>
                ${obsHtml}
              </td>
              ${renderMatrixCell(selected === "SI", "SI")}
              ${renderMatrixCell(selected === "NO", "NO")}
              ${renderMatrixCell(selected === "NA", "NA")}
            </tr>
          `;
        })
        .join("");

      return `
        <section class="${sectionLayoutClass(sectionName)} avoid-break">
          <div class="section-title">${escapeHtml(this.normalizePdfSectionLabel(sectionName))}</div>
          <table class="section-table">
            <thead>
              <tr>
                <th class="code-cell">Item</th>
                <th>Concepto</th>
                <th>✔</th>
                <th>✖</th>
                <th>N/A</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    };

    const orderedSections = Array.from(grouped.entries()).sort((a, b) => {
      const order = ["CABINA", "DOCUMENTOS", "ESTADO_MECANICO", "LUCES", "LLANTAS", "SEGURIDAD_SOCIAL"];
      return (order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0]));
    });

    const sectionsHtml = orderedSections.map(([name, sectionItems]) => renderSection(name, sectionItems)).join("");
    const totalChecklistItems = orderedSections.reduce((total, [, sectionItems]) => total + sectionItems.length, 0);
    const longTextThreshold = 220;
    const hasLargeNarrative =
      String(diaria.hallazgos ?? "").trim().length > longTextThreshold ||
      String(diaria.accionesCorrectivas ?? "").trim().length > longTextThreshold;
    const compactModeClass = totalChecklistItems >= 24 || hasLargeNarrative ? "compact" : "";
    const watermark =
      estadoActual === "DRAFT"
        ? '<div class="watermark">BORRADOR</div>'
        : estadoActual === "RECHAZADO"
          ? '<div class="watermark reject">RECHAZADO</div>'
          : "";

    const statusClass =
      estadoActual === "FINALIZED" || estadoActual === "APROBADO"
        ? "status approved"
        : estadoActual === "REPORTED"
          ? "status reported"
          : estadoActual === "RECHAZADO"
            ? "status rejected"
            : "status";

    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Inspeccion ${escapeHtml(diaria.id)}</title>
          <style>
            @page {
              size: letter landscape;
              margin: 10mm;
            }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              color: #0f172a;
              font-family: "Segoe UI", Tahoma, Arial, sans-serif;
              font-size: 9.4px;
              line-height: 1.18;
              background: #ffffff;
            }
            body { padding: 0; }
            body.compact {
              font-size: 9px;
              line-height: 1.14;
            }
            .sheet { position: relative; }
            .watermark {
              position: fixed;
              top: 46%;
              left: 20%;
              width: 60%;
              text-align: center;
              transform: rotate(-22deg);
              font-size: 56px;
              font-weight: 800;
              color: rgba(100,116,139,.14);
              pointer-events: none;
              z-index: 0;
            }
            .watermark.reject { color: rgba(220,38,38,.14); }
            .content { position: relative; z-index: 1; }
            .header {
              border: 1px solid #cbd5e1;
              border-radius: 7px;
              overflow: hidden;
              margin-bottom: 4px;
              background: #fff;
            }
            .header-top {
              background: #0f172a;
              color: #fff;
              padding: 4px 7px;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: .2px;
            }
            .header-main {
              display: grid;
              grid-template-columns: 60px 1.2fr 1fr;
              gap: 6px;
              padding: 5px 7px;
              align-items: start;
            }
            .logo-box {
              width: 60px;
              height: 52px;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fff;
              overflow: hidden;
            }
            .logo-box img { width: 100%; height: 100%; object-fit: contain; }
            .logo-fallback { color: #64748b; font-size: 8px; font-weight: 700; }
            .doc-title { font-size: 12px; font-weight: 800; margin-bottom: 1px; }
            .company-meta { color: #475569; font-size: 7.6px; line-height: 1.15; }
            .header-side { display: grid; gap: 3px; justify-items: end; }
            .status {
              display: inline-block;
              padding: 3px 7px;
              border-radius: 999px;
              background: #64748b;
              color: #fff;
              font-size: 9px;
              font-weight: 800;
              min-width: 90px;
              text-align: center;
            }
            .status.approved { background: #15803d; }
            .status.reported { background: #1d4ed8; }
            .status.rejected { background: #b91c1c; }
            .small-muted { color: #64748b; font-size: 8px; }

            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 4px;
              margin-bottom: 4px;
            }
            .meta-item {
              border: 1px solid #e2e8f0;
              border-radius: 5px;
              padding: 3px 5px;
              background: #fff;
              min-height: 28px;
            }
            .meta-item.critical {
              border-color: #fca5a5;
              background: #fef2f2;
            }
            .meta-label {
              color: #64748b;
              text-transform: uppercase;
              font-size: 7px;
              font-weight: 700;
              letter-spacing: .2px;
            }
            .meta-value {
              color: #0f172a;
              font-size: 8.2px;
              font-weight: 600;
              margin-top: 1px;
              word-break: break-word;
            }
            .meta-item.critical .meta-value { color: #991b1b; }

            .layout-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4px;
              align-items: start;
            }
            .card {
              border: 1px solid #cbd5e1;
              border-radius: 7px;
              background: #fff;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .section-wide { grid-column: span 2; }
            .section-compact { }
            .section-mecanico .section-title { padding: 3px 6px; }
            .section-mecanico .section-table thead th { font-size: 7px; padding: 2px; }
            .section-mecanico .section-table td { font-size: 7px; padding: 2px; }
            .section-mecanico .mark { width: 14px; height: 14px; font-size: 6.6px; }
            .section-title {
              background: #e2e8f0;
              padding: 4px 7px;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: .2px;
            }
            .section-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            .section-table thead th {
              background: #0f172a;
              color: #fff;
              font-size: 8px;
              font-weight: 700;
              padding: 2px 3px;
              border: 1px solid #fff;
              text-align: center;
            }
            .section-table td {
              border: 1px solid #e2e8f0;
              padding: 2px 3px;
              vertical-align: top;
              font-size: 7.4px;
            }
            .section-table tbody tr:nth-child(even) td { background: #f8fafc; }
            .section-table tr { page-break-inside: avoid; break-inside: avoid; }
            .code-cell { width: 48px; text-align: center; font-weight: 700; }
            .concept-cell { width: auto; }
            .concept-main { font-weight: 600; color: #0f172a; }
            .obs-line { margin-top: 1px; color: #991b1b; font-size: 6.8px; line-height: 1.1; }
            .answer-cell { width: 34px; text-align: center; vertical-align: middle !important; padding: 2px !important; }
            .mark {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 15px;
              height: 15px;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              color: #94a3b8;
              background: #fff;
              font-size: 7px;
              font-weight: 800;
            }
            .mark.selected.ok { background: #dcfce7; color: #166534; border-color: #86efac; }
            .mark.selected.no { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
            .mark.selected.na { background: #f1f5f9; color: #475569; border-color: #cbd5e1; width: 18px; }

            .summary-row {
              display: grid;
              grid-template-columns: 220px 1fr 1fr;
              gap: 4px;
              margin-top: 4px;
              align-items: start;
            }
            .critical-card {
              border: 1px solid #e2e8f0;
              border-radius: 7px;
              padding: 5px;
              background: #fff;
              min-height: 62px;
            }
            .critical-card.red {
              border-color: #fca5a5;
              background: #fef2f2;
            }
            .critical-pill {
              display: inline-block;
              margin-top: 3px;
              padding: 3px 7px;
              border-radius: 999px;
              font-size: 8.6px;
              font-weight: 800;
              background: #e2e8f0;
              color: #334155;
            }
            .critical-card.red .critical-pill {
              background: #dc2626;
              color: #fff;
            }
            .note-card {
              border: 1px solid #cbd5e1;
              border-radius: 7px;
              background: #fff;
              overflow: hidden;
              min-height: 62px;
            }
            .note-card.warn { border-color: #fcd34d; background: #fffbeb; }
            .note-title {
              padding: 4px 7px;
              background: #f1f5f9;
              border-bottom: 1px solid #e2e8f0;
              font-size: 7px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .note-card.warn .note-title {
              background: #fef3c7;
              border-bottom-color: #fcd34d;
              color: #92400e;
            }
            .note-body {
              padding: 5px 7px;
              font-size: 7.1px;
              white-space: pre-wrap;
              word-break: break-word;
              min-height: 42px;
            }

            .footer-block {
              margin-top: 4px;
              border: 1px solid #cbd5e1;
              border-radius: 7px;
              background: #fff;
              padding: 5px 7px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .signature-grid {
              display: grid;
              grid-template-columns: 1fr 1fr auto;
              gap: 8px;
              align-items: end;
            }
            .sig-line {
              border-top: 1px solid #64748b;
              padding-top: 3px;
              min-height: 22px;
              font-size: 7.2px;
              color: #475569;
              text-align: center;
            }
            .audit-box {
              border: 1px dashed #cbd5e1;
              border-radius: 6px;
              padding: 4px 6px;
              min-width: 145px;
              font-size: 6.6px;
              color: #475569;
              background: #f8fafc;
            }
            .audit-box strong { color: #334155; }
            .avoid-break { page-break-inside: avoid; break-inside: avoid; }
            body.compact .header-top { padding: 3px 6px; }
            body.compact .header-main { padding: 4px 6px; gap: 5px; }
            body.compact .meta-grid { gap: 3px; margin-bottom: 3px; }
            body.compact .layout-grid { gap: 3px; }
            body.compact .summary-row { margin-top: 3px; gap: 3px; }
            body.compact .footer-block { margin-top: 3px; padding: 4px 6px; }
            body.compact .section-table td,
            body.compact .section-table thead th { padding: 2px; }
            body.compact .critical-card,
            body.compact .note-card { min-height: 56px; }
            body.compact .note-body { min-height: 36px; }
            .pdf-ready { display: none; }
          </style>
        </head>
        <body class="${compactModeClass}">
          <div class="sheet">
            ${watermark}
            <div class="content">
              <section class="header avoid-break">
                <div class="header-top">${escapeHtml(companyName)}</div>
                <div class="header-main">
                  <div class="logo-box">
                    ${
                      logoDataUri
                        ? `<img src="${logoDataUri}" alt="Logo" />`
                        : `<span class="logo-fallback">LOGO</span>`
                    }
                  </div>
                  <div>
                    <div class="doc-title">INSPECCION DIARIA DE VEHICULO</div>
                    <div class="company-meta">${escapeHtml(companyNit)}</div>
                    <div class="company-meta">${escapeHtml(companyPhone)} | ${escapeHtml(companyEmail)}</div>
                    <div class="company-meta">${escapeHtml(companyAddress)}</div>
                  </div>
                  <div class="header-side">
                    <span class="${statusClass}">${escapeHtml(diaria.estado || "SIN ESTADO")}</span>
                    <div class="small-muted">Codigo: ${escapeHtml(diaria.id)}</div>
                    <div class="small-muted">Generado: ${escapeHtml(generatedAt.toLocaleString("es-CO"))}</div>
                  </div>
                </div>
              </section>

              <section class="meta-grid avoid-break">
                <div class="meta-item"><div class="meta-label">Fecha</div><div class="meta-value">${escapeHtml(diaria.fecha || "-")}</div></div>
                <div class="meta-item"><div class="meta-label">Conductor</div><div class="meta-value">${escapeHtml(diaria.conductor || "-")}</div></div>
                <div class="meta-item"><div class="meta-label">Vehiculo / Placa</div><div class="meta-value">${escapeHtml(diaria.placa || "-")}</div></div>
                <div class="meta-item"><div class="meta-label">Cedula</div><div class="meta-value">${escapeHtml(diaria.cedula || "-")}</div></div>
                <div class="meta-item"><div class="meta-label">Manifiesto</div><div class="meta-value">${escapeHtml(diaria.numeroManifiesto || "-")}</div></div>
                <div class="meta-item"><div class="meta-label">Destino</div><div class="meta-value">${escapeHtml(diaria.destino || "-")}</div></div>
                <div class="meta-item"><div class="meta-label">Estado</div><div class="meta-value">${escapeHtml(diaria.estado || "-")}</div></div>
                <div class="meta-item ${diaria.puntoCritico ? "critical" : ""}"><div class="meta-label">Punto Critico</div><div class="meta-value">${diaria.puntoCritico ? "SI" : "NO"}</div></div>
              </section>

              <section class="layout-grid">
                ${sectionsHtml}
              </section>

              <section class="summary-row avoid-break">
                <div class="critical-card ${diaria.puntoCritico ? "red" : ""}">
                  <div class="meta-label">Indicador Punto Critico</div>
                  <div class="critical-pill">${diaria.puntoCritico ? "PUNTO CRITICO: SI" : "PUNTO CRITICO: NO"}</div>
                  <div class="small-muted" style="margin-top:6px;">${diaria.puntoCritico ? "Requiere seguimiento inmediato." : "Sin criticidad reportada."}</div>
                </div>
                <div class="note-card ${diaria.hallazgos ? "warn" : ""}">
                  <div class="note-title">Hallazgos</div>
                  <div class="note-body">${escapeHtml(diaria.hallazgos || "Sin hallazgos registrados.")}</div>
                </div>
                <div class="note-card">
                  <div class="note-title">Acciones Correctivas</div>
                  <div class="note-body">${escapeHtml(diaria.accionesCorrectivas || "Sin acciones correctivas registradas.")}</div>
                </div>
              </section>

              <section class="footer-block avoid-break">
                <div class="signature-grid">
                  <div class="sig-line">Firma del conductor</div>
                  <div class="sig-line">Firma del inspector</div>
                  <div class="audit-box">
                    <div><strong>Codigo unico:</strong> ${escapeHtml(diaria.id)}</div>
                    <div><strong>Fecha generacion:</strong> ${escapeHtml(generatedAt.toLocaleString("es-CO"))}</div>
                    <div><strong>Trazabilidad:</strong> Documento auditable de inspeccion diaria.</div>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <div class="pdf-ready" data-ready="true"></div>
        </body>
      </html>
    `;

    this.resolvePuppeteerCacheDir();
    const browser = await this.getOrCreatePdfBrowser();
    const page = await browser.newPage();

    try {
      await this.configurePdfPage(page);
      await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
      await page.emulateMediaType("print");
      await page.setContent(html, {
        waitUntil: "domcontentloaded",
        timeout: this.pdfRenderTimeoutMs,
      });
      await page.waitForSelector(".pdf-ready[data-ready='true']", {
        timeout: this.pdfWaitForReadyTimeoutMs,
      });
      const pdf = await page.pdf({
        format: "letter",
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        scale: totalChecklistItems >= 30 || hasLargeNarrative ? 0.9 : 0.92,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      });
      return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    } catch (error) {
      this.browserPromise = null;
      try {
        await browser.close();
      } catch {
        // Ignore close errors after render failure.
      }
      throw error;
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async finalize(id: string, actor: Actor) {
    this.ensureUuid(id, "id");
    const tenantId = this.resolveTenant(actor);
    const current = await this.getByIdForTenant(id, tenantId);
    await this.ensureUserCanAccessInspection(actor, current);
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
      const pdf = await this.buildPdf(finalized, items);
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
    await this.ensureUserCanAccessInspection(actor, diaria);
    if (diaria.estado !== "FINALIZED") {
      throw new BadRequestException("PDF disponible únicamente para inspecciones finalizadas");
    }
    // Regenera el PDF con la plantilla vigente para evitar entregar versiones antiguas
    // almacenadas antes del rediseño visual.
    const items = await this.items();
    const regeneratedPdf = await this.buildPdf(diaria, items);

    await this.db.query(
      `
      INSERT INTO inspecciones.archivos_pdf (diarias_id, archivo, generado_por)
      VALUES ($1, $2, $3)
      `,
      [id, regeneratedPdf, actor.userId ?? null]
    );

    await this.audit("INSPECCION_DIARIA_PDF_DOWNLOAD", id, actor, null, { downloadedAt: new Date() });
    return regeneratedPdf;
  }
}
