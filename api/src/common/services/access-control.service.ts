import { Injectable, Inject } from "@nestjs/common";
import { DatabaseService } from "../db/database.service";

export type PermissionAccessLevel = "READ" | "WRITE";

export type PermissionSummary = {
  key: string;
  module: string;
  route: string;
  accessLevel: PermissionAccessLevel;
  actions: Record<string, boolean>;
};

type PermissionCache = {
  permissions: Map<string, PermissionSummary>;
};

const PERMISSION_KEY_ALIASES: Record<string, string[]> = {
  CONFIG_USUARIOS: ["USUARIOS_TENANT_USUARIOS"],
  USUARIOS_TENANT_USUARIOS: ["CONFIG_USUARIOS"],
  CONFIG_ROLES: ["ROLES_TENANT_ROLES"],
  ROLES_TENANT_ROLES: ["CONFIG_ROLES"],
  CONFIG_GENERAL: ["CONFIGURACION_TENANT_CONFIGURACION"],
  CONFIGURACION_TENANT_CONFIGURACION: ["CONFIG_GENERAL"],
};

@Injectable()
export class AccessControlService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async getPermissionsForRequest(
    request: { permissionCache?: PermissionCache },
    userId: string,
    tenantId: string
  ): Promise<Map<string, PermissionSummary>> {
    if (request.permissionCache?.permissions) {
      return request.permissionCache.permissions;
    }
    const permissions = await this.fetchPermissions(userId, tenantId);
    request.permissionCache = { permissions };
    return permissions;
  }

  async fetchPermissions(
    userId: string,
    tenantId: string
  ): Promise<Map<string, PermissionSummary>> {
    const result = await this.db.query(
      `
      SELECT
        mi.key,
        mi.module,
        mi.route,
        rmp.access_level,
        rmp.actions
      FROM role_menu_permissions rmp
      INNER JOIN menu_items mi ON mi.id = rmp.menu_item_id
      WHERE rmp.tenant_id = $1
        AND mi.deleted_at IS NULL
        AND rmp.role_id = ANY(
          SELECT role_id
          FROM user_roles
          WHERE user_id = $2 AND tenant_id = $1
        )
      `,
      [tenantId, userId]
    );
    const map = new Map<string, PermissionSummary>();
    for (const row of result.rows as Array<{
      key: string;
      module: string;
      route: string;
      access_level: PermissionAccessLevel;
      actions: Record<string, boolean> | null;
    }>) {
      const actions = row.actions ?? {};
      const keys = [row.key, ...(PERMISSION_KEY_ALIASES[row.key] ?? [])];

      for (const key of keys) {
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            key,
            module: row.module,
            route: row.route,
            accessLevel: row.access_level,
            actions: { ...actions },
          });
          continue;
        }
        if (row.access_level === "WRITE") {
          existing.accessLevel = "WRITE";
        }
        for (const [action, allowed] of Object.entries(actions)) {
          existing.actions[action] = existing.actions[action] || Boolean(allowed);
        }
      }
    }
    return map;
  }

  isAccessAllowed(
    permission: PermissionSummary | undefined,
    required: PermissionAccessLevel
  ) {
    if (!permission) {
      return false;
    }
    if (required === "READ") {
      return permission.accessLevel === "READ" || permission.accessLevel === "WRITE";
    }
    return permission.accessLevel === "WRITE";
  }
}
