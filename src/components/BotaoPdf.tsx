"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { Relatorio } from "@/lib/pdf";

/** Gera o PDF no navegador (a biblioteca só é carregada ao clicar). */
export function BotaoPdf({ relatorio }: { relatorio: Relatorio }) {
  const [gerando, setGerando] = useState(false);
  return (
    <button
      type="button"
      className="botao-secundario botao-pequeno"
      disabled={gerando}
      onClick={async () => {
        setGerando(true);
        try {
          const { gerarPdf } = await import("@/lib/pdf");
          await gerarPdf(relatorio);
        } catch {
          alert("Não foi possível gerar o PDF. Tente novamente.");
        }
        setGerando(false);
      }}
    >
      {gerando ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Gerar PDF
    </button>
  );
}
