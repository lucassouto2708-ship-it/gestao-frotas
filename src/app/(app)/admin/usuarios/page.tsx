import Link from "next/link";
import { Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora, formatarPlaca } from "@/lib/regras";
import { requireGestor } from "@/lib/supabase/server";
import { ROTULO_PAPEL, type Convite, type Organizacao, type Profile, type Vehicle, type VehicleUser } from "@/lib/types";
import { AtribuirUsuario, BotaoAtivo, BotaoPapel } from "./BotaoPapel";
import { LinhaConvite, NovoConvite } from "./Convites";

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { supabase, profile: eu } = await requireGestor();
  const { org: orgParam } = await searchParams;
  const admin = eu.role === "admin";

  const [{ data }, { data: vinculos }, { data: veiculos }, { data: convitesData }, { data: orgsData }] = await Promise.all([
    supabase.from("profiles").select("*").order("nome"),
    supabase.from("vehicle_users").select("vehicle_id, user_id"),
    supabase.from("vehicles").select("id, placa"),
    supabase.from("convites").select("*").is("usado_em", null).order("criado_em", { ascending: false }),
    admin ? supabase.from("organizacoes").select("*").order("nome") : Promise.resolve({ data: [] }),
  ]);
  const organizacoes = (orgsData ?? []) as Organizacao[];
  const nomeOrg = new Map(organizacoes.map((o) => [o.id, o.nome]));
  const orgFiltro = admin && organizacoes.some((o) => o.id === orgParam) ? orgParam! : null;

  const todos = (data ?? []) as Profile[];
  // ADM: usuários sem organização aparecem à parte (aguardando atribuição); o ADM em si não entra na lista
  const semOrg = admin ? todos.filter((u) => u.role !== "admin" && !u.organizacao_id) : [];
  const usuarios = todos.filter((u) => u.role !== "admin" && u.organizacao_id && (!orgFiltro || u.organizacao_id === orgFiltro));
  const convites = ((convitesData ?? []) as Convite[]).filter((c) => !orgFiltro || c.organizacao_id === orgFiltro);

  const placa = new Map(((veiculos ?? []) as Pick<Vehicle, "id" | "placa">[]).map((v) => [v.id, v.placa]));
  const carrosDe = (uid: string) =>
    ((vinculos ?? []) as Pick<VehicleUser, "vehicle_id" | "user_id">[])
      .filter((l) => l.user_id === uid)
      .map((l) => ({ id: l.vehicle_id, placa: placa.get(l.vehicle_id) ?? "" }))
      .sort((a, b) => a.placa.localeCompare(b.placa));

  return (
    <Pagina
      titulo="Usuários"
      descricao="Convide pessoas para a organização com um link, defina quem é gestor ou motorista e vincule cada motorista aos carros dele na ficha do veículo."
      acoes={
        admin && (
          <form className="flex items-center gap-2">
            <select name="org" aria-label="Organização" defaultValue={orgFiltro ?? ""} className="campo w-52">
              <option value="">Todas as organizações</option>
              {organizacoes.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
            <button className="botao-secundario">Filtrar</button>
          </form>
        )
      }
    >
      <div className="space-y-4">
        <Painel titulo="Convidar pessoa">
          {admin && organizacoes.length === 0 ? (
            <p className="text-[13px] text-texto-2">Cadastre uma organização em “Organizações” para poder convidar pessoas.</p>
          ) : (
            <NovoConvite
              organizacoes={organizacoes.filter((o) => o.ativa).map((o) => ({ id: o.id, nome: o.nome }))}
              orgFixa={admin ? null : eu.organizacao_id}
            />
          )}
        </Painel>

        {convites.length > 0 && (
          <Painel titulo="Convites pendentes" acoes={<span className="text-xs text-texto-2">{convites.length}</span>} semPadding>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Código</th>
                    {admin && <th>Organização</th>}
                    <th>Papel</th>
                    <th>Validade</th>
                    <th className="num">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {convites.map((c) => (
                    <LinhaConvite key={c.id} convite={c} nomeOrg={admin ? nomeOrg.get(c.organizacao_id) ?? "—" : undefined} />
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        )}

        {semOrg.length > 0 && (
          <Painel titulo="Aguardando organização" acoes={<span className="text-xs text-texto-2">{semOrg.length}</span>} semPadding>
            <div className="overflow-x-auto">
              <table className="tabela">
                <tbody>
                  {semOrg.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.nome || "(sem nome)"}</td>
                      <td className="text-texto-2">{u.email}</td>
                      <td className="num">
                        <AtribuirUsuario id={u.id} organizacoes={organizacoes.map((o) => ({ id: o.id, nome: o.nome }))} orgAtual={null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        )}

        <Painel titulo="Pessoas da organização" acoes={<span className="text-xs text-texto-2">{usuarios.length} usuários</span>} semPadding>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  {admin && <th>Organização</th>}
                  <th>Cadastro</th>
                  <th>Papel</th>
                  <th>Veículos vinculados</th>
                  <th className="num">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.ativo ? "" : "opacity-60"}>
                    <td className="font-medium">
                      {u.nome || <span className="text-texto-2">(sem nome)</span>}
                      {!u.ativo && <span className="ml-2"><Selo nivel="critico">Desativado</Selo></span>}
                    </td>
                    <td className="text-texto-2">{u.email}</td>
                    {admin && <td>{nomeOrg.get(u.organizacao_id!) ?? "—"}</td>}
                    <td className="whitespace-nowrap">{dataHora(u.created_at)}</td>
                    <td>{u.role === "gestor" ? <Selo nivel="info">{ROTULO_PAPEL.gestor}</Selo> : <Selo nivel="neutro">{ROTULO_PAPEL.motorista}</Selo>}</td>
                    <td>
                      {u.role === "gestor" ? (
                        <span className="text-xs text-texto-2">Todos da organização</span>
                      ) : carrosDe(u.id).length === 0 ? (
                        <span className="text-xs text-alerta">Nenhum</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {carrosDe(u.id).map((c) => (
                            <Link key={c.id} href={`/admin/veiculos/${c.id}`} className="mono link rounded-[3px] border border-borda px-1.5 text-xs">
                              {formatarPlaca(c.placa)}
                            </Link>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="num whitespace-nowrap">
                      {u.id === eu.id ? (
                        <span className="text-xs text-texto-2">Usuário atual</span>
                      ) : (
                        <span className="inline-flex flex-wrap justify-end gap-1">
                          <BotaoPapel id={u.id} role={u.role} />
                          <BotaoAtivo id={u.id} ativo={u.ativo} nome={u.nome || u.email || "esta pessoa"} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={admin ? 7 : 6} className="py-6 text-center text-texto-2">
                      Ninguém ainda. Gere um convite acima e envie o link.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Painel>
      </div>
    </Pagina>
  );
}
