import { Selo } from "@/components/Selo";
import { data, km, statusOleo, statusRevisao } from "@/lib/regras";
import type { Vehicle } from "@/lib/types";

const textoNivel = { ok: "Em dia", atencao: "Em breve", critico: "Vencida" } as const;

/** Situação da troca de óleo e da revisão: última realizada, próxima e quanto falta. */
export function StatusManutencao({ veiculo }: { veiculo: Vehicle }) {
  const itens = [
    { titulo: "Troca de óleo", s: statusOleo(veiculo), kmUltima: veiculo.km_ultima_troca_oleo, dataUltima: veiculo.data_ultima_troca_oleo },
    { titulo: "Revisão", s: statusRevisao(veiculo), kmUltima: veiculo.km_ultima_revisao, dataUltima: veiculo.data_ultima_revisao },
  ];
  return (
    <div className="grid sm:grid-cols-2">
      {itens.map(({ titulo, s, kmUltima, dataUltima }) => (
        <div key={titulo} className="border-borda px-4 py-3 text-[13px] sm:border-r sm:last:border-r-0">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-semibold">{titulo}</span>
            <Selo nivel={s.nivel}>{textoNivel[s.nivel]}</Selo>
          </div>
          <p className="mb-1.5 text-xs text-texto-2">
            Última: {dataUltima ? <b className="text-texto">{data(dataUltima)} com {km(kmUltima)}</b> : <span>não registrada (contando desde o cadastro, {km(kmUltima)})</span>}
          </p>
          <div className="h-1.5 overflow-hidden rounded-sm bg-superficie-2 ring-1 ring-borda">
            <div
              className={`h-full ${s.nivel === "ok" ? "bg-sucesso" : s.nivel === "atencao" ? "bg-alerta" : "bg-perigo"}`}
              style={{ width: `${Math.min(100, Math.max(0, (s.rodado / s.intervalo) * 100))}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-texto-2 tabular-nums">
            <span>A cada {km(s.intervalo)} · próxima em {km(s.proximaKm)}</span>
            <span className={s.nivel === "critico" ? "font-semibold text-perigo" : ""}>
              {s.faltam > 0 ? `faltam ${km(s.faltam)}` : `excedido ${km(-s.faltam)}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
