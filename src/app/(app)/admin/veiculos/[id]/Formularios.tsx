"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

export function FormManutencao({ veiculoId, kmAtual }: { veiculoId: string; kmAtual: number }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"oleo" | "revisao">("oleo");
  const [kmTexto, setKmTexto] = useState(String(kmAtual));
  const [data, setData] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await createClient()
      .from("maintenances")
      .insert({ vehicle_id: veiculoId, tipo, km: Number(kmTexto.replace(/\D/g, "")), realizada_em: data, observacao: obs });
    setSalvando(false);
    if (error) return setMsg({ ok: false, texto: error.message });
    setMsg({ ok: true, texto: "Manutenção registrada. O contador foi zerado." });
    setObs("");
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as "oleo" | "revisao")}>
        <option value="oleo">Troca de óleo</option>
        <option value="revisao">Revisão</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input className="campo" inputMode="numeric" value={kmTexto} onChange={(e) => setKmTexto(e.target.value)} aria-label="Km" required />
        <input className="campo" type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" required />
      </div>
      <input className="campo" placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
      {msg && <p className={msg.ok ? "text-sm text-emerald-700" : "erro"}>{msg.texto}</p>}
      <button className="botao w-full" disabled={salvando}>Registrar</button>
    </form>
  );
}

export function FormConfigVeiculo({ veiculo }: { veiculo: Vehicle }) {
  const router = useRouter();
  const [modelo, setModelo] = useState(veiculo.modelo);
  const [oleo, setOleo] = useState(String(veiculo.intervalo_oleo));
  const [revisao, setRevisao] = useState(String(veiculo.intervalo_revisao));
  const [kmAtual, setKmAtual] = useState(String(veiculo.km_atual));
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient()
      .from("vehicles")
      .update({
        modelo,
        intervalo_oleo: Number(oleo),
        intervalo_revisao: Number(revisao),
        km_atual: Number(kmAtual.replace(/\D/g, "")),
      })
      .eq("id", veiculo.id);
    if (error) return setMsg({ ok: false, texto: error.message });
    setMsg({ ok: true, texto: "Salvo." });
    router.refresh();
  }

  async function excluir() {
    if (!confirm("Excluir este carro e todo o histórico dele? Essa ação não pode ser desfeita.")) return;
    const { error } = await createClient().from("vehicles").delete().eq("id", veiculo.id);
    if (error) return setMsg({ ok: false, texto: error.message });
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-3 text-sm">
      <label className="block">
        <span className="rotulo">Modelo</span>
        <input className="campo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="rotulo">Trocar óleo a cada (km)</span>
          <input className="campo" type="number" min={1} value={oleo} onChange={(e) => setOleo(e.target.value)} />
        </label>
        <label className="block">
          <span className="rotulo">Revisão a cada (km)</span>
          <input className="campo" type="number" min={1} value={revisao} onChange={(e) => setRevisao(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="rotulo">Corrigir km atual</span>
        <input className="campo" inputMode="numeric" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)} />
      </label>
      {msg && <p className={msg.ok ? "text-emerald-700" : "erro"}>{msg.texto}</p>}
      <div className="flex gap-2">
        <button className="botao flex-1">Salvar</button>
        <button type="button" className="botao-secundario text-red-600" onClick={excluir}>Excluir carro</button>
      </div>
    </form>
  );
}
