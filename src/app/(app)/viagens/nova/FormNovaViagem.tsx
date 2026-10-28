"use client";

import { useState } from "react";
import Link from "next/link";
import { Gauge, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { enviarFoto } from "@/lib/imagem";
import { formatarPlaca, km } from "@/lib/regras";
import { useRastreio } from "@/components/rastreio/RastreioProvider";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

export function FormNovaViagem({ veiculos, emUso }: { veiculos: Vehicle[]; emUso: string[] }) {
  const router = useRouter();
  const rastreio = useRastreio();
  // Só um carro disponível para o usuário: já vem selecionado
  const livres = veiculos.filter((v) => !emUso.includes(v.id));
  const [veiculoId, setVeiculoId] = useState(livres.length === 1 ? livres[0].id : "");
  const [destino, setDestino] = useState("");
  const [kmTexto, setKmTexto] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const veiculo = veiculos.find((v) => v.id === veiculoId);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const kmInicio = paraNumero(kmTexto, "odometro");
    if (!veiculo) return setErro("Escolha o carro.");
    if (!foto) return setErro("Tire a foto do mostrador no início da viagem.");
    if (kmInicio === null) return setErro("Informe o km do mostrador.");
    if (kmInicio < veiculo.km_atual)
      return setErro(`O km informado é menor que o último registrado para este carro (${km(veiculo.km_atual)}). Confira o valor.`);

    setSalvando(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const caminho = await enviarFoto(supabase, user!.id, foto, `viagem-inicio-${veiculo.placa}`);
      const { data: criada, error } = await supabase
        .from("trips")
        .insert({
          vehicle_id: veiculo.id,
          user_id: user!.id,
          destino,
          km_inicio: kmInicio,
          foto_inicio: caminho,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.code === "23505" ? "Este carro já está com uma viagem em andamento." : error.message);
      rastreio.iniciar(criada.id, veiculo.placa); // pede a localização e passa a rastrear
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
        <h2 className="painel-titulo">Registro de saída</h2>
      </div>
      <div className="painel-corpo grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="veiculo">Veículo <span className="text-perigo">*</span></label>
          <select id="veiculo" className="campo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} required>
            <option value="">Selecione…</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id} disabled={emUso.includes(v.id)}>
                {formatarPlaca(v.placa)} {v.modelo && `· ${v.modelo}`} {emUso.includes(v.id) ? "(em viagem)" : ""}
              </option>
            ))}
          </select>
          {veiculo && <p className="ajuda">Último km registrado: <b className="tabular-nums">{km(veiculo.km_atual)}</b></p>}
        </div>
        <div>
          <label className="rotulo" htmlFor="destino">Destino / finalidade</label>
          <input id="destino" className="campo" value={destino} onChange={(e) => setDestino(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FotoNumero
            rotulo="Odômetro na saída"
            modo="odometro"
            unidade="km"
            referencia={veiculo?.km_atual}
            valor={kmTexto}
            onValor={setKmTexto}
            onFoto={setFoto}
            fotoObrigatoria
          />
        </div>
        {erro && <p className="erro sm:col-span-2">{erro}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-borda bg-superficie-2 px-4 py-3">
        <Link href="/" className="botao-secundario">Cancelar</Link>
        <button className="botao" disabled={salvando}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Gauge size={15} />}
          {salvando ? "Salvando…" : "Iniciar viagem"}
        </button>
      </div>
    </form>
  );
}
