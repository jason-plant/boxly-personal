/*
 * generate-icons.js
 *
 * Usage:
 * 1) Place your master (largest) PNG at: public/source/logo-master.png
 * 2) Install sharp: npm install --save-dev sharp
 * 3) Run: npm run generate-icons
 *
 * This script will create:
 * - public/icon-previews/{square-transparent.png, adaptive-foreground.png, adaptive-background.png, solid-dark.png}
 * - public/icons/{icon-16.png, icon-32.png, icon-192.png, icon-512.png, apple-touch-180.png}
 * - public/site.webmanifest
 *
 * Background color can be overridden by setting env var ICON_BG (hex, e.g., #333333)
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public", "source", "logo-master.png");
const PREVIEW_DIR = path.join(ROOT, "public", "icon-previews");
const ICONS_DIR = path.join(ROOT, "public", "icons");

const BG = process.env.ICON_BG || "#333333"; // dark grey default

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function run() {
  if (!fs.existsSync(SRC)) {
    console.error("Source image not found: public/source/logo-master.png");
    console.error("Please place your largest PNG at that path and re-run.");
    process.exit(1);
  }

  await ensureDir(PREVIEW_DIR);
  await ensureDir(ICONS_DIR);

  const img = sharp(SRC).rotate();
  const metadata = await img.metadata();
  const size = Math.min(metadata.width, metadata.height);

  // Center-crop square
  const square = img.clone().extract({
    left: Math.floor((metadata.width - size) / 2),
    top: Math.floor((metadata.height - size) / 2),
    width: size,
    height: size,
  });

  // 1) Square transparent preview (attempt trim to remove uniform background)
  try {
    await square
      .clone()
      .trim(10)
      .resize(512, 512, { fit: "contain" })
      .png({ quality: 90 })
      .toFile(path.join(PREVIEW_DIR, "square-transparent.png"));
  } catch (err) {
    // Fallback: just resize
    await square.clone().resize(512, 512).png().toFile(path.join(PREVIEW_DIR, "square-transparent.png"));
  }

  // 2) Adaptive foreground (transparent foreground, 432x432)
  try {
    await square
      .clone()
      .trim(10)
      .resize(432, 432, { fit: "contain" })
      .png({ quality: 90 })
      .toFile(path.join(PREVIEW_DIR, "adaptive-foreground.png"));
  } catch (err) {
    await square.clone().resize(432, 432).png().toFile(path.join(PREVIEW_DIR, "adaptive-foreground.png"));
  }

  // 3) Adaptive background (solid dark grey)
  const bgImage = sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: BG,
    },
  }).png();
  await bgImage.toFile(path.join(PREVIEW_DIR, "adaptive-background.png"));

  // 4) Solid-background thumbnail (192x192)
  await square
    .clone()
    .resize(192, 192, { fit: "contain", background: BG })
    .flatten({ background: BG })
    .png({ quality: 90 })
    .toFile(path.join(PREVIEW_DIR, "solid-dark.png"));

  // Generate common icons (from square crop)
  const iconSizes = {
    "icon-16.png": 16,
    "icon-32.png": 32,
    "icon-192.png": 192,
    "icon-512.png": 512,
    "apple-touch-180.png": 180,
  };

  for (const [name, s] of Object.entries(iconSizes)) {
    await square
      .clone()
      .resize(s, s, { fit: "contain", background: BG })
      .flatten({ background: BG })
      .png({ quality: 90 })
      .toFile(path.join(ICONS_DIR, name));
  }

  // Create site.webmanifest
  const manifest = {
    name: "Storage Inventory",
    short_name: "Storage",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    start_url: "/",
    display: "standalone",
    background_color: BG,
    theme_color: BG,
  };

  fs.writeFileSync(path.join(ROOT, "public", "site.webmanifest"), JSON.stringify(manifest, null, 2));

  // Create a simple preview HTML
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Icon Previews</title>
    <style>body{font-family: system-ui, sans-serif; padding:24px; background:#fafafa} .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px} .card{background:#fff;padding:16px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);text-align:center} img{max-width:100%;height:auto}</style>
  </head>
  <body>
    <h1>Icon Previews</h1>
    <p>Dark background color used: <code>${BG}</code></p>
    <div class="grid">
      <div class="card"><h3>Square (transparent)</h3><img src="/icon-previews/square-transparent.png" alt="square transparent"></div>
      <div class="card"><h3>Adaptive Foreground (transparent)</h3><img src="/icon-previews/adaptive-foreground.png" alt="adaptive foreground"></div>
      <div class="card"><h3>Adaptive Background</h3><img src="/icon-previews/adaptive-background.png" alt="adaptive background"></div>
      <div class="card"><h3>Solid thumbnail</h3><img src="/icon-previews/solid-dark.png" alt="solid dark"></div>
      <div class="card"><h3>Small Icon (16)</h3><img src="/icons/icon-16.png" alt="icon 16"></div>
      <div class="card"><h3>Icon (192)</h3><img src="/icons/icon-192.png" alt="icon 192"></div>
      <div class="card"><h3>Icon (512)</h3><img src="/icons/icon-512.png" alt="icon 512"></div>
    </div>
  </body>
</html>`;

  fs.writeFileSync(path.join(PREVIEW_DIR, "index.html"), html);

  console.log("Icons and previews generated in public/icon-previews/ and public/icons/");
  console.log("If you want a different background, run with ICON_BG=#234567 npm run generate-icons");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
