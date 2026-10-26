import { notFound, redirect } from "next/navigation";
import { Pagina } from "@/components/Pagina";
import { getProfile } from "@/lib/supabase/server";
import type { Trip, Vehicle } from "@/lib/types";
import { FormFinalizar } from "./FormFinalizar";

export default async function FinalizarViagem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getProfile();
  const { data } = await supabase.from("trips").select("*, vehicles(placa, modelo)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const viagem = data as Trip & { vehicles: Pick<Vehicle, "placa" | "modelo"> };
  if (viagem.status !== "em_andamento") redirect("/");

  return (
    <Pagina titulo="Finalizar viagem" descricao="Registre a chegada com a foto do odômetro para calcular a distância percorrida." voltar="/">
      <FormFinalizar viagem={viagem} />
    </Pagina>
  );
}
