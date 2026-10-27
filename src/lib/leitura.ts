// Regras de plausibilidade das leituras (compartilhadas entre o worker e a tela).

export type ModoLeitura = "odometro" | "pneu";

/** Quais textos lidos fazem sentido para cada tipo de mostrador. */
export function criterio(modo: ModoLeitura, referencia?: number) {
  if (modo === "pneu") return (t: string) => /^\d{1,2}\.\d{2}$/.test(t) || /^\d{3,4}$/.test(t);
  return (t: string) => {
    if (!/^\d{3,7}$/.test(t)) return false;
    // Com km anterior conhecido: não pode ser menor nem um salto absurdo
    const n = Number(t);
    return referencia === undefined || (n >= referencia && n <= referencia + 100000);
  };
}

/** Texto aceito -> número. O medidor de sulco mostra sempre 2 casas decimais em mm. */
export function interpretar(texto: string, modo: ModoLeitura): number {
  if (modo === "pneu" && !texto.includes(".")) return Number(`${texto.slice(0, -2)}.${texto.slice(-2)}`);
  return Number(texto);
}
