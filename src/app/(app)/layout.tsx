import { Cabecalho } from "@/components/Cabecalho";
import { getProfile } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getProfile();
  return (
    <>
      <Cabecalho profile={profile} />
      {children}
    </>
  );
}
