export type RespuestaPayloadDto = {
  itemId: string;
  respuesta: "SI" | "NO" | "NA";
  observacion?: string;
};

export type UpsertInspeccionDiariaDto = {
  placa: string;
  conductor: string;
  cedula?: string;
  fecha: string;
  numeroManifiesto?: string;
  destino?: string;
  puntoCritico?: boolean;
  hallazgos?: string;
  accionesCorrectivas?: string;
  respuestas: RespuestaPayloadDto[];
};

export type InspeccionItemDto = {
  id: string;
  seccion: string;
  codigo: string;
  descripcion: string;
  orden: number;
  activo: boolean;
};

export type InspeccionRespuestaDto = {
  itemId: string;
  respuesta: "SI" | "NO" | "NA";
  observacion: string | null;
};

export type InspeccionDiariaResponseDto = {
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
  respuestas: InspeccionRespuestaDto[];
};
