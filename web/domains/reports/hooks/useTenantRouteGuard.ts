"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "../../../store/hooks";

export const useTenantRouteGuard = (routeTenant: string) => {
  const router = useRouter();
  const pathname = usePathname();
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const authTenant = useAppSelector((state) => state.auth.user?.tenantId ?? state.auth.tenantId);

  const isReady = useMemo(
    () => bootstrapped && authStatus !== "refreshing" && authStatus !== "authenticating",
    [authStatus, bootstrapped]
  );

  useEffect(() => {
    if (!isReady) return;
    if (authStatus !== "authenticated") {
      router.replace("/login");
      return;
    }
    if (!authTenant || !routeTenant || authTenant === routeTenant) {
      return;
    }
    const nextPath = pathname ? pathname.replace(/^\/[^/]+/, `/${authTenant}`) : `/${authTenant}`;
    router.replace(nextPath);
  }, [authStatus, authTenant, isReady, pathname, routeTenant, router]);

  return {
    isReady,
    authTenant,
    isValidTenant: Boolean(authTenant && routeTenant && authTenant === routeTenant),
    isAuthenticated: authStatus === "authenticated",
  };
};
