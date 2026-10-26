"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { Pagina } from "@/components/Pagina";
import { enviarFoto } from "@/lib/imagem";
import { normalizarPlaca, placaValida } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";

export default function NovoVeiculo() {
  const router = useRouter();
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [kmTexto, setKmTexto] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const kmInicial = paraNumero(kmTexto, "odometro");
    if (!placaValida(placa)) return setErro("Placa inválida. Use o formato ABC1234 ou ABC1D23.");
    if (kmInicial === null) return setErro("Informe o km do mostrador.");

    setSalvando(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const caminho = foto ? await enviarFoto(supabase, user!.id, foto, "cadastro") : null;
      const { error } = await supabase.from("vehicles").insert({
        placa: normalizarPlaca(placa),
        modelo,
        km_inicial: kmInicial,
        km_atual: kmInicial,
        foto_km_inicial: caminho,
        created_by: user!.id,
      });
      if (error) throw new Error(error.code === "23505" ? "Essa placa já está cadastrada." : error.message);
      router.push("/");
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Pagina titulo="Cadastrar carro" voltar="/">
      <form onSubmit={salvar} className="card max-w-lg space-y-4">
        <div>
          <label className="rotulo" htmlFor="placa">Placa</label>
          <input
            id="placa"
            className="campo uppercase"
            placeholder="ABC1D23"
            maxLength={8}
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="modelo">Modelo (opcional)</label>
          <input id="modelo" className="campo" placeholder="Ex.: Fiat Strada 2023" value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </div>
        <FotoNumero rotulo="Km atual do mostrador" modo="odometro" unidade="km" valor={kmTexto} onValor={setKmTexto} onFoto={setFoto} />
        {erro && <p className="erro">{erro}</p>}
        <button className="botao w-full" disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar"}</button>
      </form>
    </Pagina>
  );
}
