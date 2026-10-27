// Leitura de números na área da foto marcada pelo usuário. Roda no navegador, gratuito e sem chave de API.
//   1. Leitor de visor de 7 segmentos (medidor de pneu, odômetro digital) — em um Web Worker.
//   2. Reserva: Tesseract.js (odômetro de ponteiro/rolinho e outros mostradores).
// É uma sugestão: o usuário sempre confere/corrige o valor antes de salvar.
import type { Worker as TesseractWorker } from "tesseract.js";
import type { Area, Imagem } from "./lcd";
import { criterio, interpretar, type ModoLeitura } from "./leitura";

export type { Area } from "./lcd";
export type { ModoLeitura } from "./leitura";

/** Decodifica a foto em pixels (para o leitor e para medir o tamanho). */
export async function carregarImagem(foto: Blob): Promise<Imagem> {
  const bitmap = await createImageBitmap(foto);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

// ---------------------------------------------------------------------------
// Leitor de visor (Web Worker, com reserva na própria thread)
// ---------------------------------------------------------------------------

type Pedido =
  | { tipo: "sugerir"; img: Imagem; modo: ModoLeitura }
  | { tipo: "ler"; img: Imagem; area: Area; modo: ModoLeitura; referencia?: number };

let worker: Worker | null = null;
let proximoId = 1;
const pendentes = new Map<number, { ok: (v: unknown) => void; falha: (e: unknown) => void }>();

function obterWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./lcd.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; resultado?: unknown; erro?: string }>) => {
      const p = pendentes.get(e.data.id);
      pendentes.delete(e.data.id);
      if (e.data.erro) p?.falha(new Error(e.data.erro));
      else p?.ok(e.data.resultado);
    };
    worker.onerror = () => {
      for (const p of pendentes.values()) p.falha(new Error("worker"));
      pendentes.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

async function executar<T>(pedido: Pedido): Promise<T> {
  const w = obterWorker();
  if (w) {
    try {
      return await new Promise<T>((ok, falha) => {
        const id = proximoId++;
        pendentes.set(id, { ok: ok as (v: unknown) => void, falha });
        w.postMessage({ ...pedido, id });
      });
    } catch {
      // cai para a thread principal
    }
  }
  const lcd = await import("./lcd");
  return (pedido.tipo === "sugerir"
    ? lcd.sugerirArea(pedido.img, criterio(pedido.modo))
    : lcd.lerArea(pedido.img, pedido.area, criterio(pedido.modo, pedido.referencia))) as T;
}

/** Onde provavelmente está a tela do medidor (para posicionar o retângulo). */
export function sugerirArea(img: Imagem, modo: ModoLeitura) {
  return executar<Area | null>({ tipo: "sugerir", img, modo });
}

// ---------------------------------------------------------------------------
// Reserva: Tesseract.js no recorte
// ---------------------------------------------------------------------------

let tesseract: Promise<TesseractWorker> | null = null;

function obterTesseract() {
  tesseract ??= (async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    const w = await createWorker("eng");
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789.," });
    return w;
  })();
  tesseract.catch(() => (tesseract = null));
  return tesseract;
}

/** Recorte da área em tons de cinza, ampliado, com texto escuro sobre fundo claro. */
function recorteParaOcr(img: Imagem, area: Area) {
  const escala = Math.max(1, 110 / area.h);
  const w = Math.round(area.w * escala), h = Math.round(area.h * escala);
  const m = Math.round(h * 0.2);
  const canvas = document.createElement("canvas");
  canvas.width = w + 2 * m;
  canvas.height = h + 2 * m;
  const ctx = canvas.getContext("2d")!;
  const saida = ctx.createImageData(canvas.width, canvas.height);
  const cinza = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.max(0, Math.floor(area.x + x / escala)));
      const sy = Math.min(img.height - 1, Math.max(0, Math.floor(area.y + y / escala)));
      const p = (sy * img.width + sx) * 4;
      cinza[y * w + x] = 0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2];
    }
  const ord = Array.from(cinza).sort((a, b) => a - b);
  const min = ord[Math.floor(ord.length * 0.02)], max = ord[Math.floor(ord.length * 0.98)];
  const inverter = ord[Math.floor(ord.length / 2)] < (min + max) / 2; // fundo escuro, dígitos claros
  const faixa = Math.max(1, max - min);
  saida.data.fill(255);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = Math.max(0, Math.min(255, ((cinza[y * w + x] - min) / faixa) * 255));
      if (inverter) v = 255 - v;
      const q = ((y + m) * canvas.width + x + m) * 4;
      saida.data[q] = saida.data[q + 1] = saida.data[q + 2] = v;
    }
  ctx.putImageData(saida, 0, 0);
  return canvas;
}

async function lerComTesseract(img: Imagem, area: Area, modo: ModoLeitura, referencia?: number): Promise<number | null> {
  const w = await obterTesseract();
  const { data } = await w.recognize(recorteParaOcr(img, area));
  const aceitar = criterio(modo, referencia);
  const candidatos =
    modo === "pneu"
      ? (data.text.match(/\d{1,2}[.,]\d{1,2}/g) ?? []).map((t) => t.replace(",", "."))
      : (data.text.match(/\d{1,3}(?:[.,]\d{3})+|\d+/g) ?? []).map((t) => t.replace(/[.,]/g, ""));
  for (const c of candidatos) {
    if (modo === "pneu") {
      const n = Number(c);
      if (n >= 0 && n <= 20) return n;
    } else if (aceitar(c)) return Number(c);
  }
  return null;
}

/** Lê o número dentro da área marcada. */
export async function lerArea(img: Imagem, area: Area, modo: ModoLeitura, referencia?: number): Promise<number | null> {
  const texto = await executar<string | null>({ tipo: "ler", img, area, modo, referencia }).catch(() => null);
  if (texto) return interpretar(texto, modo);
  return lerComTesseract(img, area, modo, referencia).catch(() => null);
}
