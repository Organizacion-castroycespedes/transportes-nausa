import assert from "node:assert/strict";
import test from "node:test";
import { AuditService } from "../../common/services/audit.service";
import { CacheService } from "../../common/services/cache.service";
import { MenuAdminService } from "./menu-admin.service";

class FakeDatabaseService {
  constructor(private readonly client: { query: Function; release: Function }) {}

  async getClient() {
    return this.client;
  }

  async query() {
    return { rows: [] };
  }
}

test("MenuAdminService: replaceRolePermissions uses transaction", async () => {
  const queries: string[] = [];
  const client = {
    query: async (text: string) => {
      const trimmed = text.trim();
      queries.push(trimmed);
      if (
        trimmed.startsWith("BEGIN") ||
        trimmed.startsWith("COMMIT") ||
        trimmed.startsWith("ROLLBACK")
      ) {
        return { rows: [] };
      }
      if (trimmed.includes("FROM menu_items") && trimmed.startsWith("SELECT")) {
        return { rows: [{ id: "menu-1" }] };
      }
      if (trimmed.includes("FROM role_menu_permissions") && trimmed.startsWith("SELECT")) {
        return { rows: [{ menu_item_id: "menu-1", access_level: "READ", actions: {} }] };
      }
      return { rows: [] };
    },
    release: () => undefined,
  };

  const auditService = { logEvent: () => undefined } as unknown as AuditService;
  const cacheService = {
    invalidateTenantNamespace: () => undefined,
  } as unknown as CacheService;
  const service = new MenuAdminService(
    new FakeDatabaseService(client) as never,
    auditService,
    cacheService
  );

  const result = await service.replaceRolePermissions(
    "role-1",
    {
      tenantId: "tenant-1",
      permissions: [
        {
          menuItemId: "menu-1",
          accessLevel: "READ",
        },
      ],
    },
    { roles: ["SUPER_ADMIN"], tenantId: "tenant-1", userId: "user-1" }
  );

  assert.deepEqual(result, { ok: true });
  assert.ok(queries.some((query) => query.startsWith("BEGIN")));
  assert.ok(queries.some((query) => query.startsWith("COMMIT")));
  assert.ok(
    queries.some((query) => query.startsWith("DELETE FROM role_menu_permissions"))
  );
});
