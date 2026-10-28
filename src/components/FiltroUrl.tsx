"use client";

import { useRouter } from "next/navigation";

/** Lista de opções que filtra a página na hora de escolher (guarda a escolha na URL, mantendo os demais filtros). */
export function FiltroUrl({ parametro, valor, opcoes, todas, rotulo, className = "campo w-56" }: {
  parametro: string;
  valor: string;
  opcoes: { id: string; nome: string }[];
  todas?: string;
  rotulo: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label={rotulo}
      className={className}
      value={valor}
      onChange={(e) => {
        const q = new URLSearchParams(window.location.search);
        if (e.target.value) q.set(parametro, e.target.value);
        else q.delete(parametro);
        router.push(`${window.location.pathname}${q.size ? `?${q}` : ""}`);
      }}
    >
      {todas && <option value="">{todas}</option>}
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>{o.nome}</option>
      ))}
    </select>
  );
}
