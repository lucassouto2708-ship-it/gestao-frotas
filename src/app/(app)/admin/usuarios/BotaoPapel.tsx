"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldMinus, UserCheck, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

/** Promove motorista a gestor ou volta gestor a motorista (a regra é conferida no banco). */
export function BotaoPapel({ id, role }: { id: string; role: Role }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const novo = role === "gestor" ? "motorista" : "gestor";
  const Icone = salvando ? Loader2 : novo === "gestor" ? ShieldCheck : ShieldMinus;

  return (
    <button
      className="botao-secundario botao-pequeno"
      disabled={salvando}
      onClick={async () => {
        setSalvando(true);
        const { error } = await createClient().rpc("definir_papel", { p_usuario: id, p_papel: novo });
        setSalvando(false);
        if (error) alert(error.message);
        router.refresh();
      }}
    >
      <Icone size={13} className={salvando ? "animate-spin" : ""} />
      {novo === "gestor" ? "Tornar gestor" : "Tornar motorista"}
    </button>
  );
}

/** Desativa/reativa o acesso de uma pessoa (sem apagar o histórico dela). */
export function BotaoAtivo({ id, ativo, nome }: { id: string; ativo: boolean; nome: string }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const Icone = salvando ? Loader2 : ativo ? UserX : UserCheck;

  return (
    <button
      className="botao-secundario botao-pequeno"
      disabled={salvando}
      onClick={async () => {
        if (ativo && !confirm(`Desativar o acesso de ${nome}? Ela deixa de entrar no sistema; o histórico é mantido.`)) return;
        setSalvando(true);
        const { error } = await createClient().rpc("definir_ativo", { p_usuario: id, p_ativo: !ativo });
        setSalvando(false);
        if (error) alert(error.message);
        router.refresh();
      }}
    >
      <Icone size={13} className={salvando ? "animate-spin" : ""} />
      {ativo ? "Desativar" : "Reativar"}
    </button>
  );
}

/** ADM: coloca alguém em uma organização (ou muda de organização) já com o papel. */
export function AtribuirUsuario({ id, organizacoes, orgAtual }: { id: string; organizacoes: { id: string; nome: string }[]; orgAtual: string | null }) {
  const router = useRouter();
  const [org, setOrg] = useState(orgAtual ?? "");
  const [papel, setPapel] = useState<"motorista" | "gestor">("motorista");
  const [salvando, setSalvando] = useState(false);

  return (
    <span className="inline-flex items-center gap-1">
      <select className="campo h-8 w-36 text-xs" value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Organização">
        <option value="">Organização…</option>
        {organizacoes.map((o) => (
          <option key={o.id} value={o.id}>{o.nome}</option>
        ))}
      </select>
      <select className="campo h-8 w-28 text-xs" value={papel} onChange={(e) => setPapel(e.target.value as "motorista" | "gestor")} aria-label="Papel">
        <option value="motorista">Motorista</option>
        <option value="gestor">Gestor</option>
      </select>
      <button
        className="botao botao-pequeno"
        disabled={!org || salvando}
        onClick={async () => {
          setSalvando(true);
          const { error } = await createClient().rpc("atribuir_usuario", { p_usuario: id, p_org: org, p_papel: papel });
          setSalvando(false);
          if (error) alert(error.message);
          router.refresh();
        }}
      >
        {salvando ? <Loader2 size={13} className="animate-spin" /> : null} Atribuir
      </button>
    </span>
  );
}
