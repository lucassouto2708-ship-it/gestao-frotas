import Link from "next/link";
import { CarFront } from "lucide-react";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { getProfile } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/types";
import { FormNovaViagem } from "./FormNovaViagem";

export default async function NovaViagem() {
  const { supabase } = await getProfile();
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
            texto="Peça ao administrador para vincular o seu carro ao seu usuário, ou cadastre um veículo novo, para registrar viagens."
            acao={<Link href="/veiculos/novo" className="botao">Cadastrar veículo</Link>}
          />
        </Painel>
      )}
    </Pagina>
  );
}
