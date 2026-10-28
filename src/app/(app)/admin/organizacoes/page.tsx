import Link from "next/link";
import { Building2 } from "lucide-react";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { Organizacao } from "@/lib/types";
import { AcoesOrganizacao, NovaOrganizacao } from "./Acoes";

export default async function Organizacoes() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("organizacoes").select("*").order("nome");
  const organizacoes = (data ?? []) as Organizacao[];

  const contar = async (tabela: string, org: string, filtro?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const q = base(tabela, org);
    const { count } = await (filtro ? filtro(q) : q);
    return count ?? 0;
  };
  function base(tabela: string, org: string) {
    return supabase.from(tabela).select("id", { count: "exact", head: true }).eq("organizacao_id", org);
  }
  const linhas = await Promise.all(
    organizacoes.map(async (o) => ({
      o,
      veiculos: await contar("vehicles", o.id),
      usuarios: await contar("profiles", o.id, (q) => q.neq("role", "admin")),
      viagens: await contar("trips", o.id),
    })),
  );

  return (
    <Pagina titulo="Organizações" descricao="Cada cliente (empresa ou município) tem os próprios veículos, usuários e parâmetros, totalmente separados dos demais.">
      <div className="space-y-4">
        <Painel titulo="Novo cliente">
          <NovaOrganizacao />
        </Painel>
        <Painel titulo="Clientes" acoes={<span className="text-xs text-texto-2">{organizacoes.length}</span>} semPadding>
          {linhas.length === 0 ? (
            <EstadoVazio icone={<Building2 size={28} strokeWidth={1.5} />} titulo="Nenhuma organização" texto="Cadastre o primeiro cliente acima." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Organização</th>
                    <th>Tipo</th>
                    <th>Situação</th>
                    <th className="num">Veículos</th>
                    <th className="num">Usuários</th>
                    <th className="num">Viagens</th>
                    <th>Desde</th>
                    <th className="num">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ o, veiculos, usuarios, viagens }) => (
                    <tr key={o.id}>
                      <td className="font-semibold">{o.nome}</td>
                      <td>{o.tipo === "municipio" ? "Município" : "Empresa"}</td>
                      <td>{o.ativa ? <Selo nivel="ok">Ativa</Selo> : <Selo nivel="critico">Suspensa</Selo>}</td>
                      <td className="num">{veiculos}</td>
                      <td className="num">{usuarios}</td>
                      <td className="num">{viagens}</td>
                      <td className="whitespace-nowrap">{dataHora(o.criada_em)}</td>
                      <td className="num whitespace-nowrap">
                        <span className="inline-flex flex-wrap justify-end gap-1">
                          <Link href={`/admin?org=${o.id}`} className="botao-secundario botao-pequeno">Painel</Link>
                          <Link href={`/admin/usuarios?org=${o.id}`} className="botao-secundario botao-pequeno">Usuários e convites</Link>
                          <AcoesOrganizacao id={o.id} nome={o.nome} ativa={o.ativa} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>
    </Pagina>
  );
}
