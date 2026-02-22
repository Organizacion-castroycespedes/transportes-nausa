import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  TenantsService,
  type TenantDetailsInput,
  type TenantSummaryInput,
} from "./tenants.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TenantsController {
  constructor(
    @Inject(TenantsService) private readonly tenantsService: TenantsService
  ) {}

  private buildActor(request: Request & { user?: { roles?: string[]; tenantId?: string } }) {
    const roles = Array.isArray(request.user?.roles) ? request.user.roles : [];
    return {
      roles,
      tenantId: request.user?.tenantId,
    };
  }

  private resolveTenantScope(
    tenantId: string,
    actor: ReturnType<TenantsController["buildActor"]>
  ) {
    if (actor.roles.includes("SUPER_ADMIN")) {
      return tenantId;
    }
    if (!actor.roles.includes("ADMIN")) {
      throw new ForbiddenException("No autorizado");
    }
    if (!actor.tenantId) {
      throw new BadRequestException("Tenant requerido");
    }
    if (tenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }
    return actor.tenantId;
  }

  @Get()
  @Roles("SUPER_ADMIN")
  list() {
    return this.tenantsService.listTenants();
  }

  @Post()
  @Roles("SUPER_ADMIN")
  create(@Body() payload: Required<Pick<TenantSummaryInput, "slug">> & TenantSummaryInput) {
    return this.tenantsService.createTenant(payload);
  }

  @Put(":id")
  @Roles("SUPER_ADMIN")
  update(
    @Param("id") tenantId: string,
    @Body() payload: TenantSummaryInput
  ) {
    return this.tenantsService.updateTenant(tenantId, payload);
  }

  @Get(":id/config")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "READ" })
  getConfig(@Param("id") tenantId: string, @Req() request: Request) {
    const resolvedTenantId = this.resolveTenantScope(
      tenantId,
      this.buildActor(request)
    );
    return this.tenantsService.getConfig(resolvedTenantId);
  }

  @Put(":id/config")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  updateConfig(
    @Param("id") tenantId: string,
    @Body() body: { config: unknown },
    @Req() request: Request
  ) {
    const resolvedTenantId = this.resolveTenantScope(
      tenantId,
      this.buildActor(request)
    );
    return this.tenantsService.updateConfig(resolvedTenantId, body?.config ?? {});
  }

  @Get(":id/details")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "READ" })
  getDetails(@Param("id") tenantId: string, @Req() request: Request) {
    const resolvedTenantId = this.resolveTenantScope(
      tenantId,
      this.buildActor(request)
    );
    return this.tenantsService.getDetails(resolvedTenantId);
  }

  @Put(":id/details")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  upsertDetails(
    @Param("id") tenantId: string,
    @Body() body: TenantDetailsInput,
    @Req() request: Request
  ) {
    const resolvedTenantId = this.resolveTenantScope(
      tenantId,
      this.buildActor(request)
    );
    return this.tenantsService.upsertDetails(resolvedTenantId, body);
  }

  @Delete(":id/details")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  deleteDetails(@Param("id") tenantId: string, @Req() request: Request) {
    const resolvedTenantId = this.resolveTenantScope(
      tenantId,
      this.buildActor(request)
    );
    return this.tenantsService.deleteDetails(resolvedTenantId);
  }
}
