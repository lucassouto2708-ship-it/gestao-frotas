"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CarFront, Ellipsis, X, ClipboardList, Gauge, LayoutList, PlusSquare, SlidersHorizontal, Users, Wrench } from "lucide-react";
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

  // Celular: barra fixa embaixo com o essencial; o resto fica em "Mais"
  const [maisAberto, setMaisAberto] = useState(false);
  // Com o teclado aberto a tela útil encolhe: a barra fixa cobriria o campo que está sendo digitado
  const [digitando, setDigitando] = useState(false);
  useEffect(() => {
    const campo = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select") || el.isContentEditable);
    const entrou = (e: FocusEvent) => campo(e.target) && setDigitando(true);
    const saiu = () => setDigitando(false);
    document.addEventListener("focusin", entrou);
    document.addEventListener("focusout", saiu);
    return () => {
      document.removeEventListener("focusin", entrou);
      document.removeEventListener("focusout", saiu);
    };
  }, []);
  type Aba = { href: string; rotulo: string; icone: typeof Gauge; exato?: boolean };
  const todas: Aba[] = [...(papel === "admin" ? [ABA_ORGANIZACOES] : []), ...(papel !== "motorista" ? ABAS_PAINEL : []), ...(papel === "motorista" ? ABAS_MOTORISTA : ABAS_GESTAO)];
  const principais = papel === "motorista" ? ABAS_MOTORISTA : [ABAS_GESTAO[0], ABAS_GESTAO[1], ABAS_GESTAO[2], ABAS_PAINEL[0]];
  const secundarias = todas.filter((a) => !principais.some((p) => p.href === a.href));
  const itemBaixo = (a: { href: string; rotulo: string; icone: typeof Gauge; exato?: boolean }) => {
    const on = ativa(a.href, a.exato);
    const Icone = a.icone;
    return (
      <Link
        key={a.href}
        href={a.href}
        aria-current={on ? "page" : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium ${on ? "text-primaria-texto" : "text-texto-2"}`}
      >
        <Icone size={22} strokeWidth={on ? 2.1 : 1.75} />
        <span className="max-w-full truncate">{a.rotulo.replace("Veículos e manutenção", "Veículos").replace("Iniciar viagem", "Viagem").replace("Painel da frota", "Painel")}</span>
      </Link>
    );
  };

  return (
    <>
    <nav className={`fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden ${digitando ? "hidden" : ""}`} aria-label="Navegação principal">
      <div className="mx-auto flex max-w-xl items-stretch">
        {principais.map(itemBaixo)}
        {secundarias.length > 0 && (
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium ${secundarias.some((a) => ativa(a.href, a.exato)) ? "text-primaria-texto" : "text-texto-2"}`}
          >
            <Ellipsis size={22} strokeWidth={1.75} />
            Mais
          </button>
        )}
      </div>
    </nav>
    {maisAberto && (
      <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
        <button type="button" className="absolute inset-0 bg-black/45" aria-label="Fechar" onClick={() => setMaisAberto(false)} />
        <div className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] shadow-2xl">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-[13px] font-semibold">Mais opções</span>
            <button type="button" onClick={() => setMaisAberto(false)} className="flex h-9 w-9 items-center justify-center rounded text-texto-2" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <ul className="divide-y divide-borda pb-2">
            {secundarias.map((a) => {
              const Icone = a.icone;
              return (
                <li key={a.href}>
                  <Link href={a.href} onClick={() => setMaisAberto(false)} className={`flex h-12 items-center gap-3 px-4 text-[14px] font-medium ${ativa(a.href, a.exato) ? "text-primaria-texto" : ""}`}>
                    <Icone size={18} strokeWidth={1.75} /> {a.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    )}
    <nav className="hidden border-b border-borda bg-superficie md:block">
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
    </>
  );
}
