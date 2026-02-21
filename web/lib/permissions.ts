import { store } from "../store";
import type { AccessLevel } from "../domains/menu/types";

export const hasMenuAccess = (menuKey: string, level: AccessLevel) => {
  const permissions = store.getState().menu.permissions;
  if (store.getState().auth.user?.role === "SUPER_ADMIN") {
    return true;
  }
  const permission = permissions.find((item) => item.key === menuKey);
  if (!permission) {
    return false;
  }
  if (level === "READ") {
    return permission.accessLevel === "READ" || permission.accessLevel === "WRITE";
  }
  return permission.accessLevel === "WRITE";
};
