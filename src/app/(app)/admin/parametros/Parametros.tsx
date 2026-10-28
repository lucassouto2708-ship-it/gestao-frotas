"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyCheck, Loader2, RotateCcw, Save } from "lucide-react";
import { Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { dataHora, formatarPlaca, km, statusOleo, statusRevisao } from "@/lib/regras";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

const MIN = 500;
const MAX = 200000;
const textoNivel = { ok: "Em dia", atencao: "Em breve", critico: "Vencida" } as const;

/** "10.000" -> 10000; null se inválido */
function lerKm(texto: string) {
  const n = Number(texto.replace(/\D/g, ""));
  return texto.trim() && n >= MIN && n <= MAX ? n : null;
}

function CampoKm({ valor, onChange, rotulo, id }: { valor: string; onChange: (v: string) => void; rotulo: string; id?: string }) {
  const invalido = lerKm(valor) === null;
  return (
    <div className="flex items-center">
      <input
        id={id}
        aria-label={rotulo}
        className={`campo rounded-r-none text-right tabular-nums ${invalido ? "border-perigo" : ""}`}
        inputMode="numeric"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="flex h-9 items-center rounded-r border border-l-0 border-borda-forte bg-superficie-2 px-2 text-[12px] text-texto-2">km</span>
    </div>
  );
}

/** Padrão usado no cadastro de novos veículos, com opção de aplicar a toda a frota. */
export function PadraoFrota({ organizacaoId, oleo, revisao, totalVeiculos }: { organizacaoId: string; oleo: number; revisao: number; totalVeiculos: number }) {
  const router = useRouter();
  const [o, setO] = useState(String(oleo));
  const [r, setR] = useState(String(revisao));
  const [ocupado, setOcupado] = useState<"salvar" | "aplicar" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  function validar() {
    const no = lerKm(o), nr = lerKm(r);
    if (no === null || nr === null) {
      setMsg({ ok: false, texto: `Use valores entre ${km(MIN)} e ${km(MAX)}.` });
      return null;
    }
    return { intervalo_oleo: no, intervalo_revisao: nr };
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = validar();
    if (!v) return;
    setOcupado("salvar");
    const { error } = await createClient().from("configuracoes").update(v).eq("organizacao_id", organizacaoId);
    setOcupado(null);
    if (error) return setMsg({ ok: false, texto: error.message });
    setMsg({ ok: true, texto: "Padrão salvo. Vale para os próximos veículos cadastrados." });
    router.refresh();
  }

  async function aplicarATodos() {
    const v = validar();
    if (!v) return;
    if (!confirm(`Aplicar óleo a cada ${km(v.intervalo_oleo)} e revisão a cada ${km(v.intervalo_revisao)} em todos os ${totalVeiculos} veículos? Os intervalos atuais de cada carro serão substituídos.`)) return;
    setOcupado("aplicar");
    const supabase = createClient();
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("configuracoes").update(v).eq("organizacao_id", organizacaoId),
      supabase.from("vehicles").update(v).eq("organizacao_id", organizacaoId),
    ]);
    setOcupado(null);
    if (e1 || e2) return setMsg({ ok: false, texto: (e1 ?? e2)!.message });
    setMsg({ ok: true, texto: `Padrão salvo e aplicado aos ${totalVeiculos} veículos.` });
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <p className="text-xs text-texto-2">Todo veículo cadastrado a partir de agora recebe estes intervalos.</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="rotulo" htmlFor="padrao-oleo">Troca de óleo a cada</label>
          <CampoKm id="padrao-oleo" rotulo="Troca de óleo a cada (padrão)" valor={o} onChange={setO} />
        </div>
        <div>
          <label className="rotulo" htmlFor="padrao-revisao">Revisão a cada</label>
          <CampoKm id="padrao-revisao" rotulo="Revisão a cada (padrão)" valor={r} onChange={setR} />
        </div>
      </div>
      {msg && <p className={msg.ok ? "sucesso" : "erro"}>{msg.texto}</p>}
      <button className="botao w-full" disabled={ocupado !== null}>
        {ocupado === "salvar" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar padrão
      </button>
      <div className="border-t border-borda pt-3">
        <button type="button" className="botao-secundario w-full" onClick={aplicarATodos} disabled={ocupado !== null || totalVeiculos === 0}>
          {ocupado === "aplicar" ? <Loader2 size={15} className="animate-spin" /> : <CopyCheck size={15} />} Aplicar a todos os {totalVeiculos} veículos
        </button>
        <p className="ajuda">Substitui os intervalos de cada carro pelo padrão acima.</p>
      </div>
    </form>
  );
}

type Edicao = { oleo: string; revisao: string };

/** Intervalos de cada veículo, editáveis na própria tabela, com prévia da situação. */
export function TabelaParametros({ veiculos, nomes }: { veiculos: Vehicle[]; nomes: Record<string, string> }) {
  const router = useRouter();
  const original = useMemo(
    () => Object.fromEntries(veiculos.map((v) => [v.id, { oleo: String(v.intervalo_oleo), revisao: String(v.intervalo_revisao) }])),
    [veiculos],
  );
  const [edicao, setEdicao] = useState<Record<string, Edicao>>(original);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const alterados = veiculos.filter((v) => {
    const e = edicao[v.id] ?? original[v.id];
    return lerKm(e.oleo) !== v.intervalo_oleo || lerKm(e.revisao) !== v.intervalo_revisao;
  });
  const invalidos = alterados.filter((v) => lerKm(edicao[v.id].oleo) === null || lerKm(edicao[v.id].revisao) === null);

  async function salvarTudo() {
    if (invalidos.length) return setMsg({ ok: false, texto: `Corrija os valores destacados (entre ${km(MIN)} e ${km(MAX)}).` });
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();
    const resultados = await Promise.all(
      alterados.map((v) =>
        supabase
          .from("vehicles")
          .update({ intervalo_oleo: lerKm(edicao[v.id].oleo), intervalo_revisao: lerKm(edicao[v.id].revisao) })
          .eq("id", v.id),
      ),
    );
    setSalvando(false);
    const erro = resultados.find((r) => r.error)?.error;
    if (erro) return setMsg({ ok: false, texto: erro.message });
    setMsg({ ok: true, texto: `${alterados.length} veículo${alterados.length > 1 ? "s atualizados" : " atualizado"}.` });
    router.refresh();
  }

  return (
    <Painel
      titulo="Intervalos por veículo"
      acoes={
        <div className="flex items-center gap-2">
          {alterados.length > 0 && (
            <>
              <span className="text-xs text-texto-2">{alterados.length} alterado{alterados.length > 1 ? "s" : ""}</span>
              <button type="button" className="botao-secundario botao-pequeno" onClick={() => setEdicao(original)} disabled={salvando}>
                <RotateCcw size={13} /> Desfazer
              </button>
            </>
          )}
          <button type="button" className="botao botao-pequeno" onClick={salvarTudo} disabled={salvando || alterados.length === 0}>
            {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar alterações
          </button>
        </div>
      }
      semPadding
    >
      {msg && <p className={`${msg.ok ? "sucesso" : "erro"} m-3`}>{msg.texto}</p>}
      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>Placa</th>
              <th className="num">Km atual</th>
              <th>Troca de óleo a cada</th>
              <th>Situação do óleo</th>
              <th>Revisão a cada</th>
              <th>Situação da revisão</th>
              <th>Última alteração</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => {
              const e = edicao[v.id] ?? original[v.id];
              // Prévia: situação com os intervalos digitados
              const simulado = { ...v, intervalo_oleo: lerKm(e.oleo) ?? v.intervalo_oleo, intervalo_revisao: lerKm(e.revisao) ?? v.intervalo_revisao };
              const so = statusOleo(simulado), sr = statusRevisao(simulado);
              const mudou = alterados.includes(v);
              const editar = (campo: keyof Edicao) => (valor: string) => setEdicao((x) => ({ ...x, [v.id]: { ...(x[v.id] ?? original[v.id]), [campo]: valor } }));
              return (
                <tr key={v.id}>
                  <td className={`whitespace-nowrap ${mudou ? "shadow-[inset_3px_0_0_var(--primaria)]" : ""}`}>
                    <Link href={`/admin/veiculos/${v.id}`} className="mono link font-semibold">{formatarPlaca(v.placa)}</Link>
                    <span className="block text-xs text-texto-2">{v.modelo || "—"}</span>
                  </td>
                  <td className="num">{km(v.km_atual)}</td>
                  <td className="w-40"><CampoKm rotulo={`Óleo a cada (${v.placa})`} valor={e.oleo} onChange={editar("oleo")} /></td>
                  <td className="whitespace-nowrap">
                    <Selo nivel={so.nivel}>{textoNivel[so.nivel]}</Selo>
                    <span className="block text-xs text-texto-2">próxima em {km(so.proximaKm)}</span>
                  </td>
                  <td className="w-40"><CampoKm rotulo={`Revisão a cada (${v.placa})`} valor={e.revisao} onChange={editar("revisao")} /></td>
                  <td className="whitespace-nowrap">
                    <Selo nivel={sr.nivel}>{textoNivel[sr.nivel]}</Selo>
                    <span className="block text-xs text-texto-2">próxima em {km(sr.proximaKm)}</span>
                  </td>
                  <td className="text-xs whitespace-nowrap text-texto-2">
                    {v.atualizado_em ? (
                      <>
                        {v.atualizado_por ? nomes[v.atualizado_por] ?? "—" : "—"}
                        <span className="block">{dataHora(v.atualizado_em)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}
