"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dataHora } from "@/lib/regras";

export type Vinculado = { id: string; nome: string; vinculadoPor: string | null; vinculadoEm: string };
export type Usuario = { id: string; nome: string };

/** Gestor/ADM: escolhe quais usuários podem usar este veículo. */
export function Motoristas({ veiculoId, vinculados, usuarios }: { veiculoId: string; vinculados: Vinculado[]; usuarios: Usuario[] }) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const disponiveis = usuarios.filter((u) => !vinculados.some((v) => v.id === u.id));

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    if (!escolhido) return;
    setOcupado("novo");
    setErro(null);
    const { error } = await createClient().from("vehicle_users").insert({ vehicle_id: veiculoId, user_id: escolhido });
    setOcupado(null);
    if (error) return setErro(error.message);
    setEscolhido("");
    router.refresh();
  }

  async function desvincular(v: Vinculado) {
    if (!confirm(`Desvincular ${v.nome} deste veículo? Ele deixa de ver o carro e de registrar viagens, medições e manutenções nele. O histórico já registrado é mantido.`)) return;
    setOcupado(v.id);
    setErro(null);
    const { error } = await createClient().from("vehicle_users").delete().eq("vehicle_id", veiculoId).eq("user_id", v.id);
    setOcupado(null);
    if (error) return setErro(error.message);
    router.refresh();
  }

  return (
    <div>
      {vinculados.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-alerta">Nenhum motorista vinculado: nenhum motorista consegue usar este veículo (gestores da organização ainda conseguem).</p>
      ) : (
        <ul className="divide-y divide-borda">
          {vinculados.map((v) => (
            <li key={v.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{v.nome}</p>
                <p className="text-xs text-texto-2">
                  {v.vinculadoPor ? `Vinculado por ${v.vinculadoPor}` : "Vinculado automaticamente"} em {dataHora(v.vinculadoEm)}
                </p>
              </div>
              <button
                type="button"
                title="Desvincular"
                disabled={ocupado !== null}
                onClick={() => desvincular(v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-texto-2 hover:bg-perigo-suave hover:text-perigo disabled:opacity-50"
              >
                {ocupado === v.id ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={vincular} className="flex gap-2 border-t border-borda px-4 py-3">
        <select className="campo" value={escolhido} onChange={(e) => setEscolhido(e.target.value)} aria-label="Motorista para vincular">
          <option value="">{disponiveis.length ? "Selecione um motorista…" : "Todos os motoristas já estão vinculados"}</option>
          {disponiveis.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <button className="botao shrink-0" disabled={!escolhido || ocupado !== null}>
          {ocupado === "novo" ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Vincular
        </button>
      </form>
      {erro && <p className="erro mx-4 mb-3">{erro}</p>}
    </div>
  );
}
