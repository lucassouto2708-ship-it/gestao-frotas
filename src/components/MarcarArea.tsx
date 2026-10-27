"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Loader2, ScanLine, X } from "lucide-react";
import type { Area } from "@/lib/ocr";

type Props = {
  foto: string;
  largura: number;
  altura: number;
  inicial: Area;
  /** Sugestão automática que pode chegar depois de aberto (só aplicada se o usuário ainda não mexeu). */
  sugestao?: Area | null;
  procurando?: boolean;
  dica: string;
  onLer: (area: Area) => void;
  onPular: () => void;
  onFechar: () => void;
};

type Alca = "nw" | "ne" | "sw" | "se";
type Gesto = { modo: "mover" | "novo" | Alca; x0: number; y0: number; area0: Area } | null;

const MIN = 16;

/** Tela cheia com a foto e um retângulo ajustável para marcar onde estão os números. */
export function MarcarArea({ foto, largura, altura, inicial, sugestao, procurando, dica, onLer, onPular, onFechar }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [escala, setEscala] = useState(1);
  const [area, setArea] = useState<Area>(inicial);
  const [mexeu, setMexeu] = useState(false);
  const gesto = useRef<Gesto>(null);

  const medir = useCallback(() => {
    if (imgRef.current?.clientWidth) setEscala(imgRef.current.clientWidth / largura);
  }, [largura]);

  useEffect(() => {
    window.addEventListener("resize", medir);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", medir);
      document.body.style.overflow = anterior;
    };
  }, [medir]);

  useEffect(() => {
    if (sugestao && !mexeu) setArea(sugestao);
  }, [sugestao, mexeu]);

  const paraImagem = (e: React.PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / escala, y: (e.clientY - r.top) / escala };
  };

  const limitar = (a: Area): Area => {
    const w = Math.max(MIN, Math.min(a.w, largura)), h = Math.max(MIN, Math.min(a.h, altura));
    return { x: Math.max(0, Math.min(a.x, largura - w)), y: Math.max(0, Math.min(a.y, altura - h)), w, h };
  };

  function iniciar(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = paraImagem(e);
    const alca = (e.target as HTMLElement).dataset.alca as Alca | undefined;
    const dentro = p.x >= area.x && p.x <= area.x + area.w && p.y >= area.y && p.y <= area.y + area.h;
    gesto.current = { modo: alca ?? (dentro ? "mover" : "novo"), x0: p.x, y0: p.y, area0: area };
    setMexeu(true);
  }

  function mover(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g) return;
    const p = paraImagem(e);
    const dx = p.x - g.x0, dy = p.y - g.y0, a = g.area0;
    if (g.modo === "mover") return setArea(limitar({ ...a, x: a.x + dx, y: a.y + dy }));
    if (g.modo === "novo")
      return setArea(limitar({ x: Math.min(g.x0, p.x), y: Math.min(g.y0, p.y), w: Math.abs(dx), h: Math.abs(dy) }));
    // Redimensionar por um canto: o canto oposto fica fixo
    const x1 = a.x + a.w, y1 = a.y + a.h;
    let nx0 = a.x, ny0 = a.y, nx1 = x1, ny1 = y1;
    if (g.modo.includes("w")) nx0 = Math.min(a.x + dx, x1 - MIN);
    if (g.modo.includes("e")) nx1 = Math.max(x1 + dx, a.x + MIN);
    if (g.modo.includes("n")) ny0 = Math.min(a.y + dy, y1 - MIN);
    if (g.modo.includes("s")) ny1 = Math.max(y1 + dy, a.y + MIN);
    setArea(limitar({ x: nx0, y: ny0, w: nx1 - nx0, h: ny1 - ny0 }));
  }

  const r = { left: area.x * escala, top: area.y * escala, width: area.w * escala, height: area.h * escala };
  const alca = (pos: Alca, cls: string) => (
    <span
      data-alca={pos}
      className={`absolute h-7 w-7 ${cls} flex items-center justify-center`}
      style={{ touchAction: "none" }}
    >
      <span data-alca={pos} className="pointer-events-none h-3.5 w-3.5 rounded-[2px] border-2 border-white bg-primaria" />
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f141a] text-white" role="dialog" aria-modal="true" aria-label="Marcar área da leitura">
      <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <ScanLine size={20} className="mt-0.5 shrink-0 text-[#7fa9e0]" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">Marque onde estão os números</p>
          <p className="text-[12.5px] text-white/70">{dica}</p>
        </div>
        <button onClick={onFechar} className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <div
          className="relative touch-none select-none"
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={() => (gesto.current = null)}
          onPointerCancel={() => (gesto.current = null)}
        >
          <img
            ref={imgRef}
            src={foto}
            alt="Foto para marcar"
            onLoad={medir}
            draggable={false}
            className="block max-h-[calc(100dvh-170px)] max-w-full"
          />
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={r}
            >
              <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-white/40" />
              {alca("nw", "-top-3.5 -left-3.5 cursor-nwse-resize")}
              {alca("ne", "-top-3.5 -right-3.5 cursor-nesw-resize")}
              {alca("sw", "-bottom-3.5 -left-3.5 cursor-nesw-resize")}
              {alca("se", "-right-3.5 -bottom-3.5 cursor-nwse-resize")}
            </div>
          </div>
          {procurando && !mexeu && (
            <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-[3px] bg-black/70 px-2 py-1 text-xs">
              <Loader2 size={12} className="animate-spin" /> Procurando a tela…
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
        <p className="mr-auto hidden text-xs text-white/60 sm:block">Arraste o retângulo, puxe os cantos ou desenhe um novo sobre a foto.</p>
        <button
          onClick={onPular}
          className="inline-flex h-10 items-center gap-2 rounded border border-white/30 px-4 text-[13px] font-semibold hover:bg-white/10"
        >
          <Keyboard size={15} /> Pular e digitar
        </button>
        <button
          onClick={() => onLer(area)}
          className="inline-flex h-10 items-center gap-2 rounded bg-primaria px-5 text-[13px] font-semibold hover:bg-primaria-hover"
        >
          <ScanLine size={15} /> Ler área marcada
        </button>
      </div>
    </div>
  );
}
