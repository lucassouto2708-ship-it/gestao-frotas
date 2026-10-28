"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dataHora } from "@/lib/regras";
import type { Convite } from "@/lib/types";

const linkDoConvite = (codigo: string) => `${window.location.origin}/convite?c=${codigo}`;

/** Gera um convite: o link leva a pessoa a se cadastrar já dentro da organização, com o papel escolhido. */
export function NovoConvite({ organizacoes, orgFixa }: { organizacoes: { id: string; nome: string }[]; orgFixa: string | null }) {
  const router = useRouter();
  const [org, setOrg] = useState(orgFixa ?? organizacoes[0]?.id ?? "");
  const [papel, setPapel] = useState<"motorista" | "gestor">("motorista");
  const [dias, setDias] = useState("7");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setGerado(null);
    setCopiado(false);
    setOcupado(true);
    const { data, error } = await createClient().rpc("criar_convite", { p_org: org, p_papel: papel, p_dias: Number(dias) });
    setOcupado(false);
    if (error) return setErro(error.message);
    setGerado(data as string);
    router.refresh();
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      prompt("Copie o link:", texto);
    }
  }

  return (
    <form onSubmit={gerar} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {orgFixa === null && (
          <div>
            <label className="rotulo" htmlFor="convite-org">Organização</label>
            <select id="convite-org" className="campo w-56" value={org} onChange={(e) => setOrg(e.target.value)} required>
              {organizacoes.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="rotulo" htmlFor="convite-papel">Papel</label>
          <select id="convite-papel" className="campo w-40" value={papel} onChange={(e) => setPapel(e.target.value as "motorista" | "gestor")}>
            <option value="motorista">Motorista</option>
            <option value="gestor">Gestor</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="convite-dias">Vale por (dias)</label>
          <input id="convite-dias" className="campo w-24" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} />
        </div>
        <button className="botao" disabled={ocupado || !org || !dias}>
          {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Gerar convite
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {gerado && (
        <div className="rounded border border-borda bg-superficie-2 p-3 text-[13px]">
          <p className="mb-1 font-semibold">Convite criado. Envie à pessoa o link abaixo (ou só o código):</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="mono break-all">{linkDoConvite(gerado)}</code>
            <button type="button" className="botao-secundario botao-pequeno" onClick={() => copiar(linkDoConvite(gerado))}>
              <Copy size={13} /> {copiado ? "Copiado!" : "Copiar link"}
            </button>
          </div>
          <p className="mt-1 text-xs text-texto-2">Código: <b className="mono">{gerado}</b></p>
        </div>
      )}
    </form>
  );
}

export function LinhaConvite({ convite, nomeOrg }: { convite: Convite; nomeOrg?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const vencido = new Date(convite.expira_em) < new Date();

  return (
    <tr>
      <td className="mono font-semibold">{convite.codigo}</td>
      {nomeOrg !== undefined && <td>{nomeOrg}</td>}
      <td>{convite.papel === "gestor" ? "Gestor" : "Motorista"}</td>
      <td className="whitespace-nowrap">
        {dataHora(convite.expira_em)} {vencido && <span className="text-perigo">(vencido)</span>}
      </td>
      <td className="num whitespace-nowrap">
        <button
          className="botao-secundario botao-pequeno mr-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(linkDoConvite(convite.codigo));
              setCopiado(true);
            } catch {
              prompt("Copie o link:", linkDoConvite(convite.codigo));
            }
          }}
        >
          <Copy size={13} /> {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <button
          className="botao-secundario botao-pequeno"
          disabled={ocupado}
          onClick={async () => {
            if (!confirm("Revogar este convite? O código deixa de funcionar.")) return;
            setOcupado(true);
            const { error } = await createClient().from("convites").delete().eq("id", convite.id);
            setOcupado(false);
            if (error) alert(error.message);
            router.refresh();
          }}
        >
          {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Revogar
        </button>
      </td>
    </tr>
  );
}
