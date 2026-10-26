import type { SupabaseClient } from "@supabase/supabase-js";

/** Reduz a foto da câmera (vários MB) para um JPEG leve antes do upload. */
export async function comprimirImagem(arquivo: File, maxLado = 1600, qualidade = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao processar a imagem"))), "image/jpeg", qualidade),
  );
}

/** Envia a foto para o bucket privado `fotos` e devolve o caminho salvo. */
export async function enviarFoto(supabase: SupabaseClient, userId: string, foto: Blob, prefixo: string) {
  const caminho = `${userId}/${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("fotos").upload(caminho, foto, { contentType: "image/jpeg" });
  if (error) throw new Error(`Erro ao enviar foto: ${error.message}`);
  return caminho;
}
