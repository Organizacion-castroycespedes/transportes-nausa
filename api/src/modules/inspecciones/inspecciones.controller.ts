import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
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
import type { UpsertInspeccionDiariaDto } from "./dto/inspeccion-diaria.dto";
import { InspeccionesService } from "./inspecciones.service";

@Controller("inspecciones")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InspeccionesController {
  constructor(@Inject(InspeccionesService) private readonly service: InspeccionesService) {}

  private buildActor(request: Request & { user?: { roles?: string[]; tenantId?: string; id?: string } }) {
    return {
      userId: request.user?.id,
      tenantId: request.user?.tenantId,
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      ip: request.ip,
      userAgent: request.headers["user-agent"] as string | undefined,
    };
  }

  @Get("items")
  @Roles("SUPER_ADMIN", "ADMIN", "USER")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "READ" })
  items() {
    return this.service.items();
  }

  @Get("diarias")
  @Roles("SUPER_ADMIN", "ADMIN", "USER")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "READ" })
  list(@Req() request: Request) {
    return this.service.list(this.buildActor(request));
  }

  @Post("diarias")
  @Roles("SUPER_ADMIN", "ADMIN", "USER")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "WRITE" })
  create(@Body() payload: UpsertInspeccionDiariaDto, @Req() request: Request) {
    return this.service.create(payload, this.buildActor(request));
  }

  @Get("diarias/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "USER")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "READ" })
  getById(@Param("id") id: string, @Req() request: Request) {
    return this.service.getById(id, this.buildActor(request));
  }

  @Put("diarias/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "USER")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "WRITE" })
  update(@Param("id") id: string, @Body() payload: UpsertInspeccionDiariaDto, @Req() request: Request) {
    return this.service.update(id, payload, this.buildActor(request));
  }

  @Post("diarias/:id/finalizar")
  @Roles("SUPER_ADMIN", "ADMIN", "USER")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "WRITE" })
  finalize(@Param("id") id: string, @Req() request: Request) {
    return this.service.finalize(id, this.buildActor(request));
  }

  @Get("diarias/:id/pdf")
  @Roles("SUPER_ADMIN", "ADMIN", "USER")
  @RequirePermission({ menuKey: MENU_KEYS.INSPECCION_DIARIA, level: "READ" })
  async pdf(@Param("id") id: string, @Req() request: Request, @Res() response: Response) {
    const buffer = await this.service.getPdf(id, this.buildActor(request));
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename=inspeccion-${id}.pdf`);
    response.send(buffer);
  }
}
