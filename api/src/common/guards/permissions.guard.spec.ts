import assert from "node:assert/strict";
import test from "node:test";
import { PermissionsGuard } from "./permissions.guard";

const buildContext = (user: { id?: string; tenantId?: string }) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as any;

test("PermissionsGuard: allows READ when permission is READ", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CONFIG_ROLES",
          {
            key: "CONFIG_ROLES",
            module: "roles",
            route: "/roles",
            accessLevel: "READ",
            actions: {},
          },
        ],
      ]),
    isAccessAllowed: (permission: any, required: any) => {
      if (required === "READ") {
        return permission?.accessLevel === "READ" || permission?.accessLevel === "WRITE";
      }
      return permission?.accessLevel === "WRITE";
    },
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(buildContext({ id: "user", tenantId: "tenant" }));
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks WRITE when permission is READ", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "WRITE" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CONFIG_ROLES",
          {
            key: "CONFIG_ROLES",
            module: "roles",
            route: "/roles",
            accessLevel: "READ",
            actions: {},
          },
        ],
      ]),
    isAccessAllowed: (permission: any, required: any) => {
      if (required === "READ") {
        return permission?.accessLevel === "READ" || permission?.accessLevel === "WRITE";
      }
      return permission?.accessLevel === "WRITE";
    },
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () => guard.canActivate(buildContext({ id: "user", tenantId: "tenant" })),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows WRITE when permission is WRITE", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "WRITE" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CONFIG_ROLES",
          {
            key: "CONFIG_ROLES",
            module: "roles",
            route: "/roles",
            accessLevel: "WRITE",
            actions: {},
          },
        ],
      ]),
    isAccessAllowed: (permission: any, required: any) => {
      if (required === "READ") {
        return permission?.accessLevel === "READ" || permission?.accessLevel === "WRITE";
      }
      return permission?.accessLevel === "WRITE";
    },
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(buildContext({ id: "user", tenantId: "tenant" }));
  assert.equal(allowed, true);
});
