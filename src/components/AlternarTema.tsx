"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function AlternarTema() {
  const [tema, setTema] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function alternar() {
    const novo = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {}
    setTema(novo);
  }

  return (
    <button
      onClick={alternar}
      title={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
      aria-label="Alternar tema"
      className="flex h-8 w-8 items-center justify-center rounded opacity-85 hover:bg-white/10 hover:opacity-100"
    >
      {tema === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
    </button>
  );
}
