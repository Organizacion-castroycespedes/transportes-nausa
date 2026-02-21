"use client";

import { Suspense, useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/design-system/Button";
import { Input } from "../../components/design-system/Input";
import { Modal } from "../../components/design-system/Modal";
import { Toast, type ToastVariant } from "../../components/design-system/Toast";
import { forceLogin, login } from "../../domains/auth/api";
import { decodeTokenPayload } from "../../domains/auth/jwt";
import {
  startSessionFromLogin,
} from "../../domains/auth/session-manager";
import { hasRefreshTokenStorage } from "../../domains/auth/session";
import { ApiError } from "../../lib/request";
import { useAutoClearState } from "../../lib/useAutoClearState";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAuthStatus } from "../../store/authSlice";

const LoginPageContent = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isHuman, setIsHuman] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [status, setStatus] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const tenantId = useAppSelector((state) => state.auth.tenantId);
  useAutoClearState(status, setStatus, 12000);

  const setStatusMessage = (message: string, variant: ToastVariant) => {
    setStatus({ message, variant });
  };
  const setStatusSuccess = (message: string) =>
    setStatusMessage(message, "success");
  const setStatusError = (message: string) => setStatusMessage(message, "error");
  const setStatusWarning = (message: string) =>
    setStatusMessage(message, "warning");

  useEffect(() => {
    if (status) {
      return;
    }
    if (searchParams?.get("reason") === "session-ended") {
      setStatusWarning(
        "Tu sesión expiró o fue cerrada en otro dispositivo. Inicia sesión nuevamente."
      );
    }
  }, [searchParams, status]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    const targetTenant = tenantId ?? "default";
    setStatusWarning("Ya existe una sesión activa en este navegador.");
    router.replace(`/${targetTenant}/dashboard`);
  }, [authStatus, router, tenantId]);

  const handleSocialLogin = (provider: "google" | "facebook") => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
    const target = baseUrl ? `${baseUrl}/auth/${provider}` : `/auth/${provider}`;
    setStatusSuccess(
      `Redirigiendo a ${provider === "google" ? "Google" : "Facebook"}...`
    );
    window.location.href = target;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (!email.trim() || !password.trim()) {
      setStatusWarning("Ingresa tu email y contraseña.");
      return;
    }
    if (!isHuman) {
      setStatusWarning("Confirma el reCAPTCHA antes de continuar.");
      return;
    }
    if (authStatus === "authenticated") {
      setStatusWarning("Ya existe una sesión activa en este navegador.");
      return;
    }
    if (authStatus === "authenticating" || authStatus === "refreshing") {
      setStatusWarning("Estamos procesando otra autenticación. Intenta de nuevo.");
      return;
    }
    setStatus(null);
    setIsSubmitting(true);
    dispatch(setAuthStatus("authenticating"));
    try {
      const tokens = await login({ email, password });
      const tokenPayload = decodeTokenPayload(tokens.accessToken);
      const tenantSlug = tokenPayload?.tenant_id ?? "default";
      await startSessionFromLogin(tokens, {
        fallbackEmail: email,
        persistRefresh: rememberMe && hasRefreshTokenStorage(),
      });
      setStatusSuccess("Inicio de sesión exitoso. Redirigiendo...");
      router.push(`/${tenantSlug}/dashboard`);
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.status === 409 &&
        (!requestError.code || requestError.code === "SESSION_ACTIVE")
      ) {
        setPendingCredentials({ email, password });
        setShowSessionConflict(true);
        setStatusWarning(
          "Ya existe una sesión activa. Puedes cerrarla y continuar aquí."
        );
        return;
      }
      dispatch(setAuthStatus("error"));
      setStatusError("No fue posible iniciar sesión. Revisa tus credenciales.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceLogin = useCallback(async () => {
    if (!pendingCredentials) {
      setShowSessionConflict(false);
      return;
    }
    setIsSubmitting(true);
    dispatch(setAuthStatus("authenticating"));
    try {
      const tokens = await forceLogin(pendingCredentials);
      const tokenPayload = decodeTokenPayload(tokens.accessToken);
      const tenantSlug = tokenPayload?.tenant_id ?? "default";
      await startSessionFromLogin(tokens, {
        fallbackEmail: pendingCredentials.email,
        persistRefresh: rememberMe && hasRefreshTokenStorage(),
      });
      setShowSessionConflict(false);
      setPendingCredentials(null);
      setStatusSuccess("Sesión anterior cerrada. Redirigiendo...");
      router.push(`/${tenantSlug}/dashboard`);
    } catch {
      dispatch(setAuthStatus("error"));
      setStatusError("No fue posible iniciar sesión. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, pendingCredentials, rememberMe, router]);

  const handleCancelForceLogin = useCallback(() => {
    setShowSessionConflict(false);
    setPendingCredentials(null);
    setStatusWarning("Inicio de sesión cancelado.");
  }, []);

  return (
    <main className="flex min-h-screen bg-background">
      {showSessionConflict ? (
        <Modal title="Sesion activa detectada">
          <p className="text-sm text-muted-foreground">
            Ya existe una sesion activa en otro dispositivo o navegador. Si
            continuas aqui, la sesion anterior se cerrara automaticamente.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleForceLogin} disabled={isSubmitting}>
              {isSubmitting ? "Procesando..." : "Cerrar la otra sesion"}
            </Button>
            <Button variant="outline" onClick={handleCancelForceLogin}>
              Cancelar
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* Left panel - branding */}
      <div className="relative hidden w-1/2 overflow-hidden bg-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0">
          <img
            src="/images/hero-truck.jpg"
            alt=""
            className="h-full w-full object-cover opacity-30"
          />
        </div>
        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3" aria-label="Volver al inicio">
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
          </Link>

          <div className="max-w-md">
            <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-background">
              Transporte seguro y confiable en la Costa Caribe
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-background/70">
              Mas de 18 anos conectando la industria colombiana con soluciones de
              transporte terrestre de carga eficientes, seguras y puntuales.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-background/10 bg-background/5 px-4 py-2 backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-secondary" />
                <span className="text-sm font-medium text-background/80">Empresa habilitada</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-background/10 bg-background/5 px-4 py-2 backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-secondary" />
                <span className="text-sm font-medium text-background/80">Flota propia</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-background/40">
            TRANSPORTES NAUSA LTDA. | NIT 900078756-1
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-3" aria-label="Volver al inicio">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                TN
              </div>
              <div>
                <p className="text-sm font-bold leading-tight text-foreground">
                  Transportes
                </p>
                <p className="text-sm font-bold leading-tight text-primary">
                  NAUSA LTDA
                </p>
              </div>
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              Volver al inicio
            </Link>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Iniciar sesion
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          {status ? (
            <div className="mt-5">
              <Toast
                message={status.message}
                variant={status.variant}
                onClose={() => setStatus(null)}
              />
            </div>
          ) : null}

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.com"
              required
            />
            <Input
              label="Contrasena"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
            />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Recordarme
              </label>
              <Link
                href="/forgot-password"
                className="font-medium text-primary transition-colors hover:text-primary/80"
              >
                Olvidaste tu contrasena?
              </Link>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isHuman}
                onChange={(event) => setIsHuman(event.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              No soy un robot
            </label>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
            {hasSubmitted && !isHuman ? (
              <p className="text-xs text-primary">
                Debes completar el reCAPTCHA antes de continuar.
              </p>
            ) : null}
          </form>

          <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>O inicia con</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => handleSocialLogin("google")}>
              Google
            </Button>
            <Button variant="outline" onClick={() => handleSocialLogin("facebook")}>
              Facebook
            </Button>
          </div>

          {/* Desktop back link */}
          <div className="mt-8 hidden text-center lg:block">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

const LoginPage = () => {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <LoginPageContent />
    </Suspense>
  );
};

export default LoginPage;
