// Lógica do rastreio por GPS da viagem. Não depende do navegador (testável em Node).
//
// Ideia central: a distância é a soma dos deslocamentos entre pontos "aceitos" do GPS, e só conta
// quando o veículo está de fato em movimento. Parado, o GPS "treme" alguns metros por segundo; se isso
// fosse somado, uma viagem com muitos semáforos ganharia quilômetros falsos.

/** Leitura do GPS. `ts` em ms (epoch), `speed` em m/s (null quando o aparelho não informa). */
export type Fix = { lat: number; lng: number; acc: number; ts: number; speed: number | null };

/** [latitude, longitude, ts em ms] */
export type Ponto = [number, number, number];

type Ancora = { lat: number; lng: number; ts: number; acc: number };

export type EstadoRastreio = {
  v: 1;
  /** Momento do primeiro fix válido (base da cobertura). */
  inicio: number;
  ultimoFix: number | null;
  ancora: Ancora | null;
  distanciaM: number;
  cobertoMs: number;
  interrupcoes: number;
  velMaxMs: number;
  fixesValidos: number;
  fixesDescartados: number;
  trilha: Ponto[];
  ultimoPontoTs: number;
  /** Leituras seguidas consideradas "parado" (sem deslocamento da referência). */
  paradasSeguidas?: number;
};

export type ResumoRastreio = {
  distanciaM: number;
  /** % do tempo da viagem em que houve GPS válido. */
  cobertura: number;
  interrupcoes: number;
  velMaxKmh: number;
  /** Distância ÷ tempo da viagem (inclui as paradas). */
  velMediaKmh: number;
  pontos: number;
  /** Trilha simplificada: [lat, lng, segundos desde o início]. */
  trilha: [number, number, number][];
};

/** Acima disto o fix é considerado ruim e ignorado (metros). */
export const PRECISAO_MAX_M = 50;
/** Sem fix por mais que isso = interrupção (ms). */
export const INTERRUPCAO_MS = 30_000;
/** Quanto tempo cada fix "cobre" no máximo (ms). */
const COBERTURA_MAX_DT_MS = 10_000;
/** Velocidade a partir da qual o veículo é considerado em movimento (m/s ≈ 3,6 km/h). */
const VEL_MIN_MOVIMENTO = 1.0;
/** Acima disto é erro do GPS em um veículo comum (m/s ≈ 198 km/h). */
const VEL_MAX_PLAUSIVEL = 55;
/** Sem velocidade informada: deslocamento mínimo para contar como movimento (3× a imprecisão). */
const LIMIAR_MIN_M = 20;
const LIMIAR_FATOR_PRECISAO = 3;
/** Sem velocidade informada: abaixo desta velocidade média desde a última referência é tremor, não movimento. */
const VEL_MIN_MEDIA = 0.5;
/** Em movimento, só soma a distância a cada passo mínimo: pontos próximos demais amplificam o ruído do GPS. */
const PASSO_MIN_M = 15;
/** Leituras seguidas paradas (sem sair do lugar) para a referência passar a acompanhar o aparelho. */
const PARADAS_PARA_ACOMPANHAR = 5;
/** Um ponto da trilha a cada X ms, no máximo. */
const TRILHA_INTERVALO_MS = 5_000;
const TRILHA_MAX_PONTOS = 6_000;

const RAIO_TERRA_M = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function novoEstado(agora: number): EstadoRastreio {
  return {
    v: 1,
    inicio: agora,
    ultimoFix: null,
    ancora: null,
    distanciaM: 0,
    cobertoMs: 0,
    interrupcoes: 0,
    velMaxMs: 0,
    fixesValidos: 0,
    fixesDescartados: 0,
    trilha: [],
    ultimoPontoTs: 0,
  };
}

/** Confere se um estado vindo do armazenamento do aparelho tem o formato esperado. */
export function estadoValido(x: unknown): x is EstadoRastreio {
  if (!x || typeof x !== "object") return false;
  const e = x as Partial<EstadoRastreio>;
  return (
    e.v === 1 &&
    typeof e.inicio === "number" &&
    typeof e.distanciaM === "number" &&
    typeof e.cobertoMs === "number" &&
    Array.isArray(e.trilha) &&
    (e.ancora === null || (typeof e.ancora === "object" && typeof e.ancora?.lat === "number"))
  );
}

function adicionarPonto(e: EstadoRastreio, f: Fix, forcar = false) {
  if (!forcar && e.trilha.length > 0 && f.ts - e.ultimoPontoTs < TRILHA_INTERVALO_MS) return;
  e.trilha.push([f.lat, f.lng, f.ts]);
  e.ultimoPontoTs = f.ts;
  if (e.trilha.length > TRILHA_MAX_PONTOS) e.trilha = e.trilha.filter((_, i) => i % 2 === 0 || i === e.trilha.length - 1);
}

export type Resultado = "aceito" | "parado" | "descartado";

/** Processa uma leitura do GPS, atualizando o estado. */
export function processarFix(e: EstadoRastreio, f: Fix): Resultado {
  const valido =
    Number.isFinite(f.lat) && Number.isFinite(f.lng) && Math.abs(f.lat) <= 90 && Math.abs(f.lng) <= 180 && Number.isFinite(f.acc);
  if (!valido || f.acc > PRECISAO_MAX_M || (e.ultimoFix !== null && f.ts <= e.ultimoFix)) {
    e.fixesDescartados++;
    return "descartado";
  }

  const anterior = e.ultimoFix;
  if (anterior !== null) {
    const dt = f.ts - anterior;
    e.cobertoMs += Math.min(dt, COBERTURA_MAX_DT_MS);
    if (dt > INTERRUPCAO_MS) e.interrupcoes++;
  } else {
    e.inicio = f.ts; // a cobertura conta a partir do primeiro sinal
  }
  e.ultimoFix = f.ts;
  e.fixesValidos++;

  const novaAncora: Ancora = { lat: f.lat, lng: f.lng, ts: f.ts, acc: f.acc };
  if (!e.ancora) {
    e.ancora = novaAncora;
    adicionarPonto(e, f, true);
    return "aceito";
  }

  const d = haversine(e.ancora, f);
  const temVelocidade = f.speed !== null && Number.isFinite(f.speed) && f.speed >= 0;
  const dtAncora = (f.ts - e.ancora.ts) / 1000;
  // Velocidade informada pelo GPS (Doppler) confirma movimento, mas a ausência de velocidade NÃO prova que
  // está parado: alguns aparelhos informam 0 com o carro andando. Por isso o deslocamento a partir da
  // referência também vale, desde que maior que o ruído do GPS e numa velocidade média plausível.
  // Se o aparelho diz "parado" (velocidade ~0), pede-se um deslocamento maior para contradizê-lo.
  const dizParado = temVelocidade && f.speed! < VEL_MIN_MOVIMENTO;
  const limiar = dizParado ? Math.max(60, 4 * f.acc) : Math.max(LIMIAR_MIN_M, LIMIAR_FATOR_PRECISAO * Math.max(f.acc, e.ancora.acc));
  const deslocou = d >= limiar && d / dtAncora >= VEL_MIN_MEDIA;
  const emMovimento = (temVelocidade && f.speed! >= VEL_MIN_MOVIMENTO) || deslocou;

  if (!emMovimento) {
    // A referência só acompanha o aparelho depois de várias leituras seguidas realmente paradas (sem sair do
    // lugar). Se acompanhasse sempre, um aparelho que informa velocidade 0 com o carro andando nunca somaria
    // distância, pois o deslocamento de cada leitura isolada ficaria sempre abaixo do ruído.
    e.paradasSeguidas = d < f.acc ? (e.paradasSeguidas ?? 0) + 1 : 0;
    if (temVelocidade && (e.paradasSeguidas ?? 0) >= PARADAS_PARA_ACOMPANHAR) e.ancora = novaAncora;
    return "parado";
  }
  e.paradasSeguidas = 0;
  // Em movimento, mas ainda perto da referência: espera juntar um passo (a referência não muda, nada se perde)
  if (d < Math.max(PASSO_MIN_M, f.acc)) return "parado";

  if (dtAncora > 0 && d / dtAncora > VEL_MAX_PLAUSIVEL) {
    e.fixesDescartados++;
    e.fixesValidos--;
    e.ultimoFix = anterior;
    return "descartado"; // salto impossível: erro do GPS
  }

  e.distanciaM += d;
  const v = temVelocidade ? f.speed! : dtAncora > 0 ? d / dtAncora : 0;
  if (v <= VEL_MAX_PLAUSIVEL && v > e.velMaxMs) e.velMaxMs = v;
  e.ancora = novaAncora;
  adicionarPonto(e, f);
  return "aceito";
}

/** Douglas-Peucker em coordenadas locais (metros), sem recursão. */
function douglasPeucker(pts: { x: number; y: number }[], tol: number): boolean[] {
  const n = pts.length;
  const manter = new Array<boolean>(n).fill(false);
  if (n === 0) return manter;
  manter[0] = manter[n - 1] = true;
  const pilha: [number, number][] = [[0, n - 1]];
  while (pilha.length) {
    const [ini, fim] = pilha.pop()!;
    let maior = 0, idx = -1;
    const a = pts[ini], b = pts[fim];
    const dx = b.x - a.x, dy = b.y - a.y;
    const comp2 = dx * dx + dy * dy;
    for (let i = ini + 1; i < fim; i++) {
      const p = pts[i];
      let dist: number;
      if (comp2 === 0) dist = Math.hypot(p.x - a.x, p.y - a.y);
      else {
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comp2));
        dist = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      }
      if (dist > maior) { maior = dist; idx = i; }
    }
    if (idx !== -1 && maior > tol) {
      manter[idx] = true;
      pilha.push([ini, idx], [idx, fim]);
    }
  }
  return manter;
}

/** Reduz a trilha mantendo o formato da rota (no máximo `max` pontos). */
export function simplificarTrilha(pontos: Ponto[], max = 500, tolInicial = 12): Ponto[] {
  if (pontos.length <= 2) return pontos.slice();
  const lat0 = pontos[0][0];
  const kx = Math.cos(rad(lat0)) * RAIO_TERRA_M * (Math.PI / 180);
  const ky = RAIO_TERRA_M * (Math.PI / 180);
  const xy = pontos.map((p) => ({ x: (p[1] - pontos[0][1]) * kx, y: (p[0] - lat0) * ky }));
  let tol = tolInicial;
  for (let i = 0; i < 12; i++) {
    const manter = douglasPeucker(xy, tol);
    const r = pontos.filter((_, k) => manter[k]);
    if (r.length <= max) return r;
    tol *= 1.6;
  }
  // Último recurso: amostragem uniforme
  const passo = Math.ceil(pontos.length / max);
  return pontos.filter((_, i) => i % passo === 0 || i === pontos.length - 1);
}

/** Números finais da viagem (não altera o estado). */
export function resumir(e: EstadoRastreio, fimTs: number): ResumoRastreio {
  const total = Math.max(1, fimTs - e.inicio);
  const cobertura = e.fixesValidos === 0 ? 0 : Math.max(0, Math.min(100, Math.round((100 * e.cobertoMs) / total)));
  const trilha = e.trilha.slice();
  if (e.ancora) {
    const ult = trilha[trilha.length - 1];
    if (!ult || ult[2] !== e.ancora.ts) trilha.push([e.ancora.lat, e.ancora.lng, e.ancora.ts]);
  }
  return {
    distanciaM: Math.round(e.distanciaM),
    cobertura,
    interrupcoes: e.interrupcoes,
    velMaxKmh: Math.round(e.velMaxMs * 3.6 * 10) / 10,
    velMediaKmh: e.fixesValidos > 1 ? Math.round((e.distanciaM / (total / 1000)) * 3.6 * 10) / 10 : 0,
    pontos: e.fixesValidos,
    trilha: simplificarTrilha(trilha).map(([lat, lng, ts]) => [
      Math.round(lat * 1e5) / 1e5,
      Math.round(lng * 1e5) / 1e5,
      Math.max(0, Math.round((ts - e.inicio) / 1000)),
    ]),
  };
}
