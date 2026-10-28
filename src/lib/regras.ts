import type { TipoManutencao, TireMeasurement, Vehicle } from "@/lib/types";

/** A partir de quanto do intervalo o aviso "em breve" aparece. */
export const AVISO_PERCENTUAL = 0.9;

/** Profundidade mínima legal do sulco no Brasil (Contran), em mm. */
export const TWI_MINIMO = 1.6;
/** Abaixo disso o pneu já merece atenção. */
export const TWI_ATENCAO = 3.0;

export type Nivel = "ok" | "atencao" | "critico";

export type StatusManutencao = {
  nivel: Nivel;
  rodado: number;
  intervalo: number;
  faltam: number;
  proximaKm: number;
};

function status(kmAtual: number, kmUltima: number, intervalo: number): StatusManutencao {
  const rodado = kmAtual - kmUltima;
  const faltam = intervalo - rodado;
  const nivel: Nivel = faltam <= 0 ? "critico" : rodado >= intervalo * AVISO_PERCENTUAL ? "atencao" : "ok";
  return { nivel, rodado, intervalo, faltam, proximaKm: kmUltima + intervalo };
}

export function statusOleo(v: Vehicle) {
  return status(v.km_atual, v.km_ultima_troca_oleo, v.intervalo_oleo);
}

export function statusRevisao(v: Vehicle) {
  return status(v.km_atual, v.km_ultima_revisao, v.intervalo_revisao);
}

export function nivelPneu(mm: number): Nivel {
  if (mm < TWI_MINIMO) return "critico";
  if (mm < TWI_ATENCAO) return "atencao";
  return "ok";
}

export const PNEUS = [
  { campo: "dianteiro_esquerdo", foto: "foto_de", rotulo: "Dianteiro esquerdo" },
  { campo: "dianteiro_direito", foto: "foto_dd", rotulo: "Dianteiro direito" },
  { campo: "traseiro_esquerdo", foto: "foto_te", rotulo: "Traseiro esquerdo" },
  { campo: "traseiro_direito", foto: "foto_td", rotulo: "Traseiro direito" },
] as const satisfies readonly { campo: keyof TireMeasurement; foto: keyof TireMeasurement; rotulo: string }[];

export function piorNivel(niveis: Nivel[]): Nivel {
  if (niveis.includes("critico")) return "critico";
  if (niveis.includes("atencao")) return "atencao";
  return "ok";
}

export function normalizarPlaca(placa: string) {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function placaValida(placa: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizarPlaca(placa));
}

/** ABC1234 -> ABC-1234; Mercosul (ABC1D23) fica sem hífen. */
export function formatarPlaca(placa: string) {
  return /^[A-Z]{3}[0-9]{4}$/.test(placa) ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa;
}

export const km = (n: number) => `${n.toLocaleString("pt-BR")} km`;

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export const TIPOS_MANUTENCAO: Record<TipoManutencao, string> = {
  oleo: "Troca de óleo",
  revisao: "Revisão",
  pneus: "Pneus",
  freios: "Freios",
  bateria: "Bateria",
  outro: "Outro serviço",
};

export const dinheiro = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "2026-03-10" -> "10/03/2026" (datas sem horário, sem conversão de fuso) */
export const data = (iso: string) => iso.split("-").reverse().join("/");

export const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export type Pendencia = { servico: "Troca de óleo" | "Revisão"; nivel: Exclude<Nivel, "ok">; texto: string };

/** O que precisa ser feito no veículo (óleo/revisão em breve ou vencidos). `kmAtual` permite simular um km. */
export function pendencias(v: Vehicle, kmAtual = v.km_atual): Pendencia[] {
  const veiculo = { ...v, km_atual: Math.max(v.km_atual, kmAtual) };
  const lista: Pendencia[] = [];
  for (const [servico, s] of [["Troca de óleo", statusOleo(veiculo)], ["Revisão", statusRevisao(veiculo)]] as const) {
    if (s.nivel === "ok") continue;
    lista.push({
      servico,
      nivel: s.nivel,
      texto:
        s.nivel === "critico"
          ? `vencida: passou ${km(-s.faltam)} do limite (prevista com ${km(s.proximaKm)})`
          : `em breve: faltam ${km(s.faltam)} (prevista com ${km(s.proximaKm)})`,
    });
  }
  return lista.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "critico" ? -1 : 1));
}

/** 1536000 -> "1,5 MB" */
export function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const un = ["KB", "MB", "GB"];
  let v = bytes / 1024, i = 0;
  while (v >= 1024 && i < un.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${un[i]}`;
}
