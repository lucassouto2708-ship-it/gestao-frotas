"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { enviarFoto } from "@/lib/imagem";
import { AvisoManutencao } from "@/components/manutencao/AvisoManutencao";
import { useRastreio } from "@/components/rastreio/RastreioProvider";
import { ConferenciaGps } from "@/components/rastreio/ConferenciaGps";
import { compararDistancias, dataHora, formatarPlaca, km, pendencias } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import type { Trip, Vehicle } from "@/lib/types";

export function FormFinalizar({ viagem }: { viagem: Trip & { vehicles: Vehicle } }) {
  const router = useRouter();
  const rastreio = useRastreio();
  const [kmTexto, setKmTexto] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const kmFim = paraNumero(kmTexto, "odometro");
  const rodado = kmFim !== null && kmFim >= viagem.km_inicio ? kmFim - viagem.km_inicio : null;
  // Com o km de chegada, o carro passa do limite de troca de óleo / revisão?
  const aviso = rodado !== null ? pendencias(viagem.vehicles, kmFim!) : [];
  // Rastreio por GPS deste aparelho (null se a viagem não foi rastreada aqui)
  const gps = rastreio.resumo(viagem.id);
  const comparacao = rodado !== null ? compararDistancias(rodado, gps?.distanciaM ?? null, gps?.cobertura ?? null) : null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!foto) return setErro("Tire a foto do mostrador no fim da viagem.");
    if (kmFim === null) return setErro("Informe o km do mostrador.");
    if (kmFim < viagem.km_inicio) return setErro(`O km final não pode ser menor que o inicial (${km(viagem.km_inicio)}).`);

    setSalvando(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const caminho = await enviarFoto(supabase, user!.id, foto, `viagem-fim-${viagem.vehicles.placa}`);
      // Números finais do GPS, calculados no momento de salvar
      const final = rastreio.resumo(viagem.id);
      if (final && final.trilha.length > 1) {
        // A trilha é gravada antes de finalizar (depois disso o banco não deixa mais alterar).
        // Se falhar, a viagem é finalizada do mesmo jeito: o rastreio nunca pode impedir o registro.
        await supabase.from("trip_trilhas").upsert({ trip_id: viagem.id, pontos: final.trilha });
      }
      const base = { km_fim: kmFim, foto_fim: caminho, finalizada_em: new Date().toISOString(), status: "finalizada" };
      const dadosGps = final
        ? {
            gps_distancia_m: final.distanciaM,
            gps_cobertura: final.cobertura,
            gps_interrupcoes: Math.min(final.interrupcoes, 32000),
            gps_pontos: final.pontos,
            vel_max_kmh: Math.min(final.velMaxKmh, 399),
            vel_media_kmh: Math.min(final.velMediaKmh, 399),
          }
        : {};
      let { error } = await supabase.from("trips").update({ ...base, ...dadosGps }).eq("id", viagem.id);
      // Banco ainda sem as colunas do GPS (banco.sql não atualizado): finaliza sem os dados do GPS
      if (error && final) ({ error } = await supabase.from("trips").update(base).eq("id", viagem.id));
      if (error) throw new Error(error.message);
      rastreio.encerrar();
      router.push(`/?finalizada=${viagem.id}`);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="painel max-w-2xl">
      <div className="painel-cabecalho">
        <h2 className="painel-titulo">Registro de chegada</h2>
      </div>
      <dl className="grid grid-cols-2 border-b border-borda bg-superficie-2 text-[13px] sm:grid-cols-4">
        {[
          ["Placa", <span key="p" className="mono font-semibold">{formatarPlaca(viagem.vehicles.placa)}</span>],
          ["Veículo", viagem.vehicles.modelo || "—"],
          ["Saída", dataHora(viagem.iniciada_em)],
          ["Km na saída", <span key="k" className="tabular-nums">{km(viagem.km_inicio)}</span>],
        ].map(([rotulo, valor], i) => (
          <div key={i} className="border-borda px-4 py-2.5 sm:border-r last:border-r-0">
            <dt className="text-[11px] font-semibold tracking-wider text-texto-2 uppercase">{rotulo}</dt>
            <dd className="mt-0.5 font-medium">{valor}</dd>
          </div>
        ))}
      </dl>
      <div className="painel-corpo space-y-4">
        <FotoNumero
          rotulo="Odômetro na chegada"
          modo="odometro"
          unidade="km"
          referencia={viagem.km_inicio}
          valor={kmTexto}
          onValor={setKmTexto}
          onFoto={setFoto}
          fotoObrigatoria
        />
        {rodado !== null && (
          <div className="flex items-center justify-between rounded border border-borda border-l-[3px] border-l-primaria bg-primaria-suave px-4 py-2.5 text-[13px]">
            <span className="font-medium">Distância percorrida</span>
            <span className="text-[16px] font-semibold tabular-nums">{km(rodado)}</span>
          </div>
        )}
        {comparacao && <ConferenciaGps comparacao={comparacao} odometroKm={rodado!} gps={gps} />}
        <AvisoManutencao
          veiculoId={viagem.vehicle_id}
          placa={viagem.vehicles.placa}
          itens={aviso}
          titulo="Ao finalizar esta viagem, o veículo precisará de:"
          semBotao
        />
        {erro && <p className="erro">{erro}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-borda bg-superficie-2 px-4 py-3">
        <Link href="/" className="botao-secundario">Cancelar</Link>
        <button className="botao" disabled={salvando}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />}
          {salvando ? "Salvando…" : "Finalizar viagem"}
        </button>
      </div>
    </form>
  );
}
