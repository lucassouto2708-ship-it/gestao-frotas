"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { BotaoSair } from "@/components/BotaoSair";
import { createClient } from "@/lib/supabase/client";

export function FormConvite({ nome, codigoDoLink }: { nome: string; codigoDoLink: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(codigoDoLink);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Código guardado quando a pessoa abriu o link antes de entrar/criar a conta
  useEffect(() => {
    if (codigoDoLink) return;
    try {
      const guardado = localStorage.getItem("convite_codigo");
      if (guardado) setCodigo(guardado);
    } catch {
      // sem armazenamento: a pessoa digita
    }
  }, [codigoDoLink]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await createClient().rpc("aceitar_convite", { p_codigo: codigo });
    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }
    try {
      localStorage.removeItem("convite_codigo");
    } catch {
      // ignora
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col bg-fundo">
      <div className="h-1 bg-primaria" />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-11 w-11 rounded" />
            <div className="leading-tight">
              <h1 className="text-[18px] font-bold">Gestão de Frotas</h1>
              <p className="text-[13px] text-texto-2">{nome ? `Olá, ${nome}` : "Quase lá"}</p>
            </div>
          </div>
          <form onSubmit={enviar} className="painel">
            <div className="painel-cabecalho">
              <h2 className="painel-titulo">Entrar em uma organização</h2>
            </div>
            <div className="painel-corpo space-y-3.5">
              <p className="text-[13px] text-texto-2">
                Digite o código de convite que o gestor da sua empresa ou prefeitura enviou. Sem ele, o acesso não é liberado.
              </p>
              <div>
                <label className="rotulo" htmlFor="codigo">Código de convite</label>
                <input
                  id="codigo"
                  className="campo mono uppercase"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              {erro && <p className="erro">{erro}</p>}
              <button className="botao w-full" disabled={carregando || !codigo.trim()}>
                {carregando ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {carregando ? "Verificando…" : "Entrar na organização"}
              </button>
            </div>
          </form>
          <div className="mt-4 flex justify-center text-[13px] text-texto-2">
            <span className="rounded bg-cabecalho text-cabecalho-texto">
              <BotaoSair />
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
