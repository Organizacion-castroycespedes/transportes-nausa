ALTER TABLE IF EXISTS public.conductores
  ADD COLUMN IF NOT EXISTS vehiculo_placa VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vehiculo_tipo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehiculo_marca VARCHAR(80),
  ADD COLUMN IF NOT EXISTS vehiculo_modelo VARCHAR(80);

UPDATE public.conductores
SET vehiculo_placa = UPPER(BTRIM(vehiculo_placa))
WHERE vehiculo_placa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conductores_tenant_vehiculo_placa
  ON public.conductores (tenant_id, vehiculo_placa)
  WHERE vehiculo_placa IS NOT NULL;
