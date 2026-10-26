"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
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
    <Pagina titulo="Cadastrar veículo" descricao="Inclua um veículo na frota com a quilometragem atual do odômetro." voltar="/">
      <form onSubmit={salvar} className="painel max-w-2xl">
        <div className="painel-cabecalho">
          <h2 className="painel-titulo">Dados do veículo</h2>
        </div>
        <div className="painel-corpo grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="placa">Placa <span className="text-perigo">*</span></label>
            <input
              id="placa"
              className="campo mono uppercase"
              placeholder="ABC1D23"
              maxLength={8}
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              required
            />
            <p className="ajuda">Padrão antigo (ABC1234) ou Mercosul (ABC1D23).</p>
          </div>
          <div>
            <label className="rotulo" htmlFor="modelo">Modelo</label>
            <input id="modelo" className="campo" placeholder="Ex.: Fiat Strada 2023" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <FotoNumero rotulo="Quilometragem atual do odômetro" modo="odometro" unidade="km" valor={kmTexto} onValor={setKmTexto} onFoto={setFoto} />
          </div>
          {erro && <p className="erro sm:col-span-2">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-borda bg-superficie-2 px-4 py-3">
          <Link href="/" className="botao-secundario">Cancelar</Link>
          <button className="botao" disabled={salvando}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {salvando ? "Salvando…" : "Cadastrar veículo"}
          </button>
        </div>
      </form>
    </Pagina>
  );
}
