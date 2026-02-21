"use client";

import { useEffect, useState } from "react";
import { DriverForm } from "../../../domains/drivers/components/DriverForm";
import { getMyDriver, updateMyDriver } from "../../../domains/drivers/api";
import type { DriverResponse } from "../../../domains/drivers/types";
import { useAppSelector } from "../../../store/hooks";

export default function MiPerfilConductorPage() {
  const authUser = useAppSelector((state) => state.auth.user);
  const [driver, setDriver] = useState<DriverResponse | null>(null);

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
      <DriverForm
        initial={{
          email: driver.userEmail,
          licenciaNumero: driver.licenciaNumero ?? "",
          licenciaCategoria: driver.licenciaCategoria ?? "",
          licenciaVencimiento: driver.licenciaVencimiento ?? "",
          telefono: driver.telefono ?? "",
          direccion: driver.direccion ?? "",
          persona: {
            nombres: driver.persona.nombres ?? "",
            apellidos: driver.persona.apellidos ?? "",
            documentoTipo: driver.persona.documentoTipo ?? "CC",
            documentoNumero: driver.persona.documentoNumero ?? "",
          },
        }}
        onSubmit={async (payload) => {
          await updateMyDriver(payload as any, {
            "x-user-role": authUser?.role ?? "",
            "x-tenant-id": authUser?.tenantId ?? "",
            "x-user-id": authUser?.id ?? "",
          });
        }}
      />
    </div>
  );
}
