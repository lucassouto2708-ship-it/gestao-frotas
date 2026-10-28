import { Pagina, Painel } from "@/components/Pagina";
import { dataHora } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { Configuracoes, LimpezaFotos as LinhaLimpeza, Vehicle } from "@/lib/types";
import { LimpezaFotos, type Execucao, type ResumoFotos } from "./LimpezaFotos";
import { PadraoFrota, TabelaParametros } from "./Parametros";

// A limpeza manual pode demorar um pouco (apaga em lotes)
export const maxDuration = 60;

export default async function Parametros() {
  const { supabase } = await requireAdmin();
  const [{ data: config }, { data: veiculos }, { data: perfis }] = await Promise.all([
    supabase.from("configuracoes").select("*").maybeSingle<Configuracoes>(),
    supabase.from("vehicles").select("*").order("placa"),
    supabase.from("profiles").select("id, nome, email"),
  ]);
  const meses = config?.meses_guardar_fotos ?? 6;
  const [{ data: resumoBruto, error: erroResumo }, { data: limpezas }] = await Promise.all([
    supabase.rpc("resumo_fotos", { meses }),
    supabase.from("limpezas_fotos").select("*").order("executada_em", { ascending: false }).limit(5),
  ]);
  const linhaResumo = Array.isArray(resumoBruto) ? resumoBruto[0] : resumoBruto;
  const resumo: ResumoFotos | null =
    erroResumo || !linhaResumo
      ? null
      : {
          total: Number(linhaResumo.total),
          total_bytes: Number(linhaResumo.total_bytes),
          antigas: Number(linhaResumo.antigas),
          antigas_bytes: Number(linhaResumo.antigas_bytes),
        };
  const agendado = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET);
  const padrao = config ?? { intervalo_oleo: 10000, intervalo_revisao: 20000, atualizado_por: null, atualizado_em: null };
  const nomeDe = new Map(((perfis ?? []) as { id: string; nome: string; email: string | null }[]).map((p) => [p.id, p.nome || p.email || "—"]));

  const historico: Execucao[] = ((limpezas ?? []) as LinhaLimpeza[]).map((l) => ({
    id: l.id,
    em: l.executada_em,
    quantidade: l.quantidade,
    bytes: Number(l.bytes),
    automatica: l.automatica,
    por: l.executada_por ? nomeDe.get(l.executada_por) ?? null : null,
  }));

  return (
    <Pagina
      titulo="Parâmetros"
      descricao="Intervalos de troca de óleo e revisão (o aviso “em breve” aparece a 90% do intervalo) e limpeza de fotos antigas."
    >
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4 self-start">
          <Painel
            titulo="Padrão da frota"
            acoes={
              padrao.atualizado_em && (
                <span className="text-xs text-texto-2">
                  {padrao.atualizado_por ? `por ${nomeDe.get(padrao.atualizado_por) ?? "—"} ` : ""}em {dataHora(padrao.atualizado_em)}
                </span>
              )
            }
          >
            <PadraoFrota oleo={padrao.intervalo_oleo} revisao={padrao.intervalo_revisao} totalVeiculos={(veiculos ?? []).length} />
          </Painel>
          <LimpezaFotos meses={meses} ativa={config?.limpeza_fotos_ativa ?? true} resumo={resumo} agendado={agendado} historico={historico} />
        </div>
        <TabelaParametros veiculos={(veiculos ?? []) as Vehicle[]} nomes={Object.fromEntries(nomeDe)} />
      </div>
    </Pagina>
  );
}
