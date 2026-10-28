"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, LocateFixed, LocateOff, MonitorSmartphone, TriangleAlert } from "lucide-react";
import { duracao, formatarPlaca, kmGps } from "@/lib/regras";
import { useRastreio } from "./RastreioProvider";

/** Faixa fixa no topo com o rastreio da viagem em andamento, visível em todas as telas. */
export function BarraRastreio() {
  const { ativo, painel } = useRastreio();
  const caminho = usePathname();
  if (!ativo) return null;

  const naFinalizacao = caminho.endsWith("/finalizar");
  const problema = painel.situacao === "negado" || painel.situacao === "indisponivel";
  const semSinal = painel.situacao === "sem_sinal";
  const cor = problema ? "border-perigo/40 bg-perigo-suave text-perigo" : semSinal ? "border-alerta/40 bg-alerta-suave text-alerta" : "border-borda bg-superficie-2 text-texto";

  return (
    <div className={`border-b ${cor}`} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[12.5px] sm:px-6">
        <span className="flex items-center gap-2 font-semibold">
          {problema ? <LocateOff size={15} /> : <LocateFixed size={15} className={painel.situacao === "rastreando" ? "animate-pulse text-sucesso" : ""} />}
          {painel.situacao === "negado"
            ? "Localização bloqueada: a viagem não será rastreada"
            : painel.situacao === "indisponivel"
              ? "Este aparelho não tem GPS disponível"
              : painel.situacao === "aguardando"
                ? "Procurando o sinal de GPS…"
                : semSinal
                  ? "Sem sinal de GPS"
                  : "Rastreando a viagem"}
          <span className="mono font-normal opacity-80">{formatarPlaca(ativo.placa)}</span>
        </span>

        {!problema && painel.situacao !== "aguardando" && (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5 tabular-nums">
            <span><b>{kmGps(painel.distanciaM)}</b> pelo GPS</span>
            <span>{duracao(painel.decorridoMs)}</span>
            {painel.velKmh !== null && <span>{painel.velKmh} km/h</span>}
            {painel.precisaoM !== null && <span className="text-texto-2">precisão {painel.precisaoM} m</span>}
          </span>
        )}

        {problema && painel.situacao === "negado" && (
          <span className="text-[12px]">Libere a localização do site nas configurações do navegador e recarregue.</span>
        )}

        {!problema && painel.telaLigada === "nao_suportada" && (
          <span className="flex items-center gap-1 text-alerta"><TriangleAlert size={13} /> Mantenha a tela ligada para não perder o rastreio.</span>
        )}
        {!problema && painel.telaLigada === "ativa" && (
          <span className="flex items-center gap-1 text-texto-2"><MonitorSmartphone size={13} /> Tela mantida ligada</span>
        )}

        {!naFinalizacao && (
          <Link href={`/viagens/${ativo.tripId}/finalizar`} className="botao botao-pequeno ml-auto">
            <Flag size={13} /> Finalizar viagem
          </Link>
        )}
      </div>
    </div>
  );
}
