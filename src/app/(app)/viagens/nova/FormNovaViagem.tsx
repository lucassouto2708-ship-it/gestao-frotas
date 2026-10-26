"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { enviarFoto } from "@/lib/imagem";
import { formatarPlaca, km } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

export function FormNovaViagem({ veiculos, emUso }: { veiculos: Vehicle[]; emUso: string[] }) {
  const router = useRouter();
  const [veiculoId, setVeiculoId] = useState("");
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
      const { error } = await supabase.from("trips").insert({
        vehicle_id: veiculo.id,
        user_id: user!.id,
        destino,
        km_inicio: kmInicio,
        foto_inicio: caminho,
      });
      if (error) throw new Error(error.code === "23505" ? "Este carro já está com uma viagem em andamento." : error.message);
      router.push("/");
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="card max-w-lg space-y-4">
      <div>
        <label className="rotulo" htmlFor="veiculo">Carro</label>
        <select id="veiculo" className="campo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} required>
          <option value="">Selecione…</option>
          {veiculos.map((v) => (
            <option key={v.id} value={v.id} disabled={emUso.includes(v.id)}>
              {formatarPlaca(v.placa)} {v.modelo && `· ${v.modelo}`} {emUso.includes(v.id) ? "(em viagem)" : ""}
            </option>
          ))}
        </select>
        {veiculo && <p className="mt-1 text-xs text-slate-500">Último km registrado: {km(veiculo.km_atual)}</p>}
      </div>
      <div>
        <label className="rotulo" htmlFor="destino">Destino / motivo (opcional)</label>
        <input id="destino" className="campo" value={destino} onChange={(e) => setDestino(e.target.value)} />
      </div>
      <FotoNumero
        rotulo="Mostrador no início da viagem"
        modo="odometro"
        unidade="km"
        referencia={veiculo?.km_atual}
        valor={kmTexto}
        onValor={setKmTexto}
        onFoto={setFoto}
        fotoObrigatoria
      />
      {erro && <p className="erro">{erro}</p>}
      <button className="botao w-full" disabled={salvando}>{salvando ? "Salvando…" : "Iniciar viagem"}</button>
    </form>
  );
}
