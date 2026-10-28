import Link from "next/link";
import { CheckCircle2, ChevronRight, ClipboardList, Flag, Gauge, PlusSquare, Route, Wrench } from "lucide-react";
import { AvisoManutencao } from "@/components/manutencao/AvisoManutencao";
import { RastreioDaViagem } from "@/components/rastreio/RastreioDaViagem";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora, formatarPlaca, km, pendencias } from "@/lib/regras";
import { getProfile } from "@/lib/supabase/server";
import type { Trip, Vehicle } from "@/lib/types";

type ViagemComCarro = Trip & { vehicles: Vehicle };

export default async function Inicio({ searchParams }: { searchParams: Promise<{ finalizada?: string }> }) {
  const { supabase, profile } = await getProfile();
  const { finalizada } = await searchParams;
  const [{ data }, { data: frota }] = await Promise.all([
    supabase.from("trips").select("*, vehicles(*)").eq("user_id", profile.id).order("iniciada_em", { ascending: false }).limit(10),
    supabase.from("vehicles").select("*").order("placa"),
  ]);
  const viagens = (data ?? []) as ViagemComCarro[];
  // Viagem acabou de ser finalizada: mostra o resultado e o que o carro precisa
  const recemFinalizada = finalizada ? viagens.find((v) => v.id === finalizada && v.status === "finalizada") : undefined;
  const pendentes = ((frota ?? []) as Vehicle[]).map((v) => ({ v, itens: pendencias(v) })).filter((p) => p.itens.length);
  const abertas = viagens.filter((v) => v.status === "em_andamento");
  const recentes = viagens.filter((v) => v.status === "finalizada").slice(0, 5);

  const acoes = [
    { href: "/viagens/nova", icone: Gauge, titulo: "Iniciar viagem", texto: "Registrar saída com foto do odômetro" },
    { href: "/veiculos", icone: Wrench, titulo: "Manutenção", texto: "Registrar serviço e ver histórico do veículo" },
    { href: "/pneus/novo", icone: ClipboardList, titulo: "Medição de pneus", texto: "Profundidade do sulco (TWI) dos 4 pneus" },
    { href: "/veiculos/novo", icone: PlusSquare, titulo: "Cadastrar veículo", texto: "Placa, modelo e quilometragem inicial" },
  ];

  return (
    <Pagina
      titulo="Início"
      descricao={`${profile.nome ? `${profile.nome.split(" ")[0]}, r` : "R"}egistre viagens, medições de pneus e novos veículos.`}
    >
      {recemFinalizada && (
        <div className="mb-4 space-y-2">
          <p className="sucesso flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>
              Viagem finalizada: <b className="mono">{formatarPlaca(recemFinalizada.vehicles.placa)}</b> percorreu{" "}
              <b>{km(recemFinalizada.km_fim! - recemFinalizada.km_inicio)}</b>.
              {pendencias(recemFinalizada.vehicles).length === 0 && " Manutenção do veículo em dia."}
            </span>
          </p>
          <AvisoManutencao
            veiculoId={recemFinalizada.vehicle_id}
            placa={recemFinalizada.vehicles.placa}
            itens={pendencias(recemFinalizada.vehicles)}
          />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {pendentes.length > 0 && (
            <Painel
              titulo="Manutenção necessária"
              acoes={<Selo nivel={pendentes.some((p) => p.itens.some((i) => i.nivel === "critico")) ? "critico" : "atencao"}>{pendentes.length} veículo{pendentes.length > 1 ? "s" : ""}</Selo>}
            >
              <div className="space-y-2">
                {pendentes.map(({ v, itens }) => (
                  <AvisoManutencao key={v.id} veiculoId={v.id} placa={v.placa} itens={itens} compacto />
                ))}
              </div>
            </Painel>
          )}
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
                      <th>GPS</th>
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
                        <td><RastreioDaViagem tripId={v.id} placa={v.vehicles.placa} /></td>
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
                      <th>Manutenção do veículo</th>
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
                        <td className="whitespace-nowrap">
                          {(() => {
                            const p = pendencias(v.vehicles);
                            return p.length === 0 ? (
                              <Selo nivel="ok">Em dia</Selo>
                            ) : (
                              <span className="flex flex-wrap gap-1">
                                {p.map((i) => (
                                  <Selo key={i.servico} nivel={i.nivel}>
                                    {i.servico} {i.nivel === "critico" ? "vencida" : "em breve"}
                                  </Selo>
                                ))}
                              </span>
                            );
                          })()}
                        </td>
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
