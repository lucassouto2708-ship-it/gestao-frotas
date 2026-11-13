"use client";

import { useState } from "react";
import Link from "next/link";
import { Gauge, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { enviarFoto } from "@/lib/imagem";
import { cnhHabilita, formatarPlaca, km, rotuloExigida } from "@/lib/regras";
import { useRastreio } from "@/components/rastreio/RastreioProvider";
import { createClient } from "@/lib/supabase/client";
import type { CategoriaCnh, Vehicle } from "@/lib/types";

/** cnh: categoria de quem vai dirigir (null = não informada; undefined = não conferir, caso do ADM). */
export function FormNovaViagem({ veiculos, emUso, cnh }: { veiculos: Vehicle[]; emUso: string[]; cnh: CategoriaCnh | null | undefined }) {
  const router = useRouter();
  const rastreio = useRastreio();
  const habilitado = (v: Vehicle) => cnh === undefined || cnhHabilita(cnh, v.cnh_exigida);
  const bloqueados = veiculos.filter((v) => !habilitado(v));
  // Só um carro disponível para o usuário: já vem selecionado
  const livres = veiculos.filter((v) => !emUso.includes(v.id) && habilitado(v));
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
    if (!habilitado(veiculo))
      return setErro(`Sua CNH não permite dirigir este veículo: ele exige categoria ${rotuloExigida(veiculo.cnh_exigida!)}.`);
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
              <option key={v.id} value={v.id} disabled={emUso.includes(v.id) || !habilitado(v)}>
                {formatarPlaca(v.placa)} {v.modelo && `· ${v.modelo}`}{" "}
                {!habilitado(v) ? `(exige CNH ${rotuloExigida(v.cnh_exigida!)})` : emUso.includes(v.id) ? "(em viagem)" : ""}
              </option>
            ))}
          </select>
          {veiculo && <p className="ajuda">Último km registrado: <b className="tabular-nums">{km(veiculo.km_atual)}</b></p>}
          {bloqueados.length > 0 && (
            <p className="ajuda text-alerta">
              {cnh
                ? `Sua CNH é categoria ${cnh}. ${bloqueados.length === 1 ? "Um veículo exige" : `${bloqueados.length} veículos exigem`} outra categoria e não pode${bloqueados.length === 1 ? "" : "m"} ser usado${bloqueados.length === 1 ? "" : "s"}.`
                : "Sua CNH não está cadastrada, por isso os veículos que exigem categoria ficam bloqueados. Peça ao gestor para informá-la."}
            </p>
          )}
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
