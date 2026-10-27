// Roda o leitor de visor fora da thread da tela (a leitura leva alguns segundos no celular).
import { lerArea, sugerirArea, type Area, type Imagem } from "./lcd";
import { criterio, type ModoLeitura } from "./leitura";

type Pedido =
  | { id: number; tipo: "sugerir"; img: Imagem; modo: ModoLeitura }
  | { id: number; tipo: "ler"; img: Imagem; area: Area; modo: ModoLeitura; referencia?: number };

self.onmessage = (e: MessageEvent<Pedido>) => {
  const p = e.data;
  try {
    const resultado =
      p.tipo === "sugerir"
        ? sugerirArea(p.img, criterio(p.modo))
        : lerArea(p.img, p.area, criterio(p.modo, p.referencia), { odometro: p.modo === "odometro" });
    self.postMessage({ id: p.id, resultado });
  } catch (erro) {
    self.postMessage({ id: p.id, erro: String(erro) });
  }
};
