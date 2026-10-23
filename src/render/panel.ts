// The machine's backing plate: brushed steel with a bevel, vignette and corner rivets,
// painted once per size into a canvas that the board uses as a texture.
// A fixed seed keeps the brushing identical on every load.

export function drawPanel(width: number, height: number, resolution: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * resolution));
  canvas.height = Math.max(1, Math.round(height * resolution));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(resolution, resolution);

  const r = 20;
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, r);
  ctx.save();
  ctx.clip();

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#222a3a');
  base.addColorStop(1, '#141a25');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Brushing: many faint horizontal strokes, light and dark.
  const rand = mulberry32(7);
  const strokes = Math.round((width * height) / 260);
  for (let i = 0; i < strokes; i++) {
    const y = rand() * height;
    const x = rand() * width - 40;
    const len = 30 + rand() * 140;
    const light = rand() > 0.5;
    ctx.strokeStyle = light
      ? `rgba(255,255,255,${0.012 + rand() * 0.03})`
      : `rgba(0,0,0,${0.03 + rand() * 0.05})`;
    ctx.lineWidth = 0.6 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 0.6);
    ctx.stroke();
  }

  // A soft top light and a vignette toward the edges.
  const light = ctx.createRadialGradient(
    width * 0.5,
    -height * 0.1,
    0,
    width * 0.5,
    -height * 0.1,
    height * 0.9,
  );
  light.addColorStop(0, 'rgba(160,190,230,0.10)');
  light.addColorStop(1, 'rgba(160,190,230,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Bevel: a dark outer edge, a light inner lip along the top.
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, r);
  ctx.strokeStyle = '#2f384b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundRect(ctx, 2.5, 2.5, width - 5, height - 5, r - 2);
  const lip = ctx.createLinearGradient(0, 0, 0, height);
  lip.addColorStop(0, 'rgba(255,255,255,0.10)');
  lip.addColorStop(0.3, 'rgba(255,255,255,0)');
  ctx.strokeStyle = lip;
  ctx.lineWidth = 1;
  ctx.stroke();

  for (const [x, y] of [
    [14, 14],
    [width - 14, 14],
    [14, height - 14],
    [width - 14, height - 14],
  ] as const) {
    rivet(ctx, x, y);
  }
  return canvas;
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x + 0.8, y + 1, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  const g = ctx.createRadialGradient(x - 1.2, y - 1.2, 0, x, y, 4);
  g.addColorStop(0, '#c4cad6');
  g.addColorStop(0.6, '#6b7385');
  g.addColorStop(1, '#3a4152');
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
