import Link from "next/link";
import { Pagina } from "@/components/Pagina";
import { dataHora, formatarPlaca, km } from "@/lib/regras";
import { getProfile } from "@/lib/supabase/server";
import type { Trip, Vehicle } from "@/lib/types";

type ViagemComCarro = Trip & { vehicles: Pick<Vehicle, "placa" | "modelo"> };

export default async function Inicio() {
  const { supabase, profile } = await getProfile();
  const { data } = await supabase
    .from("trips")
    .select("*, vehicles(placa, modelo)")
    .eq("user_id", profile.id)
    .order("iniciada_em", { ascending: false })
    .limit(10);
  const viagens = (data ?? []) as ViagemComCarro[];
  const abertas = viagens.filter((v) => v.status === "em_andamento");
  const recentes = viagens.filter((v) => v.status === "finalizada").slice(0, 5);

  const acoes = [
    { href: "/viagens/nova", icone: "🚗", titulo: "Iniciar viagem", texto: "Foto do km inicial" },
    { href: "/pneus/novo", icone: "🛞", titulo: "Medir pneus", texto: "Medidor TWI dos 4 pneus" },
    { href: "/veiculos/novo", icone: "➕", titulo: "Cadastrar carro", texto: "Placa e km inicial" },
  ];

  return (
    <Pagina titulo={`Olá${profile.nome ? `, ${profile.nome.split(" ")[0]}` : ""}!`}>
      {abertas.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="font-semibold text-slate-700">Viagem em andamento</h2>
          {abertas.map((v) => (
            <div key={v.id} className="card flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50">
              <div>
                <p className="font-bold">{formatarPlaca(v.vehicles.placa)} <span className="font-normal text-slate-600">{v.vehicles.modelo}</span></p>
                <p className="text-sm text-slate-600">
                  Saída {dataHora(v.iniciada_em)} · {km(v.km_inicio)} {v.destino && `· ${v.destino}`}
                </p>
              </div>
              <Link href={`/viagens/${v.id}/finalizar`} className="botao">Finalizar viagem</Link>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {acoes.map((a) => (
          <Link key={a.href} href={a.href} className="card flex items-center gap-3 transition hover:border-marca">
            <span className="text-3xl">{a.icone}</span>
            <span>
              <span className="block font-semibold">{a.titulo}</span>
              <span className="text-sm text-slate-500">{a.texto}</span>
            </span>
          </Link>
        ))}
      </section>

      {recentes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold text-slate-700">Minhas últimas viagens</h2>
          <ul className="card divide-y divide-slate-100 p-0">
            {recentes.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <b>{formatarPlaca(v.vehicles.placa)}</b> · {dataHora(v.finalizada_em!)} {v.destino && `· ${v.destino}`}
                </span>
                <span className="font-semibold">{km(v.km_fim! - v.km_inicio)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Pagina>
  );
}
