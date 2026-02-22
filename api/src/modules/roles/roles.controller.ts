import {
  ForbiddenException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { RolesService, type RoleRecord } from "./roles.service";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

type AuthRequest = Request & {
  user?: {
    id?: string;
    roles?: string[];
    tenantId?: string;
  };
};

@Controller("roles")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RolesController {
  constructor(
    @Inject(RolesService) private readonly rolesService: RolesService
  ) {}

  private buildActor(request: AuthRequest) {
    const roles = Array.isArray(request.user?.roles)
      ? request.user.roles
      : [];
    return {
      roles,
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
    };
  }

  private isSuperAdmin(actor: ReturnType<RolesController["buildActor"]>) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private filterSuperAdminRole(
    roles: RoleRecord[],
    actor: ReturnType<RolesController["buildActor"]>
  ) {
    if (this.isSuperAdmin(actor)) {
      return roles;
    }
    return roles.filter((role) => role.nombre !== "SUPER_ADMIN");
  }

  private ensureCanWriteRole(
    actor: ReturnType<RolesController["buildActor"]>,
    roleName?: string
  ) {
    if (this.isSuperAdmin(actor)) {
      return;
    }
    if (roleName?.trim().toUpperCase() === "SUPER_ADMIN") {
      throw new ForbiddenException("No autorizado");
    }
  }

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_ROLES, level: "READ" })
  async list(@Req() request: AuthRequest) {
    const actor = this.buildActor(request);
    const roles = await this.rolesService.listRoles(actor);
    return this.filterSuperAdminRole(roles, actor);
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_ROLES, level: "WRITE" })
  create(@Body() payload: CreateRoleDto, @Req() request: AuthRequest) {
    const actor = this.buildActor(request);
    this.ensureCanWriteRole(actor, payload.nombre);
    return this.rolesService.createRole(payload, actor);
  }

  @Put(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_ROLES, level: "WRITE" })
  update(
    @Param("id") roleId: string,
    @Body() payload: UpdateRoleDto,
    @Req() request: AuthRequest
  ) {
    const actor = this.buildActor(request);
    this.ensureCanWriteRole(actor, payload.nombre);
    return this.rolesService.updateRole(roleId, payload, actor);
  }
}
