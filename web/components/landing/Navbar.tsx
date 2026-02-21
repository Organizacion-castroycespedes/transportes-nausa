"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";

const navLinks = [
  { label: "Inicio", href: "#inicio" },
  { label: "Nosotros", href: "#nosotros" },
  { label: "Servicios", href: "#servicios" },
  { label: "Cobertura", href: "#cobertura" },
  { label: "Contacto", href: "#contacto" },
];

export const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Transportes Nausa - Inicio">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-sans text-lg font-bold text-primary-foreground">
            TN
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold leading-tight text-foreground">
              Transportes
            </p>
            <p className="text-sm font-bold leading-tight text-primary">
              NAUSA LTDA
            </p>
          </div>
        </Link>

        <ul className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 md:flex">
          <a
            href="tel:+573135316370"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone className="h-4 w-4" />
            <span>313 531 6370</span>
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Iniciar sesion
          </Link>
          <a
            href="#contacto"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Cotizar
          </a>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {menuOpen && (
        <div className="border-t border-border bg-background px-6 pb-6 md:hidden">
          <ul className="flex flex-col gap-1 pt-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <a
              href="tel:+573135316370"
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4" />
              313 531 6370
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => setMenuOpen(false)}
            >
              Iniciar sesion
            </Link>
            <a
              href="#contacto"
              className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => setMenuOpen(false)}
            >
              Solicitar Cotizacion
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
