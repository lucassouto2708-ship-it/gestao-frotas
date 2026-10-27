import { notFound } from "next/navigation";
import { Camera, ClipboardList, Route } from "lucide-react";
import { FormManutencao } from "@/components/manutencao/FormManutencao";
import { HistoricoManutencao, type ManutencaoComUsuario } from "@/components/manutencao/HistoricoManutencao";
import { StatusManutencao } from "@/components/manutencao/StatusManutencao";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { linksDasFotos } from "@/lib/fotos";
import { PNEUS, dataHora, formatarPlaca, km, nivelPneu } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { Profile, TireMeasurement, Trip, Vehicle } from "@/lib/types";
import { FormConfigVeiculo } from "./Formularios";

type ComUsuario<T> = T & { profiles: Pick<Profile, "nome" | "email"> | null };

export default async function DetalheVeiculo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: v }, { data: viagens }, { data: manutencoes }, { data: medicoes }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle<Vehicle>(),
    supabase.from("trips").select("*, profiles(nome, email)").eq("vehicle_id", id).order("iniciada_em", { ascending: false }).limit(50),
    supabase.from("maintenances").select("*, profiles(nome, email)").eq("vehicle_id", id).order("realizada_em", { ascending: false }).order("km", { ascending: false }),
    supabase.from("tire_measurements").select("*, profiles(nome, email)").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!v) notFound();
  const listaViagens = (viagens ?? []) as ComUsuario<Trip>[];
  const listaMedicoes = (medicoes ?? []) as ComUsuario<TireMeasurement>[];
  const fotos = await linksDasFotos(supabase, [
    v.foto_km_inicial,
    ...listaViagens.flatMap((t) => [t.foto_inicio, t.foto_fim]),
    ...listaMedicoes.flatMap((m) => PNEUS.map((p) => m[p.foto])),
  ]);
  const nome = (p: ComUsuario<unknown>["profiles"]) => p?.nome || p?.email || "—";
  const Foto = ({ caminho, rotulo }: { caminho: string | null; rotulo: string }) =>
    caminho && fotos[caminho] ? (
      <a href={fotos[caminho]} target="_blank" title={`Abrir ${rotulo}`} className="ml-1.5 inline-flex items-center gap-1 align-middle text-xs text-primaria-texto hover:underline">
        <Camera size={13} />
        <span className="sr-only">{rotulo}</span>
      </a>
    ) : null;

  return (
    <Pagina
      titulo={`Veículo ${formatarPlaca(v.placa)}`}
      descricao={`${v.modelo || "Modelo não informado"} · cadastrado em ${dataHora(v.created_at)}`}
      voltar="/admin"
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Painel titulo="Ficha do veículo" semPadding>
            <dl className="grid grid-cols-2 text-[13px] sm:grid-cols-4">
              {[
                ["Placa", <span key="p" className="mono font-semibold">{formatarPlaca(v.placa)}</span>],
                ["Modelo", v.modelo || "—"],
                ["Km no cadastro", <span key="k" className="tabular-nums">{km(v.km_inicial)}<Foto caminho={v.foto_km_inicial} rotulo="foto do cadastro" /></span>],
                ["Km atual", <span key="a" className="text-[15px] font-semibold tabular-nums">{km(v.km_atual)}</span>],
              ].map(([rotulo, valor], i) => (
                <div key={i} className="border-b border-borda px-4 py-3 sm:border-r sm:last:border-r-0">
                  <dt className="text-[11px] font-semibold tracking-wider text-texto-2 uppercase">{rotulo}</dt>
                  <dd className="mt-0.5 font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
            <StatusManutencao veiculo={v} />
          </Painel>

          <Painel titulo="Medições de pneus" acoes={<span className="text-xs text-texto-2">Últimas 10</span>} semPadding>
            {listaMedicoes.length === 0 ? (
              <EstadoVazio icone={<ClipboardList size={26} strokeWidth={1.5} />} titulo="Nenhuma medição registrada" texto="As aferições do sulco feitas pelos operadores aparecerão aqui." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Data</th>
                      {PNEUS.map((p) => <th key={p.campo} className="num">{p.rotulo}</th>)}
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaMedicoes.map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap">{dataHora(m.created_at)}</td>
                        {PNEUS.map((p) => {
                          const mm = Number(m[p.campo]);
                          const nivel = nivelPneu(mm);
                          return (
                            <td key={p.campo} className={`num ${nivel === "critico" ? "font-semibold text-perigo" : nivel === "atencao" ? "text-alerta" : ""}`}>
                              {mm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} mm
                              <Foto caminho={m[p.foto] as string | null} rotulo={`foto ${p.rotulo.toLowerCase()}`} />
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap">{nome(m.profiles)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          <Painel titulo="Viagens" acoes={<span className="text-xs text-texto-2">Últimas 50</span>} semPadding>
            {listaViagens.length === 0 ? (
              <EstadoVazio icone={<Route size={26} strokeWidth={1.5} />} titulo="Nenhuma viagem registrada" />
            ) : (
              <div className="max-h-[60vh] overflow-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Saída</th>
                      <th>Motorista</th>
                      <th>Destino</th>
                      <th className="num">Km inicial</th>
                      <th className="num">Km final</th>
                      <th className="num">Percorrido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaViagens.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap">{dataHora(t.iniciada_em)}</td>
                        <td className="whitespace-nowrap">{nome(t.profiles)}</td>
                        <td>{t.destino || <span className="text-texto-2">—</span>}</td>
                        <td className="num">{km(t.km_inicio)}<Foto caminho={t.foto_inicio} rotulo="foto da saída" /></td>
                        <td className="num">
                          {t.km_fim !== null ? <>{km(t.km_fim)}<Foto caminho={t.foto_fim} rotulo="foto da chegada" /></> : <Selo nivel="info">Em andamento</Selo>}
                        </td>
                        <td className="num font-semibold">{t.km_fim !== null ? km(t.km_fim - t.km_inicio) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          <HistoricoManutencao registros={(manutencoes ?? []) as ManutencaoComUsuario[]} admin />
        </div>

        <div className="space-y-4 self-start">
          <Painel titulo="Registrar manutenção">
            <FormManutencao veiculoId={v.id} kmAtual={v.km_atual} />
          </Painel>

          <Painel titulo="Configurações do veículo">
            <FormConfigVeiculo veiculo={v} />
          </Painel>
        </div>
      </div>
    </Pagina>
  );
}
