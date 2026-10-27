"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

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
    if (!confirm("Excluir este veículo e todo o histórico dele? Essa ação não pode ser desfeita.")) return;
    const { error } = await createClient().from("vehicles").delete().eq("id", veiculo.id);
    if (error) return setMsg({ ok: false, texto: error.message });
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <label className="block">
        <span className="rotulo">Modelo</span>
        <input className="campo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="rotulo">Óleo a cada (km)</span>
          <input className="campo text-right tabular-nums" type="number" min={1} value={oleo} onChange={(e) => setOleo(e.target.value)} />
        </label>
        <label className="block">
          <span className="rotulo">Revisão a cada (km)</span>
          <input className="campo text-right tabular-nums" type="number" min={1} value={revisao} onChange={(e) => setRevisao(e.target.value)} />
        </label>
      </div>
      <p className="ajuda -mt-1">
        Para mudar o padrão da frota ou vários carros de uma vez, use <Link href="/admin/parametros" className="link">Parâmetros</Link>.
      </p>
      <label className="block">
        <span className="rotulo">Corrigir km atual</span>
        <input className="campo text-right tabular-nums" inputMode="numeric" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)} />
      </label>
      {msg && <p className={msg.ok ? "sucesso" : "erro"}>{msg.texto}</p>}
      <div className="flex gap-2">
        <button className="botao flex-1"><Save size={15} /> Salvar alterações</button>
      </div>
      <div className="mt-2 border-t border-borda pt-3">
        <p className="mb-2 text-xs text-texto-2">A exclusão remove o veículo e todo o histórico de viagens, medições e manutenções.</p>
        <button type="button" className="botao-perigo w-full" onClick={excluir}><Trash2 size={15} /> Excluir veículo</button>
      </div>
    </form>
  );
}
