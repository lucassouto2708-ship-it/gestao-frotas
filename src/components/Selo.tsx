import type { Nivel } from "@/lib/regras";

const estilos: Record<Nivel, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  atencao: "bg-amber-100 text-amber-800",
  critico: "bg-red-100 text-red-800",
};

export function Selo({ nivel, children }: { nivel: Nivel; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilos[nivel]}`}>
      {children}
    </span>
  );
}
