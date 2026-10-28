import { createClient } from "@supabase/supabase-js";
import { executarLimpeza } from "@/lib/limpeza";

// Chamada todo dia pela Vercel (ver vercel.json). Precisa de duas variáveis no servidor:
//   SUPABASE_SERVICE_ROLE_KEY  chave secreta do Supabase (nunca com o prefixo NEXT_PUBLIC_)
//   CRON_SECRET                texto aleatório; a Vercel o envia no cabeçalho Authorization
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo || !chave) {
    return Response.json({ ok: false, erro: "Limpeza automática não configurada (faltam SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET)." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: config } = await supabase.from("configuracoes").select("meses_guardar_fotos, limpeza_fotos_ativa").maybeSingle();
    if (config && config.limpeza_fotos_ativa === false) return Response.json({ ok: true, ignorada: "Limpeza automática desligada nos Parâmetros." });
    const resultado = await executarLimpeza(supabase, config?.meses_guardar_fotos ?? 6, { orcamentoMs: 45_000 });
    return Response.json({ ok: true, ...resultado });
  } catch (erro) {
    return Response.json({ ok: false, erro: (erro as Error).message }, { status: 500 });
  }
}
