"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

export function BotaoPapel({ id, role }: { id: string; role: Role }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const novo: Role = role === "admin" ? "comum" : "admin";

  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${role === "admin" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
        {role === "admin" ? "ADM" : "Comum"}
      </span>
      <button
        className="botao-secundario px-3 py-1.5 text-sm"
        disabled={salvando}
        onClick={async () => {
          setSalvando(true);
          const { error } = await createClient().from("profiles").update({ role: novo }).eq("id", id);
          setSalvando(false);
          if (error) alert(error.message);
          router.refresh();
        }}
      >
        {novo === "admin" ? "Tornar ADM" : "Tornar comum"}
      </button>
    </div>
  );
}
