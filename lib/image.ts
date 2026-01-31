/**
 * Client-side image compression utilities.
 * - No external dependencies.
 * - Converts to WebP when supported for better size savings.
 */

export async function supportsWebP() {
  if (!self.document) return false;
  try {
    const canvas = document.createElement("canvas");
    if (!canvas.getContext) return false;
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  } catch (e) {
    return false;
  }
}

export type CompressOptions = {
  maxSize?: number; // max width or height in px (default 1280)
  quality?: number; // 0-1 (default 0.8)
  mimeType?: string | null; // override mime type (if null, auto-detect)
};

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxSize = 1280, quality = 0.8 } = opts;

  const useWebP = opts.mimeType ? opts.mimeType === "image/webp" : await supportsWebP();
  const mime = opts.mimeType || (useWebP ? "image/webp" : "image/jpeg");

  // Load image into an Image element
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      resolve(i);
    };
    i.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    i.src = url;
  });

  let { width, height } = img;
  if (!width || !height) throw new Error("Image not loadable");

  // Calculate target size while preserving aspect ratio
  if (width > maxSize || height > maxSize) {
    const ratio = width / height;
    if (ratio > 1) {
      width = maxSize;
      height = Math.round(maxSize / ratio);
    } else {
      height = maxSize;
      width = Math.round(maxSize * ratio);
    }
  }

  // Draw into canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, mime, quality));
  if (!blob) throw new Error("Compression failed");

  const ext = mime === "image/webp" ? "webp" : "jpg";
  const newName = file.name.replace(/\.[^.]+$/, `.${ext}`);

  return new File([blob], newName, { type: mime });
}
