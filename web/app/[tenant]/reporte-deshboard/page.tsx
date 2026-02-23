import { redirect } from "next/navigation";

type PageProps = {
  params: { tenant: string };
};

export default function ReporteDeshboardAliasPage({ params }: PageProps) {
  const { tenant } = params;
  redirect(`/${tenant}/reporte-dashboard`);
}
