import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { FormConvite } from "./FormConvite";

export default async function ConvitePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const { profile, bancoDesatualizado } = await getProfile();
  // Quem já tem organização (ou é ADM) não usa convite
  if (profile.role === "admin" || profile.organizacao_id || bancoDesatualizado) redirect("/");
  return <FormConvite nome={profile.nome || profile.email || ""} codigoDoLink={c ?? ""} />;
}
