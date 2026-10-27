"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench } from "lucide-react";
import { TIPOS_MANUTENCAO, hojeISO } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import type { TipoManutencao } from "@/lib/types";

const ZERA_CONTADOR: Partial<Record<TipoManutencao, string>> = {
  oleo: "O contador de troca de óleo será zerado.",
  revisao: "O contador de revisão será zerado.",
};

export function FormManutencao({ veiculoId, kmAtual }: { veiculoId: string; kmAtual: number }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoManutencao>("oleo");
  const [kmTexto, setKmTexto] = useState(String(kmAtual));
  const [dataServico, setDataServico] = useState(hojeISO);
  const [custo, setCusto] = useState("");
  const [obs, setObs] = useState("");
  const [comOleo, setComOleo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const kmServico = Number(kmTexto.replace(/\D/g, ""));
    const valor = custo.trim() ? Number(custo.replace(/\./g, "").replace(",", ".")) : null;
    if (!kmTexto.trim() || Number.isNaN(kmServico)) return setMsg({ ok: false, texto: "Informe o km do veículo no serviço." });
    if (valor !== null && (Number.isNaN(valor) || valor < 0)) return setMsg({ ok: false, texto: "Custo inválido. Use, por exemplo, 289,90." });
    if (tipo === "outro" && !obs.trim()) return setMsg({ ok: false, texto: "Descreva o serviço na observação." });

    setSalvando(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const base = { vehicle_id: veiculoId, km: kmServico, realizada_em: dataServico, user_id: user!.id };
    const registros = [{ ...base, tipo, custo: valor, observacao: obs.trim() }];
    if (tipo === "revisao" && comOleo) registros.push({ ...base, tipo: "oleo", custo: null, observacao: "Feita junto com a revisão" });
    const { error } = await supabase.from("maintenances").insert(registros);
    setSalvando(false);
    if (error) return setMsg({ ok: false, texto: error.message });
    setMsg({ ok: true, texto: `${TIPOS_MANUTENCAO[tipo]} registrada no histórico.` });
    setObs("");
    setCusto("");
    setComOleo(false);
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <div>
        <label className="rotulo" htmlFor="tipo-manut">Serviço</label>
        <select id="tipo-manut" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoManutencao)}>
          {Object.entries(TIPOS_MANUTENCAO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </select>
        {ZERA_CONTADOR[tipo] && <p className="ajuda">{ZERA_CONTADOR[tipo]}</p>}
      </div>
      {tipo === "revisao" && (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={comOleo} onChange={(e) => setComOleo(e.target.checked)} className="h-4 w-4 accent-[var(--primaria)]" />
          O óleo também foi trocado nesta revisão
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="rotulo" htmlFor="km-manut">Km no serviço</label>
          <input id="km-manut" className="campo text-right tabular-nums" inputMode="numeric" value={kmTexto} onChange={(e) => setKmTexto(e.target.value)} required />
        </div>
        <div>
          <label className="rotulo" htmlFor="data-manut">Data</label>
          <input id="data-manut" className="campo" type="date" max={hojeISO()} value={dataServico} onChange={(e) => setDataServico(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="rotulo" htmlFor="custo-manut">Custo (R$)</label>
        <input id="custo-manut" className="campo text-right tabular-nums" inputMode="decimal" placeholder="Opcional" value={custo} onChange={(e) => setCusto(e.target.value)} />
      </div>
      <div>
        <label className="rotulo" htmlFor="obs-manut">Observação{tipo === "outro" && <span className="text-perigo"> *</span>}</label>
        <input
          id="obs-manut"
          className="campo"
          placeholder={tipo === "outro" ? "Descreva o serviço" : "Opcional (oficina, peças, óleo usado...)"}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
      </div>
      {msg && <p className={msg.ok ? "sucesso" : "erro"}>{msg.texto}</p>}
      <button className="botao w-full" disabled={salvando}>
        {salvando ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
        Registrar no histórico
      </button>
    </form>
  );
}
