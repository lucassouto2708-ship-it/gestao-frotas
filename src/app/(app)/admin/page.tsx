import Link from "next/link";
import { Pagina } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { PNEUS, type Nivel, formatarPlaca, km, nivelPneu, piorNivel, statusOleo, statusRevisao } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { TireMeasurement, Trip, Vehicle } from "@/lib/types";

const textoNivel: Record<Nivel, string> = { ok: "Em dia", atencao: "Em breve", critico: "Vencida" };
const textoPneu: Record<Nivel, string> = { ok: "OK", atencao: "Atenção", critico: "Trocar" };

function mesAtual() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

/** Intervalo do mês no fuso de Brasília (sem horário de verão desde 2019). */
function intervaloDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const proximo = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return { inicio: `${mes}-01T00:00:00-03:00`, fim: `${proximo}-01T00:00:00-03:00` };
}

export default async function PainelAdmin({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase } = await requireAdmin();
  const { mes: mesParam } = await searchParams;
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesAtual();
  const { inicio, fim } = intervaloDoMes(mes);

  const [{ data: veiculos }, { data: viagensMes }, { data: abertas }, { data: medicoes }] = await Promise.all([
    supabase.from("vehicles").select("*").order("placa"),
    supabase.from("trips").select("vehicle_id, km_inicio, km_fim").eq("status", "finalizada").gte("finalizada_em", inicio).lt("finalizada_em", fim),
    supabase.from("trips").select("vehicle_id").eq("status", "em_andamento"),
    supabase.from("tire_measurements").select("*").order("created_at", { ascending: false }),
  ]);

  const kmMes = new Map<string, { km: number; viagens: number }>();
  for (const t of (viagensMes ?? []) as Pick<Trip, "vehicle_id" | "km_inicio" | "km_fim">[]) {
    const atual = kmMes.get(t.vehicle_id) ?? { km: 0, viagens: 0 };
    kmMes.set(t.vehicle_id, { km: atual.km + (t.km_fim! - t.km_inicio), viagens: atual.viagens + 1 });
  }
  const emViagem = new Set((abertas ?? []).map((t) => t.vehicle_id as string));
  const ultimaMedicao = new Map<string, TireMeasurement>();
  for (const m of (medicoes ?? []) as TireMeasurement[]) if (!ultimaMedicao.has(m.vehicle_id)) ultimaMedicao.set(m.vehicle_id, m);

  const lista = ((veiculos ?? []) as Vehicle[]).map((v) => {
    const med = ultimaMedicao.get(v.id);
    return {
      v,
      oleo: statusOleo(v),
      revisao: statusRevisao(v),
      pneus: med ? piorNivel(PNEUS.map((p) => nivelPneu(Number(med[p.campo])))) : null,
      mes: kmMes.get(v.id) ?? { km: 0, viagens: 0 },
    };
  });
  const totalKm = lista.reduce((s, l) => s + l.mes.km, 0);
  const alertas = lista.filter((l) => l.oleo.nivel !== "ok" || l.revisao.nivel !== "ok" || (l.pneus && l.pneus !== "ok")).length;

  return (
    <Pagina titulo="Painel da frota">
      <form className="mb-5 flex items-end gap-2">
        <div>
          <label className="rotulo" htmlFor="mes">Mês</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className="campo" />
        </div>
        <button className="botao-secundario">Ver</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador titulo="Carros" valor={String(lista.length)} />
        <Indicador titulo="Em viagem agora" valor={String(emViagem.size)} />
        <Indicador titulo="Km rodados no mês" valor={km(totalKm)} />
        <Indicador titulo="Carros com alerta" valor={String(alertas)} destaque={alertas > 0} />
      </div>

      {lista.length === 0 && <p className="card text-slate-600">Nenhum carro cadastrado.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {lista.map(({ v, oleo, revisao, pneus, mes: m }) => (
          <Link key={v.id} href={`/admin/veiculos/${v.id}`} className="card block space-y-3 transition hover:border-marca">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{formatarPlaca(v.placa)}</p>
                <p className="text-sm text-slate-500">{v.modelo || "Sem modelo"}</p>
              </div>
              {emViagem.has(v.id) && <Selo nivel="atencao">Em viagem</Selo>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Km atual</span><p className="font-semibold">{km(v.km_atual)}</p></div>
              <div><span className="text-slate-500">No mês</span><p className="font-semibold">{km(m.km)} <span className="font-normal text-slate-500">({m.viagens} viagens)</span></p></div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Selo nivel={oleo.nivel}>Óleo: {textoNivel[oleo.nivel]} ({oleo.faltam > 0 ? `faltam ${km(oleo.faltam)}` : `passou ${km(-oleo.faltam)}`})</Selo>
              <Selo nivel={revisao.nivel}>Revisão: {textoNivel[revisao.nivel]} ({revisao.faltam > 0 ? `faltam ${km(revisao.faltam)}` : `passou ${km(-revisao.faltam)}`})</Selo>
              {pneus ? <Selo nivel={pneus}>Pneus: {textoPneu[pneus]}</Selo> : <span className="text-slate-400">Pneus: sem medição</span>}
            </div>
          </Link>
        ))}
      </div>
    </Pagina>
  );
}

function Indicador({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`card ${destaque ? "border-red-300 bg-red-50" : ""}`}>
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="text-xl font-bold">{valor}</p>
    </div>
  );
}
