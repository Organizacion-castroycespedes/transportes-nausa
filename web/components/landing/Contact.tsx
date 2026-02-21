"use client";

import { useState } from "react";
import { Mail, MapPin, Phone, Send } from "lucide-react";

const contactInfo = [
  {
    icon: Phone,
    label: "Telefonos",
    value: "313 531 6370 / 304 116 3311",
    href: "tel:+573135316370",
  },
  {
    icon: Mail,
    label: "Correo electronico",
    value: "transnausa@hotmail.com",
    href: "mailto:transnausa@hotmail.com",
  },
  {
    icon: MapPin,
    label: "Direccion",
    value: "Carrera 39 #8-59, Malambo, Atlantico",
    href: "https://maps.google.com/?q=Malambo+Atlantico+Colombia",
  },
];

export const Contact = () => {
  const [formData, setFormData] = useState({
    nombre: "",
    empresa: "",
    telefono: "",
    email: "",
    mensaje: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const whatsappMessage = encodeURIComponent(
      `Hola, soy ${formData.nombre} de ${formData.empresa}.\n\n${formData.mensaje}\n\nContacto: ${formData.telefono} / ${formData.email}`
    );
    window.open(
      `https://wa.me/573135316370?text=${whatsappMessage}`,
      "_blank"
    );
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <section id="contacto" className="bg-muted py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold tracking-wide text-primary uppercase">
            Contacto
          </span>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Hablemos de su proxima carga
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Complete el formulario y nos pondremos en contacto con usted a la
            brevedad. Tambien puede comunicarse directamente por telefono o
            WhatsApp.
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-border bg-card p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="nombre"
                    className="block text-sm font-medium text-card-foreground"
                  >
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    required
                    value={formData.nombre}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 focus:outline-none"
                    placeholder="Su nombre"
                  />
                </div>
                <div>
                  <label
                    htmlFor="empresa"
                    className="block text-sm font-medium text-card-foreground"
                  >
                    Empresa
                  </label>
                  <input
                    type="text"
                    id="empresa"
                    name="empresa"
                    value={formData.empresa}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 focus:outline-none"
                    placeholder="Nombre de su empresa"
                  />
                </div>
                <div>
                  <label
                    htmlFor="telefono"
                    className="block text-sm font-medium text-card-foreground"
                  >
                    Telefono
                  </label>
                  <input
                    type="tel"
                    id="telefono"
                    name="telefono"
                    required
                    value={formData.telefono}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 focus:outline-none"
                    placeholder="300 000 0000"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-card-foreground"
                  >
                    Correo electronico
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 focus:outline-none"
                    placeholder="correo@empresa.com"
                  />
                </div>
              </div>
              <div className="mt-5">
                <label
                  htmlFor="mensaje"
                  className="block text-sm font-medium text-card-foreground"
                >
                  Mensaje
                </label>
                <textarea
                  id="mensaje"
                  name="mensaje"
                  rows={4}
                  required
                  value={formData.mensaje}
                  onChange={handleChange}
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 focus:outline-none"
                  placeholder="Describa el tipo de carga, ruta y cualquier detalle relevante..."
                />
              </div>
              <button
                type="submit"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {submitted ? "Mensaje enviado" : "Enviar Mensaje"}
              </button>
              {submitted && (
                <p className="mt-3 text-sm text-secondary">
                  Se abrira WhatsApp con su mensaje. Gracias por contactarnos.
                </p>
              )}
            </form>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-2">
            {contactInfo.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.icon === MapPin ? "_blank" : undefined}
                  rel={item.icon === MapPin ? "noopener noreferrer" : undefined}
                  className="group flex gap-4 rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/20 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.value}
                    </p>
                  </div>
                </a>
              );
            })}

            <div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-6">
              <h3 className="font-bold text-foreground">Horario de atencion</h3>
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Lunes a Viernes</span>
                  <span className="font-medium text-foreground">
                    7:00 AM - 6:00 PM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sabados</span>
                  <span className="font-medium text-foreground">
                    7:00 AM - 1:00 PM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Domingos y festivos</span>
                  <span className="font-medium text-foreground">Cerrado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
