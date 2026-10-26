import { Pagina } from "@/components/Pagina";
import { requireAdmin } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { BotaoPapel } from "./BotaoPapel";

export default async function Usuarios() {
  const { supabase, profile: eu } = await requireAdmin();
  const { data } = await supabase.from("profiles").select("*").order("nome");
  const usuarios = (data ?? []) as Profile[];

  return (
    <Pagina titulo="Usuários" voltar="/admin">
      <p className="mb-4 text-sm text-slate-600">
        Todo mundo que cria conta entra como <b>comum</b>. Promova aqui quem deve ver o painel da frota.
      </p>
      <ul className="card divide-y divide-slate-100 p-0">
        {usuarios.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-semibold">{u.nome || "(sem nome)"}</p>
              <p className="text-sm text-slate-500">{u.email}</p>
            </div>
            {u.id === eu.id ? (
              <span className="text-sm text-slate-500">Você (ADM)</span>
            ) : (
              <BotaoPapel id={u.id} role={u.role} />
            )}
          </li>
        ))}
      </ul>
    </Pagina>
  );
}
