import { FiltroUrl } from "@/components/FiltroUrl";
import { SeletorMes } from "@/components/SeletorMes";
import { Indicador, Pagina } from "@/components/Pagina";
import { PNEUS, formatarPlaca, km, nivelPneu, piorNivel, statusOleo, statusRevisao } from "@/lib/regras";
import { requireGestor } from "@/lib/supabase/server";
import type { Organizacao, TireMeasurement, Trip, Vehicle } from "@/lib/types";
import { TabelaFrota, type LinhaFrota } from "./TabelaFrota";

function mesAtual() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

/** Intervalo do mês no fuso de Brasília (sem horário de verão desde 2019). */
function intervaloDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const proximo = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return { inicio: `${mes}-01T00:00:00-03:00`, fim: `${proximo}-01T00:00:00-03:00` };
}

function nomeDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const nome = new Date(a, m - 1, 15).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export default async function PainelAdmin({ searchParams }: { searchParams: Promise<{ mes?: string; org?: string }> }) {
  const { supabase, profile } = await requireGestor();
  const { mes: mesParam, org: orgParam } = await searchParams;
  const admin = profile.role === "admin";
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesAtual();
  const { inicio, fim } = intervaloDoMes(mes);

  // O gestor só enxerga a própria organização (o banco garante); o ADM pode filtrar por uma
  const { data: orgsData } = admin ? await supabase.from("organizacoes").select("*").order("nome") : { data: [] };
  const organizacoes = (orgsData ?? []) as Organizacao[];
  const orgFiltro = admin && organizacoes.some((o) => o.id === orgParam) ? orgParam! : null;
  const nomeOrg = new Map(organizacoes.map((o) => [o.id, o.nome]));
  const daOrg: Record<string, string> = orgFiltro ? { organizacao_id: orgFiltro } : {};

  const [{ data: veiculos }, { data: viagensMes }, { data: abertas }, { data: medicoes }, { data: vinculos }, { data: perfis }] = await Promise.all([
    supabase.from("vehicles").select("*").match(daOrg).order("placa"),
    supabase.from("trips").select("vehicle_id, km_inicio, km_fim").eq("status", "finalizada").gte("finalizada_em", inicio).lt("finalizada_em", fim).match(daOrg),
    supabase.from("trips").select("vehicle_id").eq("status", "em_andamento").match(daOrg),
    supabase.from("tire_measurements").select("*").match(daOrg).order("created_at", { ascending: false }),
    supabase.from("vehicle_users").select("vehicle_id, user_id").match(daOrg),
    supabase.from("profiles").select("id, nome, email"),
  ]);
  const nomeDe = new Map(((perfis ?? []) as { id: string; nome: string; email: string | null }[]).map((p) => [p.id, p.nome || p.email || "—"]));
  const motoristasDe = (vid: string) =>
    ((vinculos ?? []) as { vehicle_id: string; user_id: string }[])
      .filter((l) => l.vehicle_id === vid)
      .map((l) => nomeDe.get(l.user_id) ?? "—")
      .sort();

  const kmMes = new Map<string, { km: number; viagens: number }>();
  for (const t of (viagensMes ?? []) as Pick<Trip, "vehicle_id" | "km_inicio" | "km_fim">[]) {
    const atual = kmMes.get(t.vehicle_id) ?? { km: 0, viagens: 0 };
    kmMes.set(t.vehicle_id, { km: atual.km + (t.km_fim! - t.km_inicio), viagens: atual.viagens + 1 });
  }
  const emViagem = new Set((abertas ?? []).map((t) => t.vehicle_id as string));
  const ultimaMedicao = new Map<string, TireMeasurement>();
  for (const m of (medicoes ?? []) as TireMeasurement[]) if (!ultimaMedicao.has(m.vehicle_id)) ultimaMedicao.set(m.vehicle_id, m);

  const lista: LinhaFrota[] = ((veiculos ?? []) as Vehicle[]).map((v) => {
    const med = ultimaMedicao.get(v.id);
    const mesV = kmMes.get(v.id) ?? { km: 0, viagens: 0 };
    return {
      id: v.id,
      placa: formatarPlaca(v.placa),
      modelo: v.modelo,
      kmAtual: v.km_atual,
      emViagem: emViagem.has(v.id),
      kmMes: mesV.km,
      viagensMes: mesV.viagens,
      oleo: statusOleo(v),
      revisao: statusRevisao(v),
      pneus: med ? piorNivel(PNEUS.map((p) => nivelPneu(Number(med[p.campo])))) : null,
      motoristas: motoristasDe(v.id),
      org: admin && !orgFiltro ? nomeOrg.get(v.organizacao_id) : undefined,
    };
  });
  const totalKm = lista.reduce((s, l) => s + l.kmMes, 0);
  const totalViagens = lista.reduce((s, l) => s + l.viagensMes, 0);
  const alertas = lista.filter((l) => l.oleo.nivel !== "ok" || l.revisao.nivel !== "ok" || (l.pneus && l.pneus !== "ok")).length;
  const vencidas = lista.filter((l) => l.oleo.nivel === "critico" || l.revisao.nivel === "critico" || l.pneus === "critico").length;

  return (
    <Pagina
      titulo="Painel da frota"
      descricao={`Situação dos veículos, quilometragem e pendências de manutenção — competência ${nomeDoMes(mes)}.`}
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          {admin && <FiltroUrl parametro="org" rotulo="Organização" valor={orgFiltro ?? ""} todas="Todas as organizações" opcoes={organizacoes.map((o) => ({ id: o.id, nome: o.nome }))} className="campo w-52" />}
          <SeletorMes mes={mes} />
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Veículos cadastrados" valor={String(lista.length)} contexto={`${emViagem.size} em viagem no momento`} />
        <Indicador rotulo="Km rodados na competência" valor={km(totalKm)} contexto={`${totalViagens} viagens finalizadas`} />
        <Indicador
          rotulo="Veículos com pendência"
          valor={String(alertas)}
          contexto="Óleo, revisão ou pneus fora do ideal"
          tom={alertas > 0 ? "alerta" : undefined}
        />
        <Indicador
          rotulo="Pendências vencidas"
          valor={String(vencidas)}
          contexto="Manutenção vencida ou pneu abaixo do TWI"
          tom={vencidas > 0 ? "perigo" : undefined}
        />
      </div>

      <TabelaFrota linhas={lista} competencia={mes} />
    </Pagina>
  );
}
