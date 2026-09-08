// Copies the repo's docs/img/*.png screenshots into site/public/screenshots/
// so they can be served as static assets at /screenshots/*.png.
// Runs before `dev` and `build` via npm hooks.

import { readdir, mkdir, copyFile, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "docs", "img");
const DEST = join(__dirname, "..", "public", "screenshots");

async function main() {
  try {
    await stat(SRC);
  } catch {
    console.warn(`[sync-images] source dir missing: ${SRC} — skipping.`);
    return;
  }
  await mkdir(DEST, { recursive: true });
  const existing = await readdir(DEST, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isFile() && /\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name)) {
      await unlink(join(DEST, entry.name));
    }
  }
  const entries = await readdir(SRC, { withFileTypes: true });
  let copied = 0;
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(e.name)) continue;
    await copyFile(join(SRC, e.name), join(DEST, e.name));
    if (/\.png$/i.test(e.name)) {
      const stem = e.name.replace(/\.png$/i, "");
      await sharp(join(SRC, e.name)).webp({ quality: 88 }).toFile(join(DEST, `${stem}.webp`));
      await sharp(join(SRC, e.name)).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 86 }).toFile(join(DEST, `${stem}-800.webp`));
    }
    copied++;
  }
  console.log(`[sync-images] copied ${copied} file(s) → ${DEST}`);
}

main().catch((err) => {
  console.error("[sync-images] failed:", err);
  process.exit(1);
});
