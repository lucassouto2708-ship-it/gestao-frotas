"use client";

import { useState } from "react";
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
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={enviar} className="card w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 pb-2">
          <img src="/icon.svg" alt="" className="h-14 w-14" />
          <h1 className="text-xl font-bold">Gestão de Frotas</h1>
        </div>
        {modo === "cadastrar" && (
          <div>
            <label className="rotulo" htmlFor="nome">Nome</label>
            <input id="nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
        )}
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" type="password" minLength={6} className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p className="erro">{erro}</p>}
        {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
        <button className="botao w-full" disabled={carregando}>
          {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
        <button
          type="button"
          className="w-full text-sm text-marca hover:underline"
          onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}
        >
          {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tenho conta"}
        </button>
      </form>
    </main>
  );
}
