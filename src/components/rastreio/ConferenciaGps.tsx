import { CheckCircle2, MapPinOff, TriangleAlert } from "lucide-react";
import { kmGps, km, type Comparacao } from "@/lib/regras";
import type { ResumoRastreio } from "@/lib/rastreio";

const estilos = {
  ok: "border-sucesso/30 border-l-sucesso bg-sucesso-suave",
  atencao: "border-alerta/40 border-l-alerta bg-alerta-suave",
  critico: "border-perigo/30 border-l-perigo bg-perigo-suave",
  sem_dados: "border-borda border-l-borda-forte bg-superficie-2",
} as const;

/** Compara a distância do odômetro com a do GPS (só informa: o odômetro é o registro oficial). */
export function ConferenciaGps({ comparacao, odometroKm, gps }: { comparacao: Comparacao; odometroKm: number; gps: ResumoRastreio | null }) {
  const Icone = comparacao.nivel === "ok" ? CheckCircle2 : comparacao.nivel === "sem_dados" ? MapPinOff : TriangleAlert;
  return (
    <div className={`rounded border border-l-[3px] px-4 py-2.5 text-[13px] ${estilos[comparacao.nivel]}`}>
      <p className="flex items-start gap-2 font-medium">
        <Icone size={16} className="mt-0.5 shrink-0" /> {comparacao.texto}
      </p>
      {gps && (
        <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 pl-6 text-xs tabular-nums text-texto-2">
          <div>Odômetro: <b className="text-texto">{km(odometroKm)}</b></div>
          <div>GPS: <b className="text-texto">{kmGps(gps.distanciaM)}</b></div>
          <div>Cobertura do rastreio: <b className="text-texto">{gps.cobertura}%</b></div>
          {gps.interrupcoes > 0 && <div>Interrupções: <b className="text-texto">{gps.interrupcoes}</b></div>}
        </dl>
      )}
    </div>
  );
}
