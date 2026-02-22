"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "../../../store/hooks";

const InspeccionDiariaRedirectPage = () => {
  const router = useRouter();
  const params = useParams<{ slug?: string[] }>();
  const tenantId = useAppSelector((state) => state.auth.tenantId);
  const authUserTenant = useAppSelector((state) => state.auth.user?.tenantId);
  const tenant = authUserTenant ?? tenantId;

  useEffect(() => {
    const suffix = params?.slug?.length ? `/${params.slug.join("/")}` : "";
    if (!tenant) {
      router.replace("/login");
      return;
    }
    router.replace(`/${tenant}/inspeccion-diaria${suffix}`);
  }, [params?.slug, router, tenant]);

  return <p className="p-6 text-sm text-slate-500">Redirigiendo a inspeccion diaria...</p>;
};

export default InspeccionDiariaRedirectPage;
