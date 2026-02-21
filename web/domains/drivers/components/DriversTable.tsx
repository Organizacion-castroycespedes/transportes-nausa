"use client";

import Link from "next/link";
import type { DriverResponse } from "../types";

type Props = {
  tenant: string;
  drivers: DriverResponse[];
};

export const DriversTable = ({ tenant, drivers }: Props) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-4 py-2 text-left">Conductor</th>
          <th className="px-4 py-2 text-left">Licencia</th>
          <th className="px-4 py-2 text-left">Estado</th>
          <th className="px-4 py-2 text-left">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map((driver) => (
          <tr key={driver.id} className="border-t border-slate-100">
            <td className="px-4 py-2">{driver.persona.nombres} {driver.persona.apellidos}</td>
            <td className="px-4 py-2">{driver.licenciaNumero} ({driver.licenciaCategoria})</td>
            <td className="px-4 py-2">{driver.estado}</td>
            <td className="px-4 py-2">
              <Link className="text-blue-600" href={`/${tenant}/configuracion/conductores/${driver.id}/editar`}>
                Editar
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
