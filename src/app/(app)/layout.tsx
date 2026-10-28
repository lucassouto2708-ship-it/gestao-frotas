import { redirect } from "next/navigation";
import { RotulosTabela } from "@/components/RotulosTabela";
import { Cabecalho } from "@/components/Cabecalho";
import { RastreioProvider } from "@/components/rastreio/RastreioProvider";
import { Pagina, Painel } from "@/components/Pagina";
import { BotaoSair } from "@/components/BotaoSair";
import { getProfile } from "@/lib/supabase/server";

function Bloqueio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <Painel titulo={titulo}>
        <p className="text-[13.5px] text-texto-2">{texto}</p>
        <div className="mt-4 inline-block rounded bg-cabecalho text-cabecalho-texto">
          <BotaoSair />
        </div>
      </Painel>
    </main>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, org, bancoDesatualizado } = await getProfile();

  if (bancoDesatualizado) {
    return (
      <Bloqueio
        titulo="Atualização do banco pendente"
        texto="O sistema foi atualizado para o modo multiempresa. Rode novamente o arquivo supabase/banco.sql no SQL Editor do Supabase e recarregue esta página."
      />
    );
  }
  if (!profile.ativo) {
    return <Bloqueio titulo="Acesso desativado" texto="Seu acesso foi desativado. Fale com o gestor da sua organização." />;
  }
  if (profile.role !== "admin") {
    if (!profile.organizacao_id) redirect("/convite");
    if (org && !org.ativa) {
      return (
        <Bloqueio
          titulo="Organização suspensa"
          texto={`O acesso de ${org.nome} está suspenso no momento. Entre em contato com o responsável pelo sistema.`}
        />
      );
    }
  }

  return (
    <RastreioProvider userId={profile.id}>
      <Cabecalho profile={profile} orgNome={org?.nome ?? null} />
      {children}
      <div className="h-20 md:hidden" aria-hidden />
      <RotulosTabela />
    </RastreioProvider>
  );
}
