import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Transportes Nausa Ltda. | Transporte de Carga por Carretera",
  description:
    "Transporte seguro y confiable de carga por carretera en la Costa Caribe colombiana. Empresa legalmente constituida con cobertura regional y nacional. NIT 900078756-1.",
  keywords: [
    "transporte de carga",
    "transporte terrestre",
    "logistica Colombia",
    "carga por carretera",
    "Costa Caribe",
    "Atlantico",
    "Malambo",
    "Transportes Nausa",
  ],
  openGraph: {
    title: "Transportes Nausa Ltda.",
    description:
      "Transporte seguro y confiable de carga por carretera en la Costa Caribe colombiana.",
    type: "website",
    locale: "es_CO",
  },
};

export const viewport: Viewport = {
  themeColor: "#C62828",
  width: "device-width",
  initialScale: 1,
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;
