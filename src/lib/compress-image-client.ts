/**
 * Reduz qualidade e, se preciso, dimensões até caber em maxBytes (JPEG).
 * Tudo no navegador — sem enviar o arquivo para API externa.
 */
export async function compressImageFileToMaxBytes(file: File, maxBytes: number): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Não foi possível abrir esta imagem no navegador. Tente JPG ou PNG, ou outro arquivo.",
    );
  }

  const w0 = bitmap.width;
  const h0 = bitmap.height;
  if (w0 < 1 || h0 < 1) {
    bitmap.close();
    throw new Error("Imagem inválida.");
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Seu navegador não permite comprimir imagens aqui.");
  }

  const outputFormat = file.type === "image/png" ? "image/png" : "image/jpeg";

  const encode = (width: number, height: number, quality: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(bitmap, 0, 0, width, height);
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Falha ao gerar a versão menor da imagem."));
        },
        outputFormat,
        quality,
      );
    });

  let scale = 1;
  try {
    for (let round = 0; round < 28; round++) {
      const width = Math.max(1, Math.round(w0 * scale));
      const height = Math.max(1, Math.round(h0 * scale));

      for (let q = 0.92; q >= 0.42; q -= 0.06) {
        const blob = await encode(width, height, q);
        if (blob.size <= maxBytes) return blob;
      }

      scale *= 0.82;
      if (width <= 400 && height <= 400) break;
    }
  } finally {
    bitmap.close();
  }

  throw new Error(
    "Mesmo comprimindo, a imagem continua grande demais. Tente uma foto com menos detalhes ou menor resolução.",
  );
}
