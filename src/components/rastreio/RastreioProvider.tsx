"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estadoValido, novoEstado, processarFix, resumir, type EstadoRastreio, type ResumoRastreio } from "@/lib/rastreio";

export type Situacao = "aguardando" | "rastreando" | "sem_sinal" | "negado" | "indisponivel";
export type TelaLigada = "ativa" | "inativa" | "nao_suportada";

export type PainelRastreio = {
  distanciaM: number;
  decorridoMs: number;
  velKmh: number | null;
  precisaoM: number | null;
  situacao: Situacao;
  telaLigada: TelaLigada;
};

type Ativo = { tripId: string; placa: string };

type Contexto = {
  ativo: Ativo | null;
  painel: PainelRastreio;
  /** Começa a rastrear a viagem (pede a permissão de localização). */
  iniciar: (tripId: string, placa: string) => void;
  /** Números do rastreio da viagem, ou null se este aparelho não a está rastreando. */
  resumo: (tripId: string) => ResumoRastreio | null;
  /** Para o rastreio e apaga o que ficou guardado no aparelho. */
  encerrar: () => void;
};

const CHAVE = "rastreio_ativo_v1";
const SEM_SINAL_MS = 15_000;
const BATIMENTO_MS = 8_000;
const PAINEL_VAZIO: PainelRastreio = { distanciaM: 0, decorridoMs: 0, velKmh: null, precisaoM: null, situacao: "aguardando", telaLigada: "inativa" };

const Ctx = createContext<Contexto>({
  ativo: null,
  painel: PAINEL_VAZIO,
  iniciar: () => {},
  resumo: () => null,
  encerrar: () => {},
});

export const useRastreio = () => useContext(Ctx);

type Guardado = { tripId: string; placa: string; userId: string; estado: EstadoRastreio };

/**
 * Mantém o GPS ligado enquanto o app estiver aberto, em qualquer tela. O estado é guardado no
 * aparelho a cada poucos segundos: se o navegador for fechado, ao reabrir o rastreio continua
 * (o tempo sem sinal fica registrado como interrupção).
 */
export function RastreioProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [ativo, setAtivo] = useState<Ativo | null>(null);
  const [painel, setPainel] = useState<PainelRastreio>(PAINEL_VAZIO);

  const ativoRef = useRef<Ativo | null>(null);
  const estadoRef = useRef<EstadoRastreio | null>(null);
  const watchRef = useRef<number | null>(null);
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const ultimoRef = useRef<{ velKmh: number | null; precisaoM: number | null; ts: number }>({ velKmh: null, precisaoM: null, ts: 0 });
  const ultimoPedidoRef = useRef(0);
  const situacaoRef = useRef<Situacao>("aguardando");
  const telaRef = useRef<TelaLigada>("inativa");

  const salvar = useCallback(() => {
    if (!ativoRef.current || !estadoRef.current) return;
    try {
      const g: Guardado = { ...ativoRef.current, userId, estado: estadoRef.current };
      localStorage.setItem(CHAVE, JSON.stringify(g));
    } catch {}
  }, [userId]);

  const pararWatch = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }, []);

  const receber = useCallback((pos: GeolocationPosition) => {
    const e = estadoRef.current;
    if (!e) return;
    const speed = pos.coords.speed;
    const temVel = typeof speed === "number" && Number.isFinite(speed);
    processarFix(e, {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      acc: pos.coords.accuracy,
      ts: pos.timestamp,
      speed: temVel ? speed : null,
    });
    ultimoRef.current = { velKmh: temVel ? Math.round(speed * 3.6) : null, precisaoM: Math.round(pos.coords.accuracy), ts: Date.now() };
    if (situacaoRef.current !== "negado") situacaoRef.current = "rastreando";
  }, []);

  const iniciarWatch = useCallback(() => {
    pararWatch();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      situacaoRef.current = "indisponivel";
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      receber,
      (erro) => {
        if (erro.code === erro.PERMISSION_DENIED) {
          situacaoRef.current = "negado";
          pararWatch();
        }
        // Outros erros (sem sinal, tempo esgotado): o navegador continua tentando sozinho
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );
  }, [pararWatch, receber]);

  const pedirTela = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      telaRef.current = "nao_suportada";
      return;
    }
    try {
      const lock = await navigator.wakeLock.request("screen");
      lockRef.current = lock;
      telaRef.current = "ativa";
      lock.addEventListener("release", () => {
        if (lockRef.current === lock) telaRef.current = "inativa";
      });
    } catch {
      telaRef.current = "inativa";
    }
  }, []);

  const soltarTela = useCallback(() => {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
    telaRef.current = "inativa";
  }, []);

  const comecar = useCallback(
    (a: Ativo, estado: EstadoRastreio) => {
      ativoRef.current = a;
      estadoRef.current = estado;
      situacaoRef.current = "aguardando";
      ultimoRef.current = { velKmh: null, precisaoM: null, ts: 0 };
      setAtivo(a);
      iniciarWatch();
      void pedirTela();
      salvar();
    },
    [iniciarWatch, pedirTela, salvar],
  );

  const iniciar = useCallback(
    (tripId: string, placa: string) => {
      if (ativoRef.current?.tripId === tripId) return;
      comecar({ tripId, placa }, novoEstado(Date.now()));
    },
    [comecar],
  );

  const encerrar = useCallback(() => {
    pararWatch();
    soltarTela();
    ativoRef.current = null;
    estadoRef.current = null;
    setAtivo(null);
    setPainel(PAINEL_VAZIO);
    try {
      localStorage.removeItem(CHAVE);
    } catch {}
  }, [pararWatch, soltarTela]);

  const resumo = useCallback((tripId: string) => {
    if (ativoRef.current?.tripId !== tripId || !estadoRef.current) return null;
    return resumir(estadoRef.current, Date.now());
  }, []);

  // Ao abrir o app: retoma o rastreio de uma viagem que ficou em andamento neste aparelho
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const bruto = localStorage.getItem(CHAVE);
        if (!bruto) return;
        const g = JSON.parse(bruto) as Guardado;
        if (g.userId !== userId || !estadoValido(g.estado)) return void localStorage.removeItem(CHAVE);
        const { data } = await createClient().from("trips").select("status").eq("id", g.tripId).eq("user_id", userId).maybeSingle();
        if (cancelado) return;
        if (data?.status !== "em_andamento") return void localStorage.removeItem(CHAVE);
        if (!ativoRef.current) comecar({ tripId: g.tripId, placa: g.placa }, g.estado);
      } catch {}
    })();
    return () => {
      cancelado = true;
    };
  }, [userId, comecar]);

  // Atualiza o painel a cada segundo e guarda o estado a cada 5 s
  useEffect(() => {
    if (!ativo) return;
    const ui = setInterval(() => {
      const e = estadoRef.current;
      if (!e) return;
      const agora = Date.now();
      // Batimento: alguns aparelhos só avisam quando a posição muda. Se ficar muito tempo sem leitura
      // (ex.: parado num semáforo), pede a posição atual para não parecer "sem sinal".
      if (situacaoRef.current !== "negado" && agora - ultimoRef.current.ts > BATIMENTO_MS && agora - ultimoPedidoRef.current > BATIMENTO_MS) {
        ultimoPedidoRef.current = agora;
        navigator.geolocation?.getCurrentPosition(receber, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });
      }
      let situacao = situacaoRef.current;
      if (situacao === "rastreando" && agora - ultimoRef.current.ts > SEM_SINAL_MS) situacao = "sem_sinal";
      setPainel({
        distanciaM: e.distanciaM,
        decorridoMs: e.fixesValidos > 0 ? agora - e.inicio : 0,
        velKmh: ultimoRef.current.velKmh,
        precisaoM: ultimoRef.current.precisaoM,
        situacao,
        telaLigada: telaRef.current,
      });
    }, 1000);
    const grava = setInterval(salvar, 5000);
    return () => {
      clearInterval(ui);
      clearInterval(grava);
    };
  }, [ativo, salvar, receber]);

  // Ao voltar para o app (tela desbloqueada): refaz o GPS e a tela ligada, que o navegador solta ao esconder
  useEffect(() => {
    if (!ativo) return;
    const aoMudar = () => {
      if (document.visibilityState === "hidden") salvar();
      else {
        iniciarWatch();
        void pedirTela();
      }
    };
    document.addEventListener("visibilitychange", aoMudar);
    window.addEventListener("pagehide", salvar);
    return () => {
      document.removeEventListener("visibilitychange", aoMudar);
      window.removeEventListener("pagehide", salvar);
    };
  }, [ativo, iniciarWatch, pedirTela, salvar]);

  // Ao sair do app (logout), solta o GPS
  useEffect(
    () => () => {
      pararWatch();
      soltarTela();
    },
    [pararWatch, soltarTela],
  );

  const valor = useMemo(() => ({ ativo, painel, iniciar, resumo, encerrar }), [ativo, painel, iniciar, resumo, encerrar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
