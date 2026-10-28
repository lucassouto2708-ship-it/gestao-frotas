"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ImageOff, Loader2, Save, Trash2 } from "lucide-react";
import { Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora, tamanho } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import { limparFotosAgora } from "./acoes";

export type ResumoFotos = { total: number; total_bytes: number; antigas: number; antigas_bytes: number };
export type Execucao = { id: string; em: string; quantidade: number; bytes: number; automatica: boolean; por: string | null };

type Props = {
  meses: number;
  ativa: boolean;
  /** null = o banco ainda não tem a limpeza de fotos (falta rodar o banco.sql atualizado) */
  resumo: ResumoFotos | null;
  /** SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET configurados na Vercel */
  agendado: boolean;
  historico: Execucao[];
};

export function LimpezaFotos({ meses, ativa, resumo, agendado, historico }: Props) {
  const router = useRouter();
  const [mesesTxt, setMesesTxt] = useState(String(meses));
  const [ligada, setLigada] = useState(ativa);
  const [ocupado, setOcupado] = useState<"salvar" | "limpar" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const novoMeses = Number(mesesTxt);
  const mesesValido = Number.isInteger(novoMeses) && novoMeses >= 1 && novoMeses <= 60;
  const alterado = novoMeses !== meses || ligada !== ativa;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!mesesValido) return setMsg({ ok: false, texto: "Informe de 1 a 60 meses." });
    setOcupado("salvar");
    const { error } = await createClient().from("configuracoes").update({ meses_guardar_fotos: novoMeses, limpeza_fotos_ativa: ligada }).eq("id", true);
    setOcupado(null);
    if (error) return setMsg({ ok: false, texto: error.message });
    setMsg({ ok: true, texto: "Configuração salva." });
    router.refresh();
  }

  async function limparAgora() {
    if (!resumo || resumo.antigas === 0) return;
    if (
      !confirm(
        `Apagar definitivamente ${resumo.antigas} foto${resumo.antigas > 1 ? "s" : ""} (${tamanho(resumo.antigas_bytes)}) com mais de ${meses} meses?\n\nOs números (km, mm) e o histórico continuam, mas as fotos não podem ser recuperadas.`,
      )
    )
      return;
    setOcupado("limpar");
    setMsg(null);
    const r = await limparFotosAgora();
    setOcupado(null);
    if (!r.ok) return setMsg({ ok: false, texto: r.erro });
    const { removidas, bytes, restantes } = r.resultado;
    setMsg({
      ok: true,
      texto:
        `${removidas} foto${removidas === 1 ? "" : "s"} removida${removidas === 1 ? "" : "s"} (${tamanho(bytes)} liberados).` +
        (restantes > 0 ? ` Ainda restam ${restantes}: clique de novo.` : ""),
    });
    router.refresh();
  }

  return (
    <Painel titulo="Limpeza de fotos antigas" className="self-start">
      {resumo === null ? (
        <p className="erro">Para usar este recurso, rode o <b>banco.sql</b> atualizado no SQL Editor do Supabase.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-texto-2">
            Apaga só as <b>fotos</b> antigas para economizar espaço. Os números lidos (km, mm) e o histórico continuam guardados.
          </p>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded border border-borda px-3 py-2">
              <dt className="text-[11px] font-semibold tracking-wider text-texto-2 uppercase">Fotos guardadas</dt>
              <dd className="font-semibold tabular-nums">{resumo.total.toLocaleString("pt-BR")} <span className="font-normal text-texto-2">· {tamanho(resumo.total_bytes)}</span></dd>
            </div>
            <div className={`rounded border px-3 py-2 ${resumo.antigas > 0 ? "border-alerta/40 bg-alerta-suave" : "border-borda"}`}>
              <dt className="text-[11px] font-semibold tracking-wider text-texto-2 uppercase">Com mais de {meses} meses</dt>
              <dd className="font-semibold tabular-nums">{resumo.antigas.toLocaleString("pt-BR")} <span className="font-normal text-texto-2">· {tamanho(resumo.antigas_bytes)}</span></dd>
            </div>
          </dl>

          <form onSubmit={salvar} className="space-y-3 border-t border-borda pt-3">
            <div>
              <label className="rotulo" htmlFor="meses-fotos">Guardar as fotos por</label>
              <div className="flex items-center">
                <input
                  id="meses-fotos"
                  className={`campo rounded-r-none text-right tabular-nums ${mesesValido ? "" : "border-perigo"}`}
                  inputMode="numeric"
                  value={mesesTxt}
                  onChange={(e) => setMesesTxt(e.target.value.replace(/\D/g, ""))}
                />
                <span className="flex h-9 items-center rounded-r border border-l-0 border-borda-forte bg-superficie-2 px-2.5 text-[12px] text-texto-2">meses</span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={ligada} onChange={(e) => setLigada(e.target.checked)} className="h-4 w-4 accent-[var(--primaria)]" />
              Limpeza automática diária ligada
            </label>
            <button className="botao w-full" disabled={ocupado !== null || !alterado}>
              {ocupado === "salvar" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
            </button>
          </form>

          <div className="flex items-start gap-2 text-xs text-texto-2">
            <CalendarClock size={14} className="mt-0.5 shrink-0" />
            {!agendado ? (
              <p>
                <Selo nivel="atencao">Agendamento não configurado</Selo> Adicione <b>SUPABASE_SERVICE_ROLE_KEY</b> e <b>CRON_SECRET</b> na Vercel (veja o README). Enquanto isso, use o botão abaixo.
              </p>
            ) : ligada ? (
              <p><Selo nivel="ok">Automática ativa</Selo> roda todo dia de madrugada.</p>
            ) : (
              <p><Selo nivel="neutro">Automática desligada</Selo> só o botão abaixo apaga fotos.</p>
            )}
          </div>

          <button
            type="button"
            className="botao-perigo w-full"
            onClick={limparAgora}
            disabled={ocupado !== null || alterado || resumo.antigas === 0}
            title={alterado ? "Salve a configuração antes" : undefined}
          >
            {ocupado === "limpar" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {resumo.antigas === 0 ? "Nenhuma foto antiga para apagar" : `Limpar agora (${resumo.antigas.toLocaleString("pt-BR")} foto${resumo.antigas > 1 ? "s" : ""})`}
          </button>
          {alterado && <p className="ajuda -mt-2">Salve a configuração antes de limpar.</p>}
          {msg && <p className={msg.ok ? "sucesso" : "erro"}>{msg.texto}</p>}

          {historico.length > 0 && (
            <div className="border-t border-borda pt-3">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-texto-2 uppercase">
                <ImageOff size={13} /> Últimas limpezas
              </p>
              <ul className="space-y-1 text-xs">
                {historico.map((h) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <span className="text-texto-2">{dataHora(h.em)} · {h.automatica ? "automática" : h.por ?? "ADM"}</span>
                    <span className="tabular-nums">{h.quantidade} foto{h.quantidade === 1 ? "" : "s"} · {tamanho(h.bytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Painel>
  );
}
