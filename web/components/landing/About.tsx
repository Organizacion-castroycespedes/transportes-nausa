import Image from "next/image";
import { Target, Eye, Heart } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Mision",
    description:
      "Proveer soluciones integrales de transporte terrestre de carga, garantizando la seguridad, eficiencia y cumplimiento en cada operacion, contribuyendo al desarrollo economico de la region Caribe y del pais.",
  },
  {
    icon: Eye,
    title: "Vision",
    description:
      "Ser la empresa de transporte de carga terrestre lider en la Costa Caribe colombiana, reconocida por su confiabilidad, innovacion en procesos logisticos y compromiso con el desarrollo sostenible.",
  },
  {
    icon: Heart,
    title: "Valores",
    description:
      "Responsabilidad, puntualidad, seguridad, integridad y compromiso con nuestros clientes. Cada carga es nuestra prioridad, cada cliente merece nuestro mejor servicio.",
  },
];

export const About = () => {
  return (
    <section id="nosotros" className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold tracking-wide text-primary uppercase">
              Nosotros
            </span>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Conectando destinos desde 2006
            </h2>
            <p className="mt-6 text-pretty leading-relaxed text-muted-foreground">
              <strong className="text-foreground">TRANSPORTES NAUSA LTDA.</strong>{" "}
              es una empresa legalmente constituida, dedicada al transporte de
              carga por carretera (CIIU 4923), con sede en Malambo, Atlantico.
              Desde nuestra fundacion, hemos construido una solida reputacion en
              el sector logistico de la Costa Caribe colombiana.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Nuestro equipo de profesionales y nuestra flota de vehiculos nos
              permiten ofrecer un servicio integral de transporte terrestre,
              cumpliendo con la normatividad vigente y los mas altos estandares
              de calidad, seguridad y puntualidad.
            </p>

            <div className="mt-8 flex flex-wrap gap-6">
              <div className="rounded-xl border border-border bg-muted px-6 py-4 text-center">
                <p className="text-3xl font-bold text-primary">18+</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Anos de experiencia
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted px-6 py-4 text-center">
                <p className="text-3xl font-bold text-primary">100%</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Empresa habilitada
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted px-6 py-4 text-center">
                <p className="text-3xl font-bold text-primary">Costa</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Caribe y nacional
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl">
              <Image
                src="/images/about-team.jpg"
                alt="Flota de camiones de Transportes Nausa"
                width={640}
                height={480}
                className="h-auto w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-border bg-card p-5 shadow-lg lg:block">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                NIT
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">900078756-1</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sociedad Limitada
              </p>
            </div>
          </div>
        </div>

        <div className="mt-24 grid gap-8 md:grid-cols-3">
          {values.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-card-foreground">
                  {item.title}
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
