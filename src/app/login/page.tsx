"use client";

import { useState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setCarregando(true);
    const supabase = createClient();
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        setErro("E-mail ou senha inválidos.");
      } else {
        router.replace("/");
        router.refresh();
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
      if (error) {
        setErro(error.message);
      } else if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      } else {
        setInfo("Cadastro feito! Confirme pelo link enviado ao seu e-mail e depois entre.");
        setModo("entrar");
      }
    }
    setCarregando(false);
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
              <p className="text-[13px] text-texto-2">Controle de quilometragem, manutenção e pneus</p>
            </div>
          </div>

          <form onSubmit={enviar} className="painel">
            <div className="painel-cabecalho">
              <h2 className="painel-titulo">{modo === "entrar" ? "Acesso ao sistema" : "Cadastro de usuário"}</h2>
            </div>
            <div className="painel-corpo space-y-3.5">
              {modo === "cadastrar" && (
                <div>
                  <label className="rotulo" htmlFor="nome">Nome completo</label>
                  <input id="nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
              )}
              <div>
                <label className="rotulo" htmlFor="email">E-mail</label>
                <input id="email" type="email" autoComplete="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="rotulo" htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  type="password"
                  minLength={6}
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  className="campo"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                {modo === "cadastrar" && <p className="ajuda">Mínimo de 6 caracteres.</p>}
              </div>
              {erro && <p className="erro">{erro}</p>}
              {info && <p className="sucesso">{info}</p>}
              <button className="botao w-full" disabled={carregando}>
                {carregando ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : modo === "entrar" ? (
                  <LogIn size={15} />
                ) : (
                  <UserPlus size={15} />
                )}
                {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            </div>
            <div className="border-t border-borda px-4 py-3 text-center text-[13px]">
              <button type="button" className="link" onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}>
                {modo === "entrar" ? "Não possui acesso? Cadastre-se" : "Já possuo cadastro"}
              </button>
            </div>
          </form>
          <p className="mt-4 text-center text-xs text-texto-2">Acesso restrito a usuários autorizados.</p>
        </div>
      </div>
    </main>
  );
}
