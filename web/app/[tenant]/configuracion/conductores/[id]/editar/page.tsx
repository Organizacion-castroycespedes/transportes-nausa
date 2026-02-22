"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DriverForm } from "../../../../../../domains/drivers/components/DriverForm";
import { getDriver, updateDriver } from "../../../../../../domains/drivers/api";
import type { DriverResponse } from "../../../../../../domains/drivers/types";
import { useAppSelector } from "../../../../../../store/hooks";

export default function EditarConductorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);
  const [driver, setDriver] = useState<DriverResponse | null>(null);

  useEffect(() => {
    void getDriver(params.id, {
      "x-user-role": authUser?.role ?? "",
      "x-tenant-id": authUser?.tenantId ?? "",
      "x-user-id": authUser?.id ?? "",
    }).then(setDriver);
  }, [authUser, params.id]);

  if (!driver) return <p>Cargando...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar conductor</h1>
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
          await updateDriver(params.id, payload as any, {
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
