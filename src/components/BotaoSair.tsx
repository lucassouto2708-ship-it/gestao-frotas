"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();
  return (
    <button
      title="Sair"
      className="flex h-8 items-center gap-1.5 rounded px-2 opacity-85 hover:bg-white/10 hover:opacity-100"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut size={15} strokeWidth={1.75} />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}
