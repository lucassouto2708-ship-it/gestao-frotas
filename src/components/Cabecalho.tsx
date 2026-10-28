import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Abas } from "./Abas";
import { AlternarTema } from "./AlternarTema";
import { BotaoSair } from "./BotaoSair";
import { BarraRastreio } from "./rastreio/BarraRastreio";

export const VERSAO = "1.1";

export function Cabecalho({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-20">
      <div className="bg-cabecalho text-cabecalho-texto">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0 rounded-[3px] ring-1 ring-white/25" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-bold">Gestão de Frotas</span>
              <span className="hidden truncate text-[11.5px] opacity-75 sm:block">
                Controle de quilometragem, manutenção e pneus
              </span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1 text-[13px]">
            <span className="mr-2 hidden text-[11px] opacity-60 md:inline">v{VERSAO}</span>
            <AlternarTema />
            <span className="mx-1 hidden h-6 w-px bg-white/20 sm:block" />
            <span className="hidden items-center gap-2 px-2 sm:flex">
              <CircleUserRound size={18} strokeWidth={1.75} className="opacity-80" />
              <span className="max-w-48 truncate">{profile.nome || profile.email}</span>
              <span className="rounded-[3px] border border-white/30 px-1.5 py-px text-[10.5px] font-semibold tracking-wide uppercase">
                {profile.role === "admin" ? "ADM" : "Operador"}
              </span>
            </span>
            <BotaoSair />
          </div>
        </div>
      </div>
      <Abas admin={profile.role === "admin"} />
      <BarraRastreio />
    </header>
  );
}
