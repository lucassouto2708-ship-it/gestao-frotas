"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw, ScanLine, TriangleAlert } from "lucide-react";
import { MarcarArea } from "@/components/MarcarArea";
import { comprimirImagem } from "@/lib/imagem";
import { carregarImagem, lerArea, sugerirArea, type Area, type ModoLeitura } from "@/lib/ocr";
import type { Imagem } from "@/lib/lcd";

type Props = {
  rotulo: string;
  modo: ModoLeitura;
  /** Para o odômetro: km atual do carro (a leitura não pode ser menor). */
  referencia?: number;
  valor: string;
  onValor: (v: string) => void;
  onFoto: (foto: Blob | null) => void;
  fotoObrigatoria?: boolean;
  unidade: string;
};

const DICAS: Record<ModoLeitura, string> = {
  odometro: "Enquadre só os números do km total (ODO). Deixe de fora o km parcial (TRIP), a hora e a temperatura.",
  pneu: "Enquadre a tela do medidor ou só os números. O valor deve estar em mm.",
};

/** Área inicial do retângulo antes da sugestão automática: uma faixa no centro da foto. */
function areaPadrao(img: Imagem, modo: ModoLeitura): Area {
  const w = img.width * (modo === "pneu" ? 0.5 : 0.6), h = img.height * (modo === "pneu" ? 0.25 : 0.15);
  return { x: (img.width - w) / 2, y: (img.height - h) / 2, w, h };
}

/** Foto do mostrador: o usuário marca onde estão os números, o app lê e o usuário confere. */
export function FotoNumero({ rotulo, modo, referencia, valor, onValor, onFoto, fotoObrigatoria, unidade }: Props) {
  const id = useId();
  const campoRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imagem, setImagem] = useState<Imagem | null>(null);
  const [ultimaArea, setUltimaArea] = useState<Area | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [sugestao, setSugestao] = useState<Area | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher a mesma foto de novo
    if (arquivo) void processar(arquivo);
  }

  function aoSoltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const arquivo = e.dataTransfer.files?.[0];
    if (arquivo?.type.startsWith("image/")) void processar(arquivo);
  }

  async function processar(arquivo: File) {
    setAviso(null);
    setSugestao(null);
    setUltimaArea(null);
    const foto = await comprimirImagem(arquivo);
    setPreview(URL.createObjectURL(foto));
    onFoto(foto);
    const img = await carregarImagem(foto);
    setImagem(img);
    setMarcando(true);
    // Medidor de pneu: tenta achar a tela sozinho para já posicionar o retângulo
    if (modo === "pneu") {
      setProcurando(true);
      sugerirArea(img, modo)
        .then(setSugestao)
        .catch(() => null)
        .finally(() => setProcurando(false));
    }
  }

  async function ler(area: Area) {
    if (!imagem) return;
    setMarcando(false);
    setUltimaArea(area);
    setAviso(null);
    setLendo(true);
    try {
      const n = await lerArea(imagem, area, modo, referencia);
      if (n === null) {
        setAviso({ ok: false, texto: "Não foi possível ler os números. Ajuste a marcação ou digite o valor." });
      } else {
        onValor(modo === "pneu" ? n.toFixed(2).replace(".", ",") : String(n));
        setAviso({ ok: true, texto: "Valor lido da área marcada. Confira antes de salvar." });
      }
    } catch {
      setAviso({ ok: false, texto: "A leitura automática falhou. Digite o valor." });
    } finally {
      setLendo(false);
    }
  }

  function pular() {
    setMarcando(false);
    setTimeout(() => campoRef.current?.focus(), 50);
  }

  return (
    <div>
      <span className="rotulo">
        {rotulo}
        {fotoObrigatoria && <span className="text-perigo"> *</span>}
      </span>
      <div className="flex items-stretch gap-2">
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltar}
          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded border border-dashed p-2.5 transition-colors ${
            arrastando ? "border-primaria bg-primaria-suave" : "border-borda-forte bg-superficie-2 hover:border-primaria"
          }`}
        >
          {preview ? (
            <img src={preview} alt="Foto do mostrador" className="h-16 w-24 shrink-0 rounded-[3px] border border-borda object-cover" />
          ) : (
            <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-[3px] border border-borda bg-superficie text-texto-2">
              <Camera size={22} strokeWidth={1.5} />
            </span>
          )}
          <span className="min-w-0 text-[13px] leading-snug">
            {preview ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-primaria-texto">
                <RefreshCw size={13} /> Substituir foto
              </span>
            ) : (
              <>
                <span className="block font-medium">Fotografar o mostrador</span>
                <span className="block text-texto-2">ou arraste a imagem aqui · depois marque os números</span>
              </>
            )}
          </span>
        </label>
        {imagem && (
          <button type="button" className="botao-secundario h-auto shrink-0 flex-col gap-1 px-3 text-xs" onClick={() => setMarcando(true)}>
            <ScanLine size={16} /> Marcar
            <br />
            números
          </button>
        )}
      </div>
      <input id={id} type="file" accept="image/*" capture="environment" className="hidden" onChange={aoEscolher} />

      <div className="mt-2 flex items-center">
        <input
          ref={campoRef}
          className="campo rounded-r-none text-right font-semibold tabular-nums"
          inputMode={modo === "pneu" ? "decimal" : "numeric"}
          placeholder={modo === "pneu" ? "0,00" : "0"}
          value={valor}
          onChange={(e) => onValor(e.target.value)}
          required
        />
        <span className="flex h-9 items-center rounded-r border border-l-0 border-borda-forte bg-superficie-2 px-2.5 text-[12px] text-texto-2">
          {unidade}
        </span>
      </div>
      {lendo && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-primaria-texto">
          <Loader2 size={12} className="animate-spin" /> Lendo os números marcados…
        </p>
      )}
      {!lendo && aviso && (
        <p className={`mt-1 flex items-center gap-1.5 text-xs ${aviso.ok ? "text-sucesso" : "text-alerta"}`}>
          {aviso.ok ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />} {aviso.texto}
        </p>
      )}

      {marcando && preview && imagem && (
        <MarcarArea
          foto={preview}
          largura={imagem.width}
          altura={imagem.height}
          inicial={ultimaArea ?? areaPadrao(imagem, modo)}
          sugestao={ultimaArea ? null : sugestao}
          procurando={procurando}
          dica={DICAS[modo]}
          onLer={ler}
          onPular={pular}
          onFechar={() => setMarcando(false)}
        />
      )}
    </div>
  );
}

/** "4,5" -> 4.5 ; "45.230" (odômetro) -> 45230 */
export function paraNumero(texto: string, modo: ModoLeitura) {
  const limpo = modo === "pneu" ? texto.replace(",", ".") : texto.replace(/\D/g, "");
  const n = Number(limpo);
  return limpo === "" || Number.isNaN(n) ? null : n;
}
