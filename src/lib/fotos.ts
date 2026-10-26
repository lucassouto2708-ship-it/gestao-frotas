import type { SupabaseClient } from "@supabase/supabase-js";

/** Gera links temporários (1h) para as fotos privadas do bucket. */
export async function linksDasFotos(supabase: SupabaseClient, caminhos: (string | null | undefined)[]) {
  const validos = [...new Set(caminhos.filter((c): c is string => !!c))];
  if (validos.length === 0) return {} as Record<string, string>;
  const { data } = await supabase.storage.from("fotos").createSignedUrls(validos, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl]));
}
