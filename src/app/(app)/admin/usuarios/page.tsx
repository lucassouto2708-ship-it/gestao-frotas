import { Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { BotaoPapel } from "./BotaoPapel";

export default async function Usuarios() {
  const { supabase, profile: eu } = await requireAdmin();
  const { data } = await supabase.from("profiles").select("*").order("nome");
  const usuarios = (data ?? []) as Profile[];

  return (
    <Pagina
      titulo="Usuários"
      descricao="A primeira conta criada é ADM; as demais entram como operador. Defina aqui quem tem acesso ao painel da frota."
    >
      <Painel titulo="Usuários cadastrados" acoes={<span className="text-xs text-texto-2">{usuarios.length} usuários</span>} semPadding>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Cadastro</th>
                <th>Perfil</th>
                <th className="num">Ação</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.nome || <span className="text-texto-2">(sem nome)</span>}</td>
                  <td className="text-texto-2">{u.email}</td>
                  <td className="whitespace-nowrap">{dataHora(u.created_at)}</td>
                  <td>{u.role === "admin" ? <Selo nivel="info">ADM</Selo> : <Selo nivel="neutro">Operador</Selo>}</td>
                  <td className="num">
                    {u.id === eu.id ? <span className="text-xs text-texto-2">Usuário atual</span> : <BotaoPapel id={u.id} role={u.role} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
    </Pagina>
  );
}
