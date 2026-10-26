"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FotoNumero, paraNumero } from "@/components/FotoNumero";
import { Selo } from "@/components/Selo";
import { enviarFoto } from "@/lib/imagem";
import { PNEUS, TWI_ATENCAO, TWI_MINIMO, formatarPlaca, nivelPneu } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

type Campo = (typeof PNEUS)[number]["campo"];

const textoNivel = { ok: "OK", atencao: "Atenção", critico: "Trocar" } as const;

export function FormPneus({ veiculos }: { veiculos: Vehicle[] }) {
  const router = useRouter();
  const [veiculoId, setVeiculoId] = useState("");
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
      <div className="card max-w-lg space-y-4">
        <p className="font-semibold text-emerald-700">Medição salva para {formatarPlaca(veiculo!.placa)}.</p>
        <Diagrama valores={valores} />
        <button className="botao w-full" onClick={() => router.push("/")}>Concluir</button>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="max-w-2xl space-y-4">
      <div className="card space-y-2">
        <label className="rotulo" htmlFor="veiculo">Carro</label>
        <select id="veiculo" className="campo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} required>
          <option value="">Selecione…</option>
          {veiculos.map((v) => (
            <option key={v.id} value={v.id}>{formatarPlaca(v.placa)} {v.modelo && `· ${v.modelo}`}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Meça o sulco de cada pneu com o medidor e tire a foto do visor. Mínimo legal: {TWI_MINIMO.toLocaleString("pt-BR")} mm
          (marca TWI). Abaixo de {TWI_ATENCAO.toLocaleString("pt-BR")} mm já é bom planejar a troca.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PNEUS.map((p) => (
          <div key={p.campo} className="card">
            <FotoNumero
              rotulo={p.rotulo}
              modo="pneu"
              unidade="mm"
              valor={valores[p.campo]}
              onValor={(v) => setValores((s) => ({ ...s, [p.campo]: v }))}
              onFoto={(f) => setFotos((s) => ({ ...s, [p.campo]: f }))}
            />
          </div>
        ))}
      </div>

      <Diagrama valores={valores} />
      {erro && <p className="erro">{erro}</p>}
      <button className="botao w-full" disabled={salvando}>{salvando ? "Salvando…" : "Salvar medição"}</button>
    </form>
  );
}

/** Visão de cima do carro com o status de cada pneu. */
function Diagrama({ valores }: { valores: Record<Campo, string> }) {
  const celula = (campo: Campo, rotulo: string) => {
    const n = paraNumero(valores[campo], "pneu");
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-xs text-slate-500">{rotulo}</span>
        <span className="text-lg font-bold">{n === null ? "–" : `${n.toLocaleString("pt-BR")} mm`}</span>
        {n !== null && <Selo nivel={nivelPneu(n)}>{textoNivel[nivelPneu(n)]}</Selo>}
      </div>
    );
  };
  return (
    <div className="card grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      {celula("dianteiro_esquerdo", "Diant. esq.")}
      <div className="row-span-2 flex h-36 w-16 items-start justify-center rounded-2xl border-2 border-slate-300 pt-2 text-xs text-slate-400">
        frente
      </div>
      {celula("dianteiro_direito", "Diant. dir.")}
      {celula("traseiro_esquerdo", "Tras. esq.")}
      {celula("traseiro_direito", "Tras. dir.")}
    </div>
  );
}
