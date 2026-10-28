import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Organizacao, Profile } from "@/lib/types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado de um Server Component: o proxy já renova a sessão.
          }
        },
      },
    },
  );
}

/** Contexto do usuário logado: perfil, organização e se o banco já foi atualizado para o modo multiempresa. */
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!data) redirect("/login");
  // Banco ainda no formato antigo (script não rodado): sem a coluna, e o papel "comum" vira motorista
  const bancoDesatualizado = !("organizacao_id" in data);
  const profile: Profile = {
    ...data,
    role: (data.role as string) === "comum" ? "motorista" : data.role,
    organizacao_id: data.organizacao_id ?? null,
    ativo: data.ativo ?? true,
  };
  let org: Organizacao | null = null;
  if (profile.organizacao_id) {
    const { data: o } = await supabase.from("organizacoes").select("*").eq("id", profile.organizacao_id).maybeSingle<Organizacao>();
    org = o ?? null;
  }
  return { supabase, profile, org, bancoDesatualizado };
}

/** Igual a getProfile, mas só deixa passar quem gerencia: gestor da organização ou ADM. */
export async function requireGestor() {
  const ctx = await getProfile();
  if (ctx.profile.role === "motorista") redirect("/");
  return ctx;
}

/** Só o ADM (dono do sistema). */
export async function requireAdmin() {
  const ctx = await getProfile();
  if (ctx.profile.role !== "admin") redirect("/");
  return ctx;
}
