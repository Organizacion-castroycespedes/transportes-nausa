"use client";

import Link from "next/link";
import { Button } from "../../../components/design-system/Button";
import type { DriverResponse } from "../types";

type Props = {
  tenant: string;
  drivers: DriverResponse[];
};

export const DriversTable = ({ tenant, drivers }: Props) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Conductor</th>
          <th className="px-4 py-3">Licencia</th>
          <th className="px-4 py-3">Vehiculo</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map((driver) => (
          <tr key={driver.id} className="border-t border-slate-100">
            <td className="px-4 py-3 text-slate-900">
              {driver.persona.nombres} {driver.persona.apellidos}
            </td>
            <td className="px-4 py-3 text-slate-700">
              {driver.licenciaNumero || "Sin licencia"}{" "}
              {driver.licenciaCategoria ? `(${driver.licenciaCategoria})` : ""}
            </td>
            <td className="px-4 py-3 text-slate-700">
              {driver.vehiculoPlaca || "Sin placa"}{" "}
              {driver.vehiculoTipo ? `(${driver.vehiculoTipo})` : ""}
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  driver.estado === "A"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {driver.estado === "A" ? "Activo" : "Inactivo"}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <Link href={`/${tenant}/configuracion/conductores/${driver.id}/editar`}>
                <Button variant="ghost" className="px-3 py-1.5 text-xs">
                  Editar
                </Button>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
