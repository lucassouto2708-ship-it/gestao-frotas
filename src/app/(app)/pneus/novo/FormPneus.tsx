"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { DiagramaPneus } from "@/components/DiagramaPneus";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { Selo } from "@/components/Selo";
import { enviarFoto } from "@/lib/imagem";
import { PNEUS, TWI_ATENCAO, TWI_MINIMO, formatarPlaca, nivelPneu } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

type Campo = (typeof PNEUS)[number]["campo"];

export function FormPneus({ veiculos }: { veiculos: Vehicle[] }) {
  const router = useRouter();
  const [veiculoId, setVeiculoId] = useState(veiculos.length === 1 ? veiculos[0].id : "");
  const [valores, setValores] = useState<Record<Campo, string>>({
    dianteiro_esquerdo: "",
    dianteiro_direito: "",
    traseiro_esquerdo: "",
    traseiro_direito: "",
  });
  const [fotos, setFotos] = useState<Partial<Record<Campo, Blob | null>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const veiculo = veiculos.find((v) => v.id === veiculoId);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!veiculo) return setErro("Escolha o carro.");
    const medidas = {} as Record<Campo, number>;
    for (const p of PNEUS) {
      const n = paraNumero(valores[p.campo], "pneu");
      if (n === null || n < 0 || n > 20) return setErro(`Valor inválido para ${p.rotulo.toLowerCase()} (0 a 20 mm).`);
      medidas[p.campo] = n;
    }

    setSalvando(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const caminhos: Record<string, string | null> = {};
      for (const p of PNEUS) {
        const foto = fotos[p.campo];
        caminhos[p.foto] = foto ? await enviarFoto(supabase, user!.id, foto, `pneu-${p.foto}-${veiculo.placa}`) : null;
      }
      const { error } = await supabase
        .from("tire_measurements")
        .insert({ vehicle_id: veiculo.id, user_id: user!.id, ...medidas, ...caminhos });
      if (error) throw new Error(error.message);
      setSalvo(true);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (salvo) {
    return (
      <div className="painel max-w-3xl">
        <div className="painel-cabecalho">
          <h2 className="painel-titulo">Medição registrada</h2>
        </div>
        <div className="painel-corpo space-y-4">
          <p className="sucesso flex items-center gap-2">
            <CheckCircle2 size={15} /> Medição salva para o veículo <b className="mono">{formatarPlaca(veiculo!.placa)}</b>.
          </p>
          <Diagrama valores={valores} />
        </div>
        <div className="flex justify-end border-t border-borda bg-superficie-2 px-4 py-3">
          <button className="botao" onClick={() => router.push("/")}>Concluir</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="grid max-w-[1100px] gap-4 lg:grid-cols-[1fr_320px]">
      <div className="painel">
        <div className="painel-cabecalho">
          <h2 className="painel-titulo">Aferição do sulco</h2>
        </div>
        <div className="painel-corpo space-y-4">
          <div className="max-w-md">
            <label className="rotulo" htmlFor="veiculo">Veículo <span className="text-perigo">*</span></label>
            <select id="veiculo" className="campo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} required>
              <option value="">Selecione…</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>{formatarPlaca(v.placa)} {v.modelo && `· ${v.modelo}`}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-x-6 gap-y-5 border-t border-borda pt-4 sm:grid-cols-2">
            {PNEUS.map((p) => (
              <FotoNumero
                key={p.campo}
                rotulo={p.rotulo}
                modo="pneu"
                unidade="mm"
                valor={valores[p.campo]}
                onValor={(v) => setValores((s) => ({ ...s, [p.campo]: v }))}
                onFoto={(f) => setFotos((s) => ({ ...s, [p.campo]: f }))}
              />
            ))}
          </div>
          {erro && <p className="erro">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-borda bg-superficie-2 px-4 py-3">
          <Link href="/" className="botao-secundario">Cancelar</Link>
          <button className="botao" disabled={salvando}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {salvando ? "Salvando…" : "Salvar medição"}
          </button>
        </div>
      </div>

      <div className="space-y-4 self-start">
        <div className="painel">
          <div className="painel-cabecalho">
            <h2 className="painel-titulo">Situação dos pneus</h2>
          </div>
          <div className="painel-corpo">
            <Diagrama valores={valores} />
          </div>
        </div>
        <div className="painel">
          <div className="painel-cabecalho">
            <h2 className="painel-titulo">Critérios</h2>
          </div>
          <table className="tabela">
            <tbody>
              <tr><td><Selo nivel="ok">OK</Selo></td><td className="num">≥ {TWI_ATENCAO.toLocaleString("pt-BR")} mm</td></tr>
              <tr><td><Selo nivel="atencao">Atenção</Selo></td><td className="num">{TWI_MINIMO.toLocaleString("pt-BR")} a {TWI_ATENCAO.toLocaleString("pt-BR")} mm</td></tr>
              <tr><td><Selo nivel="critico">Trocar</Selo></td><td className="num">&lt; {TWI_MINIMO.toLocaleString("pt-BR")} mm (TWI)</td></tr>
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-xs text-texto-2">Mínimo legal (Contran): {TWI_MINIMO.toLocaleString("pt-BR")} mm.</p>
        </div>
      </div>
    </form>
  );
}

function Diagrama({ valores }: { valores: Record<Campo, string> }) {
  // Sulco de pneu vai de 0 a ~20 mm: valor maior (ex.: "127" sem a vírgula) não entra no mostrador
  const n = (c: Campo) => {
    const v = paraNumero(valores[c], "pneu");
    return v !== null && v >= 0 && v <= 20 ? v : null;
  };
  return (
    <DiagramaPneus
      medidas={{
        dianteiro_esquerdo: n("dianteiro_esquerdo"),
        dianteiro_direito: n("dianteiro_direito"),
        traseiro_esquerdo: n("traseiro_esquerdo"),
        traseiro_direito: n("traseiro_direito"),
      }}
    />
  );
}
