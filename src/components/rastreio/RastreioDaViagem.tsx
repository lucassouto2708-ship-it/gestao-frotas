"use client";

import { LocateFixed, LocateOff } from "lucide-react";
import { Selo } from "@/components/Selo";
import { useRastreio } from "./RastreioProvider";

/** Estado do GPS de uma viagem em andamento, com botão para ligar o rastreio neste aparelho. */
export function RastreioDaViagem({ tripId, placa }: { tripId: string; placa: string }) {
  const { ativo, painel, iniciar } = useRastreio();
  if (ativo?.tripId === tripId) {
    if (painel.situacao === "negado") return <Selo nivel="critico">Localização bloqueada</Selo>;
    if (painel.situacao === "sem_sinal") return <Selo nivel="atencao">Sem sinal de GPS</Selo>;
    return <Selo nivel="ok">GPS rastreando</Selo>;
  }
  return (
    <button type="button" className="botao-secundario botao-pequeno whitespace-nowrap" onClick={() => iniciar(tripId, placa)} title="Usar o GPS deste aparelho para acompanhar a viagem">
      {ativo ? <LocateOff size={13} /> : <LocateFixed size={13} />} Ativar GPS
    </button>
  );
}
