"use client";

import { useRouter, useParams } from "next/navigation";
import { InspeccionWizard } from "../../../../domains/inspecciones/InspeccionWizard";
import { createInspeccion } from "../../../../domains/inspecciones/api";

export default function NuevaInspeccionPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nueva inspección diaria</h1>
      <InspeccionWizard onSave={async (payload) => {
        const created = await createInspeccion(payload);
        router.replace(`/${params.tenant}/inspeccion-diaria/${created.id}`);
        return created;
      }} />
    </div>
  );
}
