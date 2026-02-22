"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import type { CreateDriverPayload, UpdateDriverPayload } from "../types";

type Props = {
  initial?: Partial<CreateDriverPayload>;
  includePassword?: boolean;
  onSubmit: (payload: CreateDriverPayload | UpdateDriverPayload) => Promise<void>;
};

export const DriverForm = ({ initial, includePassword = false, onSubmit }: Props) => {
  const submit = async (formData: FormData) => {
    const payload: CreateDriverPayload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      licenciaNumero: String(formData.get("licenciaNumero") ?? ""),
      licenciaCategoria: String(formData.get("licenciaCategoria") ?? ""),
      licenciaVencimiento: String(formData.get("licenciaVencimiento") ?? ""),
      telefono: String(formData.get("telefono") ?? ""),
      direccion: String(formData.get("direccion") ?? ""),
      vehiculoPlaca: String(formData.get("vehiculoPlaca") ?? ""),
      vehiculoTipo: String(formData.get("vehiculoTipo") ?? ""),
      vehiculoMarca: String(formData.get("vehiculoMarca") ?? ""),
      vehiculoModelo: String(formData.get("vehiculoModelo") ?? ""),
      persona: {
        nombres: String(formData.get("nombres") ?? ""),
        apellidos: String(formData.get("apellidos") ?? ""),
        documentoTipo: String(formData.get("documentoTipo") ?? "CC"),
        documentoNumero: String(formData.get("documentoNumero") ?? ""),
      },
    };
    await onSubmit(payload);
  };

  return (
    <form action={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Input name="email" label="Email" defaultValue={initial?.email ?? ""} required />
      {includePassword ? <Input name="password" label="Password" type="password" required /> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input name="nombres" label="Nombres" defaultValue={initial?.persona?.nombres ?? ""} required />
        <Input name="apellidos" label="Apellidos" defaultValue={initial?.persona?.apellidos ?? ""} required />
        <Input name="documentoTipo" label="Tipo doc" defaultValue={initial?.persona?.documentoTipo ?? "CC"} required />
        <Input name="documentoNumero" label="Documento" defaultValue={initial?.persona?.documentoNumero ?? ""} required />
        <Input name="licenciaNumero" label="Licencia" defaultValue={initial?.licenciaNumero ?? ""} />
        <Input name="licenciaCategoria" label="Categoria" defaultValue={initial?.licenciaCategoria ?? ""} />
        <Input name="licenciaVencimiento" label="Vencimiento" type="date" defaultValue={initial?.licenciaVencimiento ?? ""} />
        <Input name="telefono" label="Telefono" defaultValue={initial?.telefono ?? ""} />
        <Input name="vehiculoPlaca" label="Placa vehiculo" defaultValue={initial?.vehiculoPlaca ?? ""} />
        <Input name="vehiculoTipo" label="Tipo vehiculo" defaultValue={initial?.vehiculoTipo ?? ""} />
        <Input name="vehiculoMarca" label="Marca vehiculo" defaultValue={initial?.vehiculoMarca ?? ""} />
        <Input name="vehiculoModelo" label="Modelo vehiculo" defaultValue={initial?.vehiculoModelo ?? ""} />
      </div>
      <Input name="direccion" label="Direccion" defaultValue={initial?.direccion ?? ""} />
      <Button type="submit">Guardar</Button>
    </form>
  );
};
