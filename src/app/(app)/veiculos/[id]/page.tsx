import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { FormManutencao } from "@/components/manutencao/FormManutencao";
import { HistoricoManutencao, type ManutencaoComUsuario } from "@/components/manutencao/HistoricoManutencao";
import { StatusManutencao } from "@/components/manutencao/StatusManutencao";
import { Pagina, Painel } from "@/components/Pagina";
import { dataHora, formatarPlaca, km } from "@/lib/regras";
import { getProfile } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/types";

export default async function FichaVeiculo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await getProfile();
  const [{ data: v }, { data: manutencoes }, { data: vinculos }, { data: perfis }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle<Vehicle>(),
    supabase.from("maintenances").select("*, profiles(nome, email)").eq("vehicle_id", id).order("realizada_em", { ascending: false }).order("km", { ascending: false }),
    supabase.from("vehicle_users").select("user_id").eq("vehicle_id", id),
    supabase.from("profiles").select("id, nome, email"),
  ]);
  if (!v) notFound();
  const admin = profile.role === "admin";
  const nomeDe = new Map(((perfis ?? []) as { id: string; nome: string; email: string | null }[]).map((p) => [p.id, p.nome || p.email || "—"]));
  const motoristas = ((vinculos ?? []) as { user_id: string }[]).map((l) => nomeDe.get(l.user_id) ?? "—").sort();

  return (
    <Pagina
      titulo={`Veículo ${formatarPlaca(v.placa)}`}
      descricao={`${v.modelo || "Modelo não informado"} · cadastrado em ${dataHora(v.created_at)}`}
      voltar="/veiculos"
      acoes={admin && <Link href={`/admin/veiculos/${v.id}`} className="botao-secundario"><BarChart3 size={15} /> Ficha completa (ADM)</Link>}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Painel titulo="Situação" semPadding>
            <dl className="grid grid-cols-2 border-b border-borda text-[13px] sm:grid-cols-4">
              {[
                ["Placa", <span key="p" className="mono font-semibold">{formatarPlaca(v.placa)}</span>],
                ["Modelo", v.modelo || "—"],
                ["Km atual", <span key="a" className="text-[15px] font-semibold tabular-nums">{km(v.km_atual)}</span>],
                ["Motoristas", motoristas.length ? motoristas.join(", ") : "—"],
              ].map(([rotulo, valor], i) => (
                <div key={i} className="px-4 py-3 sm:border-r sm:border-borda sm:last:border-r-0">
                  <dt className="text-[11px] font-semibold tracking-wider text-texto-2 uppercase">{rotulo}</dt>
                  <dd className="mt-0.5 font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
            <StatusManutencao veiculo={v} />
          </Painel>
          <HistoricoManutencao registros={(manutencoes ?? []) as ManutencaoComUsuario[]} admin={admin} />
        </div>
        <Painel titulo="Registrar manutenção" className="order-first self-start scroll-mt-28 xl:order-none" id="registrar">
          <FormManutencao veiculoId={v.id} kmAtual={v.km_atual} />
        </Painel>
      </div>
    </Pagina>
  );
}
