import { Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora } from "@/lib/regras";
import { requireAdmin } from "@/lib/supabase/server";
import Link from "next/link";
import type { Profile, Vehicle, VehicleUser } from "@/lib/types";
import { formatarPlaca } from "@/lib/regras";
import { BotaoPapel } from "./BotaoPapel";

export default async function Usuarios() {
  const { supabase, profile: eu } = await requireAdmin();
  const [{ data }, { data: vinculos }, { data: veiculos }] = await Promise.all([
    supabase.from("profiles").select("*").order("nome"),
    supabase.from("vehicle_users").select("vehicle_id, user_id"),
    supabase.from("vehicles").select("id, placa"),
  ]);
  const usuarios = (data ?? []) as Profile[];
  const placa = new Map(((veiculos ?? []) as Pick<Vehicle, "id" | "placa">[]).map((v) => [v.id, v.placa]));
  const carrosDe = (uid: string) =>
    ((vinculos ?? []) as Pick<VehicleUser, "vehicle_id" | "user_id">[])
      .filter((l) => l.user_id === uid)
      .map((l) => ({ id: l.vehicle_id, placa: placa.get(l.vehicle_id) ?? "" }))
      .sort((a, b) => a.placa.localeCompare(b.placa));

  return (
    <Pagina
      titulo="Usuários"
      descricao="A primeira conta criada é ADM; as demais entram como operador. Para vincular um operador a um carro, abra a ficha do veículo no Painel da frota."
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
                <th>Veículos vinculados</th>
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
                  <td>
                    {u.role === "admin" ? (
                      <span className="text-xs text-texto-2">Todos (ADM)</span>
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
