import { nivelPneu, type Nivel } from "@/lib/regras";

type Medidas = { dianteiro_esquerdo: number | null; dianteiro_direito: number | null; traseiro_esquerdo: number | null; traseiro_direito: number | null };

const COR: Record<Nivel | "pendente", string> = {
  ok: "var(--sucesso)",
  atencao: "var(--alerta)",
  critico: "var(--perigo)",
  pendente: "var(--borda-forte)",
};
const TEXTO: Record<Nivel, string> = { ok: "OK", atencao: "Atenção", critico: "Trocar" };

/** Veículo visto de cima, com cada pneu colorido pela situação do sulco e a medida ao lado. */
export function DiagramaPneus({ medidas }: { medidas: Medidas }) {
  const pneu = (x: number, y: number, mm: number | null) => {
    const cor = COR[mm === null ? "pendente" : nivelPneu(mm)];
    return (
      <g>
        <rect x={x} y={y} width={30} height={62} rx={8} fill={cor} />
        {[16, 28, 40, 52].map((dy) => (
          <line key={dy} x1={x + 6} x2={x + 24} y1={y + dy} y2={y + dy} stroke="var(--superficie)" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
        ))}
      </g>
    );
  };
  const rotulo = (lado: "esq" | "dir", y: number, nome: string, mm: number | null) => {
    const x = lado === "esq" ? 92 : 268;
    const ancora = lado === "esq" ? "end" : "start";
    const nivel = mm === null ? null : nivelPneu(mm);
    return (
      <g textAnchor={ancora}>
        <text x={x} y={y} fontSize={10.5} fontWeight={600} letterSpacing={0.6} fill="var(--texto-2)">{nome}</text>
        <text x={x} y={y + 22} fontSize={19} fontWeight={700} fill="var(--texto)" style={{ fontVariantNumeric: "tabular-nums" }}>
          {mm === null ? "—" : `${mm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} mm`}
        </text>
        <text x={x} y={y + 40} fontSize={11.5} fontWeight={600} fill={nivel ? COR[nivel] : "var(--texto-2)"}>
          {nivel ? `● ${TEXTO[nivel]}` : "○ Pendente"}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox="0 0 360 330" role="img" aria-label="Situação dos pneus, vista de cima do veículo" className="mx-auto block w-full max-w-[420px]">
      <text x={180} y={13} textAnchor="middle" fontSize={10} fontWeight={700} letterSpacing={1.5} fill="var(--texto-2)">FRENTE ▲</text>

      {/* Carroceria */}
      <path
        d="M180 26C216 26 234 48 234 88V252C234 292 216 312 180 312C144 312 126 292 126 252V88C126 48 144 26 180 26Z"
        fill="var(--superficie-2)" stroke="var(--borda-forte)" strokeWidth={2}
      />
      {/* Faróis e lanternas */}
      <rect x={138} y={34} width={20} height={7} rx={3.5} fill="var(--borda-forte)" />
      <rect x={202} y={34} width={20} height={7} rx={3.5} fill="var(--borda-forte)" />
      <rect x={138} y={297} width={22} height={6} rx={3} fill="var(--perigo)" fillOpacity={0.55} />
      <rect x={200} y={297} width={22} height={6} rx={3} fill="var(--perigo)" fillOpacity={0.55} />
      {/* Para-brisa, teto e vidro traseiro */}
      <path d="M142 112L152 90H208L218 112Z" fill="var(--borda)" />
      <rect x={142} y={118} width={76} height={92} rx={10} fill="var(--superficie)" stroke="var(--borda-forte)" strokeWidth={1.5} />
      <path d="M144 216H216L208 240H152Z" fill="var(--borda)" />
      {/* Espelhos */}
      <rect x={116} y={112} width={11} height={16} rx={4} fill="var(--borda-forte)" />
      <rect x={233} y={112} width={11} height={16} rx={4} fill="var(--borda-forte)" />

      {/* Pneus */}
      {pneu(98, 70, medidas.dianteiro_esquerdo)}
      {pneu(232, 70, medidas.dianteiro_direito)}
      {pneu(98, 200, medidas.traseiro_esquerdo)}
      {pneu(232, 200, medidas.traseiro_direito)}

      {/* Medidas */}
      {rotulo("esq", 78, "DIANT. ESQ.", medidas.dianteiro_esquerdo)}
      {rotulo("dir", 78, "DIANT. DIR.", medidas.dianteiro_direito)}
      {rotulo("esq", 208, "TRAS. ESQ.", medidas.traseiro_esquerdo)}
      {rotulo("dir", 208, "TRAS. DIR.", medidas.traseiro_direito)}
    </svg>
  );
}
