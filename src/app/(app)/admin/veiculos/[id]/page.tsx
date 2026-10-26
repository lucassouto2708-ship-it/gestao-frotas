import { notFound } from "next/navigation";
import { Pagina } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { linksDasFotos } from "@/lib/fotos";
import { PNEUS, dataHora, formatarPlaca, km, nivelPneu, statusOleo, statusRevisao } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { Maintenance, Profile, TireMeasurement, Trip, Vehicle } from "@/lib/types";
import { FormConfigVeiculo, FormManutencao } from "./Formularios";

type ComUsuario<T> = T & { profiles: Pick<Profile, "nome" | "email"> | null };

export default async function DetalheVeiculo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: v }, { data: viagens }, { data: manutencoes }, { data: medicoes }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle<Vehicle>(),
    supabase.from("trips").select("*, profiles(nome, email)").eq("vehicle_id", id).order("iniciada_em", { ascending: false }).limit(50),
    supabase.from("maintenances").select("*").eq("vehicle_id", id).order("km", { ascending: false }),
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
  const oleo = statusOleo(v);
  const revisao = statusRevisao(v);
  const nome = (p: ComUsuario<unknown>["profiles"]) => p?.nome || p?.email || "—";
  const Foto = ({ caminho, rotulo }: { caminho: string | null; rotulo: string }) =>
    caminho && fotos[caminho] ? (
      <a href={fotos[caminho]} target="_blank" className="text-marca underline">{rotulo}</a>
    ) : null;

  return (
    <Pagina titulo={`${formatarPlaca(v.placa)} ${v.modelo ? `· ${v.modelo}` : ""}`} voltar="/admin">
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Situação</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-slate-500">Km atual</span><p className="text-lg font-bold">{km(v.km_atual)}</p></div>
            <div>
              <span className="text-slate-500">Km no cadastro</span>
              <p className="font-semibold">{km(v.km_inicial)} <Foto caminho={v.foto_km_inicial} rotulo="foto" /></p>
            </div>
            <div><span className="text-slate-500">Cadastrado em</span><p className="font-semibold">{dataHora(v.created_at)}</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { titulo: "Troca de óleo", s: oleo },
              { titulo: "Revisão", s: revisao },
            ].map(({ titulo, s }) => (
              <div key={titulo} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <b>{titulo}</b>
                  <Selo nivel={s.nivel}>{s.nivel === "ok" ? "Em dia" : s.nivel === "atencao" ? "Em breve" : "Vencida"}</Selo>
                </div>
                <p>A cada {km(s.intervalo)} · próxima com {km(s.proximaKm)}</p>
                <p className="text-slate-600">{s.faltam > 0 ? `Faltam ${km(s.faltam)}` : `Passou ${km(-s.faltam)} do limite`}</p>
                <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200">
                  <div
                    className={`h-full ${s.nivel === "ok" ? "bg-emerald-500" : s.nivel === "atencao" ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, Math.max(0, (s.rodado / s.intervalo) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Registrar manutenção</h2>
          <FormManutencao veiculoId={v.id} kmAtual={v.km_atual} />
        </section>
      </div>

      <section className="card mt-4">
        <h2 className="mb-3 font-semibold">Pneus (últimas medições)</h2>
        {listaMedicoes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma medição ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th className="py-2 pr-3">Data</th>{PNEUS.map((p) => <th key={p.campo} className="pr-3">{p.rotulo}</th>)}<th>Por</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaMedicoes.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{dataHora(m.created_at)}</td>
                    {PNEUS.map((p) => {
                      const mm = Number(m[p.campo]);
                      return (
                        <td key={p.campo} className="pr-3 whitespace-nowrap">
                          <Selo nivel={nivelPneu(mm)}>{mm.toLocaleString("pt-BR")} mm</Selo>{" "}
                          <Foto caminho={m[p.foto] as string | null} rotulo="foto" />
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
      </section>

      <section className="card mt-4">
        <h2 className="mb-3 font-semibold">Viagens</h2>
        {listaViagens.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma viagem ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th className="py-2 pr-3">Saída</th><th className="pr-3">Motorista</th><th className="pr-3">Destino</th><th className="pr-3">Km início</th><th className="pr-3">Km fim</th><th>Rodado</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaViagens.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{dataHora(t.iniciada_em)}</td>
                    <td className="pr-3">{nome(t.profiles)}</td>
                    <td className="pr-3">{t.destino || "—"}</td>
                    <td className="pr-3 whitespace-nowrap">{km(t.km_inicio)} <Foto caminho={t.foto_inicio} rotulo="foto" /></td>
                    <td className="pr-3 whitespace-nowrap">
                      {t.km_fim !== null ? <>{km(t.km_fim)} <Foto caminho={t.foto_fim} rotulo="foto" /></> : <Selo nivel="atencao">Em andamento</Selo>}
                    </td>
                    <td className="font-semibold whitespace-nowrap">{t.km_fim !== null ? km(t.km_fim - t.km_inicio) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Histórico de manutenção</h2>
          {(manutencoes ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma manutenção registrada.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {((manutencoes ?? []) as Maintenance[]).map((m) => (
                <li key={m.id} className="py-2">
                  <b>{m.tipo === "oleo" ? "Troca de óleo" : "Revisão"}</b> com {km(m.km)} ·{" "}
                  {new Date(`${m.realizada_em}T12:00:00`).toLocaleDateString("pt-BR")}
                  {m.observacao && <p className="text-slate-500">{m.observacao}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Configurações do carro</h2>
          <FormConfigVeiculo veiculo={v} />
        </section>
      </div>
    </Pagina>
  );
}
