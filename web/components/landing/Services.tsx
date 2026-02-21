import Image from "next/image";
import { Truck, MapPin, Package, FileCheck, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Truck,
    title: "Transporte de Carga General",
    description:
      "Movilizamos todo tipo de carga general con vehiculos adecuados para cada necesidad. Garantizamos la integridad de su mercancia desde el punto de origen hasta su destino final.",
  },
  {
    icon: MapPin,
    title: "Transporte Regional",
    description:
      "Cobertura integral en la Costa Caribe colombiana con rutas optimizadas entre las principales ciudades del Atlantico, Bolivar, Magdalena, Cesar y la region norte.",
  },
  {
    icon: Package,
    title: "Logistica Terrestre",
    description:
      "Soluciones logisticas integrales que incluyen planificacion de rutas, coordinacion de entregas, seguimiento de carga y gestion documental para su tranquilidad.",
  },
  {
    icon: FileCheck,
    title: "Cumplimiento Normativo",
    description:
      "Operamos bajo estricto cumplimiento de la normatividad colombiana vigente en transporte de carga. Documentacion legal, seguros y permisos al dia.",
  },
];

export const Services = () => {
  return (
    <section id="servicios" className="bg-muted py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold tracking-wide text-primary uppercase">
            Nuestros servicios
          </span>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Soluciones de transporte a su medida
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Ofrecemos un portafolio completo de servicios de transporte terrestre
            de carga, respaldados por experiencia, flota propia y cumplimiento
            normativo.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.title}
                className="group flex gap-5 rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/20 hover:shadow-md"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-card-foreground">
                    {service.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid items-center gap-0 lg:grid-cols-2">
            <div className="relative h-64 lg:h-full">
              <Image
                src="/images/logistics-warehouse.jpg"
                alt="Almacen logistico con camiones de carga"
                fill
                className="object-cover"
              />
            </div>
            <div className="p-8 lg:p-12">
              <h3 className="text-2xl font-bold text-card-foreground">
                Necesita un servicio personalizado?
              </h3>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Entendemos que cada operacion tiene requerimientos unicos.
                Contactenos para disenar una solucion de transporte adaptada a
                las necesidades especificas de su empresa.
              </p>
              <a
                href="#contacto"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Solicitar Cotizacion
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
