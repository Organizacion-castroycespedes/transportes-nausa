import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Actor, InspeccionesService } from "./inspecciones.service";

export type PdfJobStatus = "queued" | "processing" | "completed" | "failed";

type PdfJobRecord = {
  id: string;
  inspectionId: string;
  tenantId: string;
  requestedBy: string | null;
  actor: Actor;
  status: PdfJobStatus;
  createdAt: string;
  updatedAt: string;
  filePath: string | null;
  fileName: string;
  error: string | null;
};

@Injectable()
export class InspeccionesPdfQueueService {
  private readonly jobs = new Map<string, PdfJobRecord>();
  private readonly pending: string[] = [];
  private readonly outputDir = path.resolve(process.cwd(), ".tmp", "inspecciones-pdf-jobs");
  private workerRunning = false;

  constructor(@Inject(InspeccionesService) private readonly inspeccionesService: InspeccionesService) {
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  private hasRole(actor: Actor, role: string) {
    return actor.roles.includes(role);
  }

  private isAdminLike(actor: Actor) {
    return this.hasRole(actor, "ADMIN") || this.hasRole(actor, "SUPER_ADMIN");
  }

  private ensureTenant(actor: Actor) {
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    return actor.tenantId;
  }

  private ensureCanReadJob(actor: Actor, job: PdfJobRecord) {
    const tenantId = this.ensureTenant(actor);
    if (job.tenantId !== tenantId) {
      throw new ForbiddenException("No puedes consultar este trabajo");
    }

    if (!this.isAdminLike(actor) && job.requestedBy && actor.userId !== job.requestedBy) {
      throw new ForbiddenException("No puedes consultar este trabajo");
    }
  }

  private startWorker() {
    if (this.workerRunning) return;
    this.workerRunning = true;

    void (async () => {
      while (this.pending.length > 0) {
        const jobId = this.pending.shift();
        if (!jobId) continue;
        const job = this.jobs.get(jobId);
        if (!job) continue;

        job.status = "processing";
        job.updatedAt = new Date().toISOString();

        try {
          const pdfBuffer = await this.inspeccionesService.getPdf(job.inspectionId, job.actor);
          const filePath = path.join(this.outputDir, `${job.id}.pdf`);
          await fs.promises.writeFile(filePath, pdfBuffer);
          job.filePath = filePath;
          job.status = "completed";
          job.updatedAt = new Date().toISOString();
        } catch (error) {
          const message =
            typeof error === "object" && error && "message" in error
              ? String((error as { message?: unknown }).message ?? "Error al generar PDF")
              : "Error al generar PDF";
          job.error = message;
          job.status = "failed";
          job.updatedAt = new Date().toISOString();
        }
      }

      this.workerRunning = false;
      if (this.pending.length > 0) {
        this.startWorker();
      }
    })();
  }

  async enqueueInspectionPdf(inspectionId: string, actor: Actor) {
    const tenantId = this.ensureTenant(actor);
    const inspection = await this.inspeccionesService.getById(inspectionId, actor);
    if (inspection.estado !== "FINALIZED") {
      throw new BadRequestException("PDF disponible unicamente para inspecciones finalizadas");
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const job: PdfJobRecord = {
      id,
      inspectionId,
      tenantId,
      requestedBy: actor.userId ?? null,
      actor: {
        userId: actor.userId,
        tenantId,
        roles: [...actor.roles],
        ip: actor.ip,
        userAgent: actor.userAgent,
      },
      status: "queued",
      createdAt: now,
      updatedAt: now,
      filePath: null,
      fileName: `inspeccion-${inspectionId}.pdf`,
      error: null,
    };

    this.jobs.set(id, job);
    this.pending.push(id);
    this.startWorker();

    return {
      jobId: id,
      status: job.status,
      inspectionId: job.inspectionId,
      createdAt: job.createdAt,
    };
  }

  getJobStatus(jobId: string, actor: Actor) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException("Trabajo de PDF no encontrado");
    }
    this.ensureCanReadJob(actor, job);

    return {
      jobId: job.id,
      inspectionId: job.inspectionId,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      downloadUrl: job.status === "completed" ? `/api/inspecciones/diarias/pdf/jobs/${job.id}/file` : null,
    };
  }

  async readJobFile(jobId: string, actor: Actor) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException("Trabajo de PDF no encontrado");
    }
    this.ensureCanReadJob(actor, job);

    if (job.status !== "completed" || !job.filePath) {
      throw new BadRequestException("El PDF aun no esta listo");
    }

    const buffer = await fs.promises.readFile(job.filePath);
    return { buffer, fileName: job.fileName };
  }
}
