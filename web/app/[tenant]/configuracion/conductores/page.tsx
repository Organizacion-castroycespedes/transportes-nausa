"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { DriversTable } from "../../../../domains/drivers/components/DriversTable";
import { useDrivers } from "../../../../domains/drivers/hooks";
import { useAppSelector } from "../../../../store/hooks";

export default function ConductoresPage() {
  const params = useParams<{ tenant: string }>();
  const authUser = useAppSelector((state) => state.auth.user);
  const headers = useMemo(() => ({
    "x-user-role": authUser?.role ?? "",
    "x-tenant-id": authUser?.tenantId ?? "",
    "x-user-id": authUser?.id ?? "",
  }), [authUser]);
  const { drivers, loading } = useDrivers(headers);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Conductores</h1>
        <Link className="text-blue-600" href={`/${params.tenant}/configuracion/conductores/nuevo`}>
          Nuevo conductor
        </Link>
      </div>
      {loading ? <p>Cargando...</p> : <DriversTable tenant={params.tenant} drivers={drivers} />}
    </div>
  );
}
