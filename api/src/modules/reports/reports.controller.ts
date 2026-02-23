import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ListReportInspectionsQueryDto } from "./dto/list-report-inspections-query.dto";
import { SendBulkInspectionsReportDto } from "./dto/send-bulk-inspections-report.dto";
import { ReportsService } from "./reports.service";

type AuthRequest = Request & {
  user?: {
    roles?: string[];
    tenantId?: string;
    id?: string;
  };
};

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "ADMIN", "USER")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
      ip: request.headers["x-forwarded-for"]?.toString() ?? request.ip,
      userAgent: request.headers["user-agent"] as string | undefined,
    };
  }

  @Get("dashboard")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "READ" })
  getDashboard(@Req() request: AuthRequest) {
    return this.reportsService.getDashboard(this.buildActor(request));
  }

  @Get("inspections")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "READ" })
  getInspections(
    @Query() query: ListReportInspectionsQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.reportsService.listInspections(query, this.buildActor(request));
  }

  @Get("inspections/:id/pdf")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "READ" })
  async getInspectionPdf(
    @Param("id") id: string,
    @Req() request: AuthRequest,
    @Res() response: Response
  ) {
    const buffer = await this.reportsService.getInspectionPdf(id, this.buildActor(request));
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename=inspection-report-${id}.pdf`
    );
    response.send(buffer);
  }

  @Post("inspections/send-bulk")
  @Roles("SUPER_ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "WRITE" })
  sendBulk(
    @Body() payload: SendBulkInspectionsReportDto,
    @Req() request: AuthRequest
  ) {
    return this.reportsService.sendBulkInspections(payload, this.buildActor(request));
  }
}
