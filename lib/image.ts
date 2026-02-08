/**
 * Client-side image compression utilities using `browser-image-compression`.
 * - Handles EXIF orientation and uses Web Workers for speed.
 * - Converts to WebP when supported for better size savings.
 *
 * IMPORTANT: This module avoids importing `browser-image-compression` at module
 * scope to remain safe during server-side builds. The library is dynamically
 * imported at runtime inside `compressImage` so it's only loaded in the browser.
 */

export async function supportsWebP() {
  if (typeof window === "undefined") return false;
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
  maxSizeMB?: number | null; // optional: max target size in MB (browser-image-compression uses this)
  maxUploadMB?: number | null; // hard cap size in MB (best-effort)
  aggressive?: boolean; // apply smaller dimensions and lower quality for tighter compression
};

async function canvasResize(file: File, maxWidthOrHeight: number, fileType: string, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
    });
    img.src = url;
    await loaded;

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const maxDim = Math.max(srcW, srcH) || 1;
    const scale = Math.min(1, maxWidthOrHeight / maxDim);
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
        fileType,
        quality
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("compressImage must be called in the browser");
  }

  const { maxSize = 1280, quality = 0.8, maxSizeMB = null, maxUploadMB = null, aggressive = false } = opts;
  const targetBytes = maxSizeMB ? maxSizeMB * 1024 * 1024 : null;
  const hardBytes = maxUploadMB ? maxUploadMB * 1024 * 1024 : null;

  const useWebP = opts.mimeType ? opts.mimeType === "image/webp" : await supportsWebP();
  const shouldConvert = aggressive || Boolean(maxUploadMB);
  const fileType = opts.mimeType
    || (useWebP ? "image/webp" : (shouldConvert ? "image/jpeg" : file.type || "image/jpeg"));

  const baseMaxSize = aggressive ? Math.min(maxSize, 1024) : maxSize;
  const baseQuality = aggressive ? Math.max(0.45, quality - 0.3) : quality;

  const options = {
    maxWidthOrHeight: baseMaxSize,
    initialQuality: baseQuality,
    fileType,
    useWebWorker: true,
    ...(maxSizeMB ? { maxSizeMB } : {}),
  };

  // Dynamically import the browser-only library at runtime (client only)
  const { default: imageCompression } = await import("browser-image-compression");

  const compressWithOptions = async (source: File, opts: any) => {
    try {
      return await imageCompression(source, opts);
    } catch (e) {
      const size = opts.maxWidthOrHeight ?? baseMaxSize;
      const q = opts.initialQuality ?? baseQuality;
      return await canvasResize(source, size, fileType, q);
    }
  };

  // browser-image-compression handles EXIF orientation and returns a File/Blob
  let compressed: Blob = await compressWithOptions(file, options as any);

  if (targetBytes && compressed.size > targetBytes) {
    const attempts = [
      { maxWidthOrHeight: Math.max(640, Math.round(baseMaxSize * 0.9)), initialQuality: Math.max(0.55, baseQuality - 0.1) },
      { maxWidthOrHeight: Math.max(640, Math.round(baseMaxSize * 0.8)), initialQuality: Math.max(0.45, baseQuality - 0.2) },
      { maxWidthOrHeight: Math.max(640, Math.round(baseMaxSize * 0.7)), initialQuality: Math.max(0.35, baseQuality - 0.3) },
    ];

    if (aggressive) {
      attempts.push(
        { maxWidthOrHeight: Math.max(512, Math.round(baseMaxSize * 0.6)), initialQuality: Math.max(0.3, baseQuality - 0.4) },
        { maxWidthOrHeight: Math.max(480, Math.round(baseMaxSize * 0.5)), initialQuality: Math.max(0.25, baseQuality - 0.5) },
      );
    }

    let best = compressed;
    for (const attempt of attempts) {
      const next = await compressWithOptions(file, { ...options, ...attempt } as any);
      if (next.size < best.size) best = next;
      if (next.size <= targetBytes) {
        compressed = next;
        break;
      }
    }

    if (best.size < compressed.size) {
      compressed = best;
    }
  }

  if (hardBytes && compressed.size > hardBytes) {
    const attempts = [
      { maxWidthOrHeight: Math.max(512, Math.round(baseMaxSize * 0.6)), initialQuality: Math.max(0.3, baseQuality - 0.4) },
      { maxWidthOrHeight: Math.max(480, Math.round(baseMaxSize * 0.5)), initialQuality: Math.max(0.25, baseQuality - 0.5) },
      { maxWidthOrHeight: Math.max(420, Math.round(baseMaxSize * 0.4)), initialQuality: Math.max(0.2, baseQuality - 0.6) },
    ];

    let best = compressed;
    for (const attempt of attempts) {
      const next = await compressWithOptions(file, { ...options, ...attempt } as any);
      if (next.size < best.size) best = next;
      if (next.size <= hardBytes) {
        compressed = next;
        break;
      }
    }

    if (best.size < compressed.size) {
      compressed = best;
    }

    if (compressed.size > hardBytes) {
      const finalAttempt = await compressWithOptions(file, {
        ...options,
        maxWidthOrHeight: 512,
        initialQuality: 0.2,
      } as any);
      if (finalAttempt.size < compressed.size) compressed = finalAttempt;
      if (compressed.size > hardBytes) {
        const forced = await canvasResize(file, 512, fileType, 0.2);
        if (forced.size < compressed.size) compressed = forced;
      }
    }
  }

  // If the library returned a File, return it directly
  if (compressed instanceof File) return compressed;

  // Otherwise wrap blob in a file with a sensible name
  const ext = fileType === "image/webp" ? "webp" : fileType.includes("png") ? "png" : "jpg";
  const newName = file.name.replace(/\.[^.]+$/, `.${ext}`);
  return new File([compressed], newName, { type: fileType });
}

