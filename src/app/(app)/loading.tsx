import { Loader2 } from "lucide-react";

export default function Carregando() {
  return (
    <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-6 py-10 text-[13px] text-texto-2">
      <Loader2 size={16} className="animate-spin text-primaria-texto" /> Carregando…
    </div>
  );
}
