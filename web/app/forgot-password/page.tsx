"use client";

import { useState } from "react";
import { Button } from "../../components/design-system/Button";
import { Input } from "../../components/design-system/Input";
import { forgotPassword } from "../../domains/auth/api";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }
    setError(null);
    try {
      await forgotPassword({ email });
      setSubmitted(true);
    } catch (requestError) {
      setError("No fue posible enviar el correo de recuperación.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            TN
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-card-foreground">
              Transportes
            </p>
            <p className="text-sm font-bold leading-tight text-primary">
              NAUSA LTDA
            </p>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-card-foreground">
          Recuperar contrasena
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresa tu email y te enviaremos un enlace para restablecer tu contrasena.
        </p>
        {submitted ? (
          <div className="mt-6 rounded-lg bg-secondary/10 p-4">
            <p className="text-sm text-foreground">
              Si el email existe, recibiras un enlace de recuperacion.
            </p>
          </div>
        ) : (
          <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.com"
            />
            {error ? <p className="text-sm text-primary">{error}</p> : null}
            <Button type="submit" variant="primary" size="lg">
              Enviar enlace
            </Button>
          </form>
        )}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Volver al inicio de sesion
          </a>
        </div>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
