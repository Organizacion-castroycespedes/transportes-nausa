"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getInspeccion, updateInspeccion } from "../../../../../domains/inspecciones/api";
import { InspeccionWizard } from "../../../../../domains/inspecciones/InspeccionWizard";
import type { InspeccionDiaria } from "../../../../../domains/inspecciones/types";

export default function InspeccionDetallePage() {
  const params = useParams<{ id: string }>();
  const [inspeccion, setInspeccion] = useState<InspeccionDiaria | null>(null);

  useEffect(() => {
    void getInspeccion(params.id).then(setInspeccion);
  }, [params.id]);

  if (!inspeccion) {
    return <div className="rounded-xl border bg-white p-6">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inspección {inspeccion.placa}</h1>
      <InspeccionWizard initial={inspeccion} onSave={(payload) => updateInspeccion(inspeccion.id, payload)} />
    </div>
  );
}
