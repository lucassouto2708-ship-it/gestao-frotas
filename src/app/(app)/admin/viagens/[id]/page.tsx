import { notFound } from "next/navigation";
import { Camera, MapPinOff } from "lucide-react";
import { EstadoVazio, Indicador, Pagina, Painel } from "@/components/Pagina";
import { ConferenciaGps } from "@/components/rastreio/ConferenciaGps";
import { RotaSvg } from "@/components/rastreio/RotaSvg";
import { linksDasFotos } from "@/lib/fotos";
import type { ResumoRastreio } from "@/lib/rastreio";
import { compararDistancias, dataHora, formatarPlaca, km, kmGps } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { Profile, Trip, TripTrilha, Vehicle } from "@/lib/types";

export default async function DetalheViagem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data }, { data: trilha }] = await Promise.all([
    supabase.from("trips").select("*, vehicles(*), profiles(nome, email)").eq("id", id).maybeSingle(),
    supabase.from("trip_trilhas").select("pontos").eq("trip_id", id).maybeSingle<Pick<TripTrilha, "pontos">>(),
  ]);
  if (!data) notFound();
  const t = data as Trip & { vehicles: Vehicle; profiles: Pick<Profile, "nome" | "email"> | null };
  const fotos = await linksDasFotos(supabase, [t.foto_inicio, t.foto_fim]);
  const motorista = t.profiles?.nome || t.profiles?.email || "—";
  const finalizada = t.status === "finalizada" && t.km_fim !== null;
  const rodado = finalizada ? t.km_fim! - t.km_inicio : null;
  const temGps = t.gps_distancia_m != null;
  const comparacao = rodado !== null ? compararDistancias(rodado, t.gps_distancia_m, t.gps_cobertura) : null;
  const gps: ResumoRastreio | null = temGps
    ? {
        distanciaM: t.gps_distancia_m!,
        cobertura: t.gps_cobertura ?? 0,
        interrupcoes: t.gps_interrupcoes ?? 0,
        velMaxKmh: Number(t.vel_max_kmh ?? 0),
        velMediaKmh: Number(t.vel_media_kmh ?? 0),
        pontos: t.gps_pontos ?? 0,
        trilha: [],
      }
    : null;
  const Foto = ({ caminho, rotulo }: { caminho: string | null; rotulo: string }) =>
    caminho && fotos[caminho] ? (
      <a href={fotos[caminho]} target="_blank" className="inline-flex items-center gap-1 text-primaria-texto hover:underline">
        <Camera size={13} /> {rotulo}
      </a>
    ) : (
      <span className="text-xs text-texto-2">sem foto</span>
    );

  return (
    <Pagina
      titulo={`Viagem de ${formatarPlaca(t.vehicles.placa)}`}
      descricao={`${motorista} · saída em ${dataHora(t.iniciada_em)}${t.destino ? ` · ${t.destino}` : ""}`}
      voltar={`/admin/veiculos/${t.vehicle_id}`}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Painel titulo="Rota registrada pelo GPS" semPadding>
            {trilha && trilha.pontos.length > 1 ? (
              <div className="p-4">
                <RotaSvg pontos={trilha.pontos} />
                <p className="mt-2 flex flex-wrap items-center gap-x-4 text-xs text-texto-2">
                  <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sucesso align-middle" />Saída</span>
                  <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-perigo align-middle" />Chegada</span>
                  <span>{trilha.pontos.length} pontos · rota simplificada, sem mapa de fundo</span>
                </p>
              </div>
            ) : (
              <EstadoVazio
                icone={<MapPinOff size={28} strokeWidth={1.5} />}
                titulo={temGps ? "Rota não disponível" : "Esta viagem não foi rastreada por GPS"}
                texto={temGps ? "A trilha não foi gravada (viagem muito curta ou sem sinal)." : "O motorista não liberou a localização ou usou outro aparelho."}
              />
            )}
          </Painel>
          {comparacao && <ConferenciaGps comparacao={comparacao} odometroKm={rodado!} gps={gps} />}
        </div>

        <div className="space-y-4 self-start">
          <Painel titulo="Odômetro" semPadding>
            <dl className="divide-y divide-borda text-[13px]">
              {[
                ["Saída", <span key="s" className="tabular-nums">{km(t.km_inicio)} · <Foto caminho={t.foto_inicio} rotulo="foto" /></span>],
                ["Chegada", finalizada ? <span key="c" className="tabular-nums">{km(t.km_fim!)} · <Foto caminho={t.foto_fim} rotulo="foto" /></span> : "Em andamento"],
                ["Percorrido", rodado !== null ? <b key="p" className="tabular-nums">{km(rodado)}</b> : "—"],
                ["Chegada em", t.finalizada_em ? dataHora(t.finalizada_em) : "—"],
              ].map(([rotulo, valor], i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="text-texto-2">{rotulo}</dt>
                  <dd className="text-right font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
          </Painel>
          {gps && (
            <div className="grid grid-cols-2 gap-3">
              <Indicador rotulo="Distância GPS" valor={kmGps(gps.distanciaM)} />
              <Indicador rotulo="Cobertura" valor={`${gps.cobertura}%`} contexto={gps.interrupcoes ? `${gps.interrupcoes} interrupç${gps.interrupcoes > 1 ? "ões" : "ão"}` : "sem interrupções"} tom={gps.cobertura < 80 ? "alerta" : undefined} />
              <Indicador rotulo="Velocidade máxima" valor={`${gps.velMaxKmh.toLocaleString("pt-BR")} km/h`} />
              <Indicador rotulo="Velocidade média" valor={`${gps.velMediaKmh.toLocaleString("pt-BR")} km/h`} contexto="inclui as paradas" />
            </div>
          )}
        </div>
      </div>
    </Pagina>
  );
}
