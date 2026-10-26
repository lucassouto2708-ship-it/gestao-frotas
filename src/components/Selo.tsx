import type { Nivel } from "@/lib/regras";

type Tom = Nivel | "info" | "neutro";

const estilos: Record<Tom, string> = {
  ok: "border-sucesso/35 bg-sucesso-suave text-sucesso",
  atencao: "border-alerta/40 bg-alerta-suave text-alerta",
  critico: "border-perigo/35 bg-perigo-suave text-perigo",
  info: "border-primaria/30 bg-primaria-suave text-primaria-texto",
  neutro: "border-borda-forte bg-superficie-2 text-texto-2",
};

export function Selo({ nivel, children }: { nivel: Tom; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-px text-[11px] font-semibold whitespace-nowrap ${estilos[nivel]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
