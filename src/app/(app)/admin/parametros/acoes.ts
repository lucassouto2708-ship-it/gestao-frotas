"use server";

import { revalidatePath } from "next/cache";
import { executarLimpeza, type ResultadoLimpeza } from "@/lib/limpeza";
import { requireAdmin } from "@/lib/supabase/server";

export type RespostaLimpeza = { ok: true; resultado: ResultadoLimpeza } | { ok: false; erro: string };

/** Botão "Limpar agora": roda a limpeza com a sessão do ADM logado (o banco confere que ele é ADM). */
export async function limparFotosAgora(): Promise<RespostaLimpeza> {
  const { supabase } = await requireAdmin();
  try {
    const { data: config } = await supabase.from("configuracoes").select("meses_guardar_fotos").maybeSingle();
    const resultado = await executarLimpeza(supabase, config?.meses_guardar_fotos ?? 6, { orcamentoMs: 25_000 });
    revalidatePath("/admin/parametros");
    return { ok: true, resultado };
  } catch (erro) {
    return { ok: false, erro: (erro as Error).message };
  }
}
