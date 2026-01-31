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
};

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("compressImage must be called in the browser");
  }

  const { maxSize = 1280, quality = 0.8, maxSizeMB = null } = opts;

  const useWebP = opts.mimeType ? opts.mimeType === "image/webp" : await supportsWebP();
  const fileType = opts.mimeType || (useWebP ? "image/webp" : file.type || "image/jpeg");

  const options = {
    maxWidthOrHeight: maxSize,
    initialQuality: quality,
    fileType,
    useWebWorker: true,
    ...(maxSizeMB ? { maxSizeMB } : {}),
  };

  // Dynamically import the browser-only library at runtime (client only)
  const { default: imageCompression } = await import("browser-image-compression");

  // browser-image-compression handles EXIF orientation and returns a File/Blob
  const compressed: Blob = await imageCompression(file, options as any);

  // If the library returned a File, return it directly
  if (compressed instanceof File) return compressed;

  // Otherwise wrap blob in a file with a sensible name
  const ext = fileType === "image/webp" ? "webp" : fileType.includes("png") ? "png" : "jpg";
  const newName = file.name.replace(/\.[^.]+$/, `.${ext}`);
  return new File([compressed], newName, { type: fileType });
}

