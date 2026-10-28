/** Rota da viagem desenhada a partir dos pontos do GPS (sem mapa de fundo). */
export function RotaSvg({ pontos }: { pontos: [number, number, number][] }) {
  if (pontos.length < 2) return null;
  const W = 720, H = 400, PAD = 32;
  const latMedia = pontos.reduce((s, p) => s + p[0], 0) / pontos.length;
  const kx = Math.cos((latMedia * Math.PI) / 180);
  const xs = pontos.map((p) => p[1] * kx);
  const ys = pontos.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const larg = Math.max(maxX - minX, 1e-7), alt = Math.max(maxY - minY, 1e-7);
  const escala = Math.min((W - 2 * PAD) / larg, (H - 2 * PAD) / alt);
  const ox = (W - larg * escala) / 2 - minX * escala;
  const oy = (H - alt * escala) / 2 - minY * escala;
  const px = xs.map((x) => x * escala + ox);
  const py = ys.map((y) => y * escala + oy);
  const linha = px.map((x, i) => `${x.toFixed(1)},${py[i].toFixed(1)}`).join(" ");

  // Barra de escala: 1, 2 ou 5 × 10^n metros, até ~25% da largura
  const metrosPorPx = 111_195 / escala;
  const alvo = (W * 0.25) * metrosPorPx;
  const base = Math.pow(10, Math.floor(Math.log10(alvo)));
  const passo = [5, 2, 1].map((f) => f * base).find((v) => v <= alvo) ?? base;
  const barra = passo / metrosPorPx;
  const rotulo = passo >= 1000 ? `${passo / 1000} km` : `${passo} m`;
  const ult = pontos.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-borda bg-superficie-2" role="img" aria-label="Rota da viagem">
      <polyline points={linha} fill="none" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: "var(--primaria)" }} />
      <circle cx={px[0]} cy={py[0]} r="7" strokeWidth="2.5" style={{ fill: "var(--sucesso)", stroke: "var(--superficie)" }} />
      <circle cx={px[ult]} cy={py[ult]} r="7" strokeWidth="2.5" style={{ fill: "var(--perigo)", stroke: "var(--superficie)" }} />
      <g style={{ fill: "var(--texto-2)", stroke: "var(--texto-2)" }} fontSize="12">
        <line x1={PAD} x2={PAD + barra} y1={H - 14} y2={H - 14} strokeWidth="2" />
        <text x={PAD + barra + 6} y={H - 10} stroke="none">{rotulo}</text>
      </g>
    </svg>
  );
}
