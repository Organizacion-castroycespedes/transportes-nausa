export type DriverResponse = {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userEstado: string;
  licenciaNumero: string | null;
  licenciaCategoria: string | null;
  licenciaVencimiento: string | null;
  telefono: string | null;
  direccion: string | null;
  vehiculoPlaca: string | null;
  vehiculoTipo: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  estado: string;
  persona: {
    id: string | null;
    nombres: string | null;
    apellidos: string | null;
    documentoTipo: string | null;
    documentoNumero: string | null;
    telefono: string | null;
    direccion: string | null;
    emailPersonal: string | null;
  };
};

export type CreateDriverPayload = {
  email: string;
  password: string;
  licenciaNumero?: string;
  licenciaCategoria?: string;
  licenciaVencimiento?: string;
  telefono?: string;
  direccion?: string;
  vehiculoPlaca?: string;
  vehiculoTipo?: string;
  vehiculoMarca?: string;
  vehiculoModelo?: string;
  persona: {
    nombres: string;
    apellidos: string;
    documentoTipo: string;
    documentoNumero: string;
    telefono?: string;
    direccion?: string;
    emailPersonal?: string;
  };
};

export type UpdateDriverPayload = Partial<Omit<CreateDriverPayload, "password">>;
