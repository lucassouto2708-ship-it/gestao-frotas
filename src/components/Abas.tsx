"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CarFront, ClipboardList, Gauge, LayoutList, PlusSquare, SlidersHorizontal, Users, Wrench } from "lucide-react";
import type { Role } from "@/lib/types";

const ABAS_MOTORISTA = [
  { href: "/", rotulo: "Início", icone: LayoutList, exato: true },
  { href: "/viagens/nova", rotulo: "Iniciar viagem", icone: Gauge },
];

const ABAS_GESTAO = [
  { href: "/", rotulo: "Início", icone: LayoutList, exato: true },
  { href: "/viagens/nova", rotulo: "Iniciar viagem", icone: Gauge },
  { href: "/veiculos", rotulo: "Veículos e manutenção", icone: Wrench },
  { href: "/pneus/novo", rotulo: "Medição de pneus", icone: ClipboardList },
  { href: "/veiculos/novo", rotulo: "Cadastrar veículo", icone: PlusSquare },
];

const ABAS_PAINEL = [
  { href: "/admin", rotulo: "Painel da frota", icone: CarFront, exato: false },
  { href: "/admin/usuarios", rotulo: "Usuários", icone: Users },
  { href: "/admin/parametros", rotulo: "Parâmetros", icone: SlidersHorizontal },
];

const ABA_ORGANIZACOES = { href: "/admin/organizacoes", rotulo: "Organizações", icone: Building2 };

export function Abas({ papel }: { papel: Role }) {
  const caminho = usePathname();
  const ativa = (href: string, exato?: boolean) => {
    if (href === "/admin") return caminho === "/admin" || caminho.startsWith("/admin/veiculos") || caminho.startsWith("/admin/viagens");
    if (href === "/veiculos") return caminho === "/veiculos" || (caminho.startsWith("/veiculos/") && caminho !== "/veiculos/novo");
    return exato ? caminho === href : caminho.startsWith(href);
  };

  const item = (a: { href: string; rotulo: string; icone: typeof Gauge; exato?: boolean }) => {
    const on = ativa(a.href, a.exato);
    const Icone = a.icone;
    return (
      <Link
        key={a.href}
        href={a.href}
        aria-current={on ? "page" : undefined}
        className={`-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
          on ? "border-primaria text-primaria-texto" : "border-transparent text-texto-2 hover:text-texto"
        }`}
      >
        <Icone size={15} strokeWidth={1.75} />
        {a.rotulo}
      </Link>
    );
  };

  return (
    <nav className="border-b border-borda bg-superficie">
      <div className="mx-auto flex max-w-[1400px] items-stretch overflow-x-auto px-2 sm:px-4">
        {papel !== "motorista" && (
          <>
            {papel === "admin" && item(ABA_ORGANIZACOES)}
            {ABAS_PAINEL.map(item)}
            <span className="mx-2 my-3 w-px shrink-0 bg-borda" />
          </>
        )}
        {(papel === "motorista" ? ABAS_MOTORISTA : ABAS_GESTAO).map(item)}
      </div>
    </nav>
  );
}
