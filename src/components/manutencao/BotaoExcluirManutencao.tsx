"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function BotaoExcluirManutencao({ id, descricao }: { id: string; descricao: string }) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  return (
    <button
      type="button"
      title="Excluir registro"
      className="inline-flex h-7 w-7 items-center justify-center rounded text-texto-2 hover:bg-perigo-suave hover:text-perigo disabled:opacity-50"
      disabled={excluindo}
      onClick={async () => {
        if (!confirm(`Excluir o registro "${descricao}"? Os contadores de óleo e revisão serão recalculados.`)) return;
        setExcluindo(true);
        const { error } = await createClient().from("maintenances").delete().eq("id", id);
        setExcluindo(false);
        if (error) alert(error.message);
        router.refresh();
      }}
    >
      {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
  );
}
