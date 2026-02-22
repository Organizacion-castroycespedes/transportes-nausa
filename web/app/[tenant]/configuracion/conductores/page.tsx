"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../../../../components/design-system/Button";
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
  const { drivers, loading, reload } = useDrivers(headers);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Conductores</h1>
            <p className="text-sm text-slate-500">
              Administra los conductores registrados en el tenant.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => void reload()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Link href={`/${params.tenant}/configuracion/conductores/nuevo`}>
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                Nuevo conductor
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Cargando conductores...
        </div>
      ) : drivers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No hay conductores registrados.
        </div>
      ) : (
        <DriversTable tenant={params.tenant} drivers={drivers} />
      )}
    </section>
  );
}
