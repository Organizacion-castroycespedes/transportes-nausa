import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DriversService } from "./drivers.service";
import type {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateDriverStatusDto,
} from "./dto/driver.dto";

@Controller("drivers")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DriversController {
  constructor(@Inject(DriversService) private readonly driversService: DriversService) {}

  private buildActor(
    request: Request & { user?: { roles?: string[]; tenantId?: string; id?: string } }
  ) {
    return {
      userId: request.user?.id,
      tenantId: request.user?.tenantId,
      roles: Array.isArray(request.user?.roles) ? request.user?.roles : [],
    };
  }

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_CONDUCTORES, level: "READ" })
  list(@Req() request: Request) {
    return this.driversService.list(this.buildActor(request));
  }

  @Get("me")
  @Roles("USER", "ADMIN", "SUPER_ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.PERFIL_PROPIO, level: "READ" })
  me(@Req() request: Request) {
    return this.driversService.getMe(this.buildActor(request));
  }

  @Patch("me")
  @Roles("USER", "ADMIN", "SUPER_ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.PERFIL_PROPIO, level: "WRITE" })
  updateMe(@Body() payload: UpdateDriverDto, @Req() request: Request) {
    return this.driversService.updateMe(payload, this.buildActor(request));
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_CONDUCTORES, level: "READ" })
  getById(@Param("id") id: string, @Req() request: Request) {
    return this.driversService.getById(id, this.buildActor(request));
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_CONDUCTORES, level: "WRITE" })
  create(@Body() payload: CreateDriverDto, @Req() request: Request) {
    return this.driversService.create(payload, this.buildActor(request));
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_CONDUCTORES, level: "WRITE" })
  updateById(
    @Param("id") id: string,
    @Body() payload: UpdateDriverDto,
    @Req() request: Request
  ) {
    return this.driversService.updateById(id, payload, this.buildActor(request));
  }

  @Patch(":id/status")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_CONDUCTORES, level: "WRITE" })
  updateStatus(
    @Param("id") id: string,
    @Body() payload: UpdateDriverStatusDto,
    @Req() request: Request
  ) {
    return this.driversService.updateStatus(id, payload, this.buildActor(request));
  }
}
