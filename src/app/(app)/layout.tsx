import { Cabecalho } from "@/components/Cabecalho";
import { RastreioProvider } from "@/components/rastreio/RastreioProvider";
import { getProfile } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getProfile();
  return (
    <RastreioProvider userId={profile.id}>
      <Cabecalho profile={profile} />
      {children}
    </RastreioProvider>
  );
}
