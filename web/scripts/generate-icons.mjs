#!/usr/bin/env node
/**
 * Генерация favicon-набора и OG-обложки из бренд-ассетов:
 *   app/icon.svg            → app/favicon.ico (32, валидный ICO с BMP-кадром)
 *                           → app/apple-icon.png (180)
 *                           → public/icons/icon-192.png, icon-512.png (manifest)
 *   public/media/hero/poster.jpg → public/og-cover.png (1200×630, cover-кроп)
 *
 * Артефакты коммитятся в репозиторий: npm run prepare:icons.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKGROUND = "#f3efe6";

/** SVG 120×138 → квадратный PNG-буфер со «песочной» подложкой. */
async function squareIcon(svg, size) {
  return sharp(svg, { density: 300 })
    .resize(size, size, { fit: "contain", background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
}

/**
 * Упаковка RGBA-пикселей в классический ICO (один 32-битный BMP-кадр):
 * ICONDIR + ICONDIRENTRY + BITMAPINFOHEADER + BGRA снизу-вверх + AND-маска.
 * sharp не пишет .ico — собираем контейнер вручную, формат тривиален.
 */
function packIco(rgba, size) {
  const xorSize = size * size * 4;
  const andRowBytes = Math.ceil(size / 32) * 4; // строки маски выровнены по 4 байта
  const andSize = andRowBytes * size;

  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header.writeUInt8(size < 256 ? size : 0, 6); // width
  header.writeUInt8(size < 256 ? size : 0, 7); // height
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(40 + xorSize + andSize, 14); // bytes in resource
  header.writeUInt32LE(22, 18); // offset

  const bih = Buffer.alloc(40);
  bih.writeUInt32LE(40, 0); // header size
  bih.writeInt32LE(size, 4); // width
  bih.writeInt32LE(size * 2, 8); // height: XOR + AND
  bih.writeUInt16LE(1, 12); // planes
  bih.writeUInt16LE(32, 14); // bpp
  bih.writeUInt32LE(0, 16); // BI_RGB
  bih.writeUInt32LE(xorSize + andSize, 20);

  const xor = Buffer.alloc(xorSize);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const src = (y * size + x) * 4;
      const dst = ((size - 1 - y) * size + x) * 4; // bottom-up
      xor[dst] = rgba[src + 2]; // B
      xor[dst + 1] = rgba[src + 1]; // G
      xor[dst + 2] = rgba[src]; // R
      xor[dst + 3] = rgba[src + 3]; // A
    }
  }
  const and = Buffer.alloc(andSize); // альфа уже в XOR — маска нулевая

  return Buffer.concat([header, bih, xor, and]);
}

async function main() {
  const svg = await readFile(join(root, "app/icon.svg"));
  await mkdir(join(root, "public/icons"), { recursive: true });

  // favicon.ico 32×32
  const { data } = await sharp(await squareIcon(svg, 32))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  await writeFile(join(root, "app/favicon.ico"), packIco(data, 32));

  // PNG-иконки
  await writeFile(join(root, "app/apple-icon.png"), await squareIcon(svg, 180));
  await writeFile(join(root, "public/icons/icon-192.png"), await squareIcon(svg, 192));
  await writeFile(join(root, "public/icons/icon-512.png"), await squareIcon(svg, 512));

  // OG-обложка 1200×630 из hero-постера
  const poster = join(root, "public/media/hero/poster.jpg");
  // palette-PNG: карточка в мессенджерах рендерится мелкой, а вес ~×5 меньше
  await sharp(poster)
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(join(root, "public/og-cover.png"));

  console.log("✓ app/favicon.ico, app/apple-icon.png, public/icons/{192,512}, public/og-cover.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
