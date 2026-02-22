"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getInspeccion, updateInspeccion } from "../../../../domains/inspecciones/api";
import { InspeccionWizard } from "../../../../domains/inspecciones/InspeccionWizard";
import type { InspeccionDiaria } from "../../../../domains/inspecciones/types";
import { ApiError } from "../../../../lib/request";
import { Toast } from "../../../../components/design-system/Toast";
import { Button } from "../../../../components/design-system/Button";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { useAppSelector } from "../../../../store/hooks";

export default function InspeccionDetallePage() {
  const params = useParams<{ id: string; tenant: string }>();
  const searchParams = useSearchParams();
  const authUser = useAppSelector((state) => state.auth.user);
  const [inspeccion, setInspeccion] = useState<InspeccionDiaria | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useAutoClearState(successMessage, setSuccessMessage, 7000);

  const isFreshCreate = useMemo(() => searchParams.get("created") === "1", [searchParams]);
  const canEditFinalized = authUser?.role === "ADMIN" || authUser?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isFreshCreate) {
      return;
    }
    setSuccessMessage("Inspeccion creada correctamente. Ya puedes continuar con el detalle.");
  }, [isFreshCreate]);

  useEffect(() => {
    let active = true;
    setError(null);
    void getInspeccion(params.id)
      .then((data) => {
        if (!active) return;
        setInspeccion(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError) {
          setError(`${err.message} (${err.status})`);
          return;
        }
        setError("No fue posible cargar la inspeccion.");
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  if (error) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-red-600 shadow-sm">{error}</div>;
  }

  if (!inspeccion) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Cargando inspeccion...
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {successMessage ? (
        <div className="space-y-2">
          <Toast message={successMessage} variant="success" onClose={() => setSuccessMessage(null)} />
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500" aria-hidden="true" />
            Proceso de creacion finalizado con exito
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Inspeccion {inspeccion.placa}</h1>
            <p className="text-sm text-slate-500">Estado actual: {inspeccion.estado}</p>
          </div>
          <Link href={`/${params.tenant}/inspeccion-diaria`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Volver al listado
            </Button>
          </Link>
        </div>
      </div>

      <InspeccionWizard
        initial={inspeccion}
        canEditFinalized={canEditFinalized}
        onSave={(payload) => updateInspeccion(inspeccion.id, payload)}
      />
    </section>
  );
}
