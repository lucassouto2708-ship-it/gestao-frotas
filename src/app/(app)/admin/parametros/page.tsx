import { Pagina, Painel } from "@/components/Pagina";
import { dataHora } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { Configuracoes, Vehicle } from "@/lib/types";
import { PadraoFrota, TabelaParametros } from "./Parametros";

export default async function Parametros() {
  const { supabase } = await requireAdmin();
  const [{ data: config }, { data: veiculos }, { data: perfis }] = await Promise.all([
    supabase.from("configuracoes").select("*").maybeSingle<Configuracoes>(),
    supabase.from("vehicles").select("*").order("placa"),
    supabase.from("profiles").select("id, nome, email"),
  ]);
  const padrao = config ?? { intervalo_oleo: 10000, intervalo_revisao: 20000, atualizado_por: null, atualizado_em: null };
  const nomeDe = new Map(((perfis ?? []) as { id: string; nome: string; email: string | null }[]).map((p) => [p.id, p.nome || p.email || "—"]));

  return (
    <Pagina
      titulo="Parâmetros de manutenção"
      descricao="Defina de quantos em quantos km cada veículo deve trocar o óleo e fazer revisão. O aviso “em breve” aparece a 90% do intervalo."
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
          <PadraoFrota oleo={padrao.intervalo_oleo} revisao={padrao.intervalo_revisao} totalVeiculos={(veiculos ?? []).length} />
        </Painel>
        <TabelaParametros veiculos={(veiculos ?? []) as Vehicle[]} nomes={Object.fromEntries(nomeDe)} />
      </div>
    </Pagina>
  );
}
