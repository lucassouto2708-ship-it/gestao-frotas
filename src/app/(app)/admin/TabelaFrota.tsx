"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CarFront, Download, Search } from "lucide-react";
import { EstadoVazio } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { type Nivel, type StatusManutencao, km } from "@/lib/regras";

export type LinhaFrota = {
  id: string;
  placa: string;
  modelo: string;
  kmAtual: number;
  emViagem: boolean;
  kmMes: number;
  viagensMes: number;
  oleo: StatusManutencao;
  revisao: StatusManutencao;
  pneus: Nivel | null;
  motoristas: string[];
  /** Nome da organização (só o ADM, que vê várias). */
  org?: string;
};

const textoManut: Record<Nivel, string> = { ok: "Em dia", atencao: "Em breve", critico: "Vencida" };
const textoPneu: Record<Nivel, string> = { ok: "OK", atencao: "Atenção", critico: "Trocar" };
const peso: Record<Nivel, number> = { ok: 0, atencao: 1, critico: 2 };

const FILTROS = {
  todos: { rotulo: "Todos os veículos", f: () => true },
  pendencia: {
    rotulo: "Com pendência",
    f: (l: LinhaFrota) => l.oleo.nivel !== "ok" || l.revisao.nivel !== "ok" || (!!l.pneus && l.pneus !== "ok"),
  },
  vencida: {
    rotulo: "Pendência vencida",
    f: (l: LinhaFrota) => l.oleo.nivel === "critico" || l.revisao.nivel === "critico" || l.pneus === "critico",
  },
  oleo: { rotulo: "Troca de óleo pendente", f: (l: LinhaFrota) => l.oleo.nivel !== "ok" },
  revisao: { rotulo: "Revisão pendente", f: (l: LinhaFrota) => l.revisao.nivel !== "ok" },
  pneus: { rotulo: "Pneus com alerta", f: (l: LinhaFrota) => !!l.pneus && l.pneus !== "ok" },
  semMedicao: { rotulo: "Pneus sem medição", f: (l: LinhaFrota) => l.pneus === null },
  viagem: { rotulo: "Em viagem", f: (l: LinhaFrota) => l.emViagem },
} as const;
type Filtro = keyof typeof FILTROS;

type Coluna = "placa" | "modelo" | "kmAtual" | "kmMes" | "oleo" | "revisao" | "pneus";
const valorOrdem: Record<Coluna, (l: LinhaFrota) => string | number> = {
  placa: (l) => l.placa,
  modelo: (l) => l.modelo.toLowerCase(),
  kmAtual: (l) => l.kmAtual,
  kmMes: (l) => l.kmMes,
  oleo: (l) => l.oleo.faltam,
  revisao: (l) => l.revisao.faltam,
  pneus: (l) => (l.pneus === null ? -1 : peso[l.pneus]),
};

function faltamTexto(s: StatusManutencao) {
  return s.faltam > 0 ? `faltam ${km(s.faltam)}` : `excedido ${km(-s.faltam)}`;
}

export function TabelaFrota({ linhas, competencia }: { linhas: LinhaFrota[]; competencia: string }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: "placa", asc: true });

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase().replace(/-/g, "");
    const lista = linhas.filter(
      (l) =>
        FILTROS[filtro].f(l) &&
        (!termo ||
          l.placa.toLowerCase().replace(/-/g, "").includes(termo) ||
          l.modelo.toLowerCase().includes(termo) ||
          l.motoristas.some((m) => m.toLowerCase().includes(termo))),
    );
    const v = valorOrdem[ordem.col];
    return lista.sort((a, b) => {
      const x = v(a);
      const y = v(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
      return ordem.asc ? c : -c;
    });
  }, [linhas, busca, filtro, ordem]);

  function ordenar(col: Coluna) {
    setOrdem((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: true }));
  }

  function exportarCsv() {
    const cab = ["Placa", "Modelo", "Motoristas", "Km atual", "Km na competência", "Viagens", "Óleo", "Óleo (km restantes)", "Revisão", "Revisão (km restantes)", "Pneus", "Em viagem"];
    const linhasCsv = visiveis.map((l) => [
      l.placa,
      l.modelo,
      l.motoristas.join(", "),
      l.kmAtual,
      l.kmMes,
      l.viagensMes,
      textoManut[l.oleo.nivel],
      l.oleo.faltam,
      textoManut[l.revisao.nivel],
      l.revisao.faltam,
      l.pneus ? textoPneu[l.pneus] : "Sem medição",
      l.emViagem ? "Sim" : "Não",
    ]);
    const csv = [cab, ...linhasCsv].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `frota-${competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Th = ({ col, children, num }: { col: Coluna; children: React.ReactNode; num?: boolean }) => {
    const ativa = ordem.col === col;
    const Icone = !ativa ? ArrowUpDown : ordem.asc ? ArrowUp : ArrowDown;
    return (
      <th className={num ? "num" : ""} aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => ordenar(col)}
          className={`inline-flex items-center gap-1 uppercase hover:text-texto ${ativa ? "text-texto" : ""} ${num ? "flex-row-reverse" : ""}`}
        >
          {children}
          <Icone size={12} className={ativa ? "" : "opacity-40"} />
        </button>
      </th>
    );
  };

  return (
    <section className="painel">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda px-4 py-2.5">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-texto-2" />
          <input
            className="campo pl-8"
            placeholder="Pesquisar placa, modelo ou motorista"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Pesquisar"
          />
        </div>
        <select className="campo w-full sm:w-56" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtrar">
          {Object.entries(FILTROS).map(([k, v]) => (
            <option key={k} value={k}>{v.rotulo}</option>
          ))}
        </select>
        <span className="text-[12px] text-texto-2">
          {visiveis.length} de {linhas.length} veículos
        </span>
        <button type="button" className="botao-secundario ml-auto" onClick={exportarCsv} disabled={visiveis.length === 0}>
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      {linhas.length === 0 ? (
        <EstadoVazio
          icone={<CarFront size={28} strokeWidth={1.5} />}
          titulo="Nenhum veículo cadastrado"
          texto="Os veículos cadastrados pelo gestor aparecerão aqui."
          acao={<Link href="/veiculos/novo" className="botao">Cadastrar veículo</Link>}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio titulo="Nenhum veículo atende aos filtros" texto="Altere a pesquisa ou o filtro selecionado." />
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="tabela">
            <thead>
              <tr>
                <Th col="placa">Placa</Th>
                <Th col="modelo">Modelo</Th>
                <Th col="kmAtual" num>Km atual</Th>
                <Th col="kmMes" num>Km competência</Th>
                <Th col="oleo">Troca de óleo</Th>
                <Th col="revisao">Revisão</Th>
                <Th col="pneus">Pneus</Th>
                <th>Motoristas</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const critico = l.oleo.nivel === "critico" || l.revisao.nivel === "critico" || l.pneus === "critico";
                return (
                  <tr key={l.id}>
                    <td className={`whitespace-nowrap ${critico ? "shadow-[inset_3px_0_0_var(--perigo)]" : ""}`}>
                      <Link href={`/admin/veiculos/${l.id}`} className="mono link font-semibold">{l.placa}</Link>{l.org && <span className="block text-xs text-texto-2">{l.org}</span>}
                    </td>
                    <td>{l.modelo || <span className="text-texto-2">—</span>}</td>
                    <td className="num font-semibold">{km(l.kmAtual)}</td>
                    <td className="num">
                      {km(l.kmMes)} <span className="text-xs text-texto-2">({l.viagensMes})</span>
                    </td>
                    {[l.oleo, l.revisao].map((s, i) => (
                      <td key={i} className="whitespace-nowrap">
                        <Selo nivel={s.nivel}>{textoManut[s.nivel]}</Selo>{" "}
                        <span className={`text-xs tabular-nums ${s.nivel === "critico" ? "font-semibold text-perigo" : "text-texto-2"}`}>
                          {faltamTexto(s)}
                        </span>
                      </td>
                    ))}
                    <td>{l.pneus ? <Selo nivel={l.pneus}>{textoPneu[l.pneus]}</Selo> : <Selo nivel="neutro">Sem medição</Selo>}</td>
                    <td className="max-w-48 text-xs">
                      {l.motoristas.length ? l.motoristas.join(", ") : <span className="text-alerta">Nenhum vinculado</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      {l.emViagem ? <Selo nivel="info">Em viagem</Selo> : <Selo nivel="neutro">Disponível</Selo>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
