"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DriverForm } from "../../../../../domains/drivers/components/DriverForm";
import { createDriver } from "../../../../../domains/drivers/api";
import { Button } from "../../../../../components/design-system/Button";
import { Toast, type ToastVariant } from "../../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../../lib/useAutoClearState";
import { useAppSelector } from "../../../../../store/hooks";

export default function NuevoConductorPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const authUser = useAppSelector((state) => state.auth.user);
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);

  useAutoClearState(toast, setToast);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Nuevo conductor</h1>
            <p className="text-sm text-slate-500">Registra los datos del conductor y su vehiculo.</p>
          </div>
          <Link href={`/${params.tenant}/configuracion/conductores`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </Link>
        </div>
      </div>
      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
      <DriverForm
        includePassword
        onSubmit={async (payload) => {
          try {
            await createDriver(payload as any, {
              "x-user-role": authUser?.role ?? "",
              "x-tenant-id": authUser?.tenantId ?? "",
              "x-user-id": authUser?.id ?? "",
            });
            setToast({ message: "Conductor creado correctamente.", variant: "success" });
            window.setTimeout(() => {
              router.back();
            }, 900);
          } catch (error) {
            setToast({ message: "No se pudo guardar el conductor.", variant: "error" });
            throw error;
          }
        }}
      />
    </section>
  );
}
