import { Pagina } from "@/components/Pagina";
import { getProfile } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/types";
import { FormPneus } from "./FormPneus";

export default async function NovaMedicaoPneus() {
  const { supabase } = await getProfile();
  const { data: veiculos } = await supabase.from("vehicles").select("*").order("placa");

  return (
    <Pagina titulo="Medir pneus (TWI)" voltar="/">
      {veiculos?.length ? (
        <FormPneus veiculos={veiculos as Vehicle[]} />
      ) : (
        <p className="card text-slate-600">Nenhum carro cadastrado ainda.</p>
      )}
    </Pagina>
  );
}
