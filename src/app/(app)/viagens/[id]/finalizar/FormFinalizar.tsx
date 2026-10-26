"use client";

import { useState } from "react";
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
    <form onSubmit={salvar} className="card max-w-lg space-y-4">
      <div className="rounded-lg bg-slate-100 p-3 text-sm">
        <p className="font-bold">{formatarPlaca(viagem.vehicles.placa)} {viagem.vehicles.modelo}</p>
        <p className="text-slate-600">Saída {dataHora(viagem.iniciada_em)} com {km(viagem.km_inicio)}</p>
      </div>
      <FotoNumero
        rotulo="Mostrador no fim da viagem"
        modo="odometro"
        unidade="km"
        referencia={viagem.km_inicio}
        valor={kmTexto}
        onValor={setKmTexto}
        onFoto={setFoto}
        fotoObrigatoria
      />
      {rodado !== null && (
        <p className="rounded-lg bg-emerald-50 p-3 text-center text-emerald-800">
          Distância percorrida: <b>{km(rodado)}</b>
        </p>
      )}
      {erro && <p className="erro">{erro}</p>}
      <button className="botao w-full" disabled={salvando}>{salvando ? "Salvando…" : "Finalizar viagem"}</button>
    </form>
  );
}
