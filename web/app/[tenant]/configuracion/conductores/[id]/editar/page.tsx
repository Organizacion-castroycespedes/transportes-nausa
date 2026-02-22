"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DriverForm } from "../../../../../../domains/drivers/components/DriverForm";
import { getDriver, updateDriver } from "../../../../../../domains/drivers/api";
import type { DriverResponse } from "../../../../../../domains/drivers/types";
import { useAppSelector } from "../../../../../../store/hooks";
import { Button } from "../../../../../../components/design-system/Button";
import { Toast, type ToastVariant } from "../../../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../../../lib/useAutoClearState";

export default function EditarConductorPage() {
  const params = useParams<{ id: string; tenant: string }>();
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);
  const [driver, setDriver] = useState<DriverResponse | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);

  useAutoClearState(toast, setToast);

  useEffect(() => {
    void getDriver(params.id, {
      "x-user-role": authUser?.role ?? "",
      "x-tenant-id": authUser?.tenantId ?? "",
      "x-user-id": authUser?.id ?? "",
    }).then(setDriver);
  }, [authUser, params.id]);

  if (!driver) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Cargando conductor...
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Editar conductor</h1>
            <p className="text-sm text-slate-500">Actualiza la informacion del conductor y su vehiculo.</p>
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
        initial={{
          email: driver.userEmail,
          licenciaNumero: driver.licenciaNumero ?? "",
          licenciaCategoria: driver.licenciaCategoria ?? "",
          licenciaVencimiento: driver.licenciaVencimiento ?? "",
          telefono: driver.telefono ?? "",
          direccion: driver.direccion ?? "",
          vehiculoPlaca: driver.vehiculoPlaca ?? "",
          vehiculoTipo: driver.vehiculoTipo ?? "",
          vehiculoMarca: driver.vehiculoMarca ?? "",
          vehiculoModelo: driver.vehiculoModelo ?? "",
          persona: {
            nombres: driver.persona.nombres ?? "",
            apellidos: driver.persona.apellidos ?? "",
            documentoTipo: driver.persona.documentoTipo ?? "CC",
            documentoNumero: driver.persona.documentoNumero ?? "",
          },
        }}
        onSubmit={async (payload) => {
          try {
            await updateDriver(params.id, payload as any, {
              "x-user-role": authUser?.role ?? "",
              "x-tenant-id": authUser?.tenantId ?? "",
              "x-user-id": authUser?.id ?? "",
            });
            setToast({ message: "Conductor actualizado correctamente.", variant: "success" });
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
