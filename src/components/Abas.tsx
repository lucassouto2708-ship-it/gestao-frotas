"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, ClipboardList, Gauge, LayoutList, PlusSquare, Users } from "lucide-react";

const ABAS_COMUNS = [
  { href: "/", rotulo: "Início", icone: LayoutList, exato: true },
  { href: "/viagens/nova", rotulo: "Iniciar viagem", icone: Gauge },
  { href: "/pneus/novo", rotulo: "Medição de pneus", icone: ClipboardList },
  { href: "/veiculos/novo", rotulo: "Cadastrar veículo", icone: PlusSquare },
];

const ABAS_ADMIN = [
  { href: "/admin", rotulo: "Painel da frota", icone: CarFront, exato: false },
  { href: "/admin/usuarios", rotulo: "Usuários", icone: Users },
];

export function Abas({ admin }: { admin: boolean }) {
  const caminho = usePathname();
  const ativa = (href: string, exato?: boolean) =>
    exato || href === "/admin"
      ? caminho === href || (href === "/admin" && caminho.startsWith("/admin/veiculos"))
      : caminho.startsWith(href);

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
        {admin && (
          <>
            {ABAS_ADMIN.map(item)}
            <span className="mx-2 my-3 w-px shrink-0 bg-borda" />
          </>
        )}
        {ABAS_COMUNS.map(item)}
      </div>
    </nav>
  );
}
