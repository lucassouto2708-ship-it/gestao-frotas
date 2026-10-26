"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { enviarFoto } from "@/lib/imagem";
import { dataHora, formatarPlaca, km } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import type { Trip, Vehicle } from "@/lib/types";

export function FormFinalizar({ viagem }: { viagem: Trip & { vehicles: Pick<Vehicle, "placa" | "modelo"> } }) {
  const router = useRouter();
  const [kmTexto, setKmTexto] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const kmFim = paraNumero(kmTexto, "odometro");
  const rodado = kmFim !== null && kmFim >= viagem.km_inicio ? kmFim - viagem.km_inicio : null;

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
      const { error } = await supabase
        .from("trips")
        .update({ km_fim: kmFim, foto_fim: caminho, finalizada_em: new Date().toISOString(), status: "finalizada" })
        .eq("id", viagem.id);
      if (error) throw new Error(error.message);
      router.push("/");
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
