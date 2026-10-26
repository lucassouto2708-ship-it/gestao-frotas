import { Topo } from "@/components/Topo";
import { getProfile } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getProfile();
  return (
    <>
      <Topo profile={profile} />
      {children}
    </>
  );
}
