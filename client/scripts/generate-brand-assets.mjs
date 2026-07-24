/**
 * Rasterize Strideto SVG brand marks into favicons, PWA icons, OG/email assets.
 * Run: node scripts/generate-brand-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const brandingDir = path.join(publicDir, 'branding');
const iconsDir = path.join(publicDir, 'icons');

const symbolSvg = fs.readFileSync(path.join(brandingDir, 'logo-symbol.svg'));
const logoSvg = fs.readFileSync(path.join(brandingDir, 'logo.svg'));
const logoLightSvg = fs.readFileSync(path.join(brandingDir, 'logo-light.svg'));

async function pngFromSvg(svgBuffer, size, outPath) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log('wrote', path.relative(publicDir, outPath));
}

async function ogImage(outPath, { width = 1200, height = 630, dark = false } = {}) {
  const bg = dark ? '#0F172A' : '#F8FAFC';
  const accent = '#2563EB';
  const mark = await sharp(symbolSvg, { density: 384 }).resize(160, 160).png().toBuffer();
  const word = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="80">
      <text x="0" y="58" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="${dark ? '#F8FAFC' : '#0F172A'}">Strideto</text>
    </svg>`
  );
  const tag = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="48">
      <text x="0" y="32" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="${dark ? '#94A3B8' : '#64748B'}">Every Step Toward Success.</text>
    </svg>`
  );
  const wordPng = await sharp(word).png().toBuffer();
  const tagPng = await sharp(tag).png().toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: bg,
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <rect x="0" y="0" width="12" height="${height}" fill="${accent}"/>
            <rect x="0" y="${height - 8}" width="${width}" height="8" fill="#F97316"/>
          </svg>`
        ),
        top: 0,
        left: 0,
      },
      { input: mark, top: Math.round(height / 2 - 120), left: 80 },
      { input: wordPng, top: Math.round(height / 2 - 40), left: 280 },
      { input: tagPng, top: Math.round(height / 2 + 40), left: 280 },
    ])
    .png()
    .toFile(outPath);
  console.log('wrote', path.relative(publicDir, outPath));
}

async function emailHeader(outPath) {
  const width = 600;
  const height = 120;
  const mark = await sharp(symbolSvg, { density: 384 }).resize(72, 72).png().toBuffer();
  const word = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="48">
        <text x="0" y="36" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#0F172A">Strideto</text>
      </svg>`
    )
  )
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#FFFFFF',
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <rect width="${width}" height="${height}" fill="#FFFFFF"/>
            <rect y="${height - 4}" width="${width}" height="4" fill="#2563EB"/>
          </svg>`
        ),
        top: 0,
        left: 0,
      },
      { input: mark, top: 24, left: 28 },
      { input: word, top: 40, left: 116 },
    ])
    .png()
    .toFile(outPath);
  console.log('wrote', path.relative(publicDir, outPath));
}

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true });

  await pngFromSvg(symbolSvg, 16, path.join(publicDir, 'favicon-16.png'));
  await pngFromSvg(symbolSvg, 32, path.join(publicDir, 'favicon-32.png'));
  await pngFromSvg(symbolSvg, 48, path.join(iconsDir, 'icon-48.png'));
  await pngFromSvg(symbolSvg, 180, path.join(publicDir, 'apple-touch-icon.png'));
  await pngFromSvg(symbolSvg, 192, path.join(iconsDir, 'icon-192.png'));
  await pngFromSvg(symbolSvg, 512, path.join(iconsDir, 'icon-512.png'));
  await pngFromSvg(symbolSvg, 1024, path.join(brandingDir, 'app-icon-source.png'));

  const icoBuf = await toIco([
    await sharp(symbolSvg, { density: 384 }).resize(16, 16).png().toBuffer(),
    await sharp(symbolSvg, { density: 384 }).resize(32, 32).png().toBuffer(),
    await sharp(symbolSvg, { density: 384 }).resize(48, 48).png().toBuffer(),
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);
  console.log('wrote favicon.ico');

  await ogImage(path.join(brandingDir, 'og-image.png'));
  await ogImage(path.join(publicDir, 'og-image.png'));
  await ogImage(path.join(brandingDir, 'twitter-image.png'));
  await ogImage(path.join(brandingDir, 'social-share.png'));
  await ogImage(path.join(brandingDir, 'feature-image.png'));
  await ogImage(path.join(brandingDir, 'pwa-splash.png'), { width: 1280, height: 720 });
  await emailHeader(path.join(brandingDir, 'email-header.png'));

  // Social / email SVG companions
  fs.writeFileSync(path.join(brandingDir, 'social-logo.svg'), logoSvg);
  fs.writeFileSync(path.join(brandingDir, 'email-logo.svg'), logoSvg);
  fs.writeFileSync(path.join(brandingDir, 'og-logo.svg'), logoLightSvg);
  console.log('wrote social-logo.svg, email-logo.svg, og-logo.svg');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
