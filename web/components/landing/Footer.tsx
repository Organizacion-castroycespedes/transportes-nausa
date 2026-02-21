import { Phone, Mail, MapPin } from "lucide-react";

const footerLinks = {
  navegacion: [
    { label: "Inicio", href: "#inicio" },
    { label: "Nosotros", href: "#nosotros" },
    { label: "Servicios", href: "#servicios" },
    { label: "Cobertura", href: "#cobertura" },
    { label: "Contacto", href: "#contacto" },
  ],
  servicios: [
    { label: "Carga General", href: "#servicios" },
    { label: "Transporte Regional", href: "#servicios" },
    { label: "Logistica Terrestre", href: "#servicios" },
    { label: "Cumplimiento Normativo", href: "#servicios" },
  ],
};

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                TN
              </div>
              <div>
                <p className="text-sm font-bold leading-tight text-background">
                  Transportes
                </p>
                <p className="text-sm font-bold leading-tight text-primary">
                  NAUSA LTDA
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-background/70">
              Transporte seguro y confiable de carga por carretera en la Costa
              Caribe colombiana. Empresa legalmente constituida y habilitada.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-background uppercase">
              Navegacion
            </h3>
            <ul className="mt-4 flex flex-col gap-3">
              {footerLinks.navegacion.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-background/70 transition-colors hover:text-background"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-background uppercase">
              Servicios
            </h3>
            <ul className="mt-4 flex flex-col gap-3">
              {footerLinks.servicios.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-background/70 transition-colors hover:text-background"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-background uppercase">
              Contacto
            </h3>
            <ul className="mt-4 flex flex-col gap-4">
              <li>
                <a
                  href="tel:+573135316370"
                  className="flex items-start gap-3 text-sm text-background/70 transition-colors hover:text-background"
                >
                  <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    313 531 6370
                    <br />
                    304 116 3311
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:transnausa@hotmail.com"
                  className="flex items-start gap-3 text-sm text-background/70 transition-colors hover:text-background"
                >
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  transnausa@hotmail.com
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-sm text-background/70">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Cra 39 #8-59
                    <br />
                    Malambo, Atlantico
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-background/10 pt-8 md:flex-row">
          <p className="text-xs text-background/50">
            TRANSPORTES NAUSA LTDA. | NIT 900078756-1 | Sociedad Limitada
          </p>
          <p className="text-xs text-background/50">
            Todos los derechos reservados {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
};
