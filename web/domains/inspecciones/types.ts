export type InspeccionItem = {
  id: string;
  seccion: string;
  codigo: string;
  descripcion: string;
  orden: number;
  activo: boolean;
};

export type InspeccionRespuesta = {
  itemId: string;
  respuesta: "SI" | "NO" | "NA";
  observacion: string | null;
};

export type InspeccionDiaria = {
  id: string;
  tenantId: string;
  placa: string;
  conductor: string;
  cedula: string | null;
  fecha: string;
  numeroManifiesto: string | null;
  destino: string | null;
  estado: "DRAFT" | "FINALIZED" | "REPORTED";
  puntoCritico: boolean;
  hallazgos: string | null;
  accionesCorrectivas: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  respuestas: InspeccionRespuesta[];
};

export type UpsertInspeccionDiariaPayload = {
  placa: string;
  conductor: string;
  cedula?: string;
  fecha: string;
  numeroManifiesto?: string;
  destino?: string;
  puntoCritico?: boolean;
  hallazgos?: string;
  accionesCorrectivas?: string;
  respuestas: Array<{
    itemId: string;
    respuesta: "SI" | "NO" | "NA";
    observacion?: string;
  }>;
};
