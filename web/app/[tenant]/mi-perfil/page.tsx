"use client";

import { useEffect, useState } from "react";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { DriverForm } from "../../../domains/drivers/components/DriverForm";
import { getMyDriver, updateMyDriver } from "../../../domains/drivers/api";
import type { DriverResponse } from "../../../domains/drivers/types";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { useAppSelector } from "../../../store/hooks";

export default function MiPerfilConductorPage() {
  const authUser = useAppSelector((state) => state.auth.user);
  const [driver, setDriver] = useState<DriverResponse | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);

  useAutoClearState(toast, setToast);

  useEffect(() => {
    void getMyDriver({
      "x-user-role": authUser?.role ?? "",
      "x-tenant-id": authUser?.tenantId ?? "",
      "x-user-id": authUser?.id ?? "",
    }).then(setDriver);
  }, [authUser]);

  if (!driver) {
    return <p>Cargando perfil...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mi perfil de conductor</h1>
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
            await updateMyDriver(payload as any, {
              "x-user-role": authUser?.role ?? "",
              "x-tenant-id": authUser?.tenantId ?? "",
              "x-user-id": authUser?.id ?? "",
            });
            setToast({ message: "Perfil actualizado correctamente.", variant: "success" });
          } catch (error) {
            setToast({ message: "No se pudo guardar el perfil.", variant: "error" });
            throw error;
          }
        }}
      />
    </div>
  );
}
