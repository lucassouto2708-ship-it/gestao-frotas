import Link from "next/link";
import { TriangleAlert, Wrench } from "lucide-react";
import { formatarPlaca, type Pendencia } from "@/lib/regras";

/** Faixa de aviso com o que precisa ser feito no veículo. */
export function AvisoManutencao({
  veiculoId,
  placa,
  itens,
  titulo,
  compacto,
  semBotao,
}: {
  veiculoId: string;
  placa: string;
  itens: Pendencia[];
  titulo?: string;
  compacto?: boolean;
  semBotao?: boolean;
}) {
  if (!itens.length) return null;
  const critico = itens.some((i) => i.nivel === "critico");
  return (
    <div
      className={`rounded border border-l-[3px] ${
        critico ? "border-perigo/30 border-l-perigo bg-perigo-suave" : "border-alerta/40 border-l-alerta bg-alerta-suave"
      } ${compacto ? "px-3 py-2" : "px-4 py-3"}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <TriangleAlert size={compacto ? 15 : 18} className={`mt-0.5 shrink-0 ${critico ? "text-perigo" : "text-alerta"}`} />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-semibold">
            {titulo ?? <>Veículo <span className="mono">{formatarPlaca(placa)}</span>: manutenção necessária</>}
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {itens.map((i) => (
              <li key={i.servico}>
                <b className={i.nivel === "critico" ? "text-perigo" : "text-alerta"}>{i.servico}</b> {i.texto}
              </li>
            ))}
          </ul>
        </div>
        {!semBotao && (
          <Link href={`/veiculos/${veiculoId}#registrar`} className="botao-secundario botao-pequeno self-center">
            <Wrench size={13} /> Registrar manutenção
          </Link>
        )}
      </div>
    </div>
  );
}
