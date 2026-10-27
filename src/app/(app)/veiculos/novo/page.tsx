"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { Pagina } from "@/components/Pagina";
import { enviarFoto } from "@/lib/imagem";
import { hojeISO, km, normalizarPlaca, placaValida } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";

export default function NovoVeiculo() {
  const router = useRouter();
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [kmTexto, setKmTexto] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [anterior, setAnterior] = useState({ oleoKm: "", oleoData: "", revisaoKm: "", revisaoData: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const kmInicial = paraNumero(kmTexto, "odometro");
    if (!placaValida(placa)) return setErro("Placa inválida. Use o formato ABC1234 ou ABC1D23.");
    if (kmInicial === null) return setErro("Informe o km do mostrador.");

    // Última troca de óleo / revisão (opcionais): se preencher um campo, precisa dos dois
    const ultimas: Record<string, number | string | null> = {};
    for (const [nome, chaveKm, chaveData, colKm, colData] of [
      ["troca de óleo", "oleoKm", "oleoData", "km_ultima_troca_oleo", "data_ultima_troca_oleo"],
      ["revisão", "revisaoKm", "revisaoData", "km_ultima_revisao", "data_ultima_revisao"],
    ] as const) {
      const kmTxt = anterior[chaveKm].trim(), dt = anterior[chaveData];
      if (!kmTxt && !dt) continue;
      const n = paraNumero(kmTxt, "odometro");
      if (n === null || !dt) return setErro(`Para a última ${nome}, informe o km e a data.`);
      if (n > kmInicial) return setErro(`O km da última ${nome} (${km(n)}) não pode ser maior que o km atual (${km(kmInicial)}).`);
      ultimas[colKm] = n;
      ultimas[colData] = dt;
    }

    setSalvando(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const caminho = foto ? await enviarFoto(supabase, user!.id, foto, "cadastro") : null;
      const { data: criado, error } = await supabase
        .from("vehicles")
        .insert({
          placa: normalizarPlaca(placa),
          modelo,
          km_inicial: kmInicial,
          km_atual: kmInicial,
          foto_km_inicial: caminho,
          created_by: user!.id,
          ...ultimas,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.code === "23505" ? "Essa placa já está cadastrada." : error.message);
      router.push(`/veiculos/${criado.id}`);
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
        </div>
        <div className="border-t border-borda">
          <div className="px-4 pt-3">
            <h3 className="text-[13px] font-semibold">Última manutenção <span className="font-normal text-texto-2">(opcional)</span></h3>
            <p className="ajuda">
              Informe quando foram feitas a última troca de óleo e a última revisão. Os avisos passam a contar a partir delas,
              e elas entram no histórico do veículo. Sem essa informação, a contagem começa no km atual.
            </p>
          </div>
          <div className="overflow-x-auto px-4 pt-2 pb-4">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold tracking-wider text-texto-2 uppercase">
                  <th className="pb-1 font-semibold">Serviço</th>
                  <th className="pb-1 pl-2 font-semibold">Km no serviço</th>
                  <th className="pb-1 pl-2 font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Troca de óleo", "oleoKm", "oleoData"],
                  ["Revisão", "revisaoKm", "revisaoData"],
                ] as const).map(([rotulo, chaveKm, chaveData]) => (
                  <tr key={rotulo}>
                    <td className="py-1 pr-2 font-medium whitespace-nowrap">{rotulo}</td>
                    <td className="py-1 pl-2">
                      <input
                        className="campo text-right tabular-nums"
                        inputMode="numeric"
                        placeholder="Ex.: 48000"
                        aria-label={`Km da última ${rotulo.toLowerCase()}`}
                        value={anterior[chaveKm]}
                        onChange={(e) => setAnterior((a) => ({ ...a, [chaveKm]: e.target.value }))}
                      />
                    </td>
                    <td className="py-1 pl-2">
                      <input
                        className="campo"
                        type="date"
                        max={hojeISO()}
                        aria-label={`Data da última ${rotulo.toLowerCase()}`}
                        value={anterior[chaveData]}
                        onChange={(e) => setAnterior((a) => ({ ...a, [chaveData]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {erro && <p className="erro mx-4 mb-4">{erro}</p>}
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
