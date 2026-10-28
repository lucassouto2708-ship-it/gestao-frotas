"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Escolha de competência (mês/ano) com navegação por setas e grade de meses. Troca a página ao escolher. */
export function SeletorMes({ mes, parametro = "mes" }: { mes: string; parametro?: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ano0, m0] = mes.split("-").map(Number);
  const [ano, setAno] = useState(ano0);
  const raiz = useRef<HTMLDivElement>(null);
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const anoHoje = hoje.getFullYear(), mesHoje = hoje.getMonth() + 1;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function ir(a: number, m: number) {
    const q = new URLSearchParams(window.location.search);
    q.set(parametro, `${a}-${String(m).padStart(2, "0")}`);
    setAberto(false);
    router.push(`${window.location.pathname}?${q}`);
  }
  // Setas fora do calendário: mês anterior / seguinte
  const vizinho = (d: number) => {
    const t = ano0 * 12 + (m0 - 1) + d;
    ir(Math.floor(t / 12), (t % 12) + 1);
  };

  return (
    <div ref={raiz} className="relative inline-flex items-stretch">
      <button type="button" className="botao-secundario rounded-r-none px-2" aria-label="Mês anterior" onClick={() => vizinho(-1)}>
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        className="botao-secundario -mx-px min-w-44 rounded-none"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => { setAno(ano0); setAberto((v) => !v); }}
      >
        <CalendarDays size={15} className="text-texto-2" />
        <span>{MESES_LONGOS[m0 - 1][0].toUpperCase() + MESES_LONGOS[m0 - 1].slice(1)} de {ano0}</span>
      </button>
      <button type="button" className="botao-secundario rounded-l-none px-2" aria-label="Mês seguinte" onClick={() => vizinho(1)}>
        <ChevronRight size={16} />
      </button>

      {aberto && (
        <div role="dialog" aria-label="Escolher competência" className="absolute top-full right-0 z-30 mt-1.5 w-72 rounded border border-borda-forte bg-superficie p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded hover:bg-superficie-2" aria-label="Ano anterior" onClick={() => setAno((a) => a - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-[14px] font-semibold tabular-nums">{ano}</span>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded hover:bg-superficie-2" aria-label="Próximo ano" onClick={() => setAno((a) => a + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MESES.map((nome, i) => {
              const atual = ano === ano0 && i + 1 === m0;
              const futuro = ano > anoHoje || (ano === anoHoje && i + 1 > mesHoje);
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => ir(ano, i + 1)}
                  className={`h-10 rounded text-[13px] font-medium capitalize transition-colors ${
                    atual ? "bg-primaria text-white" : futuro ? "text-texto-2/60 hover:bg-superficie-2" : "hover:bg-primaria-suave hover:text-primaria-texto"
                  } ${ano === anoHoje && i + 1 === mesHoje && !atual ? "ring-1 ring-primaria/50" : ""}`}
                >
                  {nome}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-borda pt-2">
            <button type="button" className="link text-[13px]" onClick={() => ir(anoHoje, mesHoje)}>Este mês</button>
            <button type="button" className="text-[13px] text-texto-2 hover:text-texto" onClick={() => setAberto(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
