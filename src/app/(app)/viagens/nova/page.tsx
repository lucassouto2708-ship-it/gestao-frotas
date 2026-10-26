import { Pagina } from "@/components/Pagina";
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
    <Pagina titulo="Iniciar viagem" voltar="/">
      {veiculos?.length ? (
        <FormNovaViagem veiculos={veiculos as Vehicle[]} emUso={[...emUso]} />
      ) : (
        <p className="card text-slate-600">Nenhum carro cadastrado ainda.</p>
      )}
    </Pagina>
  );
}
