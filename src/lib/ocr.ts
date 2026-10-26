// Leitura de números em fotos com Tesseract.js: roda no navegador, gratuito e sem chave de API.
// É uma sugestão: o usuário sempre confere/corrige o valor antes de salvar.
import type { Worker } from "tesseract.js";

export type ModoLeitura = "odometro" | "pneu";

let workerPromise: Promise<Worker> | null = null;

function obterWorker() {
  workerPromise ??= (async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng");
    // Sem lista de caracteres permitidos: as letras ("ODO", "km", "TRIP") ajudam a separar os números.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return worker;
  })();
  workerPromise.catch(() => (workerPromise = null));
  return workerPromise;
}

/** Tons de cinza + contraste esticado + ampliação: ajuda bastante o OCR em mostradores. */
async function preprocessar(imagem: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(imagem);
  const escala = Math.max(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = dados.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const cinza = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = cinza;
    if (cinza < min) min = cinza;
    if (cinza > max) max = cinza;
  }
  const faixa = Math.max(1, max - min);
  for (let i = 0; i < px.length; i += 4) {
    const v = ((px[i] - min) / faixa) * 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(dados, 0, 0);
  return canvas;
}

function escolherOdometro(texto: string, referencia?: number): number | null {
  // Aceita ponto de milhar ("45.230"); "123.4" (hodômetro parcial) vira "123" e "4"
  const candidatos = (texto.replace(/[oO]/g, "0").match(/\d{1,3}(?:[.,]\d{3})+(?!\d)|\d+/g) ?? [])
    .map((t) => t.replace(/[.,]/g, ""))
    .filter((t) => t.length >= 3 && t.length <= 7)
    .map(Number);
  if (candidatos.length === 0) return null;
  if (referencia !== undefined) {
    const acima = candidatos.filter((n) => n >= referencia).sort((a, b) => a - b);
    if (acima.length) return acima[0];
  }
  return candidatos.sort((a, b) => String(b).length - String(a).length || b - a)[0];
}

function escolherPneu(texto: string): number | null {
  const candidatos = (texto.match(/\d{1,2}(?:[.,]\d)?/g) ?? [])
    .map((t) => Number(t.replace(",", ".")))
    .filter((n) => n >= 0 && n <= 20);
  // Prefere um valor com casa decimal (ex.: 4,5 mm), que é como os medidores mostram
  return candidatos.find((n) => !Number.isInteger(n)) ?? candidatos[0] ?? null;
}

export async function lerNumero(imagem: Blob, modo: ModoLeitura, referencia?: number): Promise<number | null> {
  const worker = await obterWorker();
  const canvas = await preprocessar(imagem);
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return modo === "odometro" ? escolherOdometro(text, referencia) : escolherPneu(text);
}
