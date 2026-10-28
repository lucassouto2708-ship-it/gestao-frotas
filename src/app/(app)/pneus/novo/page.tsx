import Link from "next/link";
import { CarFront } from "lucide-react";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { requireGestor } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/types";
import { FormPneus } from "./FormPneus";

export default async function NovaMedicaoPneus() {
  const { supabase } = await requireGestor();
  const { data: veiculos } = await supabase.from("vehicles").select("*").order("placa");

  return (
    <Pagina titulo="Medição de pneus" descricao="Profundidade do sulco de cada pneu, aferida com medidor TWI." voltar="/">
      {veiculos?.length ? (
        <FormPneus veiculos={veiculos as Vehicle[]} />
      ) : (
        <Painel className="max-w-2xl">
          <EstadoVazio
            icone={<CarFront size={28} strokeWidth={1.5} />}
            titulo="Nenhum veículo cadastrado"
            texto="Cadastre um veículo para registrar medições de pneus."
            acao={<Link href="/veiculos/novo" className="botao">Cadastrar veículo</Link>}
          />
        </Painel>
      )}
    </Pagina>
  );
}
