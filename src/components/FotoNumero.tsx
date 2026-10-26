"use client";

import { useEffect, useId, useState } from "react";
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
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setAviso(null);
    const foto = await comprimirImagem(arquivo);
    setPreview(URL.createObjectURL(foto));
    onFoto(foto);

    setLendo(true);
    try {
      const n = await lerNumero(foto, modo, referencia);
      if (n === null) {
        setAviso("Não consegui ler o número na foto. Digite o valor.");
      } else {
        onValor(modo === "pneu" ? n.toFixed(1) : String(n));
        setAviso("Valor lido da foto. Confira antes de salvar.");
      }
    } catch {
      setAviso("A leitura automática falhou. Digite o valor.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="rotulo">{rotulo}</span>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3 hover:border-marca"
      >
        {preview ? (
          <img src={preview} alt="Foto do mostrador" className="h-20 w-28 rounded object-cover" />
        ) : (
          <span className="flex h-20 w-28 items-center justify-center rounded bg-slate-200 text-3xl">📷</span>
        )}
        <span className="text-sm text-slate-600">
          {preview ? "Trocar foto" : "Tirar foto do mostrador"}
          {fotoObrigatoria && !preview && <span className="text-red-600"> *</span>}
        </span>
      </label>
      <input id={id} type="file" accept="image/*" capture="environment" className="hidden" onChange={aoEscolher} />

      <div className="flex items-center gap-2">
        <input
          className="campo"
          inputMode={modo === "pneu" ? "decimal" : "numeric"}
          placeholder={modo === "pneu" ? "Ex.: 4,5" : "Ex.: 45230"}
          value={valor}
          onChange={(e) => onValor(e.target.value)}
          required
        />
        <span className="text-sm text-slate-500">{unidade}</span>
      </div>
      {lendo && <p className="text-xs text-marca">Lendo números da foto…</p>}
      {!lendo && aviso && <p className="text-xs text-slate-500">{aviso}</p>}
    </div>
  );
}

/** "4,5" -> 4.5 ; "45.230" (odômetro) -> 45230 */
export function paraNumero(texto: string, modo: ModoLeitura) {
  const limpo = modo === "pneu" ? texto.replace(",", ".") : texto.replace(/\D/g, "");
  const n = Number(limpo);
  return limpo === "" || Number.isNaN(n) ? null : n;
}
