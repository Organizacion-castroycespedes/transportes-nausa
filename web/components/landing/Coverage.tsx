import { MapPin, CheckCircle2 } from "lucide-react";

const regions = [
  {
    name: "Atlantico",
    description: "Sede principal en Malambo. Cobertura total del departamento.",
    highlight: true,
  },
  {
    name: "Bolivar",
    description: "Cartagena y principales municipios del departamento.",
    highlight: false,
  },
  {
    name: "Magdalena",
    description: "Santa Marta, Cienaga y corredor logistico del norte.",
    highlight: false,
  },
  {
    name: "Cesar",
    description: "Valledupar y principales centros industriales.",
    highlight: false,
  },
  {
    name: "Sucre",
    description: "Sincelejo y rutas del interior de la Costa Caribe.",
    highlight: false,
  },
  {
    name: "Cordoba",
    description: "Monteria y conexion con el interior del pais.",
    highlight: false,
  },
];

export const Coverage = () => {
  return (
    <section id="cobertura" className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold tracking-wide text-primary uppercase">
              Cobertura
            </span>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Presencia en toda la Costa Caribe
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Con sede en Malambo, Atlantico, nuestra red de operaciones
              conecta los principales centros industriales y comerciales de
              la region Caribe colombiana, con capacidad de expansion a rutas
              nacionales.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {regions.map((region) => (
                <div
                  key={region.name}
                  className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
                    region.highlight
                      ? "border-primary/30 bg-accent"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin
                      className={`h-5 w-5 ${
                        region.highlight ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <h3
                      className={`font-bold ${
                        region.highlight ? "text-accent-foreground" : "text-card-foreground"
                      }`}
                    >
                      {region.name}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {region.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-28">
            <div className="overflow-hidden rounded-2xl border border-border">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3916.123!2d-74.783!3d10.855!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8ef5d33b0e3d0001%3A0x0!2sMalambo%2C%20Atl%C3%A1ntico%2C%20Colombia!5e0!3m2!1ses!2sco!4v1700000000000"
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicacion de Transportes Nausa en Malambo, Atlantico"
                className="w-full"
              />
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h3 className="font-bold text-card-foreground">Sede Principal</h3>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <span>Carrera 39 #8-59, Malambo, Atlantico</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <span>Operacion habilitada por el Ministerio de Transporte</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <span>Cobertura regional e interdepartamental</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
