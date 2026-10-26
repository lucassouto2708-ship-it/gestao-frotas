import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Props = {
  titulo: string;
  descricao?: string;
  voltar?: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
};

export function Pagina({ titulo, descricao, voltar, acoes, children }: Props) {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      {voltar && (
        <Link href={voltar} className="mb-2 inline-flex items-center gap-1 text-[13px] text-texto-2 hover:text-primaria-texto">
          <ChevronLeft size={14} /> Voltar
        </Link>
      )}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-borda pb-4">
        <div>
          <h1 className="text-[20px] leading-tight font-bold">{titulo}</h1>
          {descricao && <p className="mt-1 text-[13px] text-texto-2">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </main>
  );
}

export function Painel({
  titulo,
  acoes,
  children,
  className = "",
  semPadding,
}: {
  titulo?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section className={`painel ${className}`}>
      {titulo && (
        <div className="painel-cabecalho">
          <h2 className="painel-titulo">{titulo}</h2>
          {acoes}
        </div>
      )}
      <div className={semPadding ? "" : "painel-corpo"}>{children}</div>
    </section>
  );
}

export function EstadoVazio({ icone, titulo, texto, acao }: { icone?: React.ReactNode; titulo: string; texto?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icone && <div className="text-texto-2/70">{icone}</div>}
      <p className="text-[14px] font-semibold">{titulo}</p>
      {texto && <p className="max-w-md text-[13px] text-texto-2">{texto}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

/** Indicador discreto: rótulo, valor e contexto. */
export function Indicador({ rotulo, valor, contexto, tom }: { rotulo: string; valor: string; contexto?: string; tom?: "alerta" | "perigo" }) {
  const cor = tom === "perigo" ? "border-l-perigo" : tom === "alerta" ? "border-l-alerta" : "border-l-primaria";
  return (
    <div className={`painel border-l-[3px] ${cor} px-4 py-3`}>
      <p className="text-[11px] font-semibold tracking-wider text-texto-2 uppercase">{rotulo}</p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums">{valor}</p>
      {contexto && <p className="text-xs text-texto-2">{contexto}</p>}
    </div>
  );
}
