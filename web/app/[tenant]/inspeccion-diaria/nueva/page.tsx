"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InspeccionWizard } from "../../../../domains/inspecciones/InspeccionWizard";
import { createInspeccion } from "../../../../domains/inspecciones/api";
import { Button } from "../../../../components/design-system/Button";

export default function NuevaInspeccionPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Nueva inspeccion diaria</h1>
            <p className="text-sm text-slate-500">Completa el encabezado y el chequeo preoperacional.</p>
          </div>
          <Link href={`/${params.tenant}/inspeccion-diaria`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Cancelar
            </Button>
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Precarga automatica</p>
            <p className="mt-1 text-sm text-emerald-900">
              El encabezado intenta cargar conductor, documento y placa desde el perfil del conductor logueado.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Operacion</p>
            <p className="mt-1 text-sm text-slate-700">
              Completa el manifiesto, destino y chequeo. Puedes guardar borrador antes de finalizar.
            </p>
          </div>
        </div>
      </div>
      <InspeccionWizard
        onSave={async (payload) => {
          const created = await createInspeccion(payload);
          router.replace(`/${params.tenant}/inspeccion-diaria/${created.id}?created=1`);
          return created;
        }}
      />
    </section>
  );
}
