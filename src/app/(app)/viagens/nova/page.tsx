import Link from "next/link";
import { CarFront } from "lucide-react";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { getProfile } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/types";
import { FormNovaViagem } from "./FormNovaViagem";

export default async function NovaViagem() {
  const { supabase, profile } = await getProfile();
  const gestor = profile.role !== "motorista";
  const [{ data: veiculos }, { data: abertas }] = await Promise.all([
    supabase.from("vehicles").select("*").order("placa"),
    supabase.from("trips").select("vehicle_id").eq("status", "em_andamento"),
  ]);
  const emUso = new Set((abertas ?? []).map((t) => t.vehicle_id as string));

  return (
    <Pagina titulo="Iniciar viagem" descricao="Registre a saída do veículo com a foto do odômetro." voltar="/">
      {veiculos?.length ? (
        <FormNovaViagem veiculos={veiculos as Vehicle[]} emUso={[...emUso]} />
      ) : (
        <Painel className="max-w-2xl">
          <EstadoVazio
            icone={<CarFront size={28} strokeWidth={1.5} />}
            titulo="Nenhum veículo vinculado a você"
            texto={
              gestor
                ? "Cadastre um veículo para registrar viagens."
                : "Peça ao gestor da sua organização para vincular o seu carro ao seu usuário."
            }
            acao={gestor ? <Link href="/veiculos/novo" className="botao">Cadastrar veículo</Link> : undefined}
          />
        </Painel>
      )}
    </Pagina>
  );
}
