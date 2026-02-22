"use client";

import { useRouter } from "next/navigation";
import { DriverForm } from "../../../../../domains/drivers/components/DriverForm";
import { createDriver } from "../../../../../domains/drivers/api";
import { useAppSelector } from "../../../../../store/hooks";

export default function NuevoConductorPage() {
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo conductor</h1>
      <DriverForm
        includePassword
        onSubmit={async (payload) => {
          await createDriver(payload as any, {
            "x-user-role": authUser?.role ?? "",
            "x-tenant-id": authUser?.tenantId ?? "",
            "x-user-id": authUser?.id ?? "",
          });
          router.back();
        }}
      />
    </div>
  );
}
