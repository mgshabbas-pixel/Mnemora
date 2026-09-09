import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Standard Brand SVG (512x512)
const svgStandard = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="108" fill="#0C0D10"/>
  <!-- Outer glowing concentric track -->
  <circle cx="256" cy="256" r="180" stroke="#25272C" stroke-width="24" stroke-linecap="round"/>
  <!-- Green execution progress arc (~75%) -->
  <circle cx="256" cy="256" r="180" stroke="#16A34A" stroke-width="24" stroke-dasharray="848 1131" stroke-dashoffset="0" stroke-linecap="round"/>
  <!-- Inner focus target ring -->
  <circle cx="256" cy="256" r="110" stroke="#2E3036" stroke-width="12"/>
  <circle cx="256" cy="256" r="110" stroke="#EA580C" stroke-width="12" stroke-dasharray="240 691" stroke-dashoffset="-120" stroke-linecap="round"/>
  <!-- Central bullseye / focus dot -->
  <circle cx="256" cy="256" r="44" fill="#FFFFFF"/>
  <circle cx="256" cy="256" r="24" fill="#16A34A"/>
  <circle cx="256" cy="256" r="10" fill="#FFFFFF"/>
  <!-- Precision crosshairs -->
  <line x1="256" y1="96" x2="256" y2="124" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  <line x1="256" y1="388" x2="256" y2="416" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  <line x1="96" y1="256" x2="124" y2="256" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  <line x1="388" y1="256" x2="416" y2="256" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
</svg>
`.trim();

// 2. Maskable SVG (Full bleed square with logo strictly within the 80% safe zone: center 256, radius <= 180)
const svgMaskable = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Full bleed solid background for maskable -->
  <rect width="512" height="512" fill="#0C0D10"/>
  <!-- Scale inner artwork to fit safe zone: 80% radius is 204px -->
  <circle cx="256" cy="256" r="144" stroke="#25272C" stroke-width="20" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="144" stroke="#16A34A" stroke-width="20" stroke-dasharray="678 904" stroke-dashoffset="0" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="88" stroke="#2E3036" stroke-width="10"/>
  <circle cx="256" cy="256" r="88" stroke="#EA580C" stroke-width="10" stroke-dasharray="190 553" stroke-dashoffset="-90" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="36" fill="#FFFFFF"/>
  <circle cx="256" cy="256" r="20" fill="#16A34A"/>
  <circle cx="256" cy="256" r="8" fill="#FFFFFF"/>
  <line x1="256" y1="128" x2="256" y2="150" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  <line x1="256" y1="362" x2="256" y2="384" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  <line x1="128" y1="256" x2="150" y2="256" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  <line x1="362" y1="256" x2="384" y2="256" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
</svg>
`.trim();

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgStandard);

async function generatePngs() {
  const standardBuffer = Buffer.from(svgStandard);
  const maskableBuffer = Buffer.from(svgMaskable);

  // 192x192 PNG
  await sharp(standardBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 512x512 PNG
  await sharp(standardBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 180x180 Apple Touch Icon
  await sharp(standardBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 512x512 Maskable PNG
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 64x64 favicon
  await sharp(standardBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon-64x64.png'));
  console.log('Generated favicon-64x64.png');
}

generatePngs().catch(console.error);
