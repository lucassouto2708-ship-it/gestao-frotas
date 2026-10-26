"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldMinus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

export function BotaoPapel({ id, role }: { id: string; role: Role }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const novo: Role = role === "admin" ? "comum" : "admin";
  const Icone = salvando ? Loader2 : novo === "admin" ? ShieldCheck : ShieldMinus;

  return (
    <button
      className="botao-secundario botao-pequeno"
      disabled={salvando}
      onClick={async () => {
        setSalvando(true);
        const { error } = await createClient().from("profiles").update({ role: novo }).eq("id", id);
        setSalvando(false);
        if (error) alert(error.message);
        router.refresh();
      }}
    >
      <Icone size={13} className={salvando ? "animate-spin" : ""} />
      {novo === "admin" ? "Tornar ADM" : "Tornar operador"}
    </button>
  );
}
