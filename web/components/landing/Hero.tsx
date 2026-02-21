import Image from "next/image";
import { ArrowRight, Shield, Truck, Clock } from "lucide-react";

export const Hero = () => {
  return (
    <section id="inicio" className="relative overflow-hidden pt-20">
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-truck.jpg"
          alt="Camion de carga en carretera colombiana"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-foreground/70" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 py-32 text-center lg:py-44">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-xs font-medium tracking-wide text-primary-foreground uppercase backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          Empresa habilitada en Colombia
        </span>

        <h1 className="mt-8 max-w-4xl text-balance text-4xl font-bold leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">
          Transporte seguro y confiable en la Costa Caribe
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-primary-foreground/80 md:text-xl">
          Mas de 18 anos conectando la industria colombiana con soluciones de
          transporte terrestre de carga eficientes, seguras y puntuales.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a
            href="#contacto"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
          >
            Solicitar Cotizacion
            <ArrowRight className="h-5 w-5" />
          </a>
          <a
            href="#servicios"
            className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/30 bg-primary-foreground/10 px-8 py-4 text-base font-semibold text-primary-foreground backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
          >
            Ver Servicios
          </a>
        </div>

        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-center gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 px-5 py-4 backdrop-blur-sm">
            <Shield className="h-5 w-5 shrink-0 text-secondary-foreground opacity-80" />
            <span className="text-sm font-medium text-primary-foreground/90">
              Empresa legalmente constituida
            </span>
          </div>
          <div className="flex items-center justify-center gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 px-5 py-4 backdrop-blur-sm">
            <Truck className="h-5 w-5 shrink-0 text-secondary-foreground opacity-80" />
            <span className="text-sm font-medium text-primary-foreground/90">
              Flota propia de vehiculos
            </span>
          </div>
          <div className="flex items-center justify-center gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 px-5 py-4 backdrop-blur-sm">
            <Clock className="h-5 w-5 shrink-0 text-secondary-foreground opacity-80" />
            <span className="text-sm font-medium text-primary-foreground/90">
              Entregas puntuales
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
