"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Pencil, Pause, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function NovaOrganizacao() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"empresa" | "municipio">("empresa");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("organizacoes").insert({ nome: nome.trim(), tipo, criada_por: user?.id });
    setOcupado(false);
    if (error) return setErro(error.code === "23505" ? "Já existe uma organização com esse nome." : error.message);
    setNome("");
    router.refresh();
  }

  return (
    <form onSubmit={criar} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="rotulo" htmlFor="org-nome">Nome do cliente</label>
          <input id="org-nome" className="campo" placeholder="Ex.: Prefeitura de Exemplo" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
        </div>
        <div>
          <label className="rotulo" htmlFor="org-tipo">Tipo</label>
          <select id="org-tipo" className="campo w-40" value={tipo} onChange={(e) => setTipo(e.target.value as "empresa" | "municipio")}>
            <option value="empresa">Empresa</option>
            <option value="municipio">Município</option>
          </select>
        </div>
        <button className="botao" disabled={ocupado || nome.trim().length < 2}>
          {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />} Cadastrar organização
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
    </form>
  );
}

export function AcoesOrganizacao({ id, nome, ativa }: { id: string; nome: string; ativa: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function atualizar(campos: { ativa?: boolean; nome?: string }) {
    setOcupado(true);
    const { error } = await createClient().from("organizacoes").update(campos).eq("id", id);
    setOcupado(false);
    if (error) alert(error.code === "23505" ? "Já existe uma organização com esse nome." : error.message);
    router.refresh();
  }

  return (
    <span className="inline-flex gap-1">
      <button
        className="botao-secundario botao-pequeno"
        disabled={ocupado}
        onClick={() => {
          const novo = prompt("Novo nome da organização:", nome)?.trim();
          if (novo && novo !== nome) atualizar({ nome: novo });
        }}
      >
        <Pencil size={13} /> Renomear
      </button>
      <button
        className="botao-secundario botao-pequeno"
        disabled={ocupado}
        onClick={() => {
          if (ativa && !confirm(`Suspender ${nome}? Ninguém dessa organização consegue entrar até você reativar. Os dados são mantidos.`)) return;
          atualizar({ ativa: !ativa });
        }}
      >
        {ocupado ? <Loader2 size={13} className="animate-spin" /> : ativa ? <Pause size={13} /> : <Play size={13} />}
        {ativa ? "Suspender" : "Reativar"}
      </button>
    </span>
  );
}
