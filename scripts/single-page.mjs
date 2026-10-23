// Packs the `build:single` output into one self-contained HTML body for sharing as a page.
// Usage: node scripts/single-page.mjs <out.html>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'dist-single/assets/';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`Expected one script, found ${js.join(', ')}`);
const css = files
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(dir + f, 'utf8'))
  .join('\n');
const script = readFileSync(dir + js[0], 'utf8').replace(/<\/script/gi, '<\\/script');

const html = `<title>Chain Reaction Prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&family=Barlow+Condensed:wght@600;700&display=swap">
<style>${css}
/* Leave room for the page viewer's buttons on phones. */
@media (max-width: 600px) { .game, .select { padding-top: 64px; } }
</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
writeFileSync(process.argv[2], html);
console.log(`Wrote ${process.argv[2]} (${Math.round(html.length / 1024)} KB)`);
