"use client";

import { useEffect } from "react";

/** No celular as tabelas viram cartões; cada célula precisa do nome da coluna (vem do cabeçalho). */
export function RotulosTabela() {
  useEffect(() => {
    function aplicar() {
      document.querySelectorAll<HTMLTableElement>("table.tabela").forEach((tabela) => {
        const nomes = Array.from(tabela.querySelectorAll("thead th")).map((th) => (th.textContent ?? "").trim());
        tabela.querySelectorAll("tbody tr").forEach((tr) => {
          Array.from(tr.children).forEach((td, i) => {
            const nome = nomes[i];
            if (nome && td.getAttribute("data-rotulo") !== nome) td.setAttribute("data-rotulo", nome);
          });
        });
      });
    }
    aplicar();
    const obs = new MutationObserver(aplicar);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
