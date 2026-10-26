"use client";

import { useEffect, useId, useState } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { comprimirImagem } from "@/lib/imagem";
import { lerNumero, type ModoLeitura } from "@/lib/ocr";

type Props = {
  rotulo: string;
  modo: ModoLeitura;
  /** Para o odômetro: km atual do carro, ajuda a escolher o número certo da foto. */
  referencia?: number;
  valor: string;
  onValor: (v: string) => void;
  onFoto: (foto: Blob | null) => void;
  fotoObrigatoria?: boolean;
  unidade: string;
};

/** Tira/escolhe a foto do mostrador, tenta ler o número (OCR) e deixa o usuário conferir. */
export function FotoNumero({ rotulo, modo, referencia, valor, onValor, onFoto, fotoObrigatoria, unidade }: Props) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
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
    const foto = await comprimirImagem(arquivo);
    setPreview(URL.createObjectURL(foto));
    onFoto(foto);

    setLendo(true);
    try {
      const n = await lerNumero(foto, modo, referencia);
      if (n === null) {
        setAviso({ ok: false, texto: "Não foi possível ler o número na foto. Informe o valor manualmente." });
      } else {
        onValor(modo === "pneu" ? n.toFixed(1) : String(n));
        setAviso({ ok: true, texto: "Valor lido da foto. Confira antes de salvar." });
      }
    } catch {
      setAviso({ ok: false, texto: "A leitura automática falhou. Informe o valor manualmente." });
    } finally {
      setLendo(false);
    }
  }

  return (
    <div>
      <span className="rotulo">
        {rotulo}
        {fotoObrigatoria && <span className="text-perigo"> *</span>}
      </span>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={`flex cursor-pointer items-center gap-3 rounded border border-dashed p-2.5 transition-colors ${
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
              <span className="block text-texto-2">ou arraste a imagem aqui · JPG, PNG</span>
            </>
          )}
        </span>
      </label>
      <input id={id} type="file" accept="image/*" capture="environment" className="hidden" onChange={aoEscolher} />

      <div className="mt-2 flex items-center">
        <input
          className="campo rounded-r-none text-right font-semibold tabular-nums"
          inputMode={modo === "pneu" ? "decimal" : "numeric"}
          placeholder={modo === "pneu" ? "0,0" : "0"}
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
          <Loader2 size={12} className="animate-spin" /> Lendo números da foto…
        </p>
      )}
      {!lendo && aviso && (
        <p className={`mt-1 flex items-center gap-1.5 text-xs ${aviso.ok ? "text-sucesso" : "text-alerta"}`}>
          {aviso.ok ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />} {aviso.texto}
        </p>
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
