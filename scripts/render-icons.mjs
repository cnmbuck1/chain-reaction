// Renders the app icon and splash sources in assets-src/ to the PNGs in assets/, which
// `npx @capacitor/assets generate` turns into every iPhone and Android size.
//   node scripts/render-icons.mjs && npx @capacitor/assets generate --iconBackgroundColor '#0f131b' --splashBackgroundColor '#0f131b'
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const jobs = [
  ['icon.svg', 'icon-only.png', 1024, false],
  ['icon-foreground.svg', 'icon-foreground.png', 1024, true],
  ['icon-background.svg', 'icon-background.png', 1024, false],
  ['splash.svg', 'splash.png', 2732, false],
  ['splash.svg', 'splash-dark.png', 2732, false],
];

const browser = await chromium.launch();
for (const [src, out, size, transparent] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = readFileSync(new URL(`../assets-src/${src}`, import.meta.url), 'utf8');
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`);
  await page.screenshot({ path: `assets/${out}`, omitBackground: transparent });
  await page.close();
}
await browser.close();
