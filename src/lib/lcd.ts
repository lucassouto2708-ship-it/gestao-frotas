// Leitor de visores LCD de 7 segmentos (ex.: medidor digital de sulco de pneu).
// Funciona direto nos pixels, sem dependências:
//   1. localiza o visor (região clara, pouco saturada e retangular) e calcula sua inclinação;
//   2. recorta o visor "desentortado" e binariza com limiar local;
//   3. corrige o itálico dos dígitos, separa cada dígito e verifica quais segmentos estão acesos;
//   4. repete com calibrações diferentes e fica com a leitura mais votada.

export type Imagem = { data: Uint8ClampedArray; width: number; height: number };

type Caixa = { x0: number; y0: number; x1: number; y1: number };
type Componente = Caixa & { area: number; sx: number; sy: number; sxx: number; syy: number; sxy: number };
type Visor = { cx: number; cy: number; angulo: number; largura: number; altura: number };

//  aaa
// f   b
//  ggg
// e   c
//  ddd
const PADROES: Record<string, string> = {
  abcdef: "0",
  bc: "1",
  abdeg: "2",
  abcdg: "3",
  bcfg: "4",
  acdfg: "5",
  acdefg: "6",
  abc: "7",
  abcf: "7",
  abcdefg: "8",
  abcdfg: "9",
};
const SEGMENTOS = "abcdefg";

function luminancia(d: Uint8ClampedArray, p: number) {
  return 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
}

/** Redimensiona (média de área) para que o maior lado tenha `lado` pixels. */
function redimensionar(img: Imagem, lado: number): Imagem {
  const f = Math.max(img.width, img.height) / lado;
  if (f <= 1) return img;
  const w = Math.round(img.width / f), h = Math.round(img.height / f);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ya = Math.floor(y * f), yb = Math.max(ya + 1, Math.floor((y + 1) * f));
    for (let x = 0; x < w; x++) {
      const xa = Math.floor(x * f), xb = Math.max(xa + 1, Math.floor((x + 1) * f));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = ya; sy < yb && sy < img.height; sy++)
        for (let sx = xa; sx < xb && sx < img.width; sx++) {
          const p = (sy * img.width + sx) * 4;
          r += img.data[p]; g += img.data[p + 1]; b += img.data[p + 2]; n++;
        }
      const q = (y * w + x) * 4;
      out[q] = r / n; out[q + 1] = g / n; out[q + 2] = b / n; out[q + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

function otsu(valores: ArrayLike<number>) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < valores.length; i++) hist[Math.max(0, Math.min(255, Math.round(valores[i])))]++;
  const total = valores.length;
  let soma = 0;
  for (let i = 0; i < 256; i++) soma += i * hist[i];
  let somaB = 0, pesoB = 0, melhor = 0, limiar = 127;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    somaB += t * hist[t];
    const mB = somaB / pesoB, mF = (soma - somaB) / pesoF;
    const v = pesoB * pesoF * (mB - mF) ** 2;
    if (v > melhor) { melhor = v; limiar = t; }
  }
  return limiar;
}

/** Componentes conexos (4-vizinhança), com caixa e momentos. */
function componentes(mask: Uint8Array, w: number, h: number, areaMin: number): Componente[] {
  const rot = new Uint8Array(w * h);
  const out: Componente[] = [];
  const pilha: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || rot[i]) continue;
    const c: Componente = { x0: w, y0: h, x1: 0, y1: 0, area: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0 };
    pilha.push(i);
    rot[i] = 1;
    while (pilha.length) {
      const j = pilha.pop()!;
      const x = j % w, y = (j - x) / w;
      c.area++; c.sx += x; c.sy += y; c.sxx += x * x; c.syy += y * y; c.sxy += x * y;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      if (x > 0 && mask[j - 1] && !rot[j - 1]) { rot[j - 1] = 1; pilha.push(j - 1); }
      if (x < w - 1 && mask[j + 1] && !rot[j + 1]) { rot[j + 1] = 1; pilha.push(j + 1); }
      if (y > 0 && mask[j - w] && !rot[j - w]) { rot[j - w] = 1; pilha.push(j - w); }
      if (y < h - 1 && mask[j + w] && !rot[j + w]) { rot[j + w] = 1; pilha.push(j + w); }
    }
    if (c.area >= areaMin) out.push(c);
  }
  return out;
}

/** Dilatação ou erosão com elemento quadrado (separável). */
function morfologia(mask: Uint8Array, w: number, h: number, r: number, dilatar: boolean) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  const alvo = dilatar ? 1 : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1 - alvo;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        if (src(mask, y * w + xx) === alvo) { v = alvo; break; }
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1 - alvo;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        if (tmp[yy * w + x] === alvo) { v = alvo; break; }
      }
      out[y * w + x] = v;
    }
  return out;
}
const src = (m: Uint8Array, i: number) => (m[i] ? 1 : 0);

/** Fecha buracos pequenos (os dígitos) dentro do visor. */
function fechar(mask: Uint8Array, w: number, h: number, r: number) {
  return morfologia(morfologia(mask, w, h, r, true), w, h, r, false);
}

/** Corta pontes finas entre regiões (ex.: visor encostado na régua). */
function abrir(mask: Uint8Array, w: number, h: number, r: number) {
  return morfologia(morfologia(mask, w, h, r, false), w, h, r, true);
}

/** Procura regiões claras, pouco saturadas e retangulares (candidatas a visor). */
function localizarVisores(img: Imagem): Visor[] {
  const { width: w, height: h, data } = img;
  const g = new Float32Array(w * h), sat = new Float32Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = luminancia(data, p);
    // Saturação relativa (S do HSV): o cinza do LCD é ~0,05; pele fica acima de 0,2
    const max = Math.max(data[p], data[p + 1], data[p + 2]);
    sat[i] = max ? (max - Math.min(data[p], data[p + 1], data[p + 2])) / max : 0;
  }
  const visores: (Visor & { nota: number })[] = [];
  const base = otsu(g);
  // Vários limiares de brilho, para tolerar fotos claras/escuras
  for (const delta of [0, -25, 25, 50, -12, 12, 37]) {
    const limiar = base + delta;
    let mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = g[i] > limiar && sat[i] < 0.2 ? 1 : 0;
    const r = Math.max(2, Math.round(Math.max(w, h) * 0.012));
    mask = abrir(fechar(mask, w, h, r), w, h, r);
    for (const c of componentes(mask, w, h, w * h * 0.003)) {
      const n = c.area, mx = c.sx / n, my = c.sy / n;
      const vxx = c.sxx / n - mx * mx, vyy = c.syy / n - my * my, vxy = c.sxy / n - mx * my;
      let ang = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
      const d = Math.sqrt(((vxx - vyy) / 2) ** 2 + vxy * vxy);
      const l1 = (vxx + vyy) / 2 + d, l2 = (vxx + vyy) / 2 - d;
      let largura = Math.sqrt(12 * l1), altura = Math.sqrt(12 * Math.max(l2, 1e-6));
      if (Math.abs(ang) > Math.PI / 4) {
        // eixo maior na vertical: visor "em pé" na foto
        ang = ang > 0 ? ang - Math.PI / 2 : ang + Math.PI / 2;
        [largura, altura] = [altura, largura];
      }
      const razao = largura / altura;
      const preench = n / (largura * altura);
      if (razao < 1.25 || razao > 6.5 || preench < 0.7 || preench > 1.25 || altura < 10) continue;
      visores.push({ cx: mx, cy: my, angulo: ang, largura, altura, nota: n * Math.min(1, preench) });
    }
  }
  // Remove duplicatas (mesmo visor achado com limiares diferentes)
  visores.sort((a, b) => b.nota - a.nota);
  const unicos: Visor[] = [];
  for (const v of visores)
    if (!unicos.some((u) => Math.hypot(u.cx - v.cx, u.cy - v.cy) < Math.min(u.altura, v.altura) * 0.5)) unicos.push(v);
  return unicos.slice(0, 4);
}

/** Recorta o visor alinhado ao seu ângulo, com `alturaSaida` pixels de altura. */
function recortar(img: Imagem, v: Visor, fator: number, alturaSaida: number) {
  const s = alturaSaida / v.altura;
  const w = Math.round(v.largura * s), h = alturaSaida;
  const cos = Math.cos(v.angulo), sin = Math.sin(v.angulo);
  const out = new Float32Array(w * h);
  const W = img.width, H = img.height;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x - w / 2) / s, t = (y - h / 2) / s;
      const sx = Math.min(W - 1.001, Math.max(0, (v.cx + u * cos - t * sin) * fator));
      const sy = Math.min(H - 1.001, Math.max(0, (v.cy + u * sin + t * cos) * fator));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const p = (y0 * W + x0) * 4, q = p + W * 4;
      out[y * w + x] =
        luminancia(img.data, p) * (1 - fx) * (1 - fy) + luminancia(img.data, p + 4) * fx * (1 - fy) +
        luminancia(img.data, q) * (1 - fx) * fy + luminancia(img.data, q + 4) * fx * fy;
    }
  return { g: out, w, h };
}

/** Binariza com limiar local (média de janela via imagem integral); k relativo ao contraste. */
function binarizar(g: Float32Array, w: number, h: number, janela: number, k: number) {
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let linha = 0;
    for (let x = 0; x < w; x++) {
      linha += g[y * w + x];
      integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + linha;
    }
  }
  // Contraste do visor: diferença entre fundo (claro) e tinta (escura)
  const ord = Array.from(g).sort((a, b) => a - b);
  const contraste = Math.max(20, ord[Math.floor(ord.length * 0.85)] - ord[Math.floor(ord.length * 0.05)]);
  const r = Math.max(2, Math.floor(janela / 2));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1), ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1);
      const soma = integ[yb * (w + 1) + xb] - integ[ya * (w + 1) + xb] - integ[yb * (w + 1) + xa] + integ[ya * (w + 1) + xa];
      out[y * w + x] = g[y * w + x] < soma / ((xb - xa) * (yb - ya)) - k * contraste ? 1 : 0;
    }
  return out;
}

/** Remove o que encosta na borda do recorte (moldura do visor). */
function limparBordas(mask: Uint8Array, w: number, h: number) {
  const pilha: number[] = [];
  const semear = (i: number) => {
    if (mask[i]) { mask[i] = 0; pilha.push(i); }
  };
  for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
  while (pilha.length) {
    const j = pilha.pop()!;
    const x = j % w, y = (j - x) / w;
    if (x > 0) semear(j - 1);
    if (x < w - 1) semear(j + 1);
    if (y > 0) semear(j - w);
    if (y < h - 1) semear(j + w);
  }
  return mask;
}

/** Cisalhamento horizontal (corrige dígitos em itálico). */
function cisalhar(mask: Uint8Array, w: number, h: number, t: number) {
  const extra = Math.ceil(Math.abs(t) * h);
  const nw = w + extra;
  const out = new Uint8Array(nw * h);
  for (let y = 0; y < h; y++) {
    const desloc = Math.round(t * (h - 1 - y)) + (t < 0 ? extra : 0);
    for (let x = 0; x < w; x++) if (mask[y * w + x]) out[y * nw + x + desloc] = 1;
  }
  return { mask: out, w: nw };
}

function decodificarDigito(mask: Uint8Array, w: number, cx: Caixa): string | null {
  const dw = cx.x1 - cx.x0 + 1, dh = cx.y1 - cx.y0 + 1;
  const frac = (fx0: number, fx1: number, fy0: number, fy1: number) => {
    const xa = cx.x0 + Math.floor(fx0 * dw), xb = cx.x0 + Math.ceil(fx1 * dw);
    const ya = cx.y0 + Math.floor(fy0 * dh), yb = cx.y0 + Math.ceil(fy1 * dh);
    let n = 0, t = 0;
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { t++; n += mask[y * w + x]; }
    return t ? n / t : 0;
  };
  const regioes: Record<string, number> = {
    a: frac(0.25, 0.75, 0, 0.16),
    b: frac(0.68, 1, 0.12, 0.42),
    c: frac(0.68, 1, 0.58, 0.88),
    d: frac(0.25, 0.75, 0.84, 1),
    e: frac(0, 0.32, 0.58, 0.88),
    f: frac(0, 0.32, 0.12, 0.42),
    g: frac(0.25, 0.75, 0.42, 0.58),
  };
  const max = Math.max(...Object.values(regioes));
  if (max < 0.15) return null;
  const acesos = SEGMENTOS.split("").filter((s) => regioes[s] > Math.max(0.1, max * 0.35)).join("");
  return PADROES[acesos] ?? null;
}

function lerLinha(mask: Uint8Array, w: number, h: number): string | null {
  // Descarta linhas compridas (bordas da moldura) e ruído
  const blobs = componentes(mask, w, h, 6).filter((b) => {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    if (bh >= h * 0.62 && bw <= bh * 0.18) return false; // traço vertical da moldura
    return bw <= h * 0.6 && !(bh <= h * 0.06 && bw > h * 0.2);
  });
  if (!blobs.length) return null;

  // Faixa dos dígitos: definida pelos blobs mais altos (segmentos verticais)
  const maxH = Math.max(...blobs.map((b) => b.y1 - b.y0 + 1));
  const altos = blobs.filter((b) => b.y1 - b.y0 + 1 >= maxH * 0.6);
  let topo = Math.min(...altos.map((b) => b.y0)), base = Math.max(...altos.map((b) => b.y1));
  const H0 = base - topo + 1;

  // Mantém só o que está dentro da faixa (tira o rótulo "mm", ícones etc.)
  const limpa = new Uint8Array(w * h);
  const xMinAltos = Math.min(...altos.map((b) => b.x0)) - H0 * 0.7;
  topo = h; base = 0;
  for (const b of blobs) {
    if (b.y0 < Math.min(...altos.map((a) => a.y0)) - H0 * 0.2 || b.y1 > Math.max(...altos.map((a) => a.y1)) + H0 * 0.2) continue;
    if (b.x1 < xMinAltos) continue; // longe, à esquerda dos dígitos
    topo = Math.min(topo, b.y0); base = Math.max(base, b.y1);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (mask[y * w + x]) limpa[y * w + x] = 1;
  }
  const H = base - topo + 1;
  if (H < h * 0.25 || H > h * 0.95) return null;

  // Separa os dígitos pela projeção de colunas da parte de cima (o ponto decimal fica embaixo)
  const yCorte = topo + Math.round(H * 0.8);
  const col = new Array(w).fill(0);
  for (let y = topo; y < yCorte; y++) for (let x = 0; x < w; x++) col[x] += limpa[y * w + x];
  const corridas: { x0: number; x1: number }[] = [];
  for (let x = 0; x < w; x++) {
    if (col[x] < 1) continue;
    const ult = corridas[corridas.length - 1];
    if (ult && x - ult.x1 <= 1) ult.x1 = x;
    else corridas.push({ x0: x, x1: x });
  }
  // Segmentos do mesmo dígito têm pequenos vãos entre si: junta pedaços enquanto
  // couberem na largura de um dígito (~0,66 da altura)
  const grupos: { x0: number; x1: number }[] = [];
  for (const c of corridas) {
    const ult = grupos[grupos.length - 1];
    if (ult && c.x1 - ult.x0 + 1 <= H * 0.66 && c.x0 - ult.x1 <= H * 0.2) ult.x1 = c.x1;
    else grupos.push({ ...c });
  }
  const digitos = grupos.filter((c) => {
    let tinta = 0, yMin = h, yMax = 0;
    for (let y = topo; y <= base; y++)
      for (let x = c.x0; x <= c.x1; x++)
        if (limpa[y * w + x]) { tinta++; if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
    return tinta > H * 0.5 && yMax - yMin + 1 >= H * 0.55;
  });
  if (!digitos.length || digitos.length > 6) return null;
  const larguraTipica = Math.max(...digitos.map((d) => d.x1 - d.x0 + 1));
  if (larguraTipica > H * 0.9) return null; // dígitos grudados
  // Todo dígito tem segmento à direita (b ou c): células de largura fixa, alinhadas pela direita
  const celula = Math.max(larguraTipica, Math.round(H * 0.4));

  let texto = "";
  for (let i = 0; i < digitos.length; i++) {
    const d = digitos[i];
    const dw = d.x1 - d.x0 + 1;
    const c =
      dw < celula * 0.5 && dw < H * 0.3
        ? "1"
        : decodificarDigito(limpa, w, { x0: Math.max(0, Math.min(d.x0, d.x1 - celula + 1)), x1: d.x1, y0: topo, y1: base });
    if (c === null) return null;
    texto += c;
    // Ponto decimal: tinta só na parte de baixo, no vão entre este dígito e o próximo
    const prox = digitos[i + 1];
    if (prox && !texto.includes(".")) {
      let pontos = 0;
      for (let y = base - Math.round(H * 0.18); y <= base + Math.round(H * 0.05) && y < h; y++)
        for (let x = d.x1 + 1; x < prox.x0; x++) pontos += limpa[y * w + x];
      if (pontos >= Math.max(3, H * H * 0.002)) texto += ".";
    }
  }
  return texto;
}

/** Ajusta o visor à área clara real (o "vidro" do LCD), descartando moldura e arredores. */
function refinar(img: Imagem, v: Visor, fator: number): Visor | null {
  const amplo = { ...v, largura: v.largura * 1.15, altura: v.altura * 1.25 };
  const { g, w, h } = recortar(img, amplo, fator, 120);
  const t = otsu(g);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = g[i] > t ? 1 : 0;
  const maior = componentes(mask, w, h, w * h * 0.08).sort((a, b) => b.area - a.area)[0];
  if (!maior) return null;
  const s = 120 / amplo.altura;
  const cos = Math.cos(v.angulo), sin = Math.sin(v.angulo);
  const u = ((maior.x0 + maior.x1) / 2 - w / 2) / s, q = ((maior.y0 + maior.y1) / 2 - h / 2) / s;
  return {
    cx: amplo.cx + u * cos - q * sin,
    cy: amplo.cy + u * sin + q * cos,
    angulo: v.angulo,
    largura: (maior.x1 - maior.x0 + 1) / s,
    altura: (maior.y1 - maior.y0 + 1) / s,
  };
}

/** Escolhe o cisalhamento que deixa os traços verticais mais "em pé" (projeção de colunas mais concentrada). */
function melhorCisalhamento(bin: Uint8Array, w: number, h: number) {
  let melhor = 0, notaMelhor = -1;
  for (let t = -0.4; t <= 0.41; t += 0.025) {
    const c = cisalhar(bin, w, h, t);
    let nota = 0;
    for (let x = 0; x < c.w; x++) {
      let col = 0;
      for (let y = 0; y < h; y++) col += c.mask[y * c.w + x];
      nota += col * col;
    }
    if (nota > notaMelhor) { notaMelhor = nota; melhor = t; }
  }
  return melhor;
}

/** Lê um visor com várias calibrações de recorte e limiar; devolve todas as leituras. */
function lerVisor(img: Imagem, bruto: Visor, fator: number): string[] {
  const leituras: string[] = [];
  const v = refinar(img, bruto, fator);
  if (!v || v.largura / v.altura < 1.2) return leituras;
  for (const escalaAltura of [0.96, 0.88]) {
    const { g, w, h } = recortar(img, { ...v, altura: v.altura * escalaAltura, largura: v.largura * 0.97 }, fator, 140);
    const janela = Math.round(h * 0.7);
    const t = melhorCisalhamento(limparBordas(binarizar(g, w, h, janela, 0.2), w, h), w, h);
    for (const k of [0.12, 0.2, 0.3]) {
      const c = cisalhar(limparBordas(binarizar(g, w, h, janela, k), w, h), w, h, t);
      const texto = lerLinha(c.mask, c.w, h);
      if (texto) leituras.push(texto);
    }
  }
  return leituras;
}

/**
 * Tenta ler o número de um visor LCD de 7 segmentos na foto.
 * `aceitar` filtra leituras plausíveis (ex.: formato do medidor). Cada visor candidato é lido
 * com 6 calibrações; vence a leitura mais votada, exigindo ao menos 2 votos concordantes.
 */
export function lerLcd(img: Imagem, aceitar: (texto: string) => boolean = () => true): string | null {
  const trabalho = redimensionar(img, 600);
  const fator = img.width / trabalho.width;
  const visores = localizarVisores(trabalho);
  // Primeiro no ângulo estimado; se nada convencer, tenta ângulos vizinhos (foto mais torta)
  for (const d of [0, -0.08, 0.08, -0.16, 0.16]) {
    let melhor: [string, number] | null = null;
    for (const v of visores) {
      const votos = new Map<string, number>();
      for (const t of lerVisor(img, { ...v, angulo: v.angulo + d }, fator)) if (aceitar(t)) votos.set(t, (votos.get(t) ?? 0) + 1);
      for (const par of votos) if (!melhor || par[1] > melhor[1]) melhor = par;
    }
    if (melhor && melhor[1] >= 2) return melhor[0];
  }
  return null;
}
