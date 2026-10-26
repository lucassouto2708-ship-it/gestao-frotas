import Link from "next/link";
import type { Profile } from "@/lib/types";
import { BotaoSair } from "./BotaoSair";

export function Topo({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-marca">
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          Frotas
        </Link>
        <nav className="flex flex-1 items-center gap-3 text-sm">
          {profile.role === "admin" && (
            <>
              <Link href="/admin" className="text-slate-600 hover:text-marca">Painel</Link>
              <Link href="/admin/usuarios" className="text-slate-600 hover:text-marca">Usuários</Link>
            </>
          )}
        </nav>
        <span className="hidden text-sm text-slate-500 sm:inline">
          {profile.nome || profile.email} {profile.role === "admin" && "(ADM)"}
        </span>
        <BotaoSair />
      </div>
    </header>
  );
}
