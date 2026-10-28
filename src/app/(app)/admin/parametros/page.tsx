import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { dataHora } from "@/lib/regras";
import { requireGestor } from "@/lib/supabase/server";
import type { Configuracoes, Organizacao, Vehicle } from "@/lib/types";
import { PadraoFrota, TabelaParametros } from "./Parametros";

export default async function Parametros({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { supabase, profile } = await requireGestor();
  const { org: orgParam } = await searchParams;
  const admin = profile.role === "admin";

  // Os parâmetros são por organização: o gestor usa a dele; o ADM escolhe qual editar
  const { data: orgsData } = admin ? await supabase.from("organizacoes").select("*").order("nome") : { data: [] };
  const organizacoes = (orgsData ?? []) as Organizacao[];
  const orgId = admin ? (organizacoes.find((o) => o.id === orgParam) ?? organizacoes[0])?.id : profile.organizacao_id;

  const cabecalhoAdmin = admin && (
    <form className="flex items-center gap-2">
      <select name="org" aria-label="Organização" defaultValue={orgId ?? ""} className="campo w-56">
        {organizacoes.map((o) => (
          <option key={o.id} value={o.id}>{o.nome}</option>
        ))}
      </select>
      <button className="botao-secundario">Ver</button>
    </form>
  );

  if (!orgId) {
    return (
      <Pagina titulo="Parâmetros de manutenção" acoes={cabecalhoAdmin}>
        <EstadoVazio titulo="Nenhuma organização" texto="Cadastre uma organização para definir os parâmetros." />
      </Pagina>
    );
  }

  const [{ data: config }, { data: veiculos }, { data: perfis }] = await Promise.all([
    supabase.from("configuracoes").select("*").eq("organizacao_id", orgId).maybeSingle<Configuracoes>(),
    supabase.from("vehicles").select("*").eq("organizacao_id", orgId).order("placa"),
    supabase.from("profiles").select("id, nome, email"),
  ]);
  const padrao = config ?? { intervalo_oleo: 10000, intervalo_revisao: 20000, atualizado_por: null, atualizado_em: null };
  const nomeDe = new Map(((perfis ?? []) as { id: string; nome: string; email: string | null }[]).map((p) => [p.id, p.nome || p.email || "—"]));

  return (
    <Pagina
      titulo="Parâmetros de manutenção"
      descricao="Defina de quantos em quantos km cada veículo deve trocar o óleo e fazer revisão. O aviso “em breve” aparece a 90% do intervalo."
      acoes={cabecalhoAdmin}
    >
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Painel
          titulo="Padrão da frota"
          acoes={
            padrao.atualizado_em && (
              <span className="text-xs text-texto-2">
                {padrao.atualizado_por ? `por ${nomeDe.get(padrao.atualizado_por) ?? "—"} ` : ""}em {dataHora(padrao.atualizado_em)}
              </span>
            )
          }
          className="self-start"
        >
          <PadraoFrota organizacaoId={orgId} oleo={padrao.intervalo_oleo} revisao={padrao.intervalo_revisao} totalVeiculos={(veiculos ?? []).length} />
        </Painel>
        <TabelaParametros veiculos={(veiculos ?? []) as Vehicle[]} nomes={Object.fromEntries(nomeDe)} />
      </div>
    </Pagina>
  );
}
