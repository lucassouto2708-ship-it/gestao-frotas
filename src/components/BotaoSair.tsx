"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();
  return (
    <button
      className="text-sm text-slate-500 hover:text-red-600"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
