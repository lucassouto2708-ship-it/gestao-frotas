import { EstadoVazio } from "@/components/Pagina";
import { requireGestor } from "@/lib/supabase/server";
import { FormNovoVeiculo } from "./FormNovoVeiculo";

export default async function NovoVeiculo() {
  const { supabase, profile } = await requireGestor();
  // Gestor cadastra na própria organização; o ADM escolhe a organização
  if (profile.role === "gestor") {
    return <FormNovoVeiculo organizacoes={[]} organizacaoId={profile.organizacao_id} />;
  }
  const { data } = await supabase.from("organizacoes").select("id, nome").eq("ativa", true).order("nome");
  const organizacoes = data ?? [];
  if (organizacoes.length === 0) {
    return <EstadoVazio titulo="Nenhuma organização" texto="Cadastre uma organização antes de cadastrar veículos." />;
  }
  return <FormNovoVeiculo organizacoes={organizacoes} organizacaoId={null} />;
}
