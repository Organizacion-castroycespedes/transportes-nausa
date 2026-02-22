"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listInspecciones } from "../../../domains/inspecciones/api";
import type { InspeccionDiaria } from "../../../domains/inspecciones/types";
import { useParams } from "next/navigation";

export default function InspeccionDiariaPage() {
  const params = useParams<{ tenant: string }>();
  const [rows, setRows] = useState<InspeccionDiaria[]>([]);

  useEffect(() => {
    void listInspecciones().then(setRows);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Inspección diaria</h1>
            <p className="mt-2 text-sm text-slate-500">Chequeo preoperacional digital.</p>
          </div>
          <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" href={`/${params.tenant}/inspeccion-diaria/nueva`}>Nueva inspección</Link>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead><tr><th>Fecha</th><th>Placa</th><th>Conductor</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td>{row.fecha.slice(0, 10)}</td>
                <td>{row.placa}</td>
                <td>{row.conductor}</td>
                <td>{row.estado}</td>
                <td><Link className="text-blue-600" href={`/${params.tenant}/inspeccion-diaria/${row.id}`}>Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
