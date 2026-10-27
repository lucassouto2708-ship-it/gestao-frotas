import { Wrench } from "lucide-react";
import { EstadoVazio, Painel } from "@/components/Pagina";
import { TIPOS_MANUTENCAO, data, dinheiro, km } from "@/lib/regras";
import type { Maintenance, Profile } from "@/lib/types";
import { BotaoExcluirManutencao } from "./BotaoExcluirManutencao";

export type ManutencaoComUsuario = Maintenance & { profiles: Pick<Profile, "nome" | "email"> | null };

/** Histórico completo de serviços do veículo, do mais recente para o mais antigo. */
export function HistoricoManutencao({ registros, admin }: { registros: ManutencaoComUsuario[]; admin: boolean }) {
  const total = registros.reduce((s, r) => s + (r.custo === null ? 0 : Number(r.custo)), 0);
  return (
    <Painel
      titulo="Histórico de manutenção"
      acoes={
        registros.length > 0 && (
          <span className="text-xs text-texto-2">
            {registros.length} registro{registros.length > 1 ? "s" : ""}
            {total > 0 && <> · total <b className="text-texto tabular-nums">{dinheiro(total)}</b></>}
          </span>
        )
      }
      semPadding
    >
      {registros.length === 0 ? (
        <EstadoVazio
          icone={<Wrench size={24} strokeWidth={1.5} />}
          titulo="Nenhum serviço registrado"
          texto="Trocas de óleo, revisões e outros serviços registrados aparecerão aqui."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Serviço</th>
                <th className="num">Km</th>
                <th className="num">Custo</th>
                <th>Observação</th>
                <th>Registrado por</th>
                {admin && <th className="num"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {registros.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{data(m.realizada_em)}</td>
                  <td className="font-medium whitespace-nowrap">{TIPOS_MANUTENCAO[m.tipo] ?? m.tipo}</td>
                  <td className="num">{km(m.km)}</td>
                  <td className="num">{m.custo === null ? <span className="text-texto-2">—</span> : dinheiro(Number(m.custo))}</td>
                  <td className="max-w-72 text-texto-2">{m.observacao || "—"}</td>
                  <td className="whitespace-nowrap text-texto-2">{m.profiles?.nome || m.profiles?.email || "—"}</td>
                  {admin && (
                    <td className="num">
                      <BotaoExcluirManutencao id={m.id} descricao={`${TIPOS_MANUTENCAO[m.tipo] ?? m.tipo} de ${data(m.realizada_em)}`} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  );
}
