import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoLimpeza = {
  removidas: number;
  bytes: number;
  /** Fotos antigas que ainda sobraram (a rotina processa em lotes e tem limite de tempo). */
  restantes: number;
};

type Opcoes = {
  /** Fotos por lote. */
  lote?: number;
  /** Tempo máximo (ms) antes de parar e deixar o resto para a próxima execução. */
  orcamentoMs?: number;
};

/**
 * Apaga as fotos com mais de `meses` meses e limpa as referências a elas.
 * Só as fotos saem: km, mm e o histórico continuam. Serve para o ADM logado (botão "Limpar agora")
 * e para a rotina automática (chave de serviço). A autorização é conferida no banco.
 */
export async function executarLimpeza(supabase: SupabaseClient, meses: number, opcoes: Opcoes = {}): Promise<ResultadoLimpeza> {
  const { lote = 200, orcamentoMs = 40_000 } = opcoes;
  const inicio = Date.now();
  let removidas = 0;
  let bytes = 0;

  while (Date.now() - inicio < orcamentoMs) {
    const { data, error } = await supabase.rpc("fotos_para_limpar", { meses, limite: lote });
    if (error) throw new Error(error.message);
    const fotos = (data ?? []) as { caminho: string; tamanho: number }[];
    if (fotos.length === 0) break;

    const { data: apagadas, error: erroRemocao } = await supabase.storage.from("fotos").remove(fotos.map((f) => f.caminho));
    if (erroRemocao) throw new Error(erroRemocao.message);
    // Se o armazenamento não apagou nada (ex.: sem permissão), para para não repetir o mesmo lote
    if (!apagadas || apagadas.length === 0) throw new Error("O armazenamento não removeu nenhuma foto. Verifique as permissões.");

    const nomes = new Set(apagadas.map((a) => a.name));
    removidas += apagadas.length;
    bytes += fotos.filter((f) => nomes.has(f.caminho)).reduce((s, f) => s + Number(f.tamanho), 0);
    if (fotos.length < lote) break;
  }

  // Sempre confere as referências (também conserta sobras de uma execução interrompida)
  const { error: erroRef } = await supabase.rpc("limpar_referencias_fotos");
  if (erroRef) throw new Error(erroRef.message);

  if (removidas > 0) {
    const { error: erroLog } = await supabase.rpc("registrar_limpeza", { qtd: removidas, tamanho: bytes, meses });
    if (erroLog) throw new Error(erroLog.message);
  }

  const { data: resumo } = await supabase.rpc("resumo_fotos", { meses });
  const linha = Array.isArray(resumo) ? resumo[0] : resumo;
  return { removidas, bytes, restantes: Number(linha?.antigas ?? 0) };
}
