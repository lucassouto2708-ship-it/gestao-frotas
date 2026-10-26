import Link from "next/link";
import { ChevronRight, ClipboardList, Flag, Gauge, PlusSquare, Route } from "lucide-react";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora, formatarPlaca, km } from "@/lib/regras";
import { getProfile } from "@/lib/supabase/server";
import type { Trip, Vehicle } from "@/lib/types";

type ViagemComCarro = Trip & { vehicles: Pick<Vehicle, "placa" | "modelo"> };

export default async function Inicio() {
  const { supabase, profile } = await getProfile();
  const { data } = await supabase
    .from("trips")
    .select("*, vehicles(placa, modelo)")
    .eq("user_id", profile.id)
    .order("iniciada_em", { ascending: false })
    .limit(10);
  const viagens = (data ?? []) as ViagemComCarro[];
  const abertas = viagens.filter((v) => v.status === "em_andamento");
  const recentes = viagens.filter((v) => v.status === "finalizada").slice(0, 5);

  const acoes = [
    { href: "/viagens/nova", icone: Gauge, titulo: "Iniciar viagem", texto: "Registrar saída com foto do odômetro" },
    { href: "/pneus/novo", icone: ClipboardList, titulo: "Medição de pneus", texto: "Profundidade do sulco (TWI) dos 4 pneus" },
    { href: "/veiculos/novo", icone: PlusSquare, titulo: "Cadastrar veículo", texto: "Placa, modelo e quilometragem inicial" },
  ];

  return (
    <Pagina
      titulo="Início"
      descricao={`${profile.nome ? `${profile.nome.split(" ")[0]}, r` : "R"}egistre viagens, medições de pneus e novos veículos.`}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Painel
            titulo="Viagens em andamento"
            acoes={abertas.length > 0 && <Selo nivel="atencao">{abertas.length} em aberto</Selo>}
            semPadding
          >
            {abertas.length === 0 ? (
              <EstadoVazio
                icone={<Route size={28} strokeWidth={1.5} />}
                titulo="Nenhuma viagem em andamento"
                texto="Ao sair com um veículo, registre a viagem com a foto do odômetro."
                acao={<Link href="/viagens/nova" className="botao"><Gauge size={15} /> Iniciar viagem</Link>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Veículo</th>
                      <th>Saída</th>
                      <th>Destino</th>
                      <th className="num">Km inicial</th>
                      <th className="num">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abertas.map((v) => (
                      <tr key={v.id}>
                        <td className="mono font-semibold">{formatarPlaca(v.vehicles.placa)}</td>
                        <td>{v.vehicles.modelo || "—"}</td>
                        <td className="whitespace-nowrap">{dataHora(v.iniciada_em)}</td>
                        <td>{v.destino || "—"}</td>
                        <td className="num">{km(v.km_inicio)}</td>
                        <td className="num">
                          <Link href={`/viagens/${v.id}/finalizar`} className="botao botao-pequeno">
                            <Flag size={13} /> Finalizar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          <Painel titulo="Minhas últimas viagens" semPadding>
            {recentes.length === 0 ? (
              <EstadoVazio titulo="Nenhuma viagem finalizada" texto="As viagens concluídas aparecerão aqui com a distância percorrida." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Chegada</th>
                      <th>Destino</th>
                      <th className="num">Km inicial</th>
                      <th className="num">Km final</th>
                      <th className="num">Percorrido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentes.map((v) => (
                      <tr key={v.id}>
                        <td className="mono font-semibold">{formatarPlaca(v.vehicles.placa)}</td>
                        <td className="whitespace-nowrap">{dataHora(v.finalizada_em!)}</td>
                        <td>{v.destino || "—"}</td>
                        <td className="num">{km(v.km_inicio)}</td>
                        <td className="num">{km(v.km_fim!)}</td>
                        <td className="num font-semibold">{km(v.km_fim! - v.km_inicio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </div>

        <Painel titulo="Operações" semPadding className="self-start">
          <ul className="divide-y divide-borda">
            {acoes.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="group flex items-center gap-3 px-4 py-3 hover:bg-superficie-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-borda bg-primaria-suave text-primaria-texto">
                    <a.icone size={17} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{a.titulo}</span>
                    <span className="block text-xs text-texto-2">{a.texto}</span>
                  </span>
                  <ChevronRight size={16} className="text-texto-2 group-hover:text-primaria-texto" />
                </Link>
              </li>
            ))}
          </ul>
        </Painel>
      </div>
    </Pagina>
  );
}
