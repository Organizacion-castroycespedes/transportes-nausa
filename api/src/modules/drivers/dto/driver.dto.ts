export type DriverPersonaDto = {
  nombres: string;
  apellidos: string;
  documentoTipo: string;
  documentoNumero: string;
  telefono?: string | null;
  direccion?: string | null;
  emailPersonal?: string | null;
};

export type CreateDriverDto = {
  email: string;
  password: string;
  estado?: "ACTIVE" | "INACTIVE" | "BLOCKED";
  licenciaNumero?: string | null;
  licenciaCategoria?: string | null;
  licenciaVencimiento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  persona: DriverPersonaDto;
};

export type UpdateDriverDto = {
  email?: string;
  licenciaNumero?: string | null;
  licenciaCategoria?: string | null;
  licenciaVencimiento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  persona?: Partial<DriverPersonaDto>;
};

export type UpdateDriverStatusDto = {
  estado: "A" | "I";
};

export type DriverResponseDto = {
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
